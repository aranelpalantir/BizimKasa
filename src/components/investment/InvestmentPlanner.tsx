import React, { useState } from 'react';
import { Target, CheckCircle2, Circle, Plus, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Modal } from '../common/Modal';
import { db } from '../../db/db';
import { formatTRY, formatNumber } from '../../services/portfolioService';
import type { Account, MonthlyInvestmentPlan } from '../../types/finance';

interface InvestmentPlannerProps {
  accounts: Account[];
  plans: MonthlyInvestmentPlan[];
  hideValues: boolean;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export const InvestmentPlanner: React.FC<InvestmentPlannerProps> = ({
  accounts,
  plans,
  hideValues
}) => {
  const currentYear = 2026;
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [isAddAllocationModalOpen, setIsAddAllocationModalOpen] = useState(false);

  // Form State
  const [targetBudgetInput, setTargetBudgetInput] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [allocationAmount, setAllocationAmount] = useState('');

  // Asset accounts available for investment
  const assetAccounts = accounts.filter(a => a.type === 'ASSET');

  // Find plan for current month/year
  const currentPlan = plans.find(p => p.year === currentYear && p.month === selectedMonth) || {
    id: `plan-${currentYear}-${selectedMonth}`,
    year: currentYear,
    month: selectedMonth,
    totalPlannedTRY: 30000,
    allocations: [
      { accountId: 'acc-varlik-altin-gr', targetAmountTRY: 15000, completed: true },
      { accountId: 'acc-fon-tte', targetAmountTRY: 10000, completed: false },
      { accountId: 'acc-varlik-euro', targetAmountTRY: 5000, completed: false }
    ],
    updatedAt: new Date().toISOString()
  };

  const totalAllocated = currentPlan.allocations.reduce((sum, a) => sum + a.targetAmountTRY, 0);
  const remainingToAllocate = Math.max(0, currentPlan.totalPlannedTRY - totalAllocated);
  const completedCount = currentPlan.allocations.filter(a => a.completed).length;

  const handleUpdateBudget = async () => {
    const val = parseFloat(targetBudgetInput.replace(',', '.'));
    if (!isNaN(val) && val >= 0) {
      await db.investmentPlans.put({
        ...currentPlan,
        totalPlannedTRY: val,
        updatedAt: new Date().toISOString()
      });
      setTargetBudgetInput('');
    }
  };

  const handleToggleComplete = async (idx: number) => {
    const newAllocations = [...currentPlan.allocations];
    newAllocations[idx].completed = !newAllocations[idx].completed;

    if (newAllocations[idx].completed) {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 }
      });
    }

    await db.investmentPlans.put({
      ...currentPlan,
      allocations: newAllocations,
      updatedAt: new Date().toISOString()
    });
  };

  const handleAddAllocation = async () => {
    if (!selectedAccountId) return;
    const amt = parseFloat(allocationAmount.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) return;

    const newAllocations = [
      ...currentPlan.allocations,
      { accountId: selectedAccountId, targetAmountTRY: amt, completed: false }
    ];

    await db.investmentPlans.put({
      ...currentPlan,
      allocations: newAllocations,
      updatedAt: new Date().toISOString()
    });

    setIsAddAllocationModalOpen(false);
    setAllocationAmount('');
  };

  const handleDeleteAllocation = async (idx: number) => {
    const newAllocations = currentPlan.allocations.filter((_, i) => i !== idx);
    await db.investmentPlans.put({
      ...currentPlan,
      allocations: newAllocations,
      updatedAt: new Date().toISOString()
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            <span>Aylık Yatırım Tahsis Planlayıcı</span>
          </h2>
          <p className="text-xs text-slate-400">
            Ay başında kalan bütçenizden altın, fon veya döviz için hedef ayırın ve alımları takip edin
          </p>
        </div>

        {/* Month Selector */}
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="px-3 py-1.5 rounded-xl bg-slate-800 border border-white/10 text-white text-xs font-semibold focus:outline-none"
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={i + 1} value={i + 1}>
              {name} {currentYear}
            </option>
          ))}
        </select>
      </div>

      {/* TARGET BUDGET OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-white/10 shadow-xl">
        <div className="flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase">
              Hedef Yatırım Bütçesi
            </span>
            <div className="text-2xl font-extrabold text-white mt-1 font-mono">
              {formatTRY(currentPlan.totalPlannedTRY, hideValues)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <input
              type="text"
              value={targetBudgetInput}
              onChange={(e) => setTargetBudgetInput(e.target.value)}
              placeholder="Yeni hedef tutar"
              className="w-28 px-2 py-1 rounded-lg bg-slate-950 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
            />
            <button
              onClick={handleUpdateBudget}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors border border-white/5"
            >
              Güncelle
            </button>
          </div>
        </div>

        <div className="flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
          <div>
            <span className="text-[11px] font-semibold text-emerald-400 uppercase">
              Planlanan Toplam Dağılım
            </span>
            <div className="text-2xl font-extrabold text-emerald-300 mt-1 font-mono">
              {formatTRY(totalAllocated, hideValues)}
            </div>
          </div>
          <span className="text-xs text-slate-400 mt-2">
            Tamamlanan: <span className="text-white font-bold">{completedCount} / {currentPlan.allocations.length}</span>
          </span>
        </div>

        <div className="flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
          <div>
            <span className="text-[11px] font-semibold text-amber-400 uppercase">
              Kalan Boş Bütçe
            </span>
            <div className="text-2xl font-extrabold text-amber-400 mt-1 font-mono">
              {formatTRY(remainingToAllocate, hideValues)}
            </div>
          </div>
          <button
            onClick={() => {
              if (assetAccounts.length > 0) setSelectedAccountId(assetAccounts[0].id);
              setIsAddAllocationModalOpen(true);
            }}
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20 mt-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Yeni Hedef Ekle</span>
          </button>
        </div>
      </div>

      {/* ALLOCATION ITEMS LIST */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{MONTH_NAMES[selectedMonth - 1]} Ayı Yatırım Hedefleri</span>
          </h4>
          <span className="text-[11px] text-slate-500">{currentPlan.allocations.length} Kalem</span>
        </div>

        {currentPlan.allocations.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Bu ay için henüz yatırım hedefi belirlenmedi.</p>
        ) : (
          <div className="space-y-2">
            {currentPlan.allocations.map((alloc, idx) => {
              const acc = accounts.find(a => a.id === alloc.accountId);
              const pct = currentPlan.totalPlannedTRY > 0 ? (alloc.targetAmountTRY / currentPlan.totalPlannedTRY) * 100 : 0;

              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                    alloc.completed
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-slate-950/60 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleComplete(idx)}
                      className="text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      {alloc.completed ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400 fill-emerald-500/20" />
                      ) : (
                        <Circle className="w-6 h-6 text-slate-600" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${alloc.completed ? 'line-through text-slate-400' : 'text-white'}`}>
                          {acc?.name || 'Varlık Hesabı'}
                        </span>
                        {acc?.symbol && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-300">
                            {acc.symbol}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Bütçedeki Payı: %{formatNumber(pct, 1)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-sm font-extrabold font-mono text-white block">
                        {formatTRY(alloc.targetAmountTRY, hideValues)}
                      </span>
                      <span className={`text-[10px] font-semibold ${alloc.completed ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {alloc.completed ? 'Alım Gerçekleşti' : 'Bekliyor'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteAllocation(idx)}
                      className="p-1 text-slate-600 hover:text-rose-400 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD ALLOCATION MODAL */}
      <Modal
        isOpen={isAddAllocationModalOpen}
        onClose={() => setIsAddAllocationModalOpen(false)}
        title="Yatırım Tahsis Hedefi Ekle"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Hedef Varlık Hesabı</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none"
            >
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.symbol ? `(${a.symbol})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Ayrılacak Tutar (TL)
            </label>
            <input
              type="text"
              value={allocationAmount}
              onChange={(e) => setAllocationAmount(e.target.value)}
              placeholder="Örn: 15000"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono font-bold text-base focus:outline-none focus:border-amber-400"
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
              onClick={handleAddAllocation}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
            >
              Hedefi Kaydet
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
