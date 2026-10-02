import React, { useState } from 'react';
import { 
  Target, 
  CheckCircle2, 
  Circle, 
  Plus, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Trash2, 
  Edit2,
  Coins,
  Euro,
  LineChart,
  Check,
  Search
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { GroupFilterBar } from '../common/GroupFilterBar';
import { db } from '../../db/db';
import { formatTRY, formatForInput, parseUserInputNumber } from '../../services/portfolioService';
import { searchTefasFunds, lookupTefasFund } from '../../services/ratesService';
import type { Account, Group, MonthlyInvestmentPlan, AssetTransaction, AssetSubType } from '../../types/finance';

interface InvestmentPlannerProps {
  groups: Group[];
  accounts: Account[];
  plans: MonthlyInvestmentPlan[];
  transactions?: AssetTransaction[];
  hideValues: boolean;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

interface PresetAsset {
  key: string;
  name: string;
  symbol: string;
  subType: AssetSubType;
  currency: 'TRY' | 'USD' | 'EUR';
  description?: string;
}

const PRESET_GOLD_ASSETS: PresetAsset[] = [
  { key: 'gold_bank', name: 'Banka Gram Altın', symbol: 'XAU_GR_BANK', subType: 'GOLD_GRAM_BANK', currency: 'TRY', description: 'Banka altın hesabı' },
  { key: 'gold_phys', name: 'Fiziki Gram Altın', symbol: 'XAU_GR_PHYSICAL', subType: 'GOLD_GRAM_PHYSICAL', currency: 'TRY', description: 'Kasa / fiziki gram' },
  { key: 'gold_ceyrek', name: 'Çeyrek Altın', symbol: 'XAU_CEYREK', subType: 'GOLD_CEYREK', currency: 'TRY', description: 'Fiziki çeyrek altın' },
  { key: 'gold_yarim', name: 'Yarım Altın', symbol: 'XAU_YARIM', subType: 'GOLD_YARIM', currency: 'TRY', description: 'Fiziki yarım altın' },
  { key: 'gold_tam', name: 'Tam Altın', symbol: 'XAU_TAM', subType: 'GOLD_TAM', currency: 'TRY', description: 'Ziynet tam altın (7.00 gr)' },
  { key: 'gold_cumhuriyet', name: 'Cumhuriyet Altını', symbol: 'XAU_CUMHURIYET', subType: 'GOLD_CUMHURIYET', currency: 'TRY', description: 'Ata Lira (7.216 gr)' },
];

const PRESET_CURRENCY_ASSETS: PresetAsset[] = [
  { key: 'usd', name: 'Amerikan Doları (USD)', symbol: 'USD', subType: 'CURRENCY', currency: 'USD', description: 'Döviz birikimi' },
  { key: 'eur', name: 'Euro (EUR)', symbol: 'EUR', subType: 'CURRENCY', currency: 'EUR', description: 'Döviz birikimi' },
];

export const InvestmentPlanner: React.FC<InvestmentPlannerProps> = ({
  groups,
  accounts,
  plans,
  transactions = [],
  hideValues
}) => {
  const currentRealMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentRealMonth);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');

  // Add Allocation Modal state
  const [isAddAllocationModalOpen, setIsAddAllocationModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'GOLD' | 'CURRENCY' | 'FUND'>('GOLD');
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('gold_bank');
  const [selectedExistingFundId, setSelectedExistingFundId] = useState<string>('');
  const [fundCodeInput, setFundCodeInput] = useState<string>('');
  const [fundNameInput, setFundNameInput] = useState<string>('');
  const [fundSuggestions, setFundSuggestions] = useState<Array<{ code: string; name: string }>>([]);
  const [allocationAmount, setAllocationAmount] = useState('');

  // Budget Modal state
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetModalTargetPlan, setBudgetModalTargetPlan] = useState<MonthlyInvestmentPlan | null>(null);
  const [budgetInputValue, setBudgetInputValue] = useState('');

  // Confirm delete dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Dynamic unbounded years list: always includes selectedYear and adjacent years so navigation never clamps
  const planYears = plans.map(p => p.year);
  const minYear = Math.min(2024, selectedYear - 1, ...planYears);
  const maxYear = Math.max(2030, selectedYear + 2, ...planYears);
  const dynamicYears: number[] = [];
  for (let y = minYear; y <= maxYear; y++) {
    dynamicYears.push(y);
  }

  // Month navigation with year rollover (e.g. Dec 2026 -> Jan 2027)
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear(y => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear(y => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  // Group Plan Lookup
  const getPlanForGroup = (groupId: string): MonthlyInvestmentPlan => {
    const found = plans.find(p => p.year === selectedYear && p.month === selectedMonth && p.groupId === groupId);
    if (found) return found;

    return {
      id: `plan-${selectedYear}-${selectedMonth}-${groupId}`,
      year: selectedYear,
      month: selectedMonth,
      groupId,
      totalPlannedTRY: 25000,
      allocations: [],
      updatedAt: new Date().toISOString()
    };
  };

  // Active Plan when filtered by a specific group
  const activeGroupPlan = selectedGroupId !== 'ALL' ? getPlanForGroup(selectedGroupId) : null;

  // Calculate actual purchases for an account in this month and year
  const getActualBoughtForAccount = (accId: string, groupId?: string): number => {
    if (!transactions || transactions.length === 0) return 0;
    return transactions
      .filter(t => 
        t.accountId === accId &&
        t.year === selectedYear &&
        t.month === selectedMonth &&
        t.type === 'BUY' &&
        (!groupId || !t.groupId || t.groupId === groupId)
      )
      .reduce((sum, t) => sum + t.totalAmountTRY, 0);
  };

  // Consolidated calculations when selectedGroupId === 'ALL'
  const consolidatedPlans = groups.map(g => getPlanForGroup(g.id));
  const consolidatedTotalPlanned = consolidatedPlans.reduce((sum, p) => sum + p.totalPlannedTRY, 0);
  const consolidatedTotalAllocated = consolidatedPlans.reduce((sum, p) => 
    sum + p.allocations.reduce((aSum, a) => aSum + a.targetAmountTRY, 0), 0
  );
  const consolidatedTotalActual = consolidatedPlans.reduce((sum, p) => 
    sum + p.allocations.reduce((aSum, a) => aSum + getActualBoughtForAccount(a.accountId, p.groupId), 0), 0
  );
  const consolidatedPct = consolidatedTotalAllocated > 0 
    ? Math.min(100, Math.round((consolidatedTotalActual / consolidatedTotalAllocated) * 100)) 
    : 0;

  // Budget modal handlers
  const handleOpenBudgetModal = (plan: MonthlyInvestmentPlan) => {
    setBudgetModalTargetPlan(plan);
    setBudgetInputValue(formatForInput(plan.totalPlannedTRY));
    setIsBudgetModalOpen(true);
  };

  const handleSaveBudgetModal = async () => {
    if (!budgetModalTargetPlan) return;
    const val = parseUserInputNumber(budgetInputValue);
    await db.investmentPlans.put({
      ...budgetModalTargetPlan,
      totalPlannedTRY: Math.max(0, val),
      updatedAt: new Date().toISOString()
    });
    setIsBudgetModalOpen(false);
  };

  const handleResetBudget = async () => {
    if (!budgetModalTargetPlan) return;
    await db.investmentPlans.put({
      ...budgetModalTargetPlan,
      totalPlannedTRY: 0,
      updatedAt: new Date().toISOString()
    });
    setBudgetInputValue('0');
    setIsBudgetModalOpen(false);
  };

  // Toggle completion
  const handleToggleComplete = async (plan: MonthlyInvestmentPlan, idx: number) => {
    const newAllocations = [...plan.allocations];
    newAllocations[idx].completed = !newAllocations[idx].completed;

    if (newAllocations[idx].completed) {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 }
      });
    }

    await db.investmentPlans.put({
      ...plan,
      allocations: newAllocations,
      updatedAt: new Date().toISOString()
    });
  };

  // Reset Add Allocation Modal state
  const handleOpenAddModal = () => {
    setActiveCategory('GOLD');
    setSelectedPresetKey('gold_bank');
    setSelectedExistingFundId('');
    setFundCodeInput('');
    setFundNameInput('');
    setFundSuggestions([]);
    setAllocationAmount('');
    setIsAddAllocationModalOpen(true);
  };

  // Add allocation to a plan
  const handleAddAllocation = async (targetPlan: MonthlyInvestmentPlan) => {
    const amt = parseUserInputNumber(allocationAmount);
    if (amt <= 0) return;

    let targetAccountId = '';
    const currentGroupId = targetPlan.groupId || groups[0]?.id || 'group-default';

    if (activeCategory === 'GOLD') {
      const preset = PRESET_GOLD_ASSETS.find(p => p.key === selectedPresetKey) || PRESET_GOLD_ASSETS[0];
      const existing = accounts.find(a => 
        a.groupId === currentGroupId && 
        (a.symbol === preset.symbol || a.subType === preset.subType)
      );
      if (existing) {
        targetAccountId = existing.id;
      } else {
        targetAccountId = `acc-asset-${Date.now()}`;
        await db.accounts.add({
          id: targetAccountId,
          groupId: currentGroupId,
          name: preset.name,
          type: 'ASSET',
          subType: preset.subType,
          symbol: preset.symbol,
          currency: preset.currency,
          order: accounts.length + 1,
          createdAt: new Date().toISOString()
        });
      }
    } else if (activeCategory === 'CURRENCY') {
      const preset = PRESET_CURRENCY_ASSETS.find(p => p.key === selectedPresetKey) || PRESET_CURRENCY_ASSETS[0];
      const existing = accounts.find(a => 
        a.groupId === currentGroupId && 
        (a.symbol === preset.symbol || (a.subType === 'CURRENCY' && a.currency === preset.currency))
      );
      if (existing) {
        targetAccountId = existing.id;
      } else {
        targetAccountId = `acc-asset-${Date.now()}`;
        await db.accounts.add({
          id: targetAccountId,
          groupId: currentGroupId,
          name: preset.name,
          type: 'ASSET',
          subType: preset.subType,
          symbol: preset.symbol,
          currency: preset.currency,
          order: accounts.length + 1,
          createdAt: new Date().toISOString()
        });
      }
    } else if (activeCategory === 'FUND') {
      if (selectedExistingFundId) {
        targetAccountId = selectedExistingFundId;
      } else {
        const code = fundCodeInput.trim().toUpperCase();
        if (!code) return;
        const existing = accounts.find(a => 
          a.groupId === currentGroupId && 
          a.subType === 'FUND' && 
          a.symbol?.toUpperCase() === code
        );
        if (existing) {
          targetAccountId = existing.id;
        } else {
          const info = lookupTefasFund(code);
          const name = fundNameInput.trim() || (info ? `${code} - ${info.name}` : `${code} Yatırım Fonu`);
          targetAccountId = `acc-asset-${Date.now()}`;
          await db.accounts.add({
            id: targetAccountId,
            groupId: currentGroupId,
            name,
            type: 'ASSET',
            subType: 'FUND',
            symbol: code,
            currency: 'TRY',
            order: accounts.length + 1,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    if (!targetAccountId) return;

    // Check if account already exists in targetPlan.allocations
    const existingAllocIndex = targetPlan.allocations.findIndex(a => a.accountId === targetAccountId);
    let newAllocations = [...targetPlan.allocations];

    if (existingAllocIndex >= 0) {
      newAllocations[existingAllocIndex] = {
        ...newAllocations[existingAllocIndex],
        targetAmountTRY: newAllocations[existingAllocIndex].targetAmountTRY + amt
      };
    } else {
      newAllocations.push({
        accountId: targetAccountId,
        targetAmountTRY: amt,
        completed: false
      });
    }

    await db.investmentPlans.put({
      ...targetPlan,
      allocations: newAllocations,
      updatedAt: new Date().toISOString()
    });

    setIsAddAllocationModalOpen(false);
    setAllocationAmount('');
  };

  // Delete allocation
  const handleDeleteAllocation = (plan: MonthlyInvestmentPlan, idx: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hedefi Sil',
      message: 'Bu varlık yatırım hedefini plandan kaldırmak istediğinize emin misiniz?',
      onConfirm: async () => {
        const newAllocations = plan.allocations.filter((_, i) => i !== idx);
        await db.investmentPlans.put({
          ...plan,
          allocations: newAllocations,
          updatedAt: new Date().toISOString()
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Date Controls */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            <span>Aylık Yatırım Tahsis Planlayıcı</span>
          </h2>
          <p className="text-xs text-slate-400">
            Kişi ve hesap bazlı yatırım hedefleri belirleyin, portföy alımlarınızla otomatik eşleştirin
          </p>
        </div>

        {/* Month & Year Navigation */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800 border border-white/10">
          <button
            onClick={handlePrevMonth}
            title="Önceki Ay"
            className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1 px-1 font-bold text-xs text-white">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span>{MONTH_NAMES[selectedMonth - 1]}</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer"
            >
              {dynamicYears.map((y) => (
                <option key={y} value={y} className="bg-slate-900 text-white font-normal">
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleNextMonth}
            title="Sonraki Ay (Yıl Aşımı Destekli)"
            className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Group Filter Bar */}
      <GroupFilterBar
        groups={groups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={setSelectedGroupId}
        title="Hesap"
      />

      {/* VIEW MODE 1: CONSOLIDATED SUMMARY ACROSS ALL GROUPS */}
      {selectedGroupId === 'ALL' && (
        <div className="space-y-4">
          {/* Consolidated Totals Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-white/10 shadow-xl">
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase">
                Konsolide Toplam Yatırım Hedefi
              </span>
              <div className="text-2xl font-extrabold text-white mt-1 font-mono">
                {formatTRY(consolidatedTotalPlanned, hideValues)}
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear} Portföy Bütçesi
              </span>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
              <span className="text-[11px] font-semibold text-amber-400 uppercase">
                Planlanan Varlık Tahsisleri
              </span>
              <div className="text-2xl font-extrabold text-amber-300 mt-1 font-mono">
                {formatTRY(consolidatedTotalAllocated, hideValues)}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                Belirlenen hedef kalemler toplamı
              </span>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase">
                Gerçekleşen Alımlar Toplamı
              </span>
              <div className="text-2xl font-extrabold text-emerald-300 mt-1 font-mono">
                {formatTRY(consolidatedTotalActual, hideValues)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-slate-950 rounded-full h-1.5 overflow-hidden border border-white/5">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${consolidatedPct}%` }}
                  />
                </div>
                <span className="text-xs text-emerald-400 font-mono font-bold">
                  %{consolidatedPct}
                </span>
              </div>
            </div>
          </div>

          {/* Group Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 rounded-2xl bg-slate-900/40 border border-white/5">
                <p className="text-sm font-medium text-slate-400">Henüz kayıtlı bir hesap bulunmuyor.</p>
                <p className="text-xs text-slate-500 mt-1">Özet veya Varlıklar sayfasından "+ Yeni Hesap" ekleyerek yatırım hedefleri belirlemeye başlayabilirsiniz.</p>
              </div>
            )}
            {groups.map((group) => {
              const gPlan = getPlanForGroup(group.id);
              const gAllocated = gPlan.allocations.reduce((sum, a) => sum + a.targetAmountTRY, 0);
              const gActual = gPlan.allocations.reduce((sum, a) => sum + getActualBoughtForAccount(a.accountId, group.id), 0);
              const gCompletedCount = gPlan.allocations.filter(a => {
                const act = getActualBoughtForAccount(a.accountId, group.id);
                return a.completed || (a.targetAmountTRY > 0 && act >= a.targetAmountTRY);
              }).length;
              const gPct = gAllocated > 0 ? Math.min(100, Math.round((gActual / gAllocated) * 100)) : 0;

              return (
                <div 
                  key={group.id} 
                  className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3 shadow-md transition-all"
                  style={{
                    borderTop: `3px solid ${group.color}`,
                    boxShadow: `0 8px 20px -8px ${group.color}25`
                  }}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: group.color, boxShadow: `0 0 8px ${group.color}` }} 
                      />
                      <h4 className="font-bold text-sm" style={{ color: group.color }}>{group.name} Hedefi</h4>
                    </div>
                    <button
                      onClick={() => setSelectedGroupId(group.id)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                    >
                      Yönet / Kalem Ekle →
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Bütçe:</span>
                      <span className="font-bold text-white font-mono">{formatTRY(gPlan.totalPlannedTRY, hideValues)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Tahsis:</span>
                      <span className="font-bold text-amber-400 font-mono">{formatTRY(gAllocated, hideValues)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Gerçekleşen:</span>
                      <span className="font-bold text-emerald-400 font-mono">{formatTRY(gActual, hideValues)}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Alım İlerlemesi</span>
                      <span className="font-mono text-emerald-300 font-bold">%{gPct} ({gCompletedCount}/{gPlan.allocations.length})</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/5">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${gPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Mini Allocations list */}
                  <div className="space-y-1">
                    {gPlan.allocations.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-1">Henüz hedef kalem tanımlanmadı.</p>
                    ) : (
                      gPlan.allocations.map((alloc, idx) => {
                        const acc = accounts.find(a => a.id === alloc.accountId);
                        const actualBought = getActualBoughtForAccount(alloc.accountId, group.id);
                        const isDone = alloc.completed || (alloc.targetAmountTRY > 0 && actualBought >= alloc.targetAmountTRY);

                        return (
                          <div
                            key={idx}
                            onClick={() => handleToggleComplete(gPlan, idx)}
                            className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/40 hover:bg-slate-800/60 cursor-pointer text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                              )}
                              <span className={`truncate text-xs ${isDone ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                                {acc?.name || 'Varlık Hesabı'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {actualBought > 0 && (
                                <span className="font-mono text-[11px] text-emerald-400">
                                  {formatTRY(actualBought, hideValues)}
                                </span>
                              )}
                              <span className="font-mono font-bold text-xs text-slate-400">
                                / {formatTRY(alloc.targetAmountTRY, hideValues)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: SPECIFIC GROUP TARGET MANAGEMENT */}
      {selectedGroupId !== 'ALL' && activeGroupPlan && (
        <div className="space-y-4">
          {/* Target Budget Card for Active Group */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-white/10 shadow-xl">
            <div 
              onClick={() => handleOpenBudgetModal(activeGroupPlan)}
              className="flex flex-col justify-between cursor-pointer p-2 -m-1 rounded-xl hover:bg-white/5 transition-colors group"
              title="Bütçeyi belirlemek veya sıfırlamak için tıklayın"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">
                    {groups.find(g => g.id === selectedGroupId)?.name} Yatırım Bütçesi
                  </span>
                  <Edit2 className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                </div>
                <div className="text-2xl font-extrabold text-white mt-1 font-mono group-hover:text-amber-300 transition-colors">
                  {formatTRY(activeGroupPlan.totalPlannedTRY, hideValues)}
                </div>
              </div>
              <span className="text-[10px] text-amber-400/80 mt-2 block font-medium">
                Hedefi değiştirmek için tıklayın →
              </span>
            </div>

            {(() => {
              const allocated = activeGroupPlan.allocations.reduce((sum, a) => sum + a.targetAmountTRY, 0);
              const remaining = Math.max(0, activeGroupPlan.totalPlannedTRY - allocated);
              const totalActualBought = activeGroupPlan.allocations.reduce((sum, a) => 
                sum + getActualBoughtForAccount(a.accountId, activeGroupPlan.groupId), 0
              );
              const completedCount = activeGroupPlan.allocations.filter(a => {
                const act = getActualBoughtForAccount(a.accountId, activeGroupPlan.groupId);
                return a.completed || (a.targetAmountTRY > 0 && act >= a.targetAmountTRY);
              }).length;
              const actualPct = allocated > 0 ? Math.min(100, Math.round((totalActualBought / allocated) * 100)) : 0;

              return (
                <>
                  <div className="flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
                    <div>
                      <span className="text-[11px] font-semibold text-amber-400 uppercase">
                        Planlanan Dağılım
                      </span>
                      <div className="text-2xl font-extrabold text-amber-300 mt-1 font-mono">
                        {formatTRY(allocated, hideValues)}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 mt-2">
                      Kalan Bütçe: <strong className="text-amber-400 font-mono">{formatTRY(remaining, hideValues)}</strong>
                    </span>
                  </div>

                  <div className="flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-emerald-400 uppercase">
                          Gerçekleşen Alımlar
                        </span>
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          %{actualPct}
                        </span>
                      </div>
                      <div className="text-2xl font-extrabold text-emerald-300 mt-1 font-mono">
                        {formatTRY(totalActualBought, hideValues)}
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>{completedCount} / {activeGroupPlan.allocations.length} Hedef Tamam</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/5">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${actualPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Allocations Checklist */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{MONTH_NAMES[selectedMonth - 1]} {selectedYear} Hedef Varlık Listesi</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Ay içindeki portföy alımlarınızla otomatik eşleşir
                </p>
              </div>

              <button
                onClick={handleOpenAddModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Hedef Kalem Ekle</span>
              </button>
            </div>

            <div className="space-y-2 pt-1">
              {activeGroupPlan.allocations.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs bg-slate-950/40 rounded-xl border border-white/5">
                  Bu ay için henüz yatırım hedefi eklenmedi. "Hedef Kalem Ekle" butonuna basarak başlayabilirsiniz.
                </div>
              ) : (
                activeGroupPlan.allocations.map((alloc, idx) => {
                  const acc = accounts.find(a => a.id === alloc.accountId);
                  const actualBought = getActualBoughtForAccount(alloc.accountId, activeGroupPlan.groupId);
                  const targetAmt = alloc.targetAmountTRY;
                  const isTargetReached = targetAmt > 0 && actualBought >= targetAmt;
                  const actualPct = targetAmt > 0 ? Math.min(100, Math.round((actualBought / targetAmt) * 100)) : 0;
                  const isCompleted = alloc.completed || isTargetReached;

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border transition-all ${
                        isCompleted
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-slate-950/60 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div
                          onClick={() => handleToggleComplete(activeGroupPlan, idx)}
                          className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                          ) : (
                            <Circle className="w-5 h-5 text-slate-600 flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-semibold truncate ${isCompleted ? 'line-through text-slate-400' : 'text-white'}`}>
                                {acc?.name || 'Varlık Hesabı'}
                              </span>
                              {acc?.symbol && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono font-bold">
                                  {acc.symbol}
                                </span>
                              )}
                              {isTargetReached && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                                  ✓ Hedefe Ulaşıldı
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-xs">
                              <span className="text-slate-400">
                                Hedef: <strong className="text-white font-mono">{formatTRY(targetAmt, hideValues)}</strong>
                              </span>
                              {actualBought > 0 ? (
                                <span className="text-emerald-400 font-medium">
                                  • Gerçekleşen: <strong className="font-mono">{formatTRY(actualBought, hideValues)}</strong> (%{actualPct})
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[11px]">
                                  • Bu ay henüz alım kaydedilmedi
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={`text-sm font-bold font-mono ${isCompleted ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {formatTRY(targetAmt, hideValues)}
                          </span>
                          <button
                            onClick={() => handleDeleteAllocation(activeGroupPlan, idx)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Hedefi Kaldır"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Mini Progress Bar */}
                      {targetAmt > 0 && (
                        <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2.5 overflow-hidden border border-white/5">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isTargetReached ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}
                            style={{ width: `${Math.min(100, (actualBought / targetAmt) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Allocation Modal */}
      <Modal
        isOpen={isAddAllocationModalOpen}
        onClose={() => setIsAddAllocationModalOpen(false)}
        title="Yeni Yatırım Hedefi Ekle"
      >
        <div className="space-y-4">
          {/* Step 1: Asset Type Category Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              1. Varlık Türü Seçin
            </label>
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-950 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveCategory('GOLD')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                  activeCategory === 'GOLD'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Altın</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('CURRENCY')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                  activeCategory === 'CURRENCY'
                    ? 'bg-indigo-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Euro className="w-3.5 h-3.5" />
                <span>Döviz</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveCategory('FUND')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                  activeCategory === 'FUND'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <LineChart className="w-3.5 h-3.5" />
                <span>TEFAS Fon</span>
              </button>
            </div>
          </div>

          {/* Step 2: Specific Asset Selection depending on category */}
          {activeCategory === 'GOLD' && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">
                2. Altın Türü Seçimi
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_GOLD_ASSETS.map((p) => {
                  const isSelected = selectedPresetKey === p.key;
                  const existingAcc = accounts.find(a => 
                    a.groupId === activeGroupPlan?.groupId && 
                    (a.symbol === p.symbol || a.subType === p.subType)
                  );
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setSelectedPresetKey(p.key)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-white ring-1 ring-amber-500/40 shadow-sm'
                          : 'bg-slate-950/60 border-white/5 hover:border-white/20 text-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span>{p.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {existingAcc ? '✓ Portföyde Bağlı' : '+ Yeni Tanımlanacak'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeCategory === 'CURRENCY' && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">
                2. Döviz Birimi Seçimi
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_CURRENCY_ASSETS.map((p) => {
                  const isSelected = selectedPresetKey === p.key;
                  const existingAcc = accounts.find(a => 
                    a.groupId === activeGroupPlan?.groupId && 
                    (a.symbol === p.symbol || (a.subType === 'CURRENCY' && a.currency === p.currency))
                  );
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setSelectedPresetKey(p.key)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-indigo-500/15 border-indigo-500 text-white ring-1 ring-indigo-500/40 shadow-sm'
                          : 'bg-slate-950/60 border-white/5 hover:border-white/20 text-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center justify-between">
                        <span>{p.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {existingAcc ? '✓ Portföyde Bağlı' : '+ Yeni Tanımlanacak'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeCategory === 'FUND' && (
            <div className="space-y-3">
              {/* Existing Funds in Portfolio */}
              {(() => {
                const groupFunds = accounts.filter(a => a.groupId === activeGroupPlan?.groupId && a.subType === 'FUND');
                return (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      2. Portföyünüzdeki Fonlar veya Yeni Fon
                    </label>
                    {groupFunds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {groupFunds.map(f => {
                          const isSelected = selectedExistingFundId === f.id;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                setSelectedExistingFundId(f.id);
                                setFundCodeInput('');
                                setFundNameInput('');
                              }}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                                isSelected
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/40'
                                  : 'bg-slate-950 border-white/10 text-slate-300 hover:border-white/20'
                              }`}
                            >
                              [{f.symbol}] {f.name}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setSelectedExistingFundId('')}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                            !selectedExistingFundId
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/40'
                              : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          + Başka Bir Fon Kodu
                        </button>
                      </div>
                    )}

                    {!selectedExistingFundId && (
                      <div className="space-y-2">
                        <div className="relative">
                          <input
                            type="text"
                            value={fundCodeInput}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              setFundCodeInput(val);
                              const match = lookupTefasFund(val);
                              if (match) {
                                setFundNameInput(match.name);
                              }
                              setFundSuggestions(searchTefasFunds(val));
                            }}
                            placeholder="Fon Kodu (Örn: MAC, TI2, IIH, BIO...)"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-mono uppercase focus:outline-none focus:border-emerald-400"
                            autoFocus
                          />
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                        </div>

                        {/* Search suggestions */}
                        {fundSuggestions.length > 0 && (
                          <div className="p-1 rounded-xl bg-slate-950 border border-white/10 max-h-36 overflow-y-auto space-y-0.5">
                            {fundSuggestions.map(s => (
                              <button
                                key={s.code}
                                type="button"
                                onClick={() => {
                                  setFundCodeInput(s.code);
                                  setFundNameInput(s.name);
                                  setFundSuggestions([]);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-xs flex items-center justify-between"
                              >
                                <span className="font-mono font-bold text-amber-300">{s.code}</span>
                                <span className="text-slate-300 text-[11px] truncate ml-2 flex-1">{s.name}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {fundNameInput && (
                          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{fundNameInput}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Step 3: Target Amount */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              3. Aylık Hedef Tutar (TL)
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={allocationAmount}
                onChange={(e) => setAllocationAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && activeGroupPlan) {
                    handleAddAllocation(activeGroupPlan);
                  }
                }}
                placeholder="Örn: 15.000 veya 15000,50"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400 pr-10"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">
                ₺
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-1.5 mt-2">
              <div className="flex flex-wrap gap-1.5">
                {[5000, 10000, 25000, 50000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAllocationAmount(formatForInput(val))}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 transition-colors"
                  >
                    {val >= 1000 ? `${val / 1000}B ₺` : `${val} ₺`}
                  </button>
                ))}
              </div>

              {(() => {
                if (!activeGroupPlan) return null;
                const allocated = activeGroupPlan.allocations.reduce((sum, a) => sum + a.targetAmountTRY, 0);
                const remaining = Math.max(0, activeGroupPlan.totalPlannedTRY - allocated);
                if (remaining <= 0) return null;

                return (
                  <button
                    type="button"
                    onClick={() => setAllocationAmount(formatForInput(remaining))}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
                  >
                    ⚡ Kalan Bütçeyi Ekle ({formatTRY(remaining)})
                  </button>
                );
              })()}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsAddAllocationModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeGroupPlan) handleAddAllocation(activeGroupPlan);
              }}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 shadow-lg shadow-amber-500/20"
            >
              Hedefe Ekle
            </button>
          </div>
        </div>
      </Modal>

      {/* Target Budget Modal */}
      <Modal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        title="Yatırım Bütçesi Belirle"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Hedef Portföyü / Hesabı:</span>
              <strong className="text-white">
                {groups.find(g => g.id === budgetModalTargetPlan?.groupId)?.name || 'Hesap'}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Dönem:</span>
              <strong className="text-amber-400 font-mono">
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </strong>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Aylık Hedef Bütçe Tutarı (TL)
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={budgetInputValue}
                onChange={(e) => setBudgetInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveBudgetModal();
                }}
                placeholder="Örn: 25.000 veya 0"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400 pr-10"
                autoFocus
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 font-mono">
                ₺
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              {[10000, 25000, 50000, 100000].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setBudgetInputValue(formatForInput(val))}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-slate-300 transition-colors"
                >
                  {val >= 1000 ? `${val / 1000}B ₺` : `${val} ₺`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={handleResetBudget}
              className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold border border-rose-500/20 transition-colors"
            >
              Hedefi Sıfırla (0 ₺)
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsBudgetModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleSaveBudgetModal}
                className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 shadow-lg shadow-amber-500/20"
              >
                Bütçeyi Güncelle
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
