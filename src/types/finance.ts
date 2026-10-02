export type AccountType = 'INCOME' | 'EXPENSE' | 'ASSET';

export type AssetSubType = 
  | 'GOLD_GRAM_PHYSICAL' // Fiziki Gram Altın
  | 'GOLD_GRAM_BANK'     // Banka Gram Altın
  | 'GOLD_CEYREK'        // Çeyrek Altın (Fiziki)
  | 'GOLD_YARIM'         // Yarım Altın
  | 'GOLD_TAM'           // Tam Altın (Ziynet - 7.00 gr)
  | 'GOLD_CUMHURIYET'    // Cumhuriyet Altını (Ata Lira - 7.216 gr)
  | 'CURRENCY'           // Döviz (USD, EUR, GBP)
  | 'FUND'               // TEFAS Yatırım Fonu
  | 'STOCK'              // Hisse Senedi (BIST / Yabancı)
  | 'CASH'               // Nakit / Vadesiz / Mevduat
  | 'CREDIT_CARD'        // Kredi Kartı
  | 'EXPENSE_FIXED'      // Sabit Gider / Aidat / Kira
  | 'EXPENSE_BILLS'      // Fatura
  | 'EXPENSE_OTHER'      // Diğer Harcama
  | 'INCOME_SALARY'      // Maaş
  | 'INCOME_RENT'        // Kira Geliri
  | 'INCOME_BONUS'       // Prim / İkramiye
  | 'INCOME_OTHER'       // Ek Gelir
  | 'OTHER';

export interface Group {
  id: string;
  name: string;        // "Ana Hesap", "Yatırım Hesabı", "Tasarruf Fonu", "Ortak Kasa"
  color: string;       // HEX code
  order: number;
  createdAt: string;
}

export interface Account {
  id: string;
  groupId: string;     // Hangi hesaba ait olduğu (Ana Hesap, Yatırım, Ortak vb.)
  name: string;        // "Ziraat Banka Gram Altın", "Kasa Fiziki Gram", "Maaş", vb.
  type: AccountType;
  subType: AssetSubType;
  symbol?: string;     // 'USD', 'EUR', 'XAU_GR_PHYSICAL', 'XAU_GR_BANK', 'XAU_CEYREK', 'TI2', 'MAC', vb.
  bankName?: string;   // 'Garanti', 'Ziraat', 'Fiziki Kasa', vb.
  currency: 'TRY' | 'USD' | 'EUR';
  order: number;
  initialBalance?: number;
  targetAllocationPct?: number;
  createdAt: string;
}

export interface CashFlowEntry {
  id: string;
  accountId: string;   // Foreign key to Account
  year: number;        // e.g. 2025, 2026
  month: number;       // 1 - 12 (Ocak - Aralık)
  amount: number;      // Tutar (TL)
  note?: string;
  isProjected?: boolean;
  updatedAt: string;
}

export interface AssetTransaction {
  id: string;
  accountId: string;   // Foreign key to Account
  groupId?: string;    // İsteğe bağlı işlem bazlı grup eşleme
  date: string;        // 'YYYY-MM-DD'
  year: number;
  month: number;       // 1 - 12
  type: 'BUY' | 'SELL';
  quantity: number;    // Alışlarda pozitif, satışlarda bozdurulan miktar
  totalAmountTRY: number; // Toplam TL maliyeti veya satım geliri
  unitPriceTRY: number;   // Birim TL fiyatı
  note?: string;
  createdAt: string;
}

export type MarketRateCategory = 'CURRENCY' | 'GOLD' | 'COMMODITY' | 'STOCK_INDEX' | 'FUND';

export interface MarketRate {
  symbol: string;         // 'USD', 'EUR', 'XAU_GR_PHYSICAL', 'XAU_GR_BANK', 'XAU_CEYREK', 'XU100', 'MAC', vb.
  name: string;           // "Gram Altın (Fiziki)", "Gram Altın (Banka)", vb.
  category: MarketRateCategory;
  rateTRY: number;        // Güncel TL fiyatı
  changeDailyPct: number; // Günlük % değişim
  source: string;         // "TCMB / Piyasa", "TEFAS", "Kapalıçarşı", "Manuel"
  dataDate: string;       // Verinin ait olduğu gün (YYYY-MM-DD)
  updatedAt: string;      // Son güncelleme anı (ISO)
  isManualOverride: boolean;
  manualRate?: number;
}

export interface InvestmentAllocation {
  accountId: string;
  targetAmountTRY: number;
  actualAmountTRY?: number;
  completed?: boolean;
}

export interface MonthlyInvestmentPlan {
  id: string;
  year: number;
  month: number;
  groupId?: string;       // Grup bazlı veya konsolide
  totalPlannedTRY: number;
  allocations: InvestmentAllocation[];
  notes?: string;
  updatedAt: string;
}

export interface AppSettings {
  pinHash?: string;
  pinLength?: number;
  biometricsEnabled: boolean;
  biometricCredentialId?: string;
  autoLockMinutes: number;
  lastActiveTimestamp: number;
  isLocked: boolean;
  defaultCurrency: 'TRY' | 'USD' | 'EUR';
  hideValuesOnScreen: boolean;
  selectedGroupFilter?: string; // 'ALL' or specific groupId
}
