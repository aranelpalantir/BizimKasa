import type { Account, AssetTransaction, MarketRate, Group } from '../types/finance';

export interface AssetPosition {
  account: Account;
  symbol: string;
  name: string;
  subType: string;
  groupId: string;
  groupName?: string;
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

export interface GroupPortfolioBreakdown {
  group: Group;
  totalCostTRY: number;
  totalValueTRY: number;
  profitLossTRY: number;
  profitLossPct: number;
  positionsCount: number;
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
  groupBreakdowns: GroupPortfolioBreakdown[];
}

export function calculatePortfolioSummary(
  accounts: Account[],
  transactions: AssetTransaction[],
  rates: MarketRate[],
  groups: Group[] = [],
  filterGroupId?: string
): PortfolioSummary {
  const rateMap = new Map<string, MarketRate>();
  for (const r of rates) {
    rateMap.set(r.symbol, r);
  }

  const groupMap = new Map<string, Group>();
  for (const g of groups) {
    groupMap.set(g.id, g);
  }

  // Filter accounts if a specific group is selected
  const targetAccounts = (filterGroupId && filterGroupId !== 'ALL')
    ? accounts.filter(a => a.groupId === filterGroupId)
    : accounts;

  const assetAccounts = targetAccounts.filter(a => a.type === 'ASSET');
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

    // Rate resolution
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
      groupId: account.groupId,
      groupName: groupMap.get(account.groupId)?.name || 'Diğer',
      totalQuantity: netQuantity,
      totalCostTRY: currentCostTRY,
      avgCostTRY,
      currentRateTRY,
      currentValueTRY,
      profitLossTRY,
      profitLossPct,
      portfolioWeightPct: 0,
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
  const goldRate = rateMap.get('XAU_GR_BANK')?.rateTRY || rateMap.get('XAU_GR_PHYSICAL')?.rateTRY || 6561.65;

  const profitLossUSD = usdRate > 0 ? profitLossTRY / usdRate : 0;
  const profitLossEUR = eurRate > 0 ? profitLossTRY / eurRate : 0;
  const profitLossGoldGram = goldRate > 0 ? profitLossTRY / goldRate : 0;

  // Group breakdowns
  const groupBreakdowns: GroupPortfolioBreakdown[] = groups.map((grp) => {
    const grpPositions = positions.filter(p => p.groupId === grp.id);
    let gCost = 0;
    let gVal = 0;
    for (const p of grpPositions) {
      gCost += p.totalCostTRY;
      gVal += p.currentValueTRY;
    }
    const gPL = gVal - gCost;
    const gPLPct = gCost > 0 ? (gPL / gCost) * 100 : 0;
    return {
      group: grp,
      totalCostTRY: gCost,
      totalValueTRY: gVal,
      profitLossTRY: gPL,
      profitLossPct: gPLPct,
      positionsCount: grpPositions.length
    };
  });

  const isGoldType = (st: string) => 
    st === 'GOLD_GRAM_PHYSICAL' || 
    st === 'GOLD_GRAM_BANK' || 
    st === 'GOLD_CEYREK' || 
    st === 'GOLD_YARIM' || 
    st === 'GOLD_TAM' ||
    st === 'GOLD_GRAM' || 
    st === 'GOLD_PIECE';

  return {
    totalCostTRY,
    totalValueTRY,
    profitLossTRY,
    profitLossPct,
    profitLossUSD,
    profitLossEUR,
    profitLossGoldGram,
    positions,
    goldPositions: positions.filter(p => isGoldType(p.subType)),
    currencyPositions: positions.filter(p => p.subType === 'CURRENCY'),
    fundPositions: positions.filter(p => p.subType === 'FUND' || p.subType === 'STOCK'),
    otherPositions: positions.filter(p => !isGoldType(p.subType) && p.subType !== 'CURRENCY' && p.subType !== 'FUND' && p.subType !== 'STOCK'),
    groupBreakdowns
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
