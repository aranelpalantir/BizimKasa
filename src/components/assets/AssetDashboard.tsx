import React, { useState } from 'react';
import { Coins, Euro, LineChart } from 'lucide-react';
import { GoldTracker } from './GoldTracker';
import { CurrencyTracker } from './CurrencyTracker';
import { FundsTracker } from './FundsTracker';
import type { Account, AssetTransaction, MarketRate } from '../../types/finance';

interface AssetDashboardProps {
  accounts: Account[];
  transactions: AssetTransaction[];
  rates: MarketRate[];
  hideValues: boolean;
}

export const AssetDashboard: React.FC<AssetDashboardProps> = ({
  accounts,
  transactions,
  rates,
  hideValues
}) => {
  const [activeTab, setActiveTab] = useState<'gold' | 'currency' | 'funds'>('gold');

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <div className="flex border-b border-white/10 pb-1 gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('gold')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
            activeTab === 'gold'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Altın & Emtia (Gram / Çeyrek)</span>
        </button>

        <button
          onClick={() => setActiveTab('currency')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
            activeTab === 'currency'
              ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Euro className="w-4 h-4" />
          <span>Döviz (Euro & USD)</span>
        </button>

        <button
          onClick={() => setActiveTab('funds')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
            activeTab === 'funds'
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <LineChart className="w-4 h-4" />
          <span>TEFAS Fonları & Borsa</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'gold' && (
        <GoldTracker
          accounts={accounts}
          transactions={transactions}
          rates={rates}
          hideValues={hideValues}
        />
      )}

      {activeTab === 'currency' && (
        <CurrencyTracker
          accounts={accounts}
          transactions={transactions}
          rates={rates}
          hideValues={hideValues}
        />
      )}

      {activeTab === 'funds' && (
        <FundsTracker
          accounts={accounts}
          transactions={transactions}
          rates={rates}
          hideValues={hideValues}
        />
      )}
    </div>
  );
};
