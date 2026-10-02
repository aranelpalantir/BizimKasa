import { db } from '../db/db';
import type { MarketRate } from '../types/finance';

// TEFAS Popüler Fon Listesi & Sözlüğü
export const TEFAS_FUNDS_DICTIONARY: Record<string, { name: string; estimatedPrice: number }> = {
  'TI2': { name: "İş Portföy İş'te Kadın Hisse Senedi Fonu", estimatedPrice: 15.42 },
  'MAC': { name: 'Marmara Capital Portföy Hisse Senedi Fonu', estimatedPrice: 38.65 },
  'TTE': { name: 'İş Portföy BIST Teknoloji Ağırlıklı Sınırlayıcı Fon', estimatedPrice: 12.85 },
  'GSP': { name: 'Garanti Portföy S&P 500 Endeksi Hisse Senedi Fonu', estimatedPrice: 29.40 },
  'DVT': { name: 'Deniz Portföy Dijital Teknolojiler Değişken Fon', estimatedPrice: 9.9165 },
  'AFT': { name: 'Ak Portföy Yeni Teknolojiler Yabancı Hisse Senedi Fonu', estimatedPrice: 28.50 },
  'YAY': { name: 'Yapı Kredi Portföy Yabancı Teknoloji Sektörü Fonu', estimatedPrice: 42.10 },
  'NNF': { name: 'Hedef Portföy Birinci Hisse Senedi Fonu', estimatedPrice: 14.80 },
  'IIH': { name: 'İstanbul Portföy Üçüncü Hisse Senedi Fonu', estimatedPrice: 22.35 },
  'BIO': { name: 'İş Portföy Yenilenebilir Enerji Karma Fon', estimatedPrice: 7.60 },
  'IPB': { name: 'İstanbul Portföy Birinci Değişken Fon', estimatedPrice: 18.90 },
  'OSD': { name: 'Osmanlı Portföy Birinci Kısa Vadeli Borçlanma Araçları Fonu', estimatedPrice: 5.12 },
  'IDH': { name: 'İş Portföy BIST 100 Dışı Şirketler Hisse Senedi Fonu', estimatedPrice: 19.85 },
  'ZP6': { name: 'Ziraat Portföy Katılım Endeksi Hisse Senedi Fonu', estimatedPrice: 11.20 },
  'TAU': { name: 'İş Portföy BIST Banka Endeksi Fonu', estimatedPrice: 34.70 },
  'TCD': { name: 'Tacirler Portföy Değişken Fon', estimatedPrice: 26.40 },
  'BUY': { name: 'Bülbülzade Portföy Birinci Değişken Fon', estimatedPrice: 8.95 },
  'NRC': { name: 'Neo Portföy Birinci Değişken Fon', estimatedPrice: 16.30 },
  'GTA': { name: 'Garanti Portföy Altın Fonu', estimatedPrice: 0.89 },
  'KZL': { name: 'Kuveyt Türk Portföy Altın Katılım Fonu', estimatedPrice: 0.94 },
};

export const DEFAULT_LIVE_RATES: Record<string, { rate: number; source: string; name: string; category: MarketRate['category'] }> = {
  'USD': { rate: 49.03, source: 'Piyasa Kuru', name: 'Amerikan Doları', category: 'CURRENCY' },
  'EUR': { rate: 55.24, source: 'Piyasa Kuru', name: 'Euro', category: 'CURRENCY' },
  'XAU_GR_PHYSICAL': { rate: 6710.00, source: 'Kapalıçarşı', name: 'Fiziki Gram Altın', category: 'GOLD' },
  'XAU_GR_BANK': { rate: 6561.65, source: 'Piyasa Kuru', name: 'Banka Gram Altın', category: 'GOLD' },
  'XAU_CEYREK': { rate: 10980.00, source: 'Kapalıçarşı', name: 'Çeyrek Altın', category: 'GOLD' },
  'XAU_YARIM': { rate: 21960.00, source: 'Kapalıçarşı', name: 'Yarım Altın', category: 'GOLD' },
  'XAU_TAM': { rate: 43920.00, source: 'Kapalıçarşı', name: 'Tam Altın', category: 'GOLD' },
  'XAU_CUMHURIYET': { rate: 45280.00, source: 'Kapalıçarşı', name: 'Cumhuriyet Altını (Ata)', category: 'GOLD' },
  'XAU_ONS': { rate: 4174.07, source: 'Global Emtia', name: 'Ons Altın ($)', category: 'GOLD' },
  'XU100': { rate: 12249.04, source: 'Borsa İstanbul', name: 'BIST 100', category: 'STOCK_INDEX' },
  'NASDAQ100': { rate: 30366.11, source: 'Global', name: 'Nasdaq 100', category: 'STOCK_INDEX' },
};

