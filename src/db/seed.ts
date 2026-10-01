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

  // Altın
  { symbol: 'XAU_GR_PHYSICAL', name: 'Fiziki Gram Altın', category: 'GOLD', rateTRY: 6710.00, changeDailyPct: 0.42, source: 'Kapalıçarşı', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'XAU_GR_BANK', name: 'Banka Gram Altın', category: 'GOLD', rateTRY: 6561.65, changeDailyPct: 0.38, source: 'Piyasa Kuru', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'XAU_CEYREK', name: 'Çeyrek Altın', category: 'GOLD', rateTRY: 10980.00, changeDailyPct: 0.35, source: 'Kapalıçarşı', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'XAU_YARIM', name: 'Yarım Altın', category: 'GOLD', rateTRY: 21960.00, changeDailyPct: 0.35, source: 'Kapalıçarşı', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'XAU_TAM', name: 'Tam Altın', category: 'GOLD', rateTRY: 43920.00, changeDailyPct: 0.35, source: 'Kapalıçarşı', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'XAU_CUMHURIYET', name: 'Cumhuriyet Altını (Ata)', category: 'GOLD', rateTRY: 45280.00, changeDailyPct: 0.35, source: 'Kapalıçarşı', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },
  { symbol: 'XAU_ONS', name: 'Ons Altın ($)', category: 'GOLD', rateTRY: 4174.07, changeDailyPct: 0.45, source: 'Global Emtia', dataDate: '2026-10-01', updatedAt: '2026-10-01T18:30:00Z', isManualOverride: false },

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
  const clearedRecord = await db.settings.get('userClearedData');
  if (clearedRecord && clearedRecord.value) {
    return;
  }
  const groupCount = await db.groups.count();
  if (groupCount > 0) {
    return;
  }
  await seedDummyData();
}

