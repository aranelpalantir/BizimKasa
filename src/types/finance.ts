export type AccountType = 'INCOME' | 'EXPENSE' | 'ASSET';

export type AssetSubType = 
  | 'GOLD_GRAM'      // Gram Altın (24k, banka veya fiziki)
  | 'GOLD_PIECE'     // Çeyrek, Yarım, Tam Altın
  | 'CURRENCY'       // USD, EUR, GBP vb.
  | 'FUND'           // TEFAS Yatırım Fonu (TTE, GSP, DVT vb.)
  | 'STOCK'          // BIST veya Yabancı Hisse
  | 'CASH'           // Nakit TL / Vadesiz Hesap
  | 'CREDIT_CARD'    // Kredi kartı ekstreleri
  | 'OTHER';

export interface Group {
  id: string;
  name: string;        // "Mert", "Aylin", "Çocuk", "Ortak Ev"
  color: string;       // HEX code (#3b82f6, #8b5cf6, etc.)
  order: number;
  createdAt: string;
}

export interface Account {
  id: string;
  groupId: string;     // Foreign key to Group
  name: string;        // "Aylin Vakıf", "Mert İş", "Gram Altın", "TTE Fonu"
  type: AccountType;
  subType: AssetSubType;
  symbol?: string;     // E.g. 'USD', 'EUR', 'XAU_GR', 'XAU_CEYREK', 'TTE', 'GSP', 'DVT'
  bankName?: string;   // E.g. 'Vakıfbank', 'Garanti', 'İş Bankası', 'Fiziki Kasa'
  currency: 'TRY' | 'USD' | 'EUR';
  order: number;
  initialBalance?: number;
  targetAllocationPct?: number; // e.g. %25
  createdAt: string;
}

// Aylık Gelir ve Gider / Kredi Kartı Ekstre Matrisi (Google Sheet Görsel 1)
export interface CashFlowEntry {
  id: string;
  accountId: string;   // Foreign key to Account
  year: number;        // e.g. 2026
  month: number;       // 1 - 12 (Ocak - Aralık)
  amount: number;      // Harcama / Gelir tutarı (TL)
  note?: string;
  isProjected?: boolean; // Önümüzdeki ay tahmini / taksiti
  updatedAt: string;
}

// Alış ve Satış Varlık Hareketleri (Google Sheet Görsel 2, 3, 4, 5)
export interface AssetTransaction {
  id: string;
  accountId: string;   // Foreign key to Account (e.g. Gram Altın, Euro, TTE)
  date: string;        // 'YYYY-MM-DD'
  year: number;
  month: number;       // 1 - 12
  type: 'BUY' | 'SELL';
  quantity: number;    // Adet / Gram / Lot / Döviz miktarı (bozdurulduğunda pozitif sayı, SELL türünde)
  totalAmountTRY: number; // Toplam TL maliyeti veya bozdurma karşılığı
  unitPriceTRY: number;   // Birim TL maliyet (totalAmountTRY / quantity)
  note?: string;
  createdAt: string;
}

// Piyasa Kurları & Fiyat Göstergeleri
export interface MarketRate {
  symbol: string;         // 'USD', 'EUR', 'XAU_GR', 'XAU_CEYREK', 'XAU_ONS', 'XAG', 'XU100', 'NASDAQ100', 'TTE', etc.
  name: string;           // "Gram Altın", "Amerikan Doları", "TTE - İş Portföy BIST Teknoloji"
  category: 'CURRENCY' | 'GOLD' | 'COMMODITY' | 'INDEX' | 'FUND';
  rateTRY: number;        // Güncel alış/satış TL fiyatı
  changeDailyPct: number; // Günlük % değişim
  updatedAt: string;
  isManualOverride: boolean;
  manualRate?: number;
}

// Aylık Yatırım Bütçesi ve Hedef Dağılımı
export interface InvestmentAllocation {
  accountId: string;      // Hedef varlık hesabı
  targetAmountTRY: number;// Hedeflenen yatırım tutarı
  actualAmountTRY?: number;
  completed?: boolean;
}

export interface MonthlyInvestmentPlan {
  id: string;
  year: number;
  month: number;
  totalPlannedTRY: number;
  allocations: InvestmentAllocation[];
  notes?: string;
  updatedAt: string;
}

// Güvenlik ve Uygulama Ayarları
export interface AppSettings {
  pinHash?: string;           // SHA-256 hash of PIN
  biometricsEnabled: boolean; // FaceID / TouchID / Windows Hello
  autoLockMinutes: number;    // 0 = anında, 1, 5, 15, 0 = kapalı
  lastActiveTimestamp: number;
  isLocked: boolean;
  defaultCurrency: 'TRY' | 'USD' | 'EUR';
  hideValuesOnScreen: boolean;// Gizlilik modu (rakamları yıldızlama)
}