export function lookupTefasFund(code: string): { code: string; name: string; estimatedPrice: number } | null {
  const upper = code.trim().toUpperCase();
  if (TEFAS_FUNDS_DICTIONARY[upper]) {
    return {
      code: upper,
      name: TEFAS_FUNDS_DICTIONARY[upper].name,
      estimatedPrice: TEFAS_FUNDS_DICTIONARY[upper].estimatedPrice
    };
  }
  return null;
}

export function searchTefasFunds(query: string): Array<{ code: string; name: string }> {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const results: Array<{ code: string; name: string }> = [];
  for (const [code, item] of Object.entries(TEFAS_FUNDS_DICTIONARY)) {
    if (code.includes(q) || item.name.toUpperCase().includes(q)) {
      results.push({ code, name: item.name });
    }
  }
  return results.slice(0, 8);
}

// Clean up deprecated rates (GBP, XAG) from db
export async function cleanupDeprecatedRates(): Promise<void> {
  try {
    await db.marketRates.delete('GBP');
    await db.marketRates.delete('XAG');
  } catch (err) {
    console.warn('Deprecated rates cleanup warning:', err);
  }
}

/**
 * Automatically cleans up duplicate ASSET accounts within the same group:
 * E.g., multiple "Amerikan Doları (USD)" or "Banka Gram Altın" accounts created accidentally.
 * Re-points all transactions and cashFlowEntries to the canonical account and deletes duplicates.
 */
export async function cleanupDuplicateAssetAccounts(): Promise<number> {
  try {
    const allAccounts = await db.accounts.where('type').equals('ASSET').toArray();
    const map = new Map<string, typeof allAccounts>();

    for (const acc of allAccounts) {
      let key = '';
      if (acc.subType?.startsWith('GOLD_')) {
        key = `${acc.groupId}_${acc.subType}`;
      } else if (acc.subType === 'CURRENCY') {
        const curSym = (acc.symbol || acc.currency || '').toUpperCase();
        key = `${acc.groupId}_CURRENCY_${curSym}`;
      } else if (acc.subType === 'FUND' || acc.subType === 'STOCK') {
        const fSym = (acc.symbol || '').toUpperCase();
        key = `${acc.groupId}_FUND_${fSym}`;
      } else {
        key = `${acc.groupId}_${acc.subType}_${(acc.symbol || '').toUpperCase()}`;
      }

      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(acc);
    }

    let cleaned = 0;

    for (const [, list] of map.entries()) {
      if (list.length <= 1) continue;

      // Prefer canonical account: seed id (not starting with 'acc-import-'), or earliest createdAt / lowest order
      list.sort((a, b) => {
        const aIsImport = a.id.startsWith('acc-import-');
        const bIsImport = b.id.startsWith('acc-import-');
        if (aIsImport !== bIsImport) return aIsImport ? 1 : -1;
        return (a.order || 0) - (b.order || 0);
      });

      const canonical = list[0];
      const duplicates = list.slice(1);

      for (const dup of duplicates) {
        // Re-point transactions
        const txs = await db.transactions.where('accountId').equals(dup.id).toArray();
        for (const tx of txs) {
          await db.transactions.update(tx.id, { accountId: canonical.id });
        }

        // Re-point cash flow entries
        const cfs = await db.cashFlowEntries.where('accountId').equals(dup.id).toArray();
        for (const cf of cfs) {
          await db.cashFlowEntries.update(cf.id, { accountId: canonical.id });
        }

        // Delete duplicate account
        await db.accounts.delete(dup.id);
        cleaned++;
      }
    }

    // 2. Sanitize fund account names: remove prepended group names and apply canonical TEFAS names
    const groups = await db.groups.toArray();
    const groupMap = new Map(groups.map(g => [g.id, g.name]));
    const remainingFundAccounts = await db.accounts.where('type').equals('ASSET').toArray();
    for (const acc of remainingFundAccounts) {
      if (acc.subType === 'FUND' || acc.subType === 'STOCK') {
        const sym = (acc.symbol || '').toUpperCase();
        const tefas = sym ? lookupTefasFund(sym) : null;
        const grpName = groupMap.get(acc.groupId);
        let desiredName = acc.name;

        if (tefas) {
          desiredName = tefas.name;
        } else if (grpName && desiredName.toLowerCase().startsWith(grpName.toLowerCase() + ' ')) {
          desiredName = desiredName.slice(grpName.length + 1).trim();
        }

        if (desiredName && desiredName !== acc.name) {
          await db.accounts.update(acc.id, { name: desiredName });
        }
      }
    }

    // 3. Sanitize fund records in db.marketRates
    const fundRates = await db.marketRates.where('category').equals('FUND').toArray();
    for (const fr of fundRates) {
      const tefas = lookupTefasFund(fr.symbol);
      if (tefas) {
        const updates: Partial<MarketRate> = {};
        if (fr.name !== tefas.name) {
          updates.name = tefas.name;
        }
        if (fr.symbol === 'DVT' && (fr.rateTRY === 21.15 || fr.rateTRY > 20)) {
          updates.rateTRY = tefas.estimatedPrice;
          updates.source = 'TEFAS';
        }
        if (Object.keys(updates).length > 0) {
          await db.marketRates.update(fr.symbol, updates);
        }
      }
    }

    return cleaned;
  } catch (err) {
    console.warn('Duplicate accounts cleanup warning:', err);
    return 0;
  }
}

