import React from 'react';
import { Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatTRY, formatNumber } from '../../services/portfolioService';
import type { PortfolioSummary } from '../../services/portfolioService';

interface NetWorthCardProps {
  summary: PortfolioSummary;
  hideValues: boolean;
}

export const NetWorthCard: React.FC<NetWorthCardProps> = ({ summary, hideValues }) => {
  const isProfit = summary.profitLossTRY >= 0;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 p-6 border border-white/10 shadow-2xl">
      {/* Decorative gradient glow */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-4">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">
              <Wallet className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider">Toplam Portföy Değeri</span>
          </div>

          <div className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
            isProfit
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
              : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
          }`}>
            {isProfit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            <span>%{formatNumber(Math.abs(summary.profitLossPct), 2)}</span>
          </div>
        </div>

        {/* Main Big Number */}
        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            {formatTRY(summary.totalValueTRY, hideValues)}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Toplam Maliyet: <span className="text-slate-300 font-medium">{formatTRY(summary.totalCostTRY, hideValues)}</span>
          </p>
        </div>

        {/* Bottom Metrics Bar */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400">Net Kâr / Zarar: </span>
            <span className={`font-semibold ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isProfit ? '+' : ''}{formatTRY(summary.profitLossTRY, hideValues)}
            </span>
          </div>

          <div className="text-slate-400">
            Aktif Varlık Sayısı: <span className="text-white font-medium">{summary.positions.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
