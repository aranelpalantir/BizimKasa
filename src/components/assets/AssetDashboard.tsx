import React, { useState } from 'react';
import { Coins, Euro, LineChart, FileSpreadsheet, Plus } from 'lucide-react';
import { GoldTracker, type GoldTypeTab } from './GoldTracker';
import { CurrencyTracker } from './CurrencyTracker';
import { FundsTracker } from './FundsTracker';
import { ImportModal } from './ImportModal';
import { AddAccountModal } from '../common/AddAccountModal';
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
  const [selectedGoldType, setSelectedGoldType] = useState<GoldTypeTab>('BANK_GRAM');
  const [selectedCurrency, setSelectedCurrency] = useState<'EUR' | 'USD'>('EUR');
  const [selectedFundSymbol, setSelectedFundSymbol] = useState<string>('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);

  // Determine which asset key to pre-select in ImportModal
  const getSelectedAssetKey = (): string => {
    if (activeTab === 'gold') {
      switch (selectedGoldType) {
        case 'BANK_GRAM': return 'GOLD_GRAM_BANK';
        case 'PHYSICAL_GRAM': return 'GOLD_GRAM_PHYSICAL';
        case 'CEYREK': return 'GOLD_CEYREK';
        case 'YARIM': return 'GOLD_YARIM';
        case 'TAM': return 'GOLD_TAM';
        case 'CUMHURIYET': return 'GOLD_CUMHURIYET';
        default: return 'GOLD_GRAM_BANK';
      }
    }
    if (activeTab === 'currency') {
      return selectedCurrency === 'USD' ? 'CURRENCY_USD' : 'CURRENCY_EUR';
    }
    if (activeTab === 'funds') {
      if (selectedFundSymbol) {
        return `FUND_${selectedFundSymbol.toUpperCase()}`;
      }
      const firstFund = accounts.find(a => a.type === 'ASSET' && (a.subType === 'FUND' || a.subType === 'STOCK') && a.symbol);
      if (firstFund?.symbol) {
        return `FUND_${firstFund.symbol.toUpperCase()}`;
      }
      return 'CUSTOM_FUND';
    }
    return 'GOLD_GRAM_BANK';
  };

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
            <span>Altın</span>
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddAccountModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-colors shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4 text-blue-400" />
            <span>Yeni Hesap</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-colors shadow-sm active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Excel / CSV İçe Aktar</span>
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'gold' && (
        <GoldTracker
          groups={groups}
          accounts={accounts}
          transactions={transactions}
          rates={rates}
          hideValues={hideValues}
          activeGoldType={selectedGoldType}
          onSelectGoldType={setSelectedGoldType}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
        />
      )}

      {activeTab === 'currency' && (
        <CurrencyTracker
          groups={groups}
          accounts={accounts}
          transactions={transactions}
          rates={rates}
          hideValues={hideValues}
          selectedCurrency={selectedCurrency}
          onSelectCurrency={setSelectedCurrency}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
        />
      )}

      {activeTab === 'funds' && (
        <FundsTracker
          groups={groups}
          accounts={accounts}
          transactions={transactions}
          rates={rates}
          hideValues={hideValues}
          selectedFundSymbol={selectedFundSymbol}
          onSelectFundSymbol={setSelectedFundSymbol}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
        />
      )}

      {/* CSV / Excel Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        groups={groups}
        accounts={accounts}
        defaultCategory={activeTab}
        defaultAssetKey={getSelectedAssetKey()}
        defaultGroupId={selectedGroupId !== 'ALL' ? selectedGroupId : undefined}
      />

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isAddAccountModalOpen}
        onClose={() => setIsAddAccountModalOpen(false)}
      />
    </div>
  );
};