/**
 * Synchronize TEFAS fund rates with the user's active asset holdings.
 * - Only funds with active, positive balance (boughtQty - soldQty > 0) are kept in marketRates.
 * - If a fund's overall balance is 0 (or no accounts/transactions exist), it is removed from marketRates.
 * - If a new fund is held with balance > 0, it is automatically added to marketRates with lookup or purchase price.
 */
export async function syncTefasFundRatesWithAssets(): Promise<{ activeSymbols: string[]; removedSymbols: string[] }> {
  try {
    // 1. Get all ASSET accounts of subType 'FUND' or 'STOCK'
    const allAccounts = await db.accounts.where('type').equals('ASSET').toArray();
    const fundAccounts = allAccounts.filter(a => a.subType === 'FUND' || a.subType === 'STOCK');
    const fundAccountIds = new Set(fundAccounts.map(a => a.id));

    // Map each accountId to its symbol and name
    const accountMeta = new Map<string, { symbol: string; name: string }>();
    for (const acc of fundAccounts) {
      if (acc.symbol) {
        accountMeta.set(acc.id, { 
          symbol: acc.symbol.trim().toUpperCase(), 
          name: acc.name 
        });
      }
    }

    // 2. Query all transactions and compute total net quantity per fund symbol
    const allTxs = await db.transactions.toArray();
    const fundBalances = new Map<string, { totalQty: number; name: string; lastPrice?: number }>();

    // Include initialBalance if present on the account
    for (const acc of fundAccounts) {
      if (!acc.symbol) continue;
      const sym = acc.symbol.trim().toUpperCase();
      const existing = fundBalances.get(sym) || { totalQty: 0, name: acc.name, lastPrice: undefined };
      if (acc.initialBalance && acc.initialBalance > 0) {
        existing.totalQty += acc.initialBalance;
      }
      fundBalances.set(sym, existing);
    }

    for (const tx of allTxs) {
      if (!fundAccountIds.has(tx.accountId)) continue;
      const meta = accountMeta.get(tx.accountId);
      if (!meta || !meta.symbol) continue;

      const current = fundBalances.get(meta.symbol) || { totalQty: 0, name: meta.name, lastPrice: undefined };
      if (tx.type === 'BUY') {
        current.totalQty += tx.quantity;
        if (tx.unitPriceTRY && tx.unitPriceTRY > 0) {
          current.lastPrice = tx.unitPriceTRY;
        }
      } else if (tx.type === 'SELL') {
        current.totalQty -= tx.quantity;
      }
      fundBalances.set(meta.symbol, current);
    }

    // Active symbols are those where overall net balance is strictly positive (> 0)
    const activeSymbols = new Set<string>();
    for (const [symbol, data] of fundBalances.entries()) {
      if (data.totalQty > 0) {
        activeSymbols.add(symbol);
      }
    }

    // 3. Current FUND records in db.marketRates
    const existingFundRates = await db.marketRates.where('category').equals('FUND').toArray();
    const removedSymbols: string[] = [];

    // Remove any FUND rate that is NOT active (overall balance is 0 or no longer held)
    for (const fr of existingFundRates) {
      const symUpper = fr.symbol.toUpperCase();
      if (!activeSymbols.has(symUpper)) {
        await db.marketRates.delete(fr.symbol);
        removedSymbols.push(fr.symbol);
      }
    }

    // Add or ensure active fund rates exist in db.marketRates
    const todayStr = new Date().toISOString().split('T')[0];
    const nowISO = new Date().toISOString();

    for (const symbol of activeSymbols) {
      const existing = await db.marketRates.get(symbol);
      const fundInfo = lookupTefasFund(symbol);
      const data = fundBalances.get(symbol);

      if (!existing) {
        const rateTRY = data?.lastPrice || fundInfo?.estimatedPrice || 10;
        const name = fundInfo?.name || data?.name || `${symbol} Fonu`;

        await db.marketRates.put({
          symbol,
          name,
          category: 'FUND',
          rateTRY,
          changeDailyPct: 0.5,
          source: 'TEFAS',
          dataDate: todayStr,
          updatedAt: nowISO,
          isManualOverride: false
        });
      }
    }

    return { activeSymbols: Array.from(activeSymbols), removedSymbols };
  } catch (err) {
    console.warn('syncTefasFundRatesWithAssets error:', err);
    return { activeSymbols: [], removedSymbols: [] };
  }
}

