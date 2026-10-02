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

export class BizimKasaDatabase extends Dexie {
  groups!: Table<Group, string>;
  accounts!: Table<Account, string>;
  cashFlowEntries!: Table<CashFlowEntry, string>;
  transactions!: Table<AssetTransaction, string>;
  marketRates!: Table<MarketRate, string>;
  investmentPlans!: Table<MonthlyInvestmentPlan, string>;
  settings!: Table<SettingRecord, string>;

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
  }
}

export const db = new BizimKasaDatabase();
