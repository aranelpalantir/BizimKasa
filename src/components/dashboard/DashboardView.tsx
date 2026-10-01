import React from 'react';
import { NetWorthCard } from './NetWorthCard';
import { RealReturnChips } from './RealReturnChips';
import { RatesTicker } from './RatesTicker';
import { PortfolioAllocationChart } from './PortfolioAllocationChart';
import { calculatePortfolioSummary, formatTRY } from '../../services/portfolioService';
import { ArrowRight, Coins, Euro, LineChart } from 'lucide-react';
import type { Account, AssetTransaction, MarketRate, CashFlowEntry } from '../../types/finance';

interface DashboardViewProps {
  accounts: Account[];
  transactions: AssetTransaction[];
  rates: MarketRate[];
  cashFlowEntries: CashFlowEntry[];
  hideValues: boolean;
  onNavigateTab: (tab: 'budget' | 'assets' | 'plan') => void;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  accounts,
  transactions,
  rates,
  cashFlowEntries,
  hideValues,
  onNavigateTab
}) => {
  const currentYear = 2026;
  const currentMonth = new Date().getMonth() + 1; // 1-12

  // 1. Calculate Portfolio metrics
  const portfolioSummary = calculatePortfolioSummary(accounts, transactions, rates);

  // 2. Calculate Current Month Cash Flow
  let monthExpense = 0;
  let monthIncome = 0;
  for (const e of cashFlowEntries) {
    if (e.year === currentYear && e.month === currentMonth) {
      const acc = accounts.find(a => a.id === e.accountId);
      if (acc?.type === 'EXPENSE') monthExpense += e.amount;
      if (acc?.type === 'INCOME') monthIncome += e.amount;
    }
  }
  const monthRemaining = monthIncome - monthExpense;

  return (
    <div className="space-y-5">
      {/* Live Market Rates Horizontal Ticker */}
      <RatesTicker rates={rates} />

      {/* Main Net Worth Hero Card */}
      <NetWorthCard summary={portfolioSummary} hideValues={hideValues} />

      {/* Real Return Multi-Currency Chips (Image 5 Metric) */}
      <RealReturnChips summary={portfolioSummary} hideValues={hideValues} />

      {/* Middle Grid: Cash Flow Snapshot & Asset Quick Action */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly Cash Flow Card */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {MONTH_NAMES[currentMonth - 1]} {currentYear} Bütçe Durumu
              </h3>
              <span className="text-sm font-bold text-white mt-0.5 block">Hane Nakit Akışı</span>
            </div>

            <button
              onClick={() => onNavigateTab('budget')}
              className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
            >
              <span>Matrise Git</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-950/60 border border-white/5 text-center">
            <div>
              <span className="text-[10px] font-semibold text-rose-400 uppercase block">Gider</span>
              <span className="text-sm sm:text-base font-bold font-mono text-white mt-1 block">
                {formatTRY(monthExpense, hideValues)}
              </span>
            </div>
            <div className="border-x border-white/10 px-1">
              <span className="text-[10px] font-semibold text-emerald-400 uppercase block">Gelir</span>
              <span className="text-sm sm:text-base font-bold font-mono text-white mt-1 block">
                {formatTRY(monthIncome, hideValues)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-blue-400 uppercase block">Kalan</span>
              <span className={`text-sm sm:text-base font-bold font-mono mt-1 block ${monthRemaining < 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                {formatTRY(monthRemaining, hideValues)}
              </span>
            </div>
          </div>
        </div>

        {/* Portfolio Allocation Chart */}
        <PortfolioAllocationChart summary={portfolioSummary} hideValues={hideValues} />
      </div>

      {/* Quick Asset Category Cards */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Varlık Kategorileri
          </h3>
          <button
            onClick={() => onNavigateTab('assets')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300"
          >
            Tümünü Yönet
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Gold Card */}
          <div
            onClick={() => onNavigateTab('assets')}
            className="p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-white/5 hover:border-amber-500/20 cursor-pointer transition-all space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform">
                <Coins className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono text-slate-500">Gram & Çeyrek</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Altın Varlığı</span>
              <span className="text-lg font-bold font-mono text-white">
                {formatTRY(
                  portfolioSummary.goldPositions.reduce((s, p) => s + p.currentValueTRY, 0),
                  hideValues
                )}
              </span>
            </div>
          </div>

          {/* Currency Card */}
          <div
            onClick={() => onNavigateTab('assets')}
            className="p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-white/5 hover:border-indigo-500/20 cursor-pointer transition-all space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                <Euro className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono text-slate-500">Euro & USD</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Döviz Varlığı</span>
              <span className="text-lg font-bold font-mono text-white">
                {formatTRY(
                  portfolioSummary.currencyPositions.reduce((s, p) => s + p.currentValueTRY, 0),
                  hideValues
                )}
              </span>
            </div>
          </div>

          {/* Funds Card */}
          <div
            onClick={() => onNavigateTab('assets')}
            className="p-4 rounded-2xl bg-slate-900/60 hover:bg-slate-900 border border-white/5 hover:border-emerald-500/20 cursor-pointer transition-all space-y-2 group"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                <LineChart className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono text-slate-500">TEFAS & Borsa</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Fon & Hisse Portföyü</span>
              <span className="text-lg font-bold font-mono text-white">
                {formatTRY(
                  portfolioSummary.fundPositions.reduce((s, p) => s + p.currentValueTRY, 0),
                  hideValues
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