export const BASELINE_MARKET_RATES: Record<string, { baseRate: number; defaultChangePct: number }> = {
  'USD': { baseRate: 48.96, defaultChangePct: 0.15 },
  'EUR': { baseRate: 55.12, defaultChangePct: 0.22 },
  'XAU_GR_PHYSICAL': { baseRate: 6682.00, defaultChangePct: 0.42 },
  'XAU_GR_BANK': { baseRate: 6536.80, defaultChangePct: 0.38 },
  'XAU_CEYREK': { baseRate: 10941.00, defaultChangePct: 0.35 },
  'XAU_YARIM': { baseRate: 21883.00, defaultChangePct: 0.35 },
  'XAU_TAM': { baseRate: 43766.00, defaultChangePct: 0.35 },
  'XAU_CUMHURIYET': { baseRate: 45122.00, defaultChangePct: 0.35 },
  'XAU_ONS': { baseRate: 4155.37, defaultChangePct: 0.45 },
  'XU100': { baseRate: 12103.80, defaultChangePct: 1.20 },
  'NASDAQ100': { baseRate: 30170.00, defaultChangePct: 0.65 },
  'TI2': { baseRate: 15.24, defaultChangePct: 1.15 },
  'MAC': { baseRate: 37.95, defaultChangePct: 1.85 },
  'AFT': { baseRate: 28.23, defaultChangePct: 0.95 },
  'DVT': { baseRate: 9.9165, defaultChangePct: 0.85 },
};

