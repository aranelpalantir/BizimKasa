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

  const chips = [
    {
      id: 'try',
      label: 'Kâr / Zarar (₺)',
      value: `${isProfit ? '+' : ''}${formatTRY(summary.profitLossTRY, hideValues)}`,
      icon: TrendingUp,
      color: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    },
    {
      id: 'usd',
      label: 'Reel Getiri ($)',
      value: hideValues ? '•••• $' : `${isProfit ? '+' : ''}$${formatNumber(summary.profitLossUSD, 2)}`,
      icon: DollarSign,
      color: 'border-blue-500/20 bg-blue-500/10 text-blue-400',
    },
    {
      id: 'eur',
      label: 'Reel Getiri (€)',
      value: hideValues ? '•••• €' : `${isProfit ? '+' : ''}€${formatNumber(summary.profitLossEUR, 2)}`,
      icon: Euro,
      color: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400',
    },
    {
      id: 'gold',
      label: 'Reel Getiri (Altın)',
      value: hideValues ? '•••• gr' : `${isProfit ? '+' : ''}${formatNumber(summary.profitLossGoldGram, 2)} gr`,
      icon: Coins,
      color: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Enflasyondan Arındırılmış Reel Getiri
        </h3>
        <span className="text-[11px] text-slate-500">Çoklu Para Birimi</span>
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
