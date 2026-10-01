import React, { useState } from 'react';
import { Coins, Euro, LineChart, FileSpreadsheet } from 'lucide-react';
import { GoldTracker } from './GoldTracker';
import { CurrencyTracker } from './CurrencyTracker';
import { FundsTracker } from './FundsTracker';
import { ImportModal } from './ImportModal';
import type { Group, Account, AssetTransaction, MarketRate } from '../../types/finance';

interface AssetDashboardProps {
  groups: Group[];
  accounts: Account[];
  transactions: AssetTransaction[];
  rates: MarketRate[];
  hideValues: boolean;
}

export const AssetDashboard: React.FC<AssetDashboardProps> = ({
  groups,
  accounts,
  transactions,
  rates,
  hideValues
}) => {
  const [activeTab, setActiveTab] = useState<'gold' | 'currency' | 'funds'>('gold');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Category Tabs & Import Button */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('gold')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap ${
              activeTab === 'gold'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Altın & Emtia</span>
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
            <span>Döviz (EUR & USD)</span>
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
            <span>Yatırım Fonları & Borsa</span>
          </button>
        </div>

        <button
          onClick={() => setIsImportModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-colors shadow-sm active:scale-95"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          <span>Excel / CSV İçe Aktar</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'gold' && (
        <GoldTracker
          groups={groups}
          accounts={accounts}
          transactions={transactions}
          rates={rates}
          hideValues={hideValues}
        />
      )}

      {activeTab === 'currency' && (
        <CurrencyTracker
          groups={groups}
          accounts={accounts}
          transactions={transactions}
          rates={rates}
          hideValues={hideValues}
        />
      )}

      {activeTab === 'funds' && (
        <FundsTracker
          groups={groups}
          accounts={accounts}
          transactions={transactions}
          rates={rates}
          hideValues={hideValues}
        />
      )}

      {/* CSV / Excel Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        groups={groups}
        accounts={accounts}
      />
    </div>
  );
};
