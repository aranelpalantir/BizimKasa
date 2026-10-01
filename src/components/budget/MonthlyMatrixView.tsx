import React, { useState } from 'react';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  FolderPlus, 
  Calendar, 
  CreditCard, 
  TrendingDown, 
  TrendingUp,
  Trash2,
  Filter
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { GroupFilterBar } from '../common/GroupFilterBar';
import { db } from '../../db/db';
import { formatTRY, formatNumber } from '../../services/portfolioService';
import type { Group, Account, CashFlowEntry, AssetSubType } from '../../types/finance';

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

const ALL_12_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const MonthlyMatrixView: React.FC<MonthlyMatrixViewProps> = ({
  groups,
  accounts,
  entries,
  hideValues,
}) => {
  const currentRealYear = new Date().getFullYear();
  const currentRealMonth = new Date().getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentRealMonth);
  const [viewMode, setViewMode] = useState<'matrix' | 'monthly'>('matrix');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');
  
  // Year dynamic filter: Only show accounts with data in this year or all accounts
  const [onlyActiveThisYear, setOnlyActiveThisYear] = useState<boolean>(false);
  // Column range mode: all 12 months or focused (last month + next 3 months)
  const [monthRangeMode, setMonthRangeMode] = useState<'all' | 'focused'>('all');

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
  const [newAccSubType, setNewAccSubType] = useState<AssetSubType>('CREDIT_CARD');
  const [newAccBank, setNewAccBank] = useState('');

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Calculate dynamic available years from entries and future projections
  const uniqueEntryYears = Array.from(new Set(entries.map(e => e.year)));
  const baseYears = [currentRealYear - 1, currentRealYear, currentRealYear + 1, currentRealYear + 2];
  const dynamicYears = Array.from(new Set([...baseYears, ...uniqueEntryYears, 2024, 2025, 2026, 2027, 2028])).sort((a, b) => a - b);

  // When type changes in modal, auto-switch to a sensible subType
  const handleTypeChange = (type: 'EXPENSE' | 'INCOME') => {
    setNewAccType(type);
    if (type === 'EXPENSE') {
      setNewAccSubType('CREDIT_CARD');
    } else {
      setNewAccSubType('INCOME_SALARY');
    }
  };

  // Map for lightning fast lookup: key = `${accountId}_${year}_${month}`
  const entryMap = new Map<string, number>();
  for (const e of entries) {
    if (e.year === selectedYear) {
      entryMap.set(`${e.accountId}_${e.month}`, e.amount);
    }
  }

  const getAmount = (accountId: string, month: number): number => {
    return entryMap.get(`${accountId}_${month}`) || 0;
  };

  // Check if account has any entry > 0 in selectedYear
  const hasDataThisYear = (accountId: string): boolean => {
    for (let m = 1; m <= 12; m++) {
      if (getAmount(accountId, m) > 0) return true;
    }
    return false;
  };

  const handleCellClick = (account: Account, month: number) => {
    const val = getAmount(account.id, month);
    setEditingCell({ account, month, currentVal: val });
    setCellInputValue(val > 0 ? val.toString() : '');
  };

  const handleSaveCell = async () => {
    if (!editingCell) return;
    const val = parseFloat(cellInputValue.replace(/\./g, '').replace(',', '.')) || 0;
    
    const existing = entries.find(
      e => e.accountId === editingCell.account.id && e.year === selectedYear && e.month === editingCell.month
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
      const id = `cf_${editingCell.account.id}_${selectedYear}_${editingCell.month}`;
      await db.cashFlowEntries.put({
        id,
        accountId: editingCell.account.id,
        year: selectedYear,
        month: editingCell.month,
        amount: val,
        updatedAt: new Date().toISOString()
      });
    }

    setEditingCell(null);
  };

  const handleOpenAccountModal = () => {
    // If a specific group is selected in the filter, preselect it!
    const targetGroup = selectedGroupId !== 'ALL' ? selectedGroupId : (groups[0]?.id || '');
    setNewAccGroupId(targetGroup);
    setNewAccName('');
    setNewAccBank('');
    setNewAccType('EXPENSE');
    setNewAccSubType('CREDIT_CARD');
    setIsAccountModalOpen(true);
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

  // Delete account confirmation
  const handleDeleteAccount = (acc: Account) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Kalemi Sil',
      message: `"${acc.name}" kalemini ve bu kaleme ait geçmiş/gelecek tüm aylık tutarları silmek istediğinize emin misiniz?`,
      confirmText: 'Kalemi Sil',
      isDestructive: true,
      onConfirm: async () => {
        await db.accounts.delete(acc.id);
        const relatedEntries = entries.filter(e => e.accountId === acc.id);
        for (const e of relatedEntries) {
          await db.cashFlowEntries.delete(e.id);
        }
      }
    });
  };

  // Delete group confirmation
  const handleDeleteGroup = (group: Group) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Ana Grubu Sil',
      message: `"${group.name}" grubunu ve bu gruba bağlı TÜM bütçe kalemlerini, aylık kayıtları ve varlık işlemlerini silmek istediğinize emin misiniz?`,
      confirmText: 'Grubu ve Tüm Verileri Sil',
      isDestructive: true,
      onConfirm: async () => {
        await db.groups.delete(group.id);
        const groupAccounts = accounts.filter(a => a.groupId === group.id);
        for (const a of groupAccounts) {
          await db.accounts.delete(a.id);
          const relatedEntries = entries.filter(e => e.accountId === a.id);
          for (const e of relatedEntries) {
            await db.cashFlowEntries.delete(e.id);
          }
          const relatedTxs = await db.transactions.where('accountId').equals(a.id).toArray();
          for (const tx of relatedTxs) {
            await db.transactions.delete(tx.id);
          }
        }
        if (selectedGroupId === group.id) {
          setSelectedGroupId('ALL');
        }
      }
    });
  };

  // Month navigation in monthly view
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

  // Visible months in matrix view
  const visibleMonths = monthRangeMode === 'all' 
    ? ALL_12_MONTHS 
    : (() => {
        // Focused: current month - 1 through current month + 3
        const start = Math.max(1, currentRealMonth - 1);
        const end = Math.min(12, currentRealMonth + 3);
        const list: number[] = [];
        for (let m = start; m <= end; m++) list.push(m);
        return list.length > 0 ? list : ALL_12_MONTHS;
      })();

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
    const targetGroups = selectedGroupId === 'ALL'
      ? groups
      : groups.filter(g => g.id === selectedGroupId);

    for (const group of targetGroups) {
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

  const filteredGroups = selectedGroupId === 'ALL'
    ? groups
    : groups.filter(g => g.id === selectedGroupId);

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-white/5">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Gelir & Gider (Aylık Nakit Akışı)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              12 aylık kredi kartı ekstreleri, sabit giderler ve kişi bazlı net kalan tablosu
            </p>
          </div>

          {/* Year Selector with Prev/Next buttons */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800 border border-white/10">
            <button
              onClick={() => setSelectedYear(y => y - 1)}
              title="Önceki Yıl"
              className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-1 px-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                {dynamicYears.map((y) => (
                  <option key={y} value={y} className="bg-slate-900 text-white">
                    {y} Yılı
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setSelectedYear(y => y + 1)}
              title="Sonraki Yıl (Gelecek Taksitler)"
              className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex rounded-xl bg-slate-800 p-1 border border-white/5">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'matrix' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Yıllık Matris
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'monthly' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Aylık Görünüm
            </button>
          </div>

          {/* New Group Button */}
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-white/10 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Yeni Grup</span>
          </button>

          {/* Add Account Button */}
          <button
            onClick={handleOpenAccountModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Kalem Ekle</span>
          </button>
        </div>
      </div>

      {/* Group Filter Bar */}
      <GroupFilterBar
        groups={groups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={setSelectedGroupId}
        title="Grup Filtresi"
      />

      {/* Sub-Filters: Column Range & Active Items Filter */}
      {viewMode === 'matrix' && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Aralık:</span>
            <button
              onClick={() => setMonthRangeMode('all')}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                monthRangeMode === 'all' 
                  ? 'bg-slate-800 text-amber-300 font-semibold border border-amber-400/20' 
                  : 'hover:bg-slate-800/60 text-slate-400'
              }`}
            >
              Tüm Yıl (12 Ay)
            </button>
            <button
              onClick={() => setMonthRangeMode('focused')}
              className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                monthRangeMode === 'focused' 
                  ? 'bg-slate-800 text-amber-300 font-semibold border border-amber-400/20' 
                  : 'hover:bg-slate-800/60 text-slate-400'
              }`}
            >
              Yakın Dönem (Geçen Ay & Sonraki 3 Ay)
            </button>
          </div>

          <button
            onClick={() => setOnlyActiveThisYear(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors border ${
              onlyActiveThisYear
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-semibold'
                : 'bg-slate-900 border-white/5 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Filter className="w-3 h-3" />
            <span>{onlyActiveThisYear ? '✓ Yalnızca Bu Yıl Verisi Olan Kalemler' : 'Tüm Tanımlı Kalemleri Göster'}</span>
          </button>
        </div>
      )}

      {/* MATRIX VIEW (12 Months or Focused Range) */}
      {viewMode === 'matrix' && (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-white/10 text-slate-400 font-semibold sticky top-0 z-20">
                <th className="py-3 px-4 min-w-[200px] sticky left-0 z-30 bg-slate-950/95 border-r border-white/10">
                  Kalem / Hesap ({selectedYear})
                </th>
                {visibleMonths.map((m) => {
                  const isCurrentMonth = selectedYear === currentRealYear && m === currentRealMonth;
                  return (
                    <th 
                      key={m} 
                      className={`py-3 px-2.5 min-w-[95px] text-right font-medium ${
                        isCurrentMonth ? 'text-amber-400 bg-amber-400/10 font-bold' : ''
                      }`}
                    >
                      <div className="flex flex-col items-end">
                        <span>{MONTH_NAMES[m - 1]}</span>
                        {isCurrentMonth && (
                          <span className="text-[9px] uppercase px-1 rounded bg-amber-500/20 text-amber-300 mt-0.5">
                            Bu Ay
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredGroups.map((group) => {
                let groupAccounts = accounts.filter(a => a.groupId === group.id && (a.type === 'EXPENSE' || a.type === 'INCOME'));
                
                // If onlyActiveThisYear is active, filter accounts that have data in this year or were recently created
                if (onlyActiveThisYear) {
                  groupAccounts = groupAccounts.filter(a => hasDataThisYear(a.id));
                }

                const expenseAccounts = groupAccounts.filter(a => a.type === 'EXPENSE');
                const incomeAccounts = groupAccounts.filter(a => a.type === 'INCOME');

                return (
                  <React.Fragment key={group.id}>
                    {/* Group Header Row */}
                    <tr className="bg-slate-900/95 font-bold border-t-2 border-white/10">
                      <td colSpan={visibleMonths.length + 1} className="py-2.5 px-4 text-sm sticky left-0 z-10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2" style={{ color: group.color }}>
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                            <span>{group.name} Bütçesi</span>
                          </div>
                          <button
                            onClick={() => handleDeleteGroup(group)}
                            title={`${group.name} Grubunu Sil`}
                            className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expense Accounts */}
                    {expenseAccounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-2 px-4 text-slate-300 font-medium sticky left-0 z-10 bg-slate-900/95 border-r border-white/10 flex items-center justify-between">
                          <div className="flex items-center gap-2 truncate pr-2">
                            {acc.subType === 'CREDIT_CARD' ? (
                              <CreditCard className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                            )}
                            <span className="truncate">{acc.name}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteAccount(acc)}
                            title="Bu kalemi sil"
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all ml-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                        {visibleMonths.map((m) => {
                          const val = getAmount(acc.id, m);
                          const isCurrentMonth = selectedYear === currentRealYear && m === currentRealMonth;
                          return (
                            <td
                              key={m}
                              onClick={() => handleCellClick(acc, m)}
                              className={`py-2 px-2.5 text-right font-mono cursor-pointer hover:bg-amber-400/10 transition-colors ${
                                isCurrentMonth ? 'bg-amber-500/[0.03]' : ''
                              } ${val > 0 ? 'text-slate-200' : 'text-slate-600'}`}
                            >
                              {val > 0 ? formatNumber(val, 0, hideValues) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Group Expense Subtotal */}
                    <tr className="bg-rose-500/10 font-bold border-y border-rose-500/20 text-rose-400">
                      <td className="py-2 px-4 sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                        {group.name} Gider
                      </td>
                      {visibleMonths.map((m) => {
                        const { totalExpense } = calcGroupTotals(group, m);
                        const isCurrentMonth = selectedYear === currentRealYear && m === currentRealMonth;
                        return (
                          <td key={m} className={`py-2 px-2.5 text-right font-mono ${isCurrentMonth ? 'bg-amber-500/[0.05]' : ''}`}>
                            {formatNumber(totalExpense, 0, hideValues)}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Income Accounts */}
                    {incomeAccounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-2 px-4 text-emerald-400 font-medium sticky left-0 z-10 bg-slate-900/95 border-r border-white/10 flex items-center justify-between">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <span className="truncate">{acc.name}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteAccount(acc)}
                            title="Bu kalemi sil"
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all ml-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                        {visibleMonths.map((m) => {
                          const val = getAmount(acc.id, m);
                          const isCurrentMonth = selectedYear === currentRealYear && m === currentRealMonth;
                          return (
                            <td
                              key={m}
                              onClick={() => handleCellClick(acc, m)}
                              className={`py-2 px-2.5 text-right font-mono cursor-pointer hover:bg-emerald-400/10 transition-colors ${
                                isCurrentMonth ? 'bg-amber-500/[0.03]' : ''
                              } ${val > 0 ? 'text-emerald-300' : 'text-slate-600'}`}
                            >
                              {val > 0 ? formatNumber(val, 0, hideValues) : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Group Remaining Subtotal */}
                    <tr className="bg-blue-500/10 font-bold border-b-2 border-white/15 text-blue-400">
                      <td className="py-2 px-4 sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                        {group.name} Kalan
                      </td>
                      {visibleMonths.map((m) => {
                        const { remaining } = calcGroupTotals(group, m);
                        const isCurrentMonth = selectedYear === currentRealYear && m === currentRealMonth;
                        return (
                          <td key={m} className={`py-2 px-2.5 text-right font-mono ${isCurrentMonth ? 'bg-amber-500/[0.05]' : ''} ${remaining < 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                            {formatNumber(remaining, 0, hideValues)}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* CONSOLIDATED GRAND TOTALS: ONLY SHOWN WHEN selectedGroupId === 'ALL' */}
              {selectedGroupId === 'ALL' && (
                <>
                  <tr className="h-4 bg-slate-950/60"><td colSpan={visibleMonths.length + 1}></td></tr>
                  
                  <tr className="bg-rose-950/40 text-rose-300 font-extrabold text-sm border-y border-rose-500/30">
                    <td className="py-3 px-4 sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                      Genel Gider (Tüm Gruplar)
                    </td>
                    {visibleMonths.map((m) => {
                      const { grandExpense } = calcConsolidated(m);
                      return (
                        <td key={m} className="py-3 px-2.5 text-right font-mono">
                          {formatNumber(grandExpense, 0, hideValues)}
                        </td>
                      );
                    })}
                  </tr>

                  <tr className="bg-emerald-950/40 text-emerald-300 font-extrabold text-sm border-b border-emerald-500/30">
                    <td className="py-3 px-4 sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                      Genel Gelir (Tüm Gruplar)
                    </td>
                    {visibleMonths.map((m) => {
                      const { grandIncome } = calcConsolidated(m);
                      return (
                        <td key={m} className="py-3 px-2.5 text-right font-mono">
                          {formatNumber(grandIncome, 0, hideValues)}
                        </td>
                      );
                    })}
                  </tr>

                  <tr className="bg-blue-950/60 text-blue-300 font-extrabold text-base border-b-2 border-blue-400">
                    <td className="py-3.5 px-4 sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                      Genel Kalan (Tüm Gruplar)
                    </td>
                    {visibleMonths.map((m) => {
                      const { grandRemaining } = calcConsolidated(m);
                      return (
                        <td key={m} className={`py-3.5 px-2.5 text-right font-mono ${grandRemaining < 0 ? 'text-rose-400' : 'text-blue-300'}`}>
                          {formatNumber(grandRemaining, 0, hideValues)}
                        </td>
                      );
                    })}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SINGLE MONTH VIEW */}
      {viewMode === 'monthly' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-900 border border-white/10">
            <button
              onClick={handlePrevMonth}
              title="Önceki Ay"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 font-bold text-base text-white">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
            </div>
            <button
              onClick={handleNextMonth}
              title="Sonraki Ay (Yıl Aşımı Destekli)"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Consolidated Month Summary */}
          {(() => {
            const { grandExpense, grandIncome, grandRemaining } = calcConsolidated(selectedMonth);
            return (
              <div className="grid grid-cols-3 gap-2.5 p-4 rounded-2xl bg-slate-900/90 border border-white/10 text-center">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-rose-400 uppercase">Toplam Gider</span>
                  <span className="text-base sm:text-lg font-bold text-white mt-1 font-mono">
                    {formatTRY(grandExpense, hideValues)}
                  </span>
                </div>
                <div className="flex flex-col border-x border-white/10 px-1">
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase">Toplam Gelir</span>
                  <span className="text-base sm:text-lg font-bold text-white mt-1 font-mono">
                    {formatTRY(grandIncome, hideValues)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold text-blue-400 uppercase">Kalan Bütçe</span>
                  <span className={`text-base sm:text-lg font-bold mt-1 font-mono ${grandRemaining < 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                    {formatTRY(grandRemaining, hideValues)}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Group Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGroups.map((group) => {
              const { remaining } = calcGroupTotals(group, selectedMonth);
              let groupAccounts = accounts.filter(a => a.groupId === group.id && (a.type === 'EXPENSE' || a.type === 'INCOME'));
              if (onlyActiveThisYear) {
                groupAccounts = groupAccounts.filter(a => hasDataThisYear(a.id));
              }

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
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 hover:bg-slate-800/80 border border-white/5 transition-colors group"
                        >
                          <div 
                            onClick={() => handleCellClick(acc, selectedMonth)}
                            className="flex items-center gap-2 cursor-pointer flex-1 truncate pr-2"
                          >
                            {acc.type === 'EXPENSE' ? (
                              <TrendingDown className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                            ) : (
                              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            )}
                            <span className="text-xs text-slate-300 font-medium truncate">{acc.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span 
                              onClick={() => handleCellClick(acc, selectedMonth)}
                              className={`text-xs font-bold font-mono cursor-pointer ${acc.type === 'INCOME' ? 'text-emerald-400' : 'text-slate-200'}`}
                            >
                              {val > 0 ? formatTRY(val, hideValues) : '0,00 ₺'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAccount(acc);
                              }}
                              title="Kalemi Sil"
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
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
        title={editingCell ? `${editingCell.account.name} — ${MONTH_NAMES[editingCell.month - 1]} ${selectedYear}` : ''}
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
              placeholder="Örn: Mert, Aylin, Çocuk, Ortak Kasa..."
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

      {/* Add New Account Modal with Pre-selected Group and Dynamic SubTypes */}
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
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              Kalem bu grubun bütçesine eklenecektir. (Kalem adına kişi adını tekrar yazmanıza gerek yoktur).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Ana Tür</label>
              <select
                value={newAccType}
                onChange={(e) => handleTypeChange(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none"
              >
                <option value="EXPENSE">Gider / Kart</option>
                <option value="INCOME">Gelir</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Alt Kategori (Rapor & İkon)</label>
              <select
                value={newAccSubType}
                onChange={(e) => setNewAccSubType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none"
              >
                {newAccType === 'EXPENSE' ? (
                  <>
                    <option value="CREDIT_CARD">💳 Kredi Kartı</option>
                    <option value="EXPENSE_FIXED">🏠 Sabit Gider / Aidat / Kira</option>
                    <option value="EXPENSE_BILLS">🧾 Faturalar</option>
                    <option value="EXPENSE_OTHER">🛒 Diğer Harcamalar</option>
                  </>
                ) : (
                  <>
                    <option value="INCOME_SALARY">💼 Maaş Geliri</option>
                    <option value="INCOME_RENT">🏢 Kira Geliri</option>
                    <option value="INCOME_BONUS">⭐ Prim / İkramiye</option>
                    <option value="INCOME_OTHER">➕ Ek Gelir</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Kalem Adı (Açıklayıcı Başlık)</label>
            <input
              type="text"
              value={newAccName}
              onChange={(e) => setNewAccName(e.target.value)}
              placeholder="Örn: Garanti Bonus, Maximum, Ev Kirası, Maaş Geliri..."
              className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Banka / Kurum (Opsiyonel)</label>
            <input
              type="text"
              value={newAccBank}
              onChange={(e) => setNewAccBank(e.target.value)}
              placeholder="Örn: Garanti BBVA, İş Bankası, Yapı Kredi..."
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

      {/* Modern Confirm Dialog for Deletions */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        isDestructive={confirmDialog.isDestructive}
      />
    </div>
  );
};