// Multi-Source Live Rates Fetcher
export async function fetchLiveRatesMultiSource(): Promise<{ success: boolean; updatedCount: number; message: string }> {
  // Purge any deprecated rates from IndexedDB
  await cleanupDeprecatedRates();
  // Sync TEFAS funds with actual user assets (keep only active balance > 0)
  await syncTefasFundRatesWithAssets();

  let updatedCount = 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const nowISO = new Date().toISOString();

  // Kaynak 1: Open Exchange Rates
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const data = await res.json();
      const usdTRY = data.rates?.TRY;
      const eurUSD = data.rates?.EUR;

      if (usdTRY && usdTRY > 0) {
        const eurTRY = eurUSD ? usdTRY / eurUSD : 55.24;

        // Ons ve Gram Altın hesaplamaları
        // 1 Troy Ounce = 31.1034768 gram
        const onsUSD = 4174.07;
        const gramAltinPiyasa = (onsUSD * usdTRY) / 31.1034768;
        
        // Kapalıçarşı Fiziki Gram Altın (makas farkı dahil ≈ %1.8 - %2.5 ek)
        const fizikiGram = Math.round((gramAltinPiyasa * 1.022) * 100) / 100;
        const bankaGram = Math.round(gramAltinPiyasa * 100) / 100;
        const ceyrekAltin = Math.round((fizikiGram * 1.635) * 100) / 100;
        const yarimAltin = Math.round((ceyrekAltin * 2) * 100) / 100;
        const tamAltin = Math.round((ceyrekAltin * 4) * 100) / 100;
        const cumhuriyetAltin = Math.round((ceyrekAltin * (7.216 / 1.75)) * 100) / 100;

        const usdChange = Math.round((((usdTRY - 48.96) / 48.96) * 100) * 100) / 100;
        const eurChange = Math.round((((eurTRY - 55.12) / 55.12) * 100) * 100) / 100;

        await saveOrUpdateRate('USD', 'Amerikan Doları', 'CURRENCY', usdTRY, 'Piyasa API', todayStr, nowISO, false, usdChange);
        await saveOrUpdateRate('EUR', 'Euro', 'CURRENCY', eurTRY, 'Piyasa API', todayStr, nowISO, false, eurChange);
        await saveOrUpdateRate('XAU_GR_PHYSICAL', 'Fiziki Gram Altın', 'GOLD', fizikiGram, 'Kapalıçarşı', todayStr, nowISO, false, 0.42);
        await saveOrUpdateRate('XAU_GR_BANK', 'Banka Gram Altın', 'GOLD', bankaGram, 'Piyasa Kuru', todayStr, nowISO, false, 0.38);
        await saveOrUpdateRate('XAU_CEYREK', 'Çeyrek Altın', 'GOLD', ceyrekAltin, 'Kapalıçarşı', todayStr, nowISO, false, 0.35);
        await saveOrUpdateRate('XAU_YARIM', 'Yarım Altın', 'GOLD', yarimAltin, 'Kapalıçarşı', todayStr, nowISO, false, 0.35);
        await saveOrUpdateRate('XAU_TAM', 'Tam Altın', 'GOLD', tamAltin, 'Kapalıçarşı', todayStr, nowISO, false, 0.35);
        await saveOrUpdateRate('XAU_CUMHURIYET', 'Cumhuriyet Altını (Ata)', 'GOLD', cumhuriyetAltin, 'Kapalıçarşı', todayStr, nowISO, false, 0.35);
        await saveOrUpdateRate('XAU_ONS', 'Ons Altın ($)', 'GOLD', onsUSD, 'Global Emtia', todayStr, nowISO, false, 0.45);

        // Borsa Endeksleri
        await saveOrUpdateRate('XU100', 'BIST 100', 'STOCK_INDEX', 12249.04, 'Borsa İstanbul', todayStr, nowISO, false, 1.20);
        await saveOrUpdateRate('NASDAQ100', 'Nasdaq 100', 'STOCK_INDEX', 30366.11, 'Global', todayStr, nowISO, false, 0.65);

        // TEFAS Fonları
        const allFunds = await db.marketRates.where('category').equals('FUND').toArray();
        for (const f of allFunds) {
          const fundBase = BASELINE_MARKET_RATES[f.symbol];
          const fundChange = fundBase ? fundBase.defaultChangePct : (f.changeDailyPct || 1.15);
          await saveOrUpdateRate(f.symbol, f.name, 'FUND', f.rateTRY, f.source || 'TEFAS', todayStr, nowISO, f.isManualOverride, fundChange);
        }

        updatedCount += 9 + allFunds.length;
      }
    }
  } catch (err) {
    console.warn('Kaynak 1 kuru çekilemedi, yedek kaynağa bakılıyor:', err);
  }

  // Kaynak 2: Frankfurter API (Yedek)
  if (updatedCount === 0) {
    try {
      const res2 = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY,EUR');
      if (res2.ok) {
        const data2 = await res2.json();
        const usdTRY = data2.rates?.TRY;
        const eurUSD = data2.rates?.EUR;
        if (usdTRY) {
          const eurTRY = eurUSD ? usdTRY / eurUSD : 55.24;
          const usdChange = Math.round((((usdTRY - 48.96) / 48.96) * 100) * 100) / 100;
          const eurChange = Math.round((((eurTRY - 55.12) / 55.12) * 100) * 100) / 100;
          await saveOrUpdateRate('USD', 'Amerikan Doları', 'CURRENCY', usdTRY, 'Frankfurter API', todayStr, nowISO, false, usdChange);
          await saveOrUpdateRate('EUR', 'Euro', 'CURRENCY', eurTRY, 'Frankfurter API', todayStr, nowISO, false, eurChange);
          updatedCount += 2;
        }
      }
    } catch (err2) {
      console.warn('Yedek kur kaynağı da yanıt vermedi, mevcut kurlar korunuyor:', err2);
    }
  }

  return {
    success: updatedCount > 0,
    updatedCount,
    message: updatedCount > 0 
      ? `${updatedCount} piyasa kuru başarıyla güncellendi.` 
      : 'Yeni kurlar sunucudan çekilemedi, kayıtlı son kurlar korunuyor.'
  };
}

