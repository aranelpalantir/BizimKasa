import { db } from '../db/db';
import type { MarketRate } from '../types/finance';

export async function fetchLiveRates(): Promise<MarketRate[]> {
  try {
    // 1. Fetch free public FX rates (USD, EUR to TRY)
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const data = await res.json();
      const tryRate = data.rates?.TRY;
      const eurRate = data.rates?.EUR;

      if (tryRate) {
        const usdTRY = tryRate;
        const eurTRY = eurRate ? tryRate / eurRate : 55.24;

        // Approximate Gram Altın based on standard Gold ONS if not overridden
        // 1 Troy Ounce = 31.1035 grams
        // Gram Altın TRY ≈ (ONS_USD * USD_TRY) / 31.1035
        const currentOns = 4174.07; // baseline or live
        const calcGramAltin = (currentOns * usdTRY) / 31.1035;
        const calcCeyrek = calcGramAltin * 1.635; // standard çeyrek factor ≈ 1.605 - 1.635

        await updateRate('USD', usdTRY);
        await updateRate('EUR', eurTRY);
        await updateRate('XAU_GR', Math.round(calcGramAltin * 100) / 100);
        await updateRate('XAU_CEYREK', Math.round(calcCeyrek * 100) / 100);
      }
    }
  } catch (err) {
    console.warn('Live rates fetch failed, using stored local cache:', err);
  }

  return await db.marketRates.toArray();
}

export async function updateRate(symbol: string, newRate: number, isManual = false): Promise<void> {
  const existing = await db.marketRates.get(symbol);
  if (existing) {
    // If it was manually overridden and this is an auto-fetch, don't overwrite manual preference
    if (existing.isManualOverride && !isManual) {
      return;
    }

    const prevRate = existing.rateTRY;
    const changePct = prevRate > 0 ? ((newRate - prevRate) / prevRate) * 100 : 0;

    await db.marketRates.update(symbol, {
      rateTRY: newRate,
      changeDailyPct: isManual ? existing.changeDailyPct : Math.round(changePct * 100) / 100,
      updatedAt: new Date().toISOString(),
      isManualOverride: isManual,
      manualRate: isManual ? newRate : existing.manualRate
    });
  }
}

export async function resetManualRate(symbol: string): Promise<void> {
  await db.marketRates.update(symbol, {
    isManualOverride: false,
    manualRate: undefined,
    updatedAt: new Date().toISOString()
  });
}
