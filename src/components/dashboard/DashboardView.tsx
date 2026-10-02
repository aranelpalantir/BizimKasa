import React, { useState } from 'react';
import { NetWorthCard } from './NetWorthCard';
import { RealReturnChips } from './RealReturnChips';
import { RatesTicker } from './RatesTicker';
import { PortfolioAllocationChart } from './PortfolioAllocationChart';
import { GroupFilterBar } from '../common/GroupFilterBar';
import { AddAccountModal } from '../common/AddAccountModal';
import { EditAccountModal } from '../common/EditAccountModal';
import { calculatePortfolioSummary, formatTRY, formatNumber } from '../../services/portfolioService';
import { ArrowRight, Coins, Euro, LineChart, Users, Plus, Wallet, Palette } from 'lucide-react';
import type { Account, AssetTransaction, MarketRate, CashFlowEntry, Group } from '../../types/finance';

interface DashboardViewProps {
  groups: Group[];
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
  groups,
  accounts,
  transactions,
  rates,
  cashFlowEntries,
  hideValues,
  onNavigateTab
}) => {
  const currentYear = 2026;
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  // 1. Calculate Portfolio metrics based on selected group
  const portfolioSummary = calculatePortfolioSummary(
    accounts,
    transactions,
    rates,
    groups,
    selectedGroupId
  );

  // 2. Calculate Current Month Cash Flow based on selected group
  let monthExpense = 0;
  let monthIncome = 0;
  for (const e of cashFlowEntries) {
    if (e.year === currentYear && e.month === currentMonth) {
      const acc = accounts.find(a => a.id === e.accountId);
      if (acc) {
        if (selectedGroupId === 'ALL' || acc.groupId === selectedGroupId) {
          if (acc.type === 'EXPENSE') monthExpense += e.amount;
          if (acc.type === 'INCOME') monthIncome += e.amount;
        }
      }
    }
  }
  const monthRemaining = monthIncome - monthExpense;

  const currentGroup = selectedGroupId === 'ALL' ? undefined : groups.find(g => g.id === selectedGroupId);
  const currentGroupName = selectedGroupId === 'ALL' 
    ? 'Tüm Portföy (Konsolide)' 
    : currentGroup?.name || 'Hesap';

  return (
    <div className="space-y-5">
      {/* Live Market Rates Horizontal Ticker with Groups & 10-day history */}
      <RatesTicker rates={rates} />

      {/* Onboarding Empty Banner when no accounts exist */}
      {groups.length === 0 && (
        <div className="p-6 rounded-3xl bg-slate-900/90 border border-amber-500/30 text-center space-y-3 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Henüz Kayıtlı Bir Hesap Bulunmuyor</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Varlıklarınızı (altın, döviz, fon) veya bütçenizi takip etmek için ilk hesabınızı oluşturun (örn: Ana Hesap, Yatırım Portföyü, Ortak Kasa).
            </p>
          </div>
          <button
            onClick={() => setIsAddAccountModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ İlk Hesabını Oluştur</span>
          </button>
        </div>
      )}

      {/* Group Filter Bar */}
      <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
        <GroupFilterBar
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
          title="Hesap"
          onAddGroup={() => setIsAddAccountModalOpen(true)}
          addLabel="Yeni Hesap"
        />
      </div>

      {/* Main Net Worth Hero Card */}
      <div className="space-y-1">
        {selectedGroupId !== 'ALL' && currentGroup && (
          <div 
            className="flex items-center justify-between px-3 py-2 rounded-2xl border transition-all"
            style={{
              backgroundColor: `${currentGroup.color}15`,
              borderColor: `${currentGroup.color}35`,
            }}
          >
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: currentGroup.color }}>
              <div 
                className="w-2.5 h-2.5 rounded-full shrink-0" 
                style={{ backgroundColor: currentGroup.color, boxShadow: `0 0 8px ${currentGroup.color}` }} 
              />
              <Users className="w-3.5 h-3.5" />
              <span>{currentGroupName} Varlıkları Görüntüleniyor</span>
            </div>
            <button
              type="button"
              onClick={() => setEditingGroup(currentGroup)}
              title={`${currentGroup.name} Renk Temasını Değiştir`}
              aria-label={`${currentGroup.name} renk temasını değiştir`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white border transition-all text-[11px] font-medium shadow-sm active:scale-95 cursor-pointer"
              style={{
                borderColor: `${currentGroup.color}40`,
                color: currentGroup.color
              }}
            >
              <Palette className="w-3 h-3" />
              <span>Renk Temasını Değiştir</span>
            </button>
          </div>
        )}
        <NetWorthCard 
          summary={portfolioSummary} 
          hideValues={hideValues} 
          themeColor={currentGroup?.color}
          accountName={currentGroup?.name}
        />
      </div>

      {/* Real Return Multi-Currency Chips */}
      <RealReturnChips summary={portfolioSummary} hideValues={hideValues} />

      {/* GROUP BREAKDOWN CARDS (When Konsolide is active) */}
      {selectedGroupId === 'ALL' && portfolioSummary.groupBreakdowns.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Hesap & Portföy Dağılımı
            </h3>
            <span className="text-[11px] text-slate-500">Kişi / Kasa Bazında Net Varlık</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {portfolioSummary.groupBreakdowns.map((gb) => {
              const isProfit = gb.profitLossTRY >= 0;
              return (
                <div
                  key={gb.group.id}
                  onClick={() => setSelectedGroupId(gb.group.id)}
                  className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-white/5 hover:border-white/15 cursor-pointer transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate pr-1">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: gb.group.color }} />
                      <span className="text-xs font-bold text-white truncate">{gb.group.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingGroup(gb.group);
                        }}
                        title={`${gb.group.name} Renk Temasını Değiştir`}
                        aria-label={`${gb.group.name} renk temasını değiştir`}
                        className="p-1 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <Palette className="w-3 h-3" />
                      </button>
                      <span className="text-[10px] text-slate-500">{gb.positionsCount} varlık</span>
                    </div>
                  </div>

                  <div className="text-sm font-extrabold text-white font-mono">
                    {formatTRY(gb.totalValueTRY, hideValues)}
                  </div>

                  <div className={`text-[10px] font-semibold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isProfit ? '+' : ''}{formatTRY(gb.profitLossTRY, hideValues)} (%{formatNumber(Math.abs(gb.profitLossPct), 1)})
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Middle Grid: Cash Flow Snapshot & Asset Allocation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly Cash Flow Card */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {MONTH_NAMES[currentMonth - 1]} {currentYear} Bütçe Durumu
              </h3>
              <span className="text-sm font-bold text-white mt-0.5 flex items-center gap-2">
                {currentGroup && (
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                    style={{ backgroundColor: currentGroup.color, boxShadow: `0 0 6px ${currentGroup.color}` }}
                  />
                )}
                <span>{currentGroupName} Nakit Akışı</span>
              </span>
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
              <span className="text-[10px] font-semibold text-emerald-400 uppercase block">Gelir</span>
              <span className="text-sm sm:text-base font-bold font-mono text-white mt-1 block">
                {formatTRY(monthIncome, hideValues)}
              </span>
            </div>
            <div className="border-x border-white/10 px-1">
              <span className="text-[10px] font-semibold text-rose-400 uppercase block">Gider</span>
              <span className="text-sm sm:text-base font-bold font-mono text-white mt-1 block">
                {formatTRY(monthExpense, hideValues)}
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
              <span className="text-[10px] font-mono text-slate-500">Euro & Dolar</span>
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
              <span className="text-[10px] font-mono text-slate-500">Yatırım Fonları</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 block font-medium">Fon Portföyü</span>
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

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isAddAccountModalOpen}
        onClose={() => setIsAddAccountModalOpen(false)}
        onAccountCreated={(newId) => setSelectedGroupId(newId)}
      />

      {/* Edit Account / Theme Color Modal */}
      <EditAccountModal
        isOpen={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        group={editingGroup}
      />
    </div>
  );
};