async function seedDummyData(): Promise<void> {
  // 1. Ana Hesaplar
  const groups: Group[] = [
    { id: 'group-ana', name: 'Ana Hesap', color: '#3b82f6', order: 1, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'group-yatirim', name: 'Yatırım Hesabı', color: '#a855f7', order: 2, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'group-tasarruf', name: 'Tasarruf Fonu', color: '#f59e0b', order: 3, createdAt: '2025-01-01T00:00:00Z' },
    { id: 'group-ortak', name: 'Ortak Kasa', color: '#10b981', order: 4, createdAt: '2025-01-01T00:00:00Z' },
  ];
  await db.groups.bulkAdd(groups);

  // 2. Hesaplar & Kategoriler
  const accounts: Account[] = [
    // --- ANA HESAP ---
    { id: 'acc-ana-kart1', groupId: 'group-ana', name: 'Bonus Kredi Kartı', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'Garanti BBVA', currency: 'TRY', order: 1, createdAt: '2025-01-01' },
    { id: 'acc-ana-kart2', groupId: 'group-ana', name: 'Maximum Kredi Kartı', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'İş Bankası', currency: 'TRY', order: 2, createdAt: '2025-01-01' },
    { id: 'acc-ana-aidat', groupId: 'group-ana', name: 'Site Aidatı', type: 'EXPENSE', subType: 'EXPENSE_FIXED', currency: 'TRY', order: 3, createdAt: '2025-01-01' },
    { id: 'acc-ana-faturalar', groupId: 'group-ana', name: 'Ev Faturaları', type: 'EXPENSE', subType: 'EXPENSE_BILLS', currency: 'TRY', order: 4, createdAt: '2025-01-01' },
    { id: 'acc-ana-maas', groupId: 'group-ana', name: 'Maaş Geliri', type: 'INCOME', subType: 'INCOME_SALARY', currency: 'TRY', order: 5, createdAt: '2025-01-01' },
    { id: 'acc-ana-prim', groupId: 'group-ana', name: 'Prim & Ek Gelir', type: 'INCOME', subType: 'INCOME_BONUS', currency: 'TRY', order: 6, createdAt: '2025-01-01' },
    // Ana Hesap Varlıkları
    { id: 'acc-ana-altin-banka', groupId: 'group-ana', name: 'Banka Gram Altın', type: 'ASSET', subType: 'GOLD_GRAM_BANK', symbol: 'XAU_GR_BANK', currency: 'TRY', order: 7, createdAt: '2025-01-01' },
    { id: 'acc-ana-fon-ti2', groupId: 'group-ana', name: 'TI2 - İş Portföy Fonu', type: 'ASSET', subType: 'FUND', symbol: 'TI2', currency: 'TRY', order: 8, createdAt: '2025-01-01' },

    // --- YATIRIM HESABI ---
    { id: 'acc-yat-kart1', groupId: 'group-yatirim', name: 'World Kredi Kartı', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'Yapı Kredi', currency: 'TRY', order: 1, createdAt: '2025-01-01' },
    { id: 'acc-yat-kart2', groupId: 'group-yatirim', name: 'Bankkart Kredi Kartı', type: 'EXPENSE', subType: 'CREDIT_CARD', bankName: 'Ziraat', currency: 'TRY', order: 2, createdAt: '2025-01-01' },
    { id: 'acc-yat-diger', groupId: 'group-yatirim', name: 'Genel Harcamalar', type: 'EXPENSE', subType: 'EXPENSE_OTHER', currency: 'TRY', order: 3, createdAt: '2025-01-01' },
    { id: 'acc-yat-gelir', groupId: 'group-yatirim', name: 'Düzenli Gelir', type: 'INCOME', subType: 'INCOME_SALARY', currency: 'TRY', order: 4, createdAt: '2025-01-01' },
    // Yatırım Varlıkları
    { id: 'acc-yat-altin-fiziki', groupId: 'group-yatirim', name: 'Fiziki Gram Altın', type: 'ASSET', subType: 'GOLD_GRAM_PHYSICAL', symbol: 'XAU_GR_PHYSICAL', currency: 'TRY', order: 5, createdAt: '2025-01-01' },
    { id: 'acc-yat-fon-mac', groupId: 'group-yatirim', name: 'MAC - Marmara Capital', type: 'ASSET', subType: 'FUND', symbol: 'MAC', currency: 'TRY', order: 6, createdAt: '2025-01-01' },
    { id: 'acc-yat-euro', groupId: 'group-yatirim', name: 'Euro (EUR)', type: 'ASSET', subType: 'CURRENCY', symbol: 'EUR', currency: 'EUR', order: 7, createdAt: '2025-01-01' },

    // --- TASARRUF FONU ---
    { id: 'acc-tas-egitim', groupId: 'group-tasarruf', name: 'Eğitim & Gelişim', type: 'EXPENSE', subType: 'EXPENSE_FIXED', currency: 'TRY', order: 1, createdAt: '2025-01-01' },
    { id: 'acc-tas-sigorta', groupId: 'group-tasarruf', name: 'Bireysel Emeklilik & Sigorta', type: 'EXPENSE', subType: 'EXPENSE_OTHER', currency: 'TRY', order: 2, createdAt: '2025-01-01' },
    { id: 'acc-tas-aktarim', groupId: 'group-tasarruf', name: 'Tasarruf Katkısı', type: 'INCOME', subType: 'INCOME_OTHER', currency: 'TRY', order: 3, createdAt: '2025-01-01' },
    // Tasarruf Varlıkları
    { id: 'acc-tas-ceyrek', groupId: 'group-tasarruf', name: 'Çeyrek Altın', type: 'ASSET', subType: 'GOLD_CEYREK', symbol: 'XAU_CEYREK', currency: 'TRY', order: 4, createdAt: '2025-01-01' },
    { id: 'acc-tas-fon-aft', groupId: 'group-tasarruf', name: 'AFT - Yeni Teknolojiler', type: 'ASSET', subType: 'FUND', symbol: 'AFT', currency: 'TRY', order: 5, createdAt: '2025-01-01' },

    // --- ORTAK KASA ---
    { id: 'acc-ort-market', groupId: 'group-ortak', name: 'Market & Mutfak', type: 'EXPENSE', subType: 'EXPENSE_OTHER', currency: 'TRY', order: 1, createdAt: '2025-01-01' },
    { id: 'acc-ort-kira-gelir', groupId: 'group-ortak', name: 'Kira Geliri', type: 'INCOME', subType: 'INCOME_RENT', currency: 'TRY', order: 2, createdAt: '2025-01-01' },
    // Ortak Varlıklar
    { id: 'acc-ort-dolar', groupId: 'group-ortak', name: 'Dolar (USD)', type: 'ASSET', subType: 'CURRENCY', symbol: 'USD', currency: 'USD', order: 3, createdAt: '2025-01-01' },
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

      // Ana Hesap
      cashFlows.push(
        { id: `cf-ana-k1-${year}-${month}`, accountId: 'acc-ana-kart1', year, month, amount: Math.round(24000 * yearMultiplier * monthVar), updatedAt: '2026-10-01' },
        { id: `cf-ana-k2-${year}-${month}`, accountId: 'acc-ana-kart2', year, month, amount: Math.round(15000 * yearMultiplier * (monthVar - 0.02)), updatedAt: '2026-10-01' },
        { id: `cf-ana-aidat-${year}-${month}`, accountId: 'acc-ana-aidat', year, month, amount: year === 2026 ? 3200 : 2500, updatedAt: '2026-10-01' },
        { id: `cf-ana-fatura-${year}-${month}`, accountId: 'acc-ana-faturalar', year, month, amount: year === 2026 ? 4800 : 3600, updatedAt: '2026-10-01' },
        { id: `cf-ana-maas-${year}-${month}`, accountId: 'acc-ana-maas', year, month, amount: year === 2026 ? 95000 : 75000, updatedAt: '2026-10-01' }
      );
      if (month === 6 || month === 12) {
        cashFlows.push({ id: `cf-ana-prim-${year}-${month}`, accountId: 'acc-ana-prim', year, month, amount: year === 2026 ? 45000 : 30000, updatedAt: '2026-10-01' });
      }

      // Yatırım Hesabı
      cashFlows.push(
        { id: `cf-yat-k1-${year}-${month}`, accountId: 'acc-yat-kart1', year, month, amount: Math.round(28000 * yearMultiplier * monthVar), updatedAt: '2026-10-01' },
        { id: `cf-yat-k2-${year}-${month}`, accountId: 'acc-yat-kart2', year, month, amount: Math.round(12000 * yearMultiplier * (monthVar + 0.03)), updatedAt: '2026-10-01' },
        { id: `cf-yat-diger-${year}-${month}`, accountId: 'acc-yat-diger', year, month, amount: year === 2026 ? 8500 : 6000, updatedAt: '2026-10-01' },
        { id: `cf-yat-maas-${year}-${month}`, accountId: 'acc-yat-gelir', year, month, amount: year === 2026 ? 88000 : 70000, updatedAt: '2026-10-01' }
      );

      // Tasarruf Fonu
      cashFlows.push(
        { id: `cf-tas-egitim-${year}-${month}`, accountId: 'acc-tas-egitim', year, month, amount: year === 2026 ? 18000 : 14000, updatedAt: '2026-10-01' },
        { id: `cf-tas-sigorta-${year}-${month}`, accountId: 'acc-tas-sigorta', year, month, amount: year === 2026 ? 5500 : 4000, updatedAt: '2026-10-01' },
        { id: `cf-tas-aktarim-${year}-${month}`, accountId: 'acc-tas-aktarim', year, month, amount: 2000, updatedAt: '2026-10-01' }
      );

      // Ortak Kasa
      cashFlows.push(
        { id: `cf-ort-market-${year}-${month}`, accountId: 'acc-ort-market', year, month, amount: Math.round(22000 * yearMultiplier), updatedAt: '2026-10-01' },
        { id: `cf-ort-kira-${year}-${month}`, accountId: 'acc-ort-kira-gelir', year, month, amount: year === 2026 ? 25000 : 18000, updatedAt: '2026-10-01' }
      );
    }
  }
  await db.cashFlowEntries.bulkAdd(cashFlows);

  // 4. Varlık Alış & Satış Hareketleri (2025 - 2026)
  const transactions: AssetTransaction[] = [
    // Ana Hesap - Banka Gram Altın
    { id: 'tx-ana-altin-1', accountId: 'acc-ana-altin-banka', groupId: 'group-ana', date: '2025-03-15', year: 2025, month: 3, type: 'BUY', quantity: 5.0, totalAmountTRY: 16500, unitPriceTRY: 3300, note: 'Banka altın alımı', createdAt: '2025-03-15' },
    { id: 'tx-ana-altin-2', accountId: 'acc-ana-altin-banka', groupId: 'group-ana', date: '2025-08-20', year: 2025, month: 8, type: 'BUY', quantity: 6.5, totalAmountTRY: 26000, unitPriceTRY: 4000, note: 'Düzenli altın alımı', createdAt: '2025-08-20' },
    { id: 'tx-ana-altin-3', accountId: 'acc-ana-altin-banka', groupId: 'group-ana', date: '2026-02-10', year: 2026, month: 2, type: 'BUY', quantity: 4.0, totalAmountTRY: 20800, unitPriceTRY: 5200, note: 'Yıl başı altın alımı', createdAt: '2026-02-10' },
    { id: 'tx-ana-altin-4', accountId: 'acc-ana-altin-banka', groupId: 'group-ana', date: '2026-07-15', year: 2026, month: 7, type: 'BUY', quantity: 5.5, totalAmountTRY: 34100, unitPriceTRY: 6200, note: 'Dönemlik altın alımı', createdAt: '2026-07-15' },

    // Ana Hesap - TI2 Fonu
    { id: 'tx-ana-ti2-1', accountId: 'acc-ana-fon-ti2', groupId: 'group-ana', date: '2025-04-10', year: 2025, month: 4, type: 'BUY', quantity: 2000, totalAmountTRY: 18000, unitPriceTRY: 9.00, note: 'İlk fon alımı', createdAt: '2025-04-10' },
    { id: 'tx-ana-ti2-2', accountId: 'acc-ana-fon-ti2', groupId: 'group-ana', date: '2026-03-18', year: 2026, month: 3, type: 'BUY', quantity: 1500, totalAmountTRY: 18750, unitPriceTRY: 12.50, note: 'Ek fon alımı', createdAt: '2026-03-18' },

    // Yatırım Hesabı - Fiziki Gram Altın
    { id: 'tx-yat-altin-1', accountId: 'acc-yat-altin-fiziki', groupId: 'group-yatirim', date: '2025-02-14', year: 2025, month: 2, type: 'BUY', quantity: 5.0, totalAmountTRY: 16000, unitPriceTRY: 3200, note: 'Fiziki altın alımı', createdAt: '2025-02-14' },
    { id: 'tx-yat-altin-2', accountId: 'acc-yat-altin-fiziki', groupId: 'group-yatirim', date: '2025-10-25', year: 2025, month: 10, type: 'BUY', quantity: 5.0, totalAmountTRY: 22500, unitPriceTRY: 4500, note: 'Kuyumcu alımı', createdAt: '2025-10-25' },
    { id: 'tx-yat-altin-3', accountId: 'acc-yat-altin-fiziki', groupId: 'group-yatirim', date: '2026-05-12', year: 2026, month: 5, type: 'BUY', quantity: 4.0, totalAmountTRY: 24800, unitPriceTRY: 6200, note: 'Dönemlik fiziki birikim', createdAt: '2026-05-12' },

    // Yatırım Hesabı - MAC Fonu
    { id: 'tx-yat-mac-1', accountId: 'acc-yat-fon-mac', groupId: 'group-yatirim', date: '2025-05-20', year: 2025, month: 5, type: 'BUY', quantity: 1000, totalAmountTRY: 25000, unitPriceTRY: 25.00, note: 'Hisse fonu alımı', createdAt: '2025-05-20' },
    { id: 'tx-yat-mac-2', accountId: 'acc-yat-fon-mac', groupId: 'group-yatirim', date: '2026-04-15', year: 2026, month: 4, type: 'BUY', quantity: 500, totalAmountTRY: 16500, unitPriceTRY: 33.00, note: 'Düzenli fon birikimi', createdAt: '2026-04-15' },

    // Yatırım Hesabı - Euro Birikim (+ Alışlar ve - Harcamalar)
    { id: 'tx-yat-eur-1', accountId: 'acc-yat-euro', groupId: 'group-yatirim', date: '2025-01-20', year: 2025, month: 1, type: 'BUY', quantity: 1000, totalAmountTRY: 37500, unitPriceTRY: 37.50, note: 'Döviz alımı', createdAt: '2025-01-20' },
    { id: 'tx-yat-eur-2', accountId: 'acc-yat-euro', groupId: 'group-yatirim', date: '2025-06-15', year: 2025, month: 6, type: 'BUY', quantity: 1500, totalAmountTRY: 60000, unitPriceTRY: 40.00, note: 'Döviz birikimi', createdAt: '2025-06-15' },
    { id: 'tx-yat-eur-3', accountId: 'acc-yat-euro', groupId: 'group-yatirim', date: '2025-08-10', year: 2025, month: 8, type: 'SELL', quantity: 500, totalAmountTRY: 21500, unitPriceTRY: 43.00, note: 'Dönem harcaması', createdAt: '2025-08-10' },
    { id: 'tx-yat-eur-4', accountId: 'acc-yat-euro', groupId: 'group-yatirim', date: '2026-03-05', year: 2026, month: 3, type: 'BUY', quantity: 1200, totalAmountTRY: 58800, unitPriceTRY: 49.00, note: 'Portföy döviz alımı', createdAt: '2026-03-05' },

    // Tasarruf Fonu - Fiziki Çeyrek Altın
    { id: 'tx-tas-ceyrek-1', accountId: 'acc-tas-ceyrek', groupId: 'group-tasarruf', date: '2025-04-23', year: 2025, month: 4, type: 'BUY', quantity: 2, totalAmountTRY: 11000, unitPriceTRY: 5500, note: 'Çeyrek altın birikimi', createdAt: '2025-04-23' },
    { id: 'tx-tas-ceyrek-2', accountId: 'acc-tas-ceyrek', groupId: 'group-tasarruf', date: '2025-09-10', year: 2025, month: 9, type: 'BUY', quantity: 2, totalAmountTRY: 14000, unitPriceTRY: 7000, note: 'Tasarruf alımı', createdAt: '2025-09-10' },
    { id: 'tx-tas-ceyrek-3', accountId: 'acc-tas-ceyrek', groupId: 'group-tasarruf', date: '2026-04-23', year: 2026, month: 4, type: 'BUY', quantity: 2, totalAmountTRY: 19000, unitPriceTRY: 9500, note: 'Dönemlik çeyrek alımı', createdAt: '2026-04-23' },

    // Tasarruf Fonu - AFT Teknoloji Fonu
    { id: 'tx-tas-aft-1', accountId: 'acc-tas-fon-aft', groupId: 'group-tasarruf', date: '2025-07-01', year: 2025, month: 7, type: 'BUY', quantity: 1000, totalAmountTRY: 19000, unitPriceTRY: 19.00, note: 'Teknoloji fonu alımı', createdAt: '2025-07-01' },
    { id: 'tx-tas-aft-2', accountId: 'acc-tas-fon-aft', groupId: 'group-tasarruf', date: '2026-06-15', year: 2026, month: 6, type: 'BUY', quantity: 1000, totalAmountTRY: 24000, unitPriceTRY: 24.00, note: 'Fon takviyesi', createdAt: '2026-06-15' },

    // Ortak Kasa - Dolar Birikimi
    { id: 'tx-ort-usd-1', accountId: 'acc-ort-dolar', groupId: 'group-ortak', date: '2025-05-10', year: 2025, month: 5, type: 'BUY', quantity: 2000, totalAmountTRY: 70000, unitPriceTRY: 35.00, note: 'Acil durum rezervi', createdAt: '2025-05-10' },
    { id: 'tx-ort-usd-2', accountId: 'acc-ort-dolar', groupId: 'group-ortak', date: '2026-01-15', year: 2026, month: 1, type: 'BUY', quantity: 1500, totalAmountTRY: 66000, unitPriceTRY: 44.00, note: 'Ortak kasa takviyesi', createdAt: '2026-01-15' },
  ];
  await db.transactions.bulkAdd(transactions);

  // 5. Market Rates
  await db.marketRates.bulkAdd(INITIAL_RATES);

  // 6. Son 10 Günün Kur Tarihçesi (22 Eylül - 1 Ekim 2026)
  const historyRecords: MarketRateHistoryRecord[] = [];
  const baseSymbols = INITIAL_RATES.map(r => r.symbol);

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
