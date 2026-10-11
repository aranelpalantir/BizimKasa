import Dexie, { type Table } from 'dexie';
import type { 
  Group, 
  Account, 
  CashFlowEntry, 
  AssetTransaction, 
  MarketRate, 
  MonthlyInvestmentPlan 
} from '../types/finance';

export interface SettingRecord {
  key: string;
  value: any;
}

let isTrackingSuppressed = false;

export function setSuppressModificationTracking(suppress: boolean) {
  isTrackingSuppressed = suppress;
}

export type DatabaseModificationListener = (iso: string) => void;
const modificationListeners: Set<DatabaseModificationListener> = new Set();

export function onDatabaseModified(listener: DatabaseModificationListener): () => void {
  modificationListeners.add(listener);
  return () => {
    modificationListeners.delete(listener);
  };
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function touchLastModified(explicitDate?: string): void {
  if (isTrackingSuppressed) return;
  const iso = explicitDate || new Date().toISOString();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      await db.settings.put({ key: 'lastModifiedAt', value: iso });
      modificationListeners.forEach(listener => {
        try {
          listener(iso);
        } catch (err) {
          console.warn('Modification listener error:', err);
        }
      });
    } catch (e) {
      console.warn('Failed to update lastModifiedAt:', e);
    }
  }, 100);
}

export interface DeletedRecord {
  id: string; // composite key: `${tableName}:${recordId}`
  recordId: string;
  tableName: string;
  deletedAt: string;
}

export class BizimKasaDatabase extends Dexie {
  groups!: Table<Group, string>;
  accounts!: Table<Account, string>;
  cashFlowEntries!: Table<CashFlowEntry, string>;
  transactions!: Table<AssetTransaction, string>;
  marketRates!: Table<MarketRate, string>;
  investmentPlans!: Table<MonthlyInvestmentPlan, string>;
  settings!: Table<SettingRecord, string>;
  deletedRecords!: Table<DeletedRecord, string>;

  constructor() {
    super('BizimKasaDB');
    
    this.version(2).stores({
      groups: 'id, order, name',
      accounts: 'id, groupId, type, subType, symbol, order',
      cashFlowEntries: 'id, accountId, year, month, [year+month], [accountId+year+month]',
      transactions: 'id, accountId, groupId, date, year, month, type, [accountId+year+month]',
      marketRates: 'symbol, category',
      rateHistory: 'id, symbol, date, [symbol+date]',
      investmentPlans: 'id, [year+month], year, month',
      settings: 'key'
    });

    this.version(3).stores({
      rateHistory: null
    });

    this.version(4).stores({
      deletedRecords: 'id, recordId, tableName, deletedAt'
    });

    this.setupModificationHooks();
  }

  private setupModificationHooks() {
    const userTableNames = [
      'groups',
      'accounts',
      'cashFlowEntries',
      'transactions',
      'investmentPlans'
    ];

    const attachHooks = (tableName: string, table: Table<any, any>) => {
      const changeHandler = () => {
        if (isTrackingSuppressed) return;
        touchLastModified();
      };

      table.hook('creating', changeHandler);
      table.hook('updating', changeHandler);
      table.hook('deleting', (primKey, _obj, transaction) => {
        if (isTrackingSuppressed) return;
        const idStr = String(primKey);
        const iso = new Date().toISOString();
        try {
          transaction.table('deletedRecords').put({
            id: `${tableName}:${idStr}`,
            recordId: idStr,
            tableName,
            deletedAt: iso
          });
        } catch (e) {
          console.warn('Failed to record deletion tombstone:', e);
        }
        touchLastModified(iso);
      });
    };

    for (const name of userTableNames) {
      const table = this.table(name);
      if (table) {
        attachHooks(name, table);
      }
    }
  }
}

export async function cleanupExpiredTombstones(daysOld = 30): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
    await db.deletedRecords.where('deletedAt').below(cutoff).delete();
  } catch (err) {
    console.warn('Tombstone cleanup error:', err);
  }
}

export const db = new BizimKasaDatabase();

/**
 * Mevcut son değişiklik zamanını getirir.
 * Eğer henüz ayarlanmamışsa mevcut veritabanı kayıtlarının (işlemler, hesaplar, bütçe vb.)
 * en güncel tarihini hesaplayıp kaydeder.
 */
export async function getLastModifiedTimestamp(): Promise<string> {
  try {
    const record = await db.settings.get('lastModifiedAt');
    if (record && record.value && typeof record.value === 'string') {
      return record.value;
    }

    // Fallback: Mevcut kayıtlar arasından en yenisini bul
    let latestMs = 0;

    const [txs, entries, accs, grps, plans] = await Promise.all([
      db.transactions.toArray().catch(() => []),
      db.cashFlowEntries.toArray().catch(() => []),
      db.accounts.toArray().catch(() => []),
      db.groups.toArray().catch(() => []),
      db.investmentPlans.toArray().catch(() => [])
    ]);

    for (const t of txs) {
      if (t.createdAt) {
        const ms = new Date(t.createdAt).getTime();
        if (!isNaN(ms) && ms > latestMs) latestMs = ms;
      }
    }

    for (const e of entries) {
      if (e.updatedAt) {
        const ms = new Date(e.updatedAt).getTime();
        if (!isNaN(ms) && ms > latestMs) latestMs = ms;
      }
    }

    for (const a of accs) {
      if (a.createdAt) {
        const ms = new Date(a.createdAt).getTime();
        if (!isNaN(ms) && ms > latestMs) latestMs = ms;
      }
    }

    for (const g of grps) {
      if (g.createdAt) {
        const ms = new Date(g.createdAt).getTime();
        if (!isNaN(ms) && ms > latestMs) latestMs = ms;
      }
    }

    for (const p of plans) {
      if (p.updatedAt) {
        const ms = new Date(p.updatedAt).getTime();
        if (!isNaN(ms) && ms > latestMs) latestMs = ms;
      }
    }

    const calculated = latestMs > 0 ? new Date(latestMs).toISOString() : new Date().toISOString();
    await db.settings.put({ key: 'lastModifiedAt', value: calculated });
    return calculated;
  } catch (err) {
    console.warn('Error reading or initializing lastModifiedAt:', err);
    return new Date().toISOString();
  }
}
