import React, { useState } from 'react';
import { Target, CheckCircle2, Circle, Plus, Sparkles, ChevronLeft, ChevronRight, Calendar, Trash2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { GroupFilterBar } from '../common/GroupFilterBar';
import { db } from '../../db/db';
import { formatTRY, formatNumber } from '../../services/portfolioService';
import type { Account, Group, MonthlyInvestmentPlan } from '../../types/finance';

interface InvestmentPlannerProps {
  groups: Group[];
  accounts: Account[];
  plans: MonthlyInvestmentPlan[];
  hideValues: boolean;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export const InvestmentPlanner: React.FC<InvestmentPlannerProps> = ({
  groups,
  accounts,
  plans,
  hideValues
}) => {
  const currentRealMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentRealMonth);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');

  const [isAddAllocationModalOpen, setIsAddAllocationModalOpen] = useState(false);
  const [targetBudgetInput, setTargetBudgetInput] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [allocationAmount, setAllocationAmount] = useState('');

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

  // Dynamic years list (from 2025 to 2029)
  const dynamicYears = [2025, 2026, 2027, 2028, 2029];

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

  // Real Asset accounts
  const assetAccounts = accounts.filter(a => a.type === 'ASSET');
  const filteredAssetAccounts = assetAccounts.filter(a => 
    selectedGroupId === 'ALL' || a.groupId === selectedGroupId
  );

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

  // Consolidated calculations when selectedGroupId === 'ALL'
  const consolidatedPlans = groups.map(g => getPlanForGroup(g.id));
  const consolidatedTotalPlanned = consolidatedPlans.reduce((sum, p) => sum + p.totalPlannedTRY, 0);
  const consolidatedTotalAllocated = consolidatedPlans.reduce((sum, p) => 
    sum + p.allocations.reduce((aSum, a) => aSum + a.targetAmountTRY, 0), 0
  );

  // Update budget for a specific plan
  const handleUpdateBudget = async (plan: MonthlyInvestmentPlan) => {
    const val = parseFloat(targetBudgetInput.replace(',', '.'));
    if (!isNaN(val) && val >= 0) {
      await db.investmentPlans.put({
        ...plan,
        totalPlannedTRY: val,
        updatedAt: new Date().toISOString()
      });
      setTargetBudgetInput('');
    }
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

  // Add allocation to a plan
  const handleAddAllocation = async (targetPlan: MonthlyInvestmentPlan) => {
    if (!selectedAccountId) return;
    const amt = parseFloat(allocationAmount.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) return;

    const newAllocations = [
      ...targetPlan.allocations,
      { accountId: selectedAccountId, targetAmountTRY: amt, completed: false }
    ];

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
            Kişi ve grup bazlı yatırım hedefleri belirleyin, ay boyunca alımlarınızı takip edin
          </p>
        </div>

        {/* Month & Year Navigation (Supports future years rollover) */}
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
        title="Grup Hedefleri"
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
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear} Portföy Toplamı
              </span>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase">
                Planlanan Varlık Tahsisleri
              </span>
              <div className="text-2xl font-extrabold text-emerald-300 mt-1 font-mono">
                {formatTRY(consolidatedTotalAllocated, hideValues)}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                Grupların hedef kalemleri toplamı
              </span>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
              <span className="text-[11px] font-semibold text-amber-400 uppercase">
                Tahsis Oranı
              </span>
              <div className="text-2xl font-extrabold text-amber-300 mt-1 font-mono">
                %{consolidatedTotalPlanned > 0 ? formatNumber((consolidatedTotalAllocated / consolidatedTotalPlanned) * 100, 0) : '0'}
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                Hedeflenen bütçeye göre
              </span>
            </div>
          </div>

          {/* Group Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => {
              const gPlan = getPlanForGroup(group.id);
              const gAllocated = gPlan.allocations.reduce((sum, a) => sum + a.targetAmountTRY, 0);
              const gCompletedCount = gPlan.allocations.filter(a => a.completed).length;

              return (
                <div key={group.id} className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3 shadow-md">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                      <h4 className="font-bold text-white text-sm">{group.name} Hedefi</h4>
                    </div>
                    <button
                      onClick={() => setSelectedGroupId(group.id)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                    >
                      Yönet / Kalem Ekle →
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Bütçe:</span>
                      <span className="font-bold text-white font-mono">{formatTRY(gPlan.totalPlannedTRY, hideValues)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Tahsis:</span>
                      <span className="font-bold text-emerald-400 font-mono">{formatTRY(gAllocated, hideValues)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Tamamlanan:</span>
                      <span className="font-bold text-amber-400 font-mono">{gCompletedCount} / {gPlan.allocations.length}</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/5">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${gPlan.totalPlannedTRY > 0 ? Math.min(100, (gAllocated / gPlan.totalPlannedTRY) * 100) : 0}%`
                      }}
                    />
                  </div>

                  {/* Mini Allocations list */}
                  <div className="space-y-1">
                    {gPlan.allocations.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic py-1">Henüz hedef kalem tanımlanmadı.</p>
                    ) : (
                      gPlan.allocations.map((alloc, idx) => {
                        const acc = accounts.find(a => a.id === alloc.accountId);
                        return (
                          <div
                            key={idx}
                            onClick={() => handleToggleComplete(gPlan, idx)}
                            className="flex items-center justify-between p-1.5 rounded-lg bg-slate-950/40 hover:bg-slate-800/60 cursor-pointer text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {alloc.completed ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                              )}
                              <span className={`truncate text-xs ${alloc.completed ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                                {acc?.name || 'Varlık Hesabı'}
                              </span>
                            </div>
                            <span className="font-mono font-bold text-xs text-slate-200">
                              {formatTRY(alloc.targetAmountTRY, hideValues)}
                            </span>
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
            <div className="flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase">
                  {groups.find(g => g.id === selectedGroupId)?.name} Yatırım Bütçesi
                </span>
                <div className="text-2xl font-extrabold text-white mt-1 font-mono">
                  {formatTRY(activeGroupPlan.totalPlannedTRY, hideValues)}
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <input
                  type="text"
                  value={targetBudgetInput}
                  onChange={(e) => setTargetBudgetInput(e.target.value)}
                  placeholder="Hedef tutar"
                  className="w-28 px-2 py-1 rounded-lg bg-slate-950 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={() => handleUpdateBudget(activeGroupPlan)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors border border-white/5"
                >
                  Güncelle
                </button>
              </div>
            </div>

            {(() => {
              const allocated = activeGroupPlan.allocations.reduce((sum, a) => sum + a.targetAmountTRY, 0);
              const remaining = Math.max(0, activeGroupPlan.totalPlannedTRY - allocated);
              const completedCount = activeGroupPlan.allocations.filter(a => a.completed).length;

              return (
                <>
                  <div className="flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
                    <div>
                      <span className="text-[11px] font-semibold text-emerald-400 uppercase">
                        Planlanan Dağılım
                      </span>
                      <div className="text-2xl font-extrabold text-emerald-300 mt-1 font-mono">
                        {formatTRY(allocated, hideValues)}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 mt-2">
                      Kalan: <strong className="text-amber-400 font-mono">{formatTRY(remaining, hideValues)}</strong>
                    </span>
                  </div>

                  <div className="flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
                    <div>
                      <span className="text-[11px] font-semibold text-blue-400 uppercase">
                        Tamamlanan Alımlar
                      </span>
                      <div className="text-2xl font-extrabold text-blue-300 mt-1 font-mono">
                        {completedCount} / {activeGroupPlan.allocations.length}
                      </div>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 mt-2 overflow-hidden border border-white/5">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${activeGroupPlan.allocations.length > 0 ? (completedCount / activeGroupPlan.allocations.length) * 100 : 0}%`
                        }}
                      />
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
                  Gerçekleştirdiğiniz alımları işaretleyin
                </p>
              </div>

              <button
                onClick={() => {
                  if (filteredAssetAccounts.length > 0) setSelectedAccountId(filteredAssetAccounts[0].id);
                  setIsAddAllocationModalOpen(true);
                }}
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
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        alloc.completed
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-slate-950/60 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div
                        onClick={() => handleToggleComplete(activeGroupPlan, idx)}
                        className="flex items-center gap-3 cursor-pointer flex-1"
                      >
                        {alloc.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-600 flex-shrink-0" />
                        )}
                        <div>
                          <span className={`text-sm font-semibold block ${alloc.completed ? 'line-through text-slate-400' : 'text-white'}`}>
                            {acc?.name || 'Varlık Hesabı'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {acc?.symbol ? `[${acc.symbol}] ` : ''}Aylık Hedef
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold font-mono ${alloc.completed ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {formatTRY(alloc.targetAmountTRY, hideValues)}
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
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Hedef Varlık Hesabı
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
            >
              {filteredAssetAccounts.map((a) => {
                const grp = groups.find(g => g.id === a.groupId);
                return (
                  <option key={a.id} value={a.id}>
                    [{grp?.name}] {a.name}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Hedef Tutar (TL)
            </label>
            <input
              type="text"
              value={allocationAmount}
              onChange={(e) => setAllocationAmount(e.target.value)}
              placeholder="Örn: 15000"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsAddAllocationModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Vazgeç
            </button>
            <button
              onClick={() => {
                if (activeGroupPlan) handleAddAllocation(activeGroupPlan);
              }}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
            >
              Hedefe Ekle
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
};
