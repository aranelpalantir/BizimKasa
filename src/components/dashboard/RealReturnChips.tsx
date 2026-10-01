import React from 'react';
import { DollarSign, Euro, Coins, TrendingUp } from 'lucide-react';
import { formatTRY, formatNumber } from '../../services/portfolioService';
import type { PortfolioSummary } from '../../services/portfolioService';

interface RealReturnChipsProps {
  summary: PortfolioSummary;
  hideValues: boolean;
}

export const RealReturnChips: React.FC<RealReturnChipsProps> = ({ summary, hideValues }) => {
  const isProfit = summary.profitLossTRY >= 0;

  const formatForeign = (val: number, symbol: string, isSuffix = false) => {
    if (hideValues) return `•••• ${symbol}`;
    const prefix = val > 0 ? '+' : val < 0 ? '-' : '';
    const formatted = formatNumber(Math.abs(val), 2);
    return isSuffix ? `${prefix}${formatted} ${symbol}` : `${prefix}${symbol}${formatted}`;
  };

  const chips = [
    {
      id: 'try',
      label: 'Net Kâr / Zarar (₺)',
      value: `${isProfit && summary.profitLossTRY > 0 ? '+' : ''}${formatTRY(summary.profitLossTRY, hideValues)}`,
      icon: TrendingUp,
      color: isProfit
        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
        : 'border-rose-500/20 bg-rose-500/10 text-rose-400',
    },
    {
      id: 'usd',
      label: 'Dolar Karşılığı ($)',
      value: formatForeign(summary.profitLossUSD, '$'),
      icon: DollarSign,
      color: isProfit
        ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
        : 'border-rose-500/20 bg-rose-500/10 text-rose-400',
    },
    {
      id: 'eur',
      label: 'Euro Karşılığı (€)',
      value: formatForeign(summary.profitLossEUR, '€'),
      icon: Euro,
      color: isProfit
        ? 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400'
        : 'border-rose-500/20 bg-rose-500/10 text-rose-400',
    },
    {
      id: 'gold',
      label: 'Altın Karşılığı (gr)',
      value: formatForeign(summary.profitLossGoldGram, 'gr', true),
      icon: Coins,
      color: isProfit
        ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
        : 'border-rose-500/20 bg-rose-500/10 text-rose-400',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Kâr / Zarar (Döviz & Altın Karşılığı)
        </h3>
        <span className="text-[11px] text-slate-500">Güncel Piyasa Kurlarıyla</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {chips.map((chip) => {
          const Icon = chip.icon;
          return (
            <div
              key={chip.id}
              className={`p-3.5 rounded-2xl border ${chip.color} flex flex-col justify-between transition-all hover:scale-[1.02]`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium opacity-80">{chip.label}</span>
                <Icon className="w-4 h-4 opacity-75" />
              </div>
              <div className="text-sm sm:text-base font-bold tracking-tight">
                {chip.value}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
