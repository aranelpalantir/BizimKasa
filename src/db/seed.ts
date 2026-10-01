import { db } from './db';
import type { 
  Group, 
  Account, 
  CashFlowEntry, 
  AssetTransaction, 
  MarketRate, 
  AppSettings 
} from '../types/finance';

export const INITIAL_RATES: MarketRate[] = [
  { symbol: 'USD', name: 'Amerikan Doları', category: 'CURRENCY', rateTRY: 49.03, changeDailyPct: 0.15, updatedAt: new Date().toISOString(), isManualOverride: false },
  { symbol: 'EUR', name: 'Euro', category: 'CURRENCY', rateTRY: 55.24, changeDailyPct: 0.22, updatedAt: new Date().toISOString(), isManualOverride: false },
  { symbol: 'XAU_GR', name: 'Gram Altın', category: 'GOLD', rateTRY: 6561.65, changeDailyPct: 0.38, updatedAt: new Date().toISOString(), isManualOverride: false },
  { symbol: 'XAU_CEYREK', name: 'Çeyrek Altın', category: 'GOLD', rateTRY: 10738.00, changeDailyPct: 0.35, updatedAt: new Date().toISOString(), isManualOverride: false },
  { symbol: 'XAU_ONS', name: 'Ons Altın ($)', category: 'GOLD', rateTRY: 4174.07, changeDailyPct: 0.45, updatedAt: new Date().toISOString(), isManualOverride: false },
  { symbol: 'XAG', name: 'Gümüş (Gram)', category: 'COMMODITY', rateTRY: 95.71, changeDailyPct: 0.80, updatedAt: new Date().toISOString(), isManualOverride: false },
  { symbol: 'XU100', name: 'BIST 100', category: 'INDEX', rateTRY: 12249.04, changeDailyPct: 1.20, updatedAt: new Date().toISOString(), isManualOverride: false },
  { symbol: 'NASDAQ100', name: 'Nasdaq 100', category: 'INDEX', rateTRY: 30366.11, changeDailyPct: 0.65, updatedAt: new Date().toISOString(), isManualOverride: false },
  { symbol: 'TTE', name: 'İş Portföy BIST Teknoloji', category: 'FUND', rateTRY: 12.2328, changeDailyPct: 1.45, updatedAt: new Date().toISOString(), isManualOverride: false },
  { symbol: 'GSP', name: 'Garanti Portföy S&P 500', category: 'FUND', rateTRY: 28.6471, changeDailyPct: 0.85, updatedAt: new Date().toISOString(), isManualOverride: false },
  { symbol: 'DVT', name: 'Deniz Portföy Dijital Tek.', category: 'FUND', rateTRY: 20.1421, changeDailyPct: 2.10, updatedAt: new Date().toISOString(), isManualOverride: false },
];

