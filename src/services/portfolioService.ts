import type { Account, AssetTransaction, MarketRate } from '../types/finance';

export interface AssetPosition {
  account: Account;
  symbol: string;
  name: string;
  subType: string;
  totalQuantity: number;
  totalCostTRY: number;
  avgCostTRY: number;
  currentRateTRY: number;
  currentValueTRY: number;
  profitLossTRY: number;
  profitLossPct: number;
  portfolioWeightPct: number;
  dailyChangePct: number;
}

export interface PortfolioSummary {
  totalCostTRY: number;
  totalValueTRY: number;
  profitLossTRY: number;
  profitLossPct: number;
  profitLossUSD: number;
  profitLossEUR: number;
  profitLossGoldGram: number;
  positions: AssetPosition[];
  goldPositions: AssetPosition[];
  currencyPositions: AssetPosition[];
  fundPositions: AssetPosition[];
  otherPositions: AssetPosition[];
}

export function calculatePortfolioSummary(
  accounts: Account[],
  transactions: AssetTransaction[],
  rates: MarketRate[]
): PortfolioSummary {
  const rateMap = new Map<string, MarketRate>();
  for (const r of rates) {
    rateMap.set(r.symbol, r);
  }

  const assetAccounts = accounts.filter(a => a.type === 'ASSET');
  const positions: AssetPosition[] = [];

  let totalCostTRY = 0;
  let totalValueTRY = 0;

  for (const account of assetAccounts) {
    const accTxs = transactions.filter(t => t.accountId === account.id);
    if (accTxs.length === 0) continue;

    let boughtQty = 0;
    let boughtCost = 0;
    let soldQty = 0;
    let soldRevenue = 0;

    for (const tx of accTxs) {
      if (tx.type === 'BUY') {
        boughtQty += tx.quantity;
        boughtCost += tx.totalAmountTRY;
      } else if (tx.type === 'SELL') {
        soldQty += tx.quantity;
        soldRevenue += tx.totalAmountTRY;
      }
    }

    const netQuantity = Math.max(0, boughtQty - soldQty);
    if (netQuantity === 0 && accTxs.length === 0) continue;

    const avgCostTRY = boughtQty > 0 ? boughtCost / boughtQty : 0;
    const currentCostTRY = netQuantity * avgCostTRY;

    // Determine current rate
    const symbol = account.symbol || '';
    const rateRecord = rateMap.get(symbol);
    const currentRateTRY = rateRecord?.rateTRY || avgCostTRY || 1;
    const dailyChangePct = rateRecord?.changeDailyPct || 0;

    const currentValueTRY = netQuantity * currentRateTRY;
    const profitLossTRY = currentValueTRY - currentCostTRY;
    const profitLossPct = currentCostTRY > 0 ? (profitLossTRY / currentCostTRY) * 100 : 0;

    totalCostTRY += currentCostTRY;
    totalValueTRY += currentValueTRY;

    positions.push({
      account,
      symbol,
      name: account.name,
      subType: account.subType,
      totalQuantity: netQuantity,
      totalCostTRY: currentCostTRY,
      avgCostTRY,
      currentRateTRY,
      currentValueTRY,
      profitLossTRY,
      profitLossPct,
      portfolioWeightPct: 0, // Will be computed after totalValueTRY
      dailyChangePct
    });
  }

  // Calculate weights
  for (const pos of positions) {
    pos.portfolioWeightPct = totalValueTRY > 0 ? (pos.currentValueTRY / totalValueTRY) * 100 : 0;
  }

  const profitLossTRY = totalValueTRY - totalCostTRY;
  const profitLossPct = totalCostTRY > 0 ? (profitLossTRY / totalCostTRY) * 100 : 0;

  // Real returns in foreign currencies and gold
  const usdRate = rateMap.get('USD')?.rateTRY || 49.03;
  const eurRate = rateMap.get('EUR')?.rateTRY || 55.24;
  const goldRate = rateMap.get('XAU_GR')?.rateTRY || 6561.65;

  const profitLossUSD = usdRate > 0 ? profitLossTRY / usdRate : 0;
  const profitLossEUR = eurRate > 0 ? profitLossTRY / eurRate : 0;
  const profitLossGoldGram = goldRate > 0 ? profitLossTRY / goldRate : 0;

  return {
    totalCostTRY,
    totalValueTRY,
    profitLossTRY,
    profitLossPct,
    profitLossUSD,
    profitLossEUR,
    profitLossGoldGram,
    positions,
    goldPositions: positions.filter(p => p.subType === 'GOLD_GRAM' || p.subType === 'GOLD_PIECE'),
    currencyPositions: positions.filter(p => p.subType === 'CURRENCY'),
    fundPositions: positions.filter(p => p.subType === 'FUND' || p.subType === 'STOCK'),
    otherPositions: positions.filter(p => p.subType !== 'GOLD_GRAM' && p.subType !== 'GOLD_PIECE' && p.subType !== 'CURRENCY' && p.subType !== 'FUND' && p.subType !== 'STOCK')
  };
}

export function formatTRY(num: number, hideValues = false): string {
  if (hideValues) return '•••••• ₺';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

export function formatNumber(num: number, decimals = 2, hideValues = false): string {
  if (hideValues) return '••••';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}
