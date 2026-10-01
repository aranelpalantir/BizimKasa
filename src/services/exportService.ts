import { db } from '../db/db';
import { forceResetWithDummyData } from '../db/seed';

export interface BizimKasaBackup {
  version: number;
  exportDate: string;
  app: 'BizimKasa';
  groups: any[];
  accounts: any[];
  cashFlowEntries: any[];
  transactions: any[];
  marketRates: any[];
  investmentPlans: any[];
  settings: any[];
}

export async function exportDatabaseToJSON(): Promise<void> {
  const groups = await db.groups.toArray();
  const accounts = await db.accounts.toArray();
  const cashFlowEntries = await db.cashFlowEntries.toArray();
  const transactions = await db.transactions.toArray();
  const marketRates = await db.marketRates.toArray();
  const investmentPlans = await db.investmentPlans.toArray();
  const settings = await db.settings.toArray();

  const backupData: BizimKasaBackup = {
    version: 1,
    exportDate: new Date().toISOString(),
    app: 'BizimKasa',
    groups,
    accounts,
    cashFlowEntries,
    transactions,
    marketRates,
    investmentPlans,
    settings
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const dateStr = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `bizimkasa-yedek-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importDatabaseFromJSON(file: File): Promise<{ success: boolean; message: string }> {
  try {
    const text = await file.text();
    const data: BizimKasaBackup = JSON.parse(text);

    if (data.app !== 'BizimKasa' || !Array.isArray(data.groups) || !Array.isArray(data.accounts)) {
      return { success: false, message: 'Geçersiz yedek dosyası formatı! BizimKasa yedeği seçiniz.' };
    }

    // Atomic replacement inside Dexie transaction
    await db.transaction('rw', [
      db.groups,
      db.accounts,
      db.cashFlowEntries,
      db.transactions,
      db.marketRates,
      db.investmentPlans,
      db.settings
    ], async () => {
      await db.groups.clear();
      await db.accounts.clear();
      await db.cashFlowEntries.clear();
      await db.transactions.clear();
      await db.marketRates.clear();
      await db.investmentPlans.clear();
      await db.settings.clear();

      if (data.groups.length > 0) await db.groups.bulkAdd(data.groups);
      if (data.accounts.length > 0) await db.accounts.bulkAdd(data.accounts);
      if (data.cashFlowEntries?.length > 0) await db.cashFlowEntries.bulkAdd(data.cashFlowEntries);
      if (data.transactions?.length > 0) await db.transactions.bulkAdd(data.transactions);
      if (data.marketRates?.length > 0) await db.marketRates.bulkAdd(data.marketRates);
      if (data.investmentPlans?.length > 0) await db.investmentPlans.bulkAdd(data.investmentPlans);
      if (data.settings?.length > 0) await db.settings.bulkAdd(data.settings);
    });

    return { success: true, message: 'Yedek başarıyla geri yüklendi!' };
  } catch (err: any) {
    console.error('Import error:', err);
    return { success: false, message: `Geri yükleme başarısız: ${err?.message || 'Bilinmeyen hata'}` };
  }
}

export async function resetToSampleData(): Promise<void> {
  await forceResetWithDummyData();
  await db.settings.put({ key: 'dummyDataVersion', value: 3 });
}