export async function seedInitialDataIfNeeded() {
  const groupCount = await db.groups.count();
  if (groupCount > 0) {
    return; // Already initialized
  }

  // 1. Initial Groups
  const groups: Group[] = [
    { id: 'group-mert', name: 'Mert', color: '#3b82f6', order: 1, createdAt: new Date().toISOString() },
    { id: 'group-aylin', name: 'Aylin', color: '#a855f7', order: 2, createdAt: new Date().toISOString() },
    { id: 'group-cocuk', name: 'Çocuk', color: '#f59e0b', order: 3, createdAt: new Date().toISOString() },
    { id: 'group-ortak', name: 'Ortak & Birikim', color: '#10b981', order: 4, createdAt: new Date().toISOString() },
  ];
  await db.groups.bulkAdd(groups);

  // 2. Initial Accounts / Categories
  const accounts: Account[] = [
    // Aylin Giderleri (Kredi Kartları & Sabit)
    { id: 'acc-aylin-vakif', groupId: 'group-aylin', name: 'Aylin Vakıf', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'Vakıfbank', currency: 'TRY', order: 1, createdAt: new Date().toISOString() },
    { id: 'acc-aylin-halk', groupId: 'group-aylin', name: 'Aylin Halk', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'Halkbank', currency: 'TRY', order: 2, createdAt: new Date().toISOString() },
    { id: 'acc-aylin-ziraat', groupId: 'group-aylin', name: 'Aylin Ziraat', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'Ziraat', currency: 'TRY', order: 3, createdAt: new Date().toISOString() },
    { id: 'acc-aylin-diger', groupId: 'group-aylin', name: 'Diğer', type: 'EXPENSE', subType: 'OTHER', currency: 'TRY', order: 4, createdAt: new Date().toISOString() },
    // Aylin Gelirleri
    { id: 'acc-aylin-maas', groupId: 'group-aylin', name: 'Aylin Maaş', type: 'INCOME', subType: 'CASH', currency: 'TRY', order: 5, createdAt: new Date().toISOString() },
    { id: 'acc-aylin-ek', groupId: 'group-aylin', name: 'Ek Gelir', type: 'INCOME', subType: 'CASH', currency: 'TRY', order: 6, createdAt: new Date().toISOString() },

    // Mert Giderleri (Kredi Kartları & Sabit)
    { id: 'acc-mert-is', groupId: 'group-mert', name: 'Mert İş', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'İş Bankası', currency: 'TRY', order: 1, createdAt: new Date().toISOString() },
    { id: 'acc-mert-teb', groupId: 'group-mert', name: 'Mert Teb', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'TEB', currency: 'TRY', order: 2, createdAt: new Date().toISOString() },
    { id: 'acc-mert-gspara', groupId: 'group-mert', name: 'Mert GsPara', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'GsPara', currency: 'TRY', order: 3, createdAt: new Date().toISOString() },
    { id: 'acc-mert-ziraat', groupId: 'group-mert', name: 'Ziraat', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'Ziraat', currency: 'TRY', order: 4, createdAt: new Date().toISOString() },
    { id: 'acc-mert-aidat', groupId: 'group-mert', name: 'Aidat', type: 'EXPENSE', subType: 'OTHER', currency: 'TRY', order: 5, createdAt: new Date().toISOString() },
    { id: 'acc-mert-diger', groupId: 'group-mert', name: 'Diğer', type: 'EXPENSE', subType: 'OTHER', currency: 'TRY', order: 6, createdAt: new Date().toISOString() },
    // Mert Gelirleri
    { id: 'acc-mert-maas', groupId: 'group-mert', name: 'Mert Maaş', type: 'INCOME', subType: 'CASH', currency: 'TRY', order: 7, createdAt: new Date().toISOString() },
    { id: 'acc-mert-kira', groupId: 'group-mert', name: 'Mert Kira', type: 'INCOME', subType: 'CASH', currency: 'TRY', order: 8, createdAt: new Date().toISOString() },
    { id: 'acc-mert-ek', groupId: 'group-mert', name: 'Ek Gelir', type: 'INCOME', subType: 'CASH', currency: 'TRY', order: 9, createdAt: new Date().toISOString() },

    // Varlık Hesapları (Ortak / Birikim)
    { id: 'acc-varlik-altin-gr', groupId: 'group-ortak', name: 'Gram Altın', type: 'ASSET', subType: 'GOLD_GRAM', symbol: 'XAU_GR', currency: 'TRY', order: 1, createdAt: new Date().toISOString() },
    { id: 'acc-varlik-altin-ceyrek', groupId: 'group-ortak', name: 'Fiziki Çeyrek Altın', type: 'ASSET', subType: 'GOLD_PIECE', symbol: 'XAU_CEYREK', currency: 'TRY', order: 2, createdAt: new Date().toISOString() },
    { id: 'acc-varlik-euro', groupId: 'group-ortak', name: 'Euro Birikim', type: 'ASSET', subType: 'CURRENCY', symbol: 'EUR', currency: 'EUR', order: 3, createdAt: new Date().toISOString() },
    { id: 'acc-varlik-usd', groupId: 'group-ortak', name: 'USD Birikim', type: 'ASSET', subType: 'CURRENCY', symbol: 'USD', currency: 'USD', order: 4, createdAt: new Date().toISOString() },
    
    // Fonlar
    { id: 'acc-fon-tte', groupId: 'group-ortak', name: 'TTE - BIST Teknoloji', type: 'ASSET', subType: 'FUND', symbol: 'TTE', currency: 'TRY', order: 5, targetAllocationPct: 25.71, createdAt: new Date().toISOString() },
    { id: 'acc-fon-gsp', groupId: 'group-ortak', name: 'GSP - S&P 500', type: 'ASSET', subType: 'FUND', symbol: 'GSP', currency: 'TRY', order: 6, targetAllocationPct: 51.29, createdAt: new Date().toISOString() },
    { id: 'acc-fon-dvt', groupId: 'group-ortak', name: 'DVT - Dijital Teknolojiler', type: 'ASSET', subType: 'FUND', symbol: 'DVT', currency: 'TRY', order: 7, targetAllocationPct: 23.00, createdAt: new Date().toISOString() },
  ];
  await db.accounts.bulkAdd(accounts);

  // 3. Aylık Gelir & Gider Girişleri (2026 yılı - Şubat, Mart, Nisan, Mayıs)
  const cashFlows: CashFlowEntry[] = [
    // Aylin - Şubat (2)
    { id: 'cf-ay-vakif-2', accountId: 'acc-aylin-vakif', year: 2026, month: 2, amount: 32363, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-halk-2', accountId: 'acc-aylin-halk', year: 2026, month: 2, amount: 0, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-ziraat-2', accountId: 'acc-aylin-ziraat', year: 2026, month: 2, amount: 2500, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-diger-2', accountId: 'acc-aylin-diger', year: 2026, month: 2, amount: 10000, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-maas-2', accountId: 'acc-aylin-maas', year: 2026, month: 2, amount: 88500, updatedAt: new Date().toISOString() },
    
    // Aylin - Mart (3)
    { id: 'cf-ay-vakif-3', accountId: 'acc-aylin-vakif', year: 2026, month: 3, amount: 44972, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-halk-3', accountId: 'acc-aylin-halk', year: 2026, month: 3, amount: 0, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-ziraat-3', accountId: 'acc-aylin-ziraat', year: 2026, month: 3, amount: 0, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-diger-3', accountId: 'acc-aylin-diger', year: 2026, month: 3, amount: 10000, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-maas-3', accountId: 'acc-aylin-maas', year: 2026, month: 3, amount: 88500, updatedAt: new Date().toISOString() },

    // Aylin - Nisan (4)
    { id: 'cf-ay-vakif-4', accountId: 'acc-aylin-vakif', year: 2026, month: 4, amount: 59907, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-halk-4', accountId: 'acc-aylin-halk', year: 2026, month: 4, amount: 0, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-ziraat-4', accountId: 'acc-aylin-ziraat', year: 2026, month: 4, amount: 5000, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-diger-4', accountId: 'acc-aylin-diger', year: 2026, month: 4, amount: 10000, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-maas-4', accountId: 'acc-aylin-maas', year: 2026, month: 4, amount: 88500, updatedAt: new Date().toISOString() },

    // Aylin - Mayıs (5)
    { id: 'cf-ay-vakif-5', accountId: 'acc-aylin-vakif', year: 2026, month: 5, amount: 45555, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-halk-5', accountId: 'acc-aylin-halk', year: 2026, month: 5, amount: 0, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-ziraat-5', accountId: 'acc-aylin-ziraat', year: 2026, month: 5, amount: 5000, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-diger-5', accountId: 'acc-aylin-diger', year: 2026, month: 5, amount: 0, updatedAt: new Date().toISOString() },
    { id: 'cf-ay-maas-5', accountId: 'acc-aylin-maas', year: 2026, month: 5, amount: 88500, updatedAt: new Date().toISOString() },

    // Mert - Şubat (2)
    { id: 'cf-mert-is-2', accountId: 'acc-mert-is', year: 2026, month: 2, amount: 33551, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-teb-2', accountId: 'acc-mert-teb', year: 2026, month: 2, amount: 19077, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-gspara-2', accountId: 'acc-mert-gspara', year: 2026, month: 2, amount: 500, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-ziraat-2', accountId: 'acc-mert-ziraat', year: 2026, month: 2, amount: 35207, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-aidat-2', accountId: 'acc-mert-aidat', year: 2026, month: 2, amount: 2000, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-diger-2', accountId: 'acc-mert-diger', year: 2026, month: 2, amount: 10364, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-maas-2', accountId: 'acc-mert-maas', year: 2026, month: 2, amount: 92500, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-kira-2', accountId: 'acc-mert-kira', year: 2026, month: 2, amount: 16750, updatedAt: new Date().toISOString() },

    // Mert - Mart (3)
    { id: 'cf-mert-is-3', accountId: 'acc-mert-is', year: 2026, month: 3, amount: 43257, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-teb-3', accountId: 'acc-mert-teb', year: 2026, month: 3, amount: 17335, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-gspara-3', accountId: 'acc-mert-gspara', year: 2026, month: 3, amount: 500, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-ziraat-3', accountId: 'acc-mert-ziraat', year: 2026, month: 3, amount: 30501, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-aidat-3', accountId: 'acc-mert-aidat', year: 2026, month: 3, amount: 2000, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-diger-3', accountId: 'acc-mert-diger', year: 2026, month: 3, amount: 10364, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-maas-3', accountId: 'acc-mert-maas', year: 2026, month: 3, amount: 92500, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-kira-3', accountId: 'acc-mert-kira', year: 2026, month: 3, amount: 16750, updatedAt: new Date().toISOString() },

    // Mert - Nisan (4)
    { id: 'cf-mert-is-4', accountId: 'acc-mert-is', year: 2026, month: 4, amount: 36335, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-teb-4', accountId: 'acc-mert-teb', year: 2026, month: 4, amount: 24771, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-gspara-4', accountId: 'acc-mert-gspara', year: 2026, month: 4, amount: 0, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-ziraat-4', accountId: 'acc-mert-ziraat', year: 2026, month: 4, amount: 30501, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-aidat-4', accountId: 'acc-mert-aidat', year: 2026, month: 4, amount: 3600, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-diger-4', accountId: 'acc-mert-diger', year: 2026, month: 4, amount: 10364, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-maas-4', accountId: 'acc-mert-maas', year: 2026, month: 4, amount: 92500, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-kira-4', accountId: 'acc-mert-kira', year: 2026, month: 4, amount: 16750, updatedAt: new Date().toISOString() },

    // Mert - Mayıs (5)
    { id: 'cf-mert-is-5', accountId: 'acc-mert-is', year: 2026, month: 5, amount: 182124, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-teb-5', accountId: 'acc-mert-teb', year: 2026, month: 5, amount: 19864, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-gspara-5', accountId: 'acc-mert-gspara', year: 2026, month: 5, amount: 0, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-ziraat-5', accountId: 'acc-mert-ziraat', year: 2026, month: 5, amount: 32507, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-aidat-5', accountId: 'acc-mert-aidat', year: 2026, month: 5, amount: 3600, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-diger-5', accountId: 'acc-mert-diger', year: 2026, month: 5, amount: 0, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-maas-5', accountId: 'acc-mert-maas', year: 2026, month: 5, amount: 92500, updatedAt: new Date().toISOString() },
    { id: 'cf-mert-kira-5', accountId: 'acc-mert-kira', year: 2026, month: 5, amount: 22000, updatedAt: new Date().toISOString() },
  ];
  await db.cashFlowEntries.bulkAdd(cashFlows);

  // 4. Varlık Alış/Satış Hareketleri (Gram Altın, Çeyrek, Euro, Fonlar)
  const transactions: AssetTransaction[] = [
    // Gram Altın Alışları (Görsel 2)
    { id: 'tx-gold-1', accountId: 'acc-varlik-altin-gr', date: '2026-04-15', year: 2026, month: 4, type: 'BUY', quantity: 4.31, totalAmountTRY: 29373.38, unitPriceTRY: 6815.17, note: 'Nisan Alımı', createdAt: new Date().toISOString() },
    { id: 'tx-gold-2', accountId: 'acc-varlik-altin-gr', date: '2026-05-18', year: 2026, month: 5, type: 'BUY', quantity: 1.14, totalAmountTRY: 7515.99, unitPriceTRY: 6592.97, note: 'Mayıs Alımı', createdAt: new Date().toISOString() },
    { id: 'tx-gold-3', accountId: 'acc-varlik-altin-gr', date: '2026-06-10', year: 2026, month: 6, type: 'BUY', quantity: 8.93, totalAmountTRY: 54933.20, unitPriceTRY: 6151.53, note: 'Haziran Alımı', createdAt: new Date().toISOString() },
    { id: 'tx-gold-4', accountId: 'acc-varlik-altin-gr', date: '2026-07-20', year: 2026, month: 7, type: 'BUY', quantity: 3.16, totalAmountTRY: 19336.72, unitPriceTRY: 6119.21, note: 'Temmuz Alımı', createdAt: new Date().toISOString() },
    { id: 'tx-gold-5', accountId: 'acc-varlik-altin-gr', date: '2026-08-14', year: 2026, month: 8, type: 'BUY', quantity: 0.96, totalAmountTRY: 6644.55, unitPriceTRY: 6921.41, note: 'Ağustos Alımı', createdAt: new Date().toISOString() },
    { id: 'tx-gold-6', accountId: 'acc-varlik-altin-gr', date: '2026-09-08', year: 2026, month: 9, type: 'BUY', quantity: 7.15, totalAmountTRY: 47957.25, unitPriceTRY: 6707.31, note: 'Eylül Alımı', createdAt: new Date().toISOString() },

    // Çeyrek Altın Alışı (Görsel 3)
    { id: 'tx-ceyrek-1', accountId: 'acc-varlik-altin-ceyrek', date: '2026-10-01', year: 2026, month: 10, type: 'BUY', quantity: 1, totalAmountTRY: 10550.00, unitPriceTRY: 10550.00, note: 'Fiziki Çeyrek', createdAt: new Date().toISOString() },

    // Euro Birikim Bakiyesi (Görsel 4 - Toplam 3.800 EUR)
    { id: 'tx-eur-1', accountId: 'acc-varlik-euro', date: '2026-01-01', year: 2026, month: 1, type: 'BUY', quantity: 3800, totalAmountTRY: 180000.00, unitPriceTRY: 47.36, note: 'Kümülatif Euro Birikimi', createdAt: new Date().toISOString() },

    // Fonlar (Görsel 5)
    // TTE: Maliyet: 8.352,32 TL, Değer: 12.232,84 TL (Birim: 12.2328, Adet: 1000)
    { id: 'tx-tte-1', accountId: 'acc-fon-tte', date: '2026-03-01', year: 2026, month: 3, type: 'BUY', quantity: 1000, totalAmountTRY: 8352.32, unitPriceTRY: 8.35232, note: 'TTE Alımları', createdAt: new Date().toISOString() },
    // GSP: Maliyet: 16.659,11 TL, Değer: 28.647,10 TL (Birim: 28.6471, Adet: 1000)
    { id: 'tx-gsp-1', accountId: 'acc-fon-gsp', date: '2026-02-15', year: 2026, month: 2, type: 'BUY', quantity: 1000, totalAmountTRY: 16659.11, unitPriceTRY: 16.65911, note: 'GSP Alımları', createdAt: new Date().toISOString() },
    // DVT: Maliyet: 7.471,83 TL, Değer: 20.142,14 TL (Birim: 20.1421, Adet: 1000)
    { id: 'tx-dvt-1', accountId: 'acc-fon-dvt', date: '2026-01-20', year: 2026, month: 1, type: 'BUY', quantity: 1000, totalAmountTRY: 7471.83, unitPriceTRY: 7.47183, note: 'DVT Alımları', createdAt: new Date().toISOString() },
  ];
  await db.transactions.bulkAdd(transactions);

  // 5. Market Rates
  await db.marketRates.bulkAdd(INITIAL_RATES);

  // 6. Default Settings
  const defaultSettings: AppSettings = {
    biometricsEnabled: false,
    autoLockMinutes: 5,
    lastActiveTimestamp: Date.now(),
    isLocked: false,
    defaultCurrency: 'TRY',
    hideValuesOnScreen: false
  };
  await db.settings.put({ key: 'appSettings', value: defaultSettings });
}
