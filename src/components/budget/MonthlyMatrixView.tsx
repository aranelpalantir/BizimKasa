import React, { useState } from 'react';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  FolderPlus, 
  Calendar,
  CreditCard,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { db } from '../../db/db';
import { formatTRY, formatNumber } from '../../services/portfolioService';
import type { Group, Account, CashFlowEntry } from '../../types/finance';

interface MonthlyMatrixViewProps {
  groups: Group[];
  accounts: Account[];
  entries: CashFlowEntry[];
  hideValues: boolean;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export const MonthlyMatrixView: React.FC<MonthlyMatrixViewProps> = ({
  groups,
  accounts,
  entries,
  hideValues,
}) => {
  const currentYear = 2026;
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [viewMode, setViewMode] = useState<'matrix' | 'monthly'>('matrix');

  // Modals state
  const [editingCell, setEditingCell] = useState<{ account: Account; month: number; currentVal: number } | null>(null);
  const [cellInputValue, setCellInputValue] = useState('');
  
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#3b82f6');

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [newAccGroupId, setNewAccGroupId] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [newAccSubType, setNewAccSubType] = useState<'CREDIT_CARD' | 'OTHER' | 'CASH'>('CREDIT_CARD');
  const [newAccBank, setNewAccBank] = useState('');

  // Map for lightning fast lookup: key = `${accountId}_${month}`
  const entryMap = new Map<string, number>();
  for (const e of entries) {
    if (e.year === currentYear) {
      entryMap.set(`${e.accountId}_${e.month}`, e.amount);
    }
  }

  const getAmount = (accountId: string, month: number): number => {
    return entryMap.get(`${accountId}_${month}`) || 0;
  };

  const handleCellClick = (account: Account, month: number) => {
    const val = getAmount(account.id, month);
    setEditingCell({ account, month, currentVal: val });
    setCellInputValue(val > 0 ? val.toString() : '');
  };

  const handleSaveCell = async () => {
    if (!editingCell) return;
    const val = parseFloat(cellInputValue.replace(/\./g, '').replace(',', '.')) || 0;
    
    // Find existing
    const existing = entries.find(
      e => e.accountId === editingCell.account.id && e.year === currentYear && e.month === editingCell.month
    );

    if (existing) {
      if (val === 0) {
        await db.cashFlowEntries.delete(existing.id);
      } else {
        await db.cashFlowEntries.update(existing.id, {
          amount: val,
          updatedAt: new Date().toISOString()
        });
      }
    } else if (val > 0) {
      const id = `cf_${editingCell.account.id}_${currentYear}_${editingCell.month}`;
      await db.cashFlowEntries.put({
        id,
        accountId: editingCell.account.id,
        year: currentYear,
        month: editingCell.month,
        amount: val,
        updatedAt: new Date().toISOString()
      });
    }

    setEditingCell(null);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    const newGroup: Group = {
      id: `group-${Date.now()}`,
      name: newGroupName.trim(),
      color: newGroupColor,
      order: groups.length + 1,
      createdAt: new Date().toISOString()
    };
    await db.groups.add(newGroup);
    setNewGroupName('');
    setIsGroupModalOpen(false);
  };

  const handleCreateAccount = async () => {
    if (!newAccName.trim() || !newAccGroupId) return;
    const newAccount: Account = {
      id: `acc-${Date.now()}`,
      groupId: newAccGroupId,
      name: newAccName.trim(),
      type: newAccType,
      subType: newAccSubType,
      bankName: newAccBank.trim() || undefined,
      currency: 'TRY',
      order: accounts.length + 1,
      createdAt: new Date().toISOString()
    };
    await db.accounts.add(newAccount);
    setNewAccName('');
    setNewAccBank('');
    setIsAccountModalOpen(false);
  };

  // Months to display in matrix view (default focus on Feb-May or all months)
  const displayMonths = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // 1-12

  // Helper calculations for a specific group & month
  const calcGroupTotals = (group: Group, month: number) => {
    const groupAccounts = accounts.filter(a => a.groupId === group.id);
    let totalExpense = 0;
    let totalIncome = 0;

    for (const acc of groupAccounts) {
      const amt = getAmount(acc.id, month);
      if (acc.type === 'EXPENSE') totalExpense += amt;
      if (acc.type === 'INCOME') totalIncome += amt;
    }

    return {
      totalExpense,
      totalIncome,
      remaining: totalIncome - totalExpense
    };
  };

  // Consolidated totals across all groups for a month
  const calcConsolidated = (month: number) => {
    let grandExpense = 0;
    let grandIncome = 0;
    for (const group of groups) {
      const { totalExpense, totalIncome } = calcGroupTotals(group, month);
      grandExpense += totalExpense;
      grandIncome += totalIncome;
    }
    return {
      grandExpense,
      grandIncome,
      grandRemaining: grandIncome - grandExpense
    };
  };

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-white/5">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Aylık Bütçe & Nakit Akışı Matrisi</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {currentYear}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Kredi kartı ekstreleri, sabit giderler ve kişi bazlı net kalan tablosu
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-800 p-1 border border-white/5">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'matrix' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Yıllık Matris
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'monthly' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Aylık Görünüm
            </button>
          </div>

          {/* Add Group & Add Account Buttons */}
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-white/10 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Yeni Grup</span>
          </button>

          <button
            onClick={() => {
              if (groups.length > 0) setNewAccGroupId(groups[0].id);
              setIsAccountModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Kalem Ekle</span>
          </button>
        </div>
      </div>

      {/* MATRIX VIEW (Google Sheet Replica) */}
      {viewMode === 'matrix' && (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-white/10 text-slate-400 font-semibold sticky top-0 z-20">
                <th className="py-3 px-4 min-w-[200px] sticky left-0 z-30 bg-slate-950/95 border-r border-white/10">
                  Kalem / Hesap
                </th>
                {displayMonths.map((m) => (
                  <th key={m} className="py-3 px-3 min-w-[110px] text-right font-medium">
                    {MONTH_NAMES[m - 1]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {groups.map((group) => {
                const groupAccounts = accounts.filter(a => a.groupId === group.id && (a.type === 'EXPENSE' || a.type === 'INCOME'));
                const expenseAccounts = groupAccounts.filter(a => a.type === 'EXPENSE');
                const incomeAccounts = groupAccounts.filter(a => a.type === 'INCOME');

                return (
                  <React.Fragment key={group.id}>
                    {/* Group Header Row */}
                    <tr className="bg-slate-900/90 font-bold border-t-2 border-white/10">
                      <td colSpan={displayMonths.length + 1} className="py-2.5 px-4 text-sm sticky left-0 z-10 flex items-center gap-2" style={{ color: group.color }}>
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                        <span>{group.name} Bütçesi</span>
                      </td>
                    </tr>

                    {/* Expense Accounts */}
                    {expenseAccounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 px-4 text-slate-300 font-medium sticky left-0 z-10 bg-slate-900/95 border-r border-white/10 flex items-center justify-between">
                          <span className="truncate pr-2">{acc.name}</span>
                          {acc.subType === 'CREDIT_CARD' && (
                            <CreditCard className="w-3 h-3 text-slate-500 flex-shrink-0" />
                          )}
                        </td>
                        {displayMonths.map((m) => {
                          const val = getAmount(acc.id, m);
                          return (
                            <td
                              key={m}
                              onClick={() => handleCellClick(acc, m)}
                              className="py-2 px-3 text-right font-mono cursor-pointer hover:bg-amber-400/10 transition-colors text-slate-300"
                            >
                              {val > 0 ? formatNumber(val, 0, hideValues) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Group Expense Subtotal (Red Row) */}
                    <tr className="bg-rose-500/10 font-bold border-y border-rose-500/20 text-rose-400">
                      <td className="py-2 px-4 sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                        {group.name} Gider
                      </td>
                      {displayMonths.map((m) => {
                        const { totalExpense } = calcGroupTotals(group, m);
                        return (
                          <td key={m} className="py-2 px-3 text-right font-mono">
                            {formatNumber(totalExpense, 0, hideValues)}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Income Accounts */}
                    {incomeAccounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 px-4 text-emerald-400 font-medium sticky left-0 z-10 bg-slate-900/95 border-r border-white/10">
                          {acc.name}
                        </td>
                        {displayMonths.map((m) => {
                          const val = getAmount(acc.id, m);
                          return (
                            <td
                              key={m}
                              onClick={() => handleCellClick(acc, m)}
                              className="py-2 px-3 text-right font-mono cursor-pointer hover:bg-emerald-400/10 transition-colors text-emerald-300"
                            >
                              {val > 0 ? formatNumber(val, 0, hideValues) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Group Remaining Subtotal (Blue Row) */}
                    <tr className="bg-blue-500/10 font-bold border-b-2 border-white/15 text-blue-400">
                      <td className="py-2 px-4 sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                        {group.name} Kalan
                      </td>
                      {displayMonths.map((m) => {
                        const { remaining } = calcGroupTotals(group, m);
                        return (
                          <td key={m} className={`py-2 px-3 text-right font-mono ${remaining < 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                            {formatNumber(remaining, 0, hideValues)}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* CONSOLIDATED GRAND TOTALS (Image 1 Bottom Rows) */}
              <tr className="h-4 bg-slate-950/60"><td colSpan={displayMonths.length + 1}></td></tr>
              
              <tr className="bg-rose-950/40 text-rose-300 font-extrabold text-sm border-y border-rose-500/30">
                <td className="py-3 px-4 sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                  Genel Gider
                </td>
                {displayMonths.map((m) => {
                  const { grandExpense } = calcConsolidated(m);
                  return (
                    <td key={m} className="py-3 px-3 text-right font-mono">
                      {formatNumber(grandExpense, 0, hideValues)}
                    </td>
                  );
                })}
              </tr>

              <tr className="bg-emerald-950/40 text-emerald-300 font-extrabold text-sm border-b border-emerald-500/30">
                <td className="py-3 px-4 sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                  Genel Gelir
                </td>
                {displayMonths.map((m) => {
                  const { grandIncome } = calcConsolidated(m);
                  return (
                    <td key={m} className="py-3 px-3 text-right font-mono">
                      {formatNumber(grandIncome, 0, hideValues)}
                    </td>
                  );
                })}
              </tr>

              <tr className="bg-blue-950/60 text-blue-300 font-extrabold text-base border-b-2 border-blue-400">
                <td className="py-3.5 px-4 sticky left-0 z-10 bg-slate-950/95 border-r border-white/10 flex items-center gap-1.5">
                  <span>Genel Kalan</span>
                </td>
                {displayMonths.map((m) => {
                  const { grandRemaining } = calcConsolidated(m);
                  return (
                    <td key={m} className={`py-3.5 px-3 text-right font-mono ${grandRemaining < 0 ? 'text-rose-400' : 'text-blue-300'}`}>
                      {formatNumber(grandRemaining, 0, hideValues)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* SINGLE MONTH VIEW (Mobile Optimized Cards) */}
      {viewMode === 'monthly' && (
        <div className="space-y-4">
          {/* Month Selector Bar */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-white/10">
            <button
              onClick={() => setSelectedMonth(m => Math.max(1, m - 1))}
              disabled={selectedMonth === 1}
              className="p-2 rounded-xl bg-slate-800 disabled:opacity-30 hover:bg-slate-700 text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 font-bold text-base text-white">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>{MONTH_NAMES[selectedMonth - 1]} {currentYear}</span>
            </div>
            <button
              onClick={() => setSelectedMonth(m => Math.min(12, m + 1))}
              disabled={selectedMonth === 12}
              className="p-2 rounded-xl bg-slate-800 disabled:opacity-30 hover:bg-slate-700 text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Consolidated Month Summary Card */}
          {(() => {
            const { grandExpense, grandIncome, grandRemaining } = calcConsolidated(selectedMonth);
            return (
              <div className="grid grid-cols-3 gap-2.5 p-4 rounded-2xl bg-slate-900/90 border border-white/10 text-center">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-rose-400 uppercase">Genel Gider</span>
                  <span className="text-base sm:text-lg font-bold text-white mt-1 font-mono">
                    {formatTRY(grandExpense, hideValues)}
                  </span>
                </div>
                <div className="flex flex-col border-x border-white/10 px-1">
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase">Genel Gelir</span>
                  <span className="text-base sm:text-lg font-bold text-white mt-1 font-mono">
                    {formatTRY(grandIncome, hideValues)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-blue-400 uppercase">Genel Kalan</span>
                  <span className={`text-base sm:text-lg font-bold mt-1 font-mono ${grandRemaining < 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                    {formatTRY(grandRemaining, hideValues)}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Group Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => {
              const { remaining } = calcGroupTotals(group, selectedMonth);
              const groupAccounts = accounts.filter(a => a.groupId === group.id && (a.type === 'EXPENSE' || a.type === 'INCOME'));

              return (
                <div key={group.id} className="rounded-2xl bg-slate-900/80 border border-white/10 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                      <h4 className="font-bold text-white text-sm">{group.name}</h4>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 mr-1">Kalan:</span>
                      <span className={`font-bold font-mono text-sm ${remaining < 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                        {formatTRY(remaining, hideValues)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {groupAccounts.map((acc) => {
                      const val = getAmount(acc.id, selectedMonth);
                      return (
                        <div
                          key={acc.id}
                          onClick={() => handleCellClick(acc, selectedMonth)}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 hover:bg-slate-800/80 border border-white/5 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {acc.type === 'EXPENSE' ? (
                              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                            ) : (
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            <span className="text-xs text-slate-300 font-medium">{acc.name}</span>
                          </div>
                          <span className={`text-xs font-bold font-mono ${acc.type === 'INCOME' ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {val > 0 ? formatTRY(val, hideValues) : '0,00 ₺'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Cell Value Modal */}
      <Modal
        isOpen={!!editingCell}
        onClose={() => setEditingCell(null)}
        title={editingCell ? `${editingCell.account.name} — ${MONTH_NAMES[editingCell.month - 1]} ${currentYear}` : ''}
      >
        {editingCell && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                {editingCell.account.type === 'INCOME' ? 'Gelir Tutarı (TL)' : 'Ekstre / Gider Tutarı (TL)'}
              </label>
              <input
                type="text"
                autoFocus
                value={cellInputValue}
                onChange={(e) => setCellInputValue(e.target.value)}
                placeholder="Örn: 35000"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono font-bold text-lg focus:outline-none focus:border-amber-400 transition-colors"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSaveCell}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20"
              >
                Kaydet
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add New Group Modal */}
      <Modal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        title="Yeni Bütçe / Kişi Grubu Ekle"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Grup Adı</label>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Örn: Mert, Aylin, Çocuk, Ortak Ev..."
              className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Renk Teması</label>
            <div className="flex items-center gap-2">
              {['#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#64748b'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewGroupColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${newGroupColor === c ? 'scale-110 border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsGroupModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Vazgeç
            </button>
            <button
              onClick={handleCreateGroup}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
            >
              Grubu Oluştur
            </button>
          </div>
        </div>
      </Modal>

      {/* Add New Account / Category Modal */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title="Yeni Gelir / Gider Kalemi Ekle"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Bağlı Olduğu Grup</label>
            <select
              value={newAccGroupId}
              onChange={(e) => setNewAccGroupId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Tür</label>
              <select
                value={newAccType}
                onChange={(e) => setNewAccType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none"
              >
                <option value="EXPENSE">Gider / Kart</option>
                <option value="INCOME">Gelir</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Alt Tür</label>
              <select
                value={newAccSubType}
                onChange={(e) => setNewAccSubType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none"
              >
                <option value="CREDIT_CARD">Kredi Kartı</option>
                <option value="CASH">Nakit / Maaş</option>
                <option value="OTHER">Diğer Sabit Gider</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Kalem Adı</label>
            <input
              type="text"
              value={newAccName}
              onChange={(e) => setNewAccName(e.target.value)}
              placeholder="Örn: Garanti Kart, Aidat, Kira..."
              className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Banka Adı (Opsiyonel)</label>
            <input
              type="text"
              value={newAccBank}
              onChange={(e) => setNewAccBank(e.target.value)}
              placeholder="Örn: Garanti BBVA, İş Bankası..."
              className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsAccountModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Vazgeç
            </button>
            <button
              onClick={handleCreateAccount}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
            >
              Kalemi Ekle
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
