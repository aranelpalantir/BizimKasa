import { db } from './db';
import type { 
  Group, 
  Account, 
  CashFlowEntry, 
  AssetTransaction, 
  MarketRate, 
  MarketRateHistoryRecord,
  AppSettings 
} from '../types/finance';

export const INITIAL_RATES: MarketRate[] = [
  // Döviz
  { symbol: 'USD', name: 'Amerikan Doları', category: 'CURRENCY', rateTRY: 49.03, changeDailyPct: 0.15, source: 'Piyasa API', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'EUR', name: 'Euro', category: 'CURRENCY', rateTRY: 55.24, changeDailyPct: 0.22, source: 'Piyasa API', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'GBP', name: 'İngiliz Sterlini', category: 'CURRENCY', rateTRY: 65.50, changeDailyPct: 0.18, source: 'Piyasa API', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },

  // Altın & Emtia
  { symbol: 'XAU_GR_PHYSICAL', name: 'Fiziki Gram Altın', category: 'GOLD', rateTRY: 6710.00, changeDailyPct: 0.42, source: 'Kapalıçarşı', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'XAU_GR_BANK', name: 'Banka Gram Altın', category: 'GOLD', rateTRY: 6561.65, changeDailyPct: 0.38, source: 'Piyasa Kuru', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'XAU_CEYREK', name: 'Çeyrek Altın', category: 'GOLD', rateTRY: 10980.00, changeDailyPct: 0.35, source: 'Kapalıçarşı', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'XAU_ONS', name: 'Ons Altın ($)', category: 'GOLD', rateTRY: 4174.07, changeDailyPct: 0.45, source: 'Global Emtia', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'XAG', name: 'Gümüş (Gram)', category: 'COMMODITY', rateTRY: 95.71, changeDailyPct: 0.80, source: 'Piyasa Kuru', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },

  // Borsa Endeksleri
  { symbol: 'XU100', name: 'BIST 100', category: 'STOCK_INDEX', rateTRY: 12249.04, changeDailyPct: 1.20, source: 'Borsa İstanbul', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'NASDAQ100', name: 'Nasdaq 100', category: 'STOCK_INDEX', rateTRY: 30366.11, changeDailyPct: 0.65, source: 'Global', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },

  // TEFAS Yatırım Fonları
  { symbol: 'TI2', name: "İş Portföy İş'te Kadın Fonu", category: 'FUND', rateTRY: 15.42, changeDailyPct: 1.15, source: 'TEFAS', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'MAC', name: 'Marmara Capital Hisse Senedi', category: 'FUND', rateTRY: 38.65, changeDailyPct: 1.85, source: 'TEFAS', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'AFT', name: 'Ak Portföy Yeni Teknolojiler', category: 'FUND', rateTRY: 28.50, changeDailyPct: 0.95, source: 'TEFAS', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
];

export async function forceResetWithDummyData(): Promise<void> {
  await db.transaction('rw', [
    db.groups,
    db.accounts,
    db.cashFlowEntries,
    db.transactions,
    db.marketRates,
    db.rateHistory,
    db.investmentPlans,
    db.settings
  ], async () => {
    await db.groups.clear();
    await db.accounts.clear();
    await db.cashFlowEntries.clear();
    await db.transactions.clear();
    await db.marketRates.clear();
    await db.rateHistory.clear();
    await db.investmentPlans.clear();
    await db.settings.clear();
  });

  await seedDummyData();
}

export async function seedInitialDataIfNeeded(): Promise<void> {
  const groupCount = await db.groups.count();
  if (groupCount > 0) {
    return;
  }
  await seedDummyData();
}

async function seedDummyData(): Promise<void> {
  // 1. Ana Gruplar
  const groups: Group[] = [
    { id: 'group-mert', name: 'Mert', color: '#3b82f6', order: 1, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'group-aylin', name: 'Aylin', color: '#a855f7', order: 2, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'group-cocuk', name: 'Çocuk', color: '#f59e0b', order: 3, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'group-ortak', name: 'Ortak Kasa', color: '#10b981', order: 4, createdAt: '2025-01-01T00:00:00Z' },
  ];
  await db.groups.bulkAdd(groups);

  // 2. Hesaplar & Kategoriler
  const accounts: Account[] = [
    // --- MERT ---
    { id: 'acc-m-kart1', groupId: 'group-mert', name: 'Garanti Bonus Kart', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'Garanti BBVA', currency: 'TRY', order: 1, createdAt: '2025-01-01' },
    { id: 'acc-m-kart2', groupId: 'group-mert', name: 'İş Maximum Kart', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'İş Bankası', currency: 'TRY', order: 2, createdAt: '2025-01-01' },
    { id: 'acc-m-aidat', groupId: 'group-mert', name: 'Site Aidatı', type: 'EXPENSE', subType: 'EXPENSE_FIXED', currency: 'TRY', order: 3, createdAt: '2025-01-01' },
    { id: 'acc-m-faturalar', groupId: 'group-mert', name: 'Ev Faturaları', type: 'EXPENSE', subType: 'EXPENSE_BILLS', currency: 'TRY', order: 4, createdAt: '2025-01-01' },
    { id: 'acc-m-maas', groupId: 'group-mert', name: 'Mert Maaş', type: 'INCOME', subType: 'INCOME_SALARY', currency: 'TRY', order: 5, createdAt: '2025-01-01' },
    { id: 'acc-m-prim', groupId: 'group-mert', name: 'Prim & İkramiye', type: 'INCOME', subType: 'INCOME_BONUS', currency: 'TRY', order: 6, createdAt: '2025-01-01' },
    // Mert Varlıkları
    { id: 'acc-m-altin-banka', groupId: 'group-mert', name: 'Banka Gram Altın (Garanti)', type: 'ASSET', subType: 'GOLD_GRAM_BANK', symbol: 'XAU_GR_BANK', currency: 'TRY', order: 7, createdAt: '2025-01-01' },
    { id: 'acc-m-fon-ti2', groupId: 'group-mert', name: 'TI2 - İş Portföy Fonu', type: 'ASSET', subType: 'FUND', symbol: 'TI2', currency: 'TRY', order: 8, createdAt: '2025-01-01' },

    // --- AYLIN ---
    { id: 'acc-a-kart1', groupId: 'group-aylin', name: 'Worldcard', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'Yapı Kredi', currency: 'TRY', order: 1, createdAt: '2025-01-01' },
    { id: 'acc-a-kart2', groupId: 'group-aylin', name: 'Ziraat Bankkart', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'Ziraat', currency: 'TRY', order: 2, createdAt: '2025-01-01' },
    { id: 'acc-a-diger', groupId: 'group-aylin', name: 'Kişisel Harcamalar', type: 'EXPENSE', subType: 'EXPENSE_OTHER', currency: 'TRY', order: 3, createdAt: '2025-01-01' },
    { id: 'acc-a-maas', groupId: 'group-aylin', name: 'Aylin Maaş', type: 'INCOME', subType: 'INCOME_SALARY', currency: 'TRY', order: 4, createdAt: '2025-01-01' },
    // Aylin Varlıkları
    { id: 'acc-a-altin-fiziki', groupId: 'group-aylin', name: 'Fiziki Gram Altın', type: 'ASSET', subType: 'GOLD_GRAM_PHYSICAL', symbol: 'XAU_GR_PHYSICAL', currency: 'TRY', order: 5, createdAt: '2025-01-01' },
    { id: 'acc-a-fon-mac', groupId: 'group-aylin', name: 'MAC - Marmara Capital', type: 'ASSET', subType: 'FUND', symbol: 'MAC', currency: 'TRY', order: 6, createdAt: '2025-01-01' },
    { id: 'acc-a-euro', groupId: 'group-aylin', name: 'Euro Birikim', type: 'ASSET', subType: 'CURRENCY', symbol: 'EUR', currency: 'EUR', order: 7, createdAt: '2025-01-01' },

    // --- ÇOCUK ---
    { id: 'acc-c-okul', groupId: 'group-cocuk', name: 'Okul / Kreş Taksiti', type: 'EXPENSE', subType: 'EXPENSE_FIXED', currency: 'TRY', order: 1, createdAt: '2025-01-01' },
    { id: 'acc-c-kurs', groupId: 'group-cocuk', name: 'Gelişim & Spor Kursu', type: 'EXPENSE', subType: 'EXPENSE_OTHER', currency: 'TRY', order: 2, createdAt: '2025-01-01' },
    { id: 'acc-c-harclik', groupId: 'group-cocuk', name: 'Büyüklerden Harçlık', type: 'INCOME', subType: 'INCOME_OTHER', currency: 'TRY', order: 3, createdAt: '2025-01-01' },
    // Çocuk Varlıkları
    { id: 'acc-c-ceyrek', groupId: 'group-cocuk', name: 'Fiziki Çeyrek Altın Birikimi', type: 'ASSET', subType: 'GOLD_CEYREK', symbol: 'XAU_CEYREK', currency: 'TRY', order: 4, createdAt: '2025-01-01' },
    { id: 'acc-c-fon-aft', groupId: 'group-cocuk', name: 'AFT - Yeni Teknolojiler', type: 'ASSET', subType: 'FUND', symbol: 'AFT', currency: 'TRY', order: 5, createdAt: '2025-01-01' },

    // --- ORTAK KASA ---
    { id: 'acc-o-market', groupId: 'group-ortak', name: 'Ev Market & Mutfak', type: 'EXPENSE', subType: 'EXPENSE_OTHER', currency: 'TRY', order: 1, createdAt: '2025-01-01' },
    { id: 'acc-o-kira-gelir', groupId: 'group-ortak', name: 'Kira Geliri', type: 'INCOME', subType: 'INCOME_RENT', currency: 'TRY', order: 2, createdAt: '2025-01-01' },
    // Ortak Varlıklar
    { id: 'acc-o-dolar', groupId: 'group-ortak', name: 'Dolar Birikimi', type: 'ASSET', subType: 'CURRENCY', symbol: 'USD', currency: 'USD', order: 3, createdAt: '2025-01-01' },
  ];
  await db.accounts.bulkAdd(accounts);

  // 3. Aylık Nakit Akışı Verileri (2025 Ocak - 2026 Ekim arası, 22 ay)
  const cashFlows: CashFlowEntry[] = [];
  const years = [2025, 2026];

  for (const year of years) {
    const maxMonth = year === 2026 ? 10 : 12;
    for (let month = 1; month <= maxMonth; month++) {
      const yearMultiplier = year === 2026 ? 1.25 : 1.0;
      const monthVar = 1 + (month % 3) * 0.05;

      // Mert
      cashFlows.push(
        { id: `cf-m-k1-${year}-${month}`, accountId: 'acc-m-kart1', year, month, amount: Math.round(24000 * yearMultiplier * monthVar), updatedAt: '2026-10-01' },
        { id: `cf-m-k2-${year}-${month}`, accountId: 'acc-m-kart2', year, month, amount: Math.round(15000 * yearMultiplier * (monthVar - 0.02)), updatedAt: '2026-10-01' },
        { id: `cf-m-aidat-${year}-${month}`, accountId: 'acc-m-aidat', year, month, amount: year === 2026 ? 3200 : 2500, updatedAt: '2026-10-01' },
        { id: `cf-m-fatura-${year}-${month}`, accountId: 'acc-m-faturalar', year, month, amount: year === 2026 ? 4800 : 3600, updatedAt: '2026-10-01' },
        { id: `cf-m-maas-${year}-${month}`, accountId: 'acc-m-maas', year, month, amount: year === 2026 ? 95000 : 75000, updatedAt: '2026-10-01' }
      );
      if (month === 6 || month === 12) {
        cashFlows.push({ id: `cf-m-prim-${year}-${month}`, accountId: 'acc-m-prim', year, month, amount: year === 2026 ? 45000 : 30000, updatedAt: '2026-10-01' });
      }

      // Aylin
      cashFlows.push(
        { id: `cf-a-k1-${year}-${month}`, accountId: 'acc-a-kart1', year, month, amount: Math.round(28000 * yearMultiplier * monthVar), updatedAt: '2026-10-01' },
        { id: `cf-a-k2-${year}-${month}`, accountId: 'acc-a-kart2', year, month, amount: Math.round(12000 * yearMultiplier * (monthVar + 0.03)), updatedAt: '2026-10-01' },
        { id: `cf-a-diger-${year}-${month}`, accountId: 'acc-a-diger', year, month, amount: year === 2026 ? 8500 : 6000, updatedAt: '2026-10-01' },
        { id: `cf-a-maas-${year}-${month}`, accountId: 'acc-a-maas', year, month, amount: year === 2026 ? 88000 : 70000, updatedAt: '2026-10-01' }
      );

      // Çocuk
      cashFlows.push(
        { id: `cf-c-okul-${year}-${month}`, accountId: 'acc-c-okul', year, month, amount: year === 2026 ? 18000 : 14000, updatedAt: '2026-10-01' },
        { id: `cf-c-kurs-${year}-${month}`, accountId: 'acc-c-kurs', year, month, amount: year === 2026 ? 5500 : 4000, updatedAt: '2026-10-01' },
        { id: `cf-c-harclik-${year}-${month}`, accountId: 'acc-c-harclik', year, month, amount: 2000, updatedAt: '2026-10-01' }
      );

      // Ortak
      cashFlows.push(
        { id: `cf-o-market-${year}-${month}`, accountId: 'acc-o-market', year, month, amount: Math.round(22000 * yearMultiplier), updatedAt: '2026-10-01' },
        { id: `cf-o-kira-${year}-${month}`, accountId: 'acc-o-kira-gelir', year, month, amount: year === 2026 ? 25000 : 18000, updatedAt: '2026-10-01' }
      );
    }
  }
  await db.cashFlowEntries.bulkAdd(cashFlows);

  // 4. Varlık Alış & Satış Hareketleri (2025 - 2026)
  const transactions: AssetTransaction[] = [
    // Mert - Banka Gram Altın
    { id: 'tx-m-altin-1', accountId: 'acc-m-altin-banka', groupId: 'group-mert', date: '2025-03-15', year: 2025, month: 3, type: 'BUY', quantity: 5.0, totalAmountTRY: 16500, unitPriceTRY: 3300, note: 'Banka alımı', createdAt: '2025-03-15' },
    { id: 'tx-m-altin-2', accountId: 'acc-m-altin-banka', groupId: 'group-mert', date: '2025-08-20', year: 2025, month: 8, type: 'BUY', quantity: 6.5, totalAmountTRY: 26000, unitPriceTRY: 4000, note: 'Yaz alımı', createdAt: '2025-08-20' },
    { id: 'tx-m-altin-3', accountId: 'acc-m-altin-banka', groupId: 'group-mert', date: '2026-02-10', year: 2026, month: 2, type: 'BUY', quantity: 4.0, totalAmountTRY: 20800, unitPriceTRY: 5200, note: 'Şubat alımı', createdAt: '2026-02-10' },
    { id: 'tx-m-altin-4', accountId: 'acc-m-altin-banka', groupId: 'group-mert', date: '2026-07-15', year: 2026, month: 7, type: 'BUY', quantity: 5.5, totalAmountTRY: 34100, unitPriceTRY: 6200, note: 'Temmuz alımı', createdAt: '2026-07-15' },

    // Mert - TI2 Fonu
    { id: 'tx-m-ti2-1', accountId: 'acc-m-fon-ti2', groupId: 'group-mert', date: '2025-04-10', year: 2025, month: 4, type: 'BUY', quantity: 2000, totalAmountTRY: 18000, unitPriceTRY: 9.00, note: 'İlk fon alımı', createdAt: '2025-04-10' },
    { id: 'tx-m-ti2-2', accountId: 'acc-m-fon-ti2', groupId: 'group-mert', date: '2026-03-18', year: 2026, month: 3, type: 'BUY', quantity: 1500, totalAmountTRY: 18750, unitPriceTRY: 12.50, note: 'Ek fon alımı', createdAt: '2026-03-18' },

    // Aylin - Fiziki Gram Altın
    { id: 'tx-a-altin-1', accountId: 'acc-a-altin-fiziki', groupId: 'group-aylin', date: '2025-02-14', year: 2025, month: 2, type: 'BUY', quantity: 5.0, totalAmountTRY: 16000, unitPriceTRY: 3200, note: 'Kuyumcu fiziki', createdAt: '2025-02-14' },
    { id: 'tx-a-altin-2', accountId: 'acc-a-altin-fiziki', groupId: 'group-aylin', date: '2025-10-25', year: 2025, month: 10, type: 'BUY', quantity: 5.0, totalAmountTRY: 22500, unitPriceTRY: 4500, note: 'Kuyumcu fiziki', createdAt: '2025-10-25' },
    { id: 'tx-a-altin-3', accountId: 'acc-a-altin-fiziki', groupId: 'group-aylin', date: '2026-05-12', year: 2026, month: 5, type: 'BUY', quantity: 4.0, totalAmountTRY: 24800, unitPriceTRY: 6200, note: 'Fiziki birikim', createdAt: '2026-05-12' },

    // Aylin - MAC Fonu
    { id: 'tx-a-mac-1', accountId: 'acc-a-fon-mac', groupId: 'group-aylin', date: '2025-05-20', year: 2025, month: 5, type: 'BUY', quantity: 1000, totalAmountTRY: 25000, unitPriceTRY: 25.00, note: 'Hisse fonu alımı', createdAt: '2025-05-20' },
    { id: 'tx-a-mac-2', accountId: 'acc-a-fon-mac', groupId: 'group-aylin', date: '2026-04-15', year: 2026, month: 4, type: 'BUY', quantity: 500, totalAmountTRY: 16500, unitPriceTRY: 33.00, note: 'Düzenli birikim', createdAt: '2026-04-15' },

    // Aylin - Euro Birikim (+ Alışlar ve - Harcamalar)
    { id: 'tx-a-eur-1', accountId: 'acc-a-euro', groupId: 'group-aylin', date: '2025-01-20', year: 2025, month: 1, type: 'BUY', quantity: 1000, totalAmountTRY: 37500, unitPriceTRY: 37.50, note: 'Döviz alımı', createdAt: '2025-01-20' },
    { id: 'tx-a-eur-2', accountId: 'acc-a-euro', groupId: 'group-aylin', date: '2025-06-15', year: 2025, month: 6, type: 'BUY', quantity: 1500, totalAmountTRY: 60000, unitPriceTRY: 40.00, note: 'Döviz birikimi', createdAt: '2025-06-15' },
    { id: 'tx-a-eur-3', accountId: 'acc-a-euro', groupId: 'group-aylin', date: '2025-08-10', year: 2025, month: 8, type: 'SELL', quantity: 500, totalAmountTRY: 21500, unitPriceTRY: 43.00, note: 'Tatil harcaması', createdAt: '2025-08-10' },
    { id: 'tx-a-eur-4', accountId: 'acc-a-euro', groupId: 'group-aylin', date: '2026-03-05', year: 2026, month: 3, type: 'BUY', quantity: 1200, totalAmountTRY: 58800, unitPriceTRY: 49.00, note: 'Döviz alımı', createdAt: '2026-03-05' },

    // Çocuk - Fiziki Çeyrek Altın
    { id: 'tx-c-ceyrek-1', accountId: 'acc-c-ceyrek', groupId: 'group-cocuk', date: '2025-04-23', year: 2025, month: 4, type: 'BUY', quantity: 2, totalAmountTRY: 11000, unitPriceTRY: 5500, note: 'Bayram çeyreği', createdAt: '2025-04-23' },
    { id: 'tx-c-ceyrek-2', accountId: 'acc-c-ceyrek', groupId: 'group-cocuk', date: '2025-09-10', year: 2025, month: 9, type: 'BUY', quantity: 2, totalAmountTRY: 14000, unitPriceTRY: 7000, note: 'Doğum günü çeyreği', createdAt: '2025-09-10' },
    { id: 'tx-c-ceyrek-3', accountId: 'acc-c-ceyrek', groupId: 'group-cocuk', date: '2026-04-23', year: 2026, month: 4, type: 'BUY', quantity: 2, totalAmountTRY: 19000, unitPriceTRY: 9500, note: 'Bayram birikimi', createdAt: '2026-04-23' },

    // Çocuk - AFT Teknoloji Fonu
    { id: 'tx-c-aft-1', accountId: 'acc-c-fon-aft', groupId: 'group-cocuk', date: '2025-07-01', year: 2025, month: 7, type: 'BUY', quantity: 1000, totalAmountTRY: 19000, unitPriceTRY: 19.00, note: 'Gelecek yatırımı', createdAt: '2025-07-01' },
    { id: 'tx-c-aft-2', accountId: 'acc-c-fon-aft', groupId: 'group-cocuk', date: '2026-06-15', year: 2026, month: 6, type: 'BUY', quantity: 1000, totalAmountTRY: 24000, unitPriceTRY: 24.00, note: 'Karne hediyesi', createdAt: '2026-06-15' },

    // Ortak - Dolar Birikimi
    { id: 'tx-o-usd-1', accountId: 'acc-o-dolar', groupId: 'group-ortak', date: '2025-05-10', year: 2025, month: 5, type: 'BUY', quantity: 2000, totalAmountTRY: 70000, unitPriceTRY: 35.00, note: 'Acil durum fonu', createdAt: '2025-05-10' },
    { id: 'tx-o-usd-2', accountId: 'acc-o-dolar', groupId: 'group-ortak', date: '2026-01-15', year: 2026, month: 1, type: 'BUY', quantity: 1500, totalAmountTRY: 66000, unitPriceTRY: 44.00, note: 'Ortak kasa takviye', createdAt: '2026-01-15' },
  ];
  await db.transactions.bulkAdd(transactions);

  // 5. Market Rates
  await db.marketRates.bulkAdd(INITIAL_RATES);

  // 6. Son 10 Günün Kur Tarihçesi (22 Eylül - 1 Ekim 2026)
  const historyRecords: MarketRateHistoryRecord[] = [];
  const baseSymbols = ['USD', 'EUR', 'XAU_GR_PHYSICAL', 'XAU_GR_BANK', 'XAU_CEYREK', 'TI2', 'MAC', 'AFT'];

  for (let i = 9; i >= 0; i--) {
    const d = new Date(2026, 9, 1 - i); // 2026-10-01 minus i days
    const dateStr = d.toISOString().split('T')[0];
    const dayFactor = 1 - (i * 0.0035); // slight historical trend

    for (const sym of baseSymbols) {
      const live = INITIAL_RATES.find(r => r.symbol === sym)?.rateTRY || 100;
      const histRate = Math.round((live * dayFactor) * 100) / 100;
      historyRecords.push({
        id: `${sym}_${dateStr}`,
        symbol: sym,
        date: dateStr,
        rateTRY: histRate,
        source: 'Piyasa API',
        isManual: false
      });
    }
  }
  await db.rateHistory.bulkAdd(historyRecords);

  // 7. Default Settings
  const defaultSettings: AppSettings = {
    biometricsEnabled: false,
    autoLockMinutes: 5,
    lastActiveTimestamp: Date.now(),
    isLocked: false,
    defaultCurrency: 'TRY',
    hideValuesOnScreen: false,
    selectedGroupFilter: 'ALL'
  };
  await db.settings.put({ key: 'appSettings', value: defaultSettings });
}