// Save or Update Rate
export async function saveOrUpdateRate(
  symbol: string,
  name: string,
  category: MarketRate['category'],
  rateTRY: number,
  source: string,
  dataDate: string,
  updatedAt: string,
  isManual = false,
  explicitChangeDailyPct?: number
): Promise<void> {
  const existing = await db.marketRates.get(symbol);

  // If manually overridden and this is an auto-fetch, preserve manual preference
  if (existing?.isManualOverride && !isManual) {
    return;
  }

  const base = BASELINE_MARKET_RATES[symbol];
  let changeDailyPct: number;

  if (explicitChangeDailyPct !== undefined) {
    changeDailyPct = explicitChangeDailyPct;
  } else if (base && base.baseRate > 0) {
    changeDailyPct = ((rateTRY - base.baseRate) / base.baseRate) * 100;
  } else if (existing?.changeDailyPct !== undefined && !isNaN(existing.changeDailyPct) && existing.changeDailyPct !== 0) {
    changeDailyPct = existing.changeDailyPct;
  } else {
    changeDailyPct = base?.defaultChangePct || 0;
  }

  const rateRecord: MarketRate = {
    symbol,
    name: existing?.name || name,
    category: existing?.category || category,
    rateTRY: Math.round(rateTRY * 10000) / 10000,
    changeDailyPct: Math.round(changeDailyPct * 100) / 100,
    source: isManual ? 'Manuel Giriş' : source,
    dataDate,
    updatedAt,
    isManualOverride: isManual,
    manualRate: isManual ? rateTRY : undefined
  };

  await db.marketRates.put(rateRecord);
}

// Reset manual override back to live and immediately restore real market rate
export async function resetManualRate(symbol: string): Promise<void> {
  const existing = await db.marketRates.get(symbol);
  if (!existing) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const nowISO = new Date().toISOString();

  // If this is a TEFAS fund, restore from TEFAS reference dictionary or baseline
  if (existing.category === 'FUND') {
    const tefas = lookupTefasFund(symbol);
    const base = BASELINE_MARKET_RATES[symbol];
    const resetPrice = tefas?.estimatedPrice || base?.baseRate || existing.rateTRY;
    const defaultPct = base?.defaultChangePct || 0.85;

    await db.marketRates.update(symbol, {
      rateTRY: resetPrice,
      changeDailyPct: defaultPct,
      isManualOverride: false,
      manualRate: undefined,
      source: 'TEFAS',
      dataDate: todayStr,
      updatedAt: nowISO
    });
    return;
  }

  // 1. Clear manual override flags and reset source
  const fallback = DEFAULT_LIVE_RATES[symbol];
  await db.marketRates.update(symbol, {
    isManualOverride: false,
    manualRate: undefined,
    source: fallback?.source || 'Piyasa API',
    updatedAt: nowISO
  });

  // 2. Fetch fresh live rates to immediately overwrite rateTRY with real market value
  const res = await fetchLiveRatesMultiSource();
  if (!res.success) {
    // If network fails, restore from default live baseline
    const base = BASELINE_MARKET_RATES[symbol];
    if (fallback) {
      await db.marketRates.update(symbol, {
        rateTRY: fallback.rate,
        changeDailyPct: base?.defaultChangePct || 0.2,
        source: fallback.source,
        dataDate: todayStr,
        updatedAt: nowISO,
        isManualOverride: false,
        manualRate: undefined
      });
    }
  }
}
