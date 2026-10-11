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
  Filter,
  Edit2,
  Home,
  Receipt,
  ShoppingCart,
  Briefcase,
  Building2,
  Sparkles,
  PlusCircle,
  Palette,
  Copy,
  Zap,
  Check,
  ArrowRight
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { GroupFilterBar } from '../common/GroupFilterBar';
import { EditAccountModal } from '../common/EditAccountModal';
import { ACCOUNT_THEME_COLORS } from '../../constants/themeColors';
import { db } from '../../db/db';
import { 
  formatTRY, 
  formatSmartTRY, 
  formatSmartNumber, 
  parseUserInputNumber, 
  formatForInput 
} from '../../services/portfolioService';
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

const renderAccountIcon = (acc: Account) => {
  switch (acc.subType) {
    case 'CREDIT_CARD':
      return <span title="Kredi Kartı" className="flex-shrink-0 inline-flex"><CreditCard className="w-3.5 h-3.5 text-blue-400" /></span>;
    case 'EXPENSE_FIXED':
      return <span title="Sabit Gider / Aidat / Kira" className="flex-shrink-0 inline-flex"><Home className="w-3.5 h-3.5 text-amber-400" /></span>;
    case 'EXPENSE_BILLS':
      return <span title="Faturalar" className="flex-shrink-0 inline-flex"><Receipt className="w-3.5 h-3.5 text-purple-400" /></span>;
    case 'EXPENSE_OTHER':
      return <span title="Diğer Harcamalar" className="flex-shrink-0 inline-flex"><ShoppingCart className="w-3.5 h-3.5 text-rose-400" /></span>;
    case 'INCOME_SALARY':
      return <span title="Maaş Geliri" className="flex-shrink-0 inline-flex"><Briefcase className="w-3.5 h-3.5 text-emerald-400" /></span>;
    case 'INCOME_RENT':
      return <span title="Kira Geliri" className="flex-shrink-0 inline-flex"><Building2 className="w-3.5 h-3.5 text-cyan-400" /></span>;
    case 'INCOME_BONUS':
      return <span title="Prim / İkramiye" className="flex-shrink-0 inline-flex"><Sparkles className="w-3.5 h-3.5 text-amber-300" /></span>;
    case 'INCOME_OTHER':
      return <span title="Ek Gelir" className="flex-shrink-0 inline-flex"><PlusCircle className="w-3.5 h-3.5 text-teal-400" /></span>;
    default:
      return acc.type === 'INCOME' ? (
        <span title="Gelir" className="flex-shrink-0 inline-flex"><TrendingUp className="w-3.5 h-3.5 text-emerald-400" /></span>
      ) : (
        <span title="Gider" className="flex-shrink-0 inline-flex"><TrendingDown className="w-3.5 h-3.5 text-rose-400" /></span>
      );
  }
};

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
  const [monthRangeMode, setMonthRangeMode] = useState<'all' | 'focused'>('focused');

  // Modals state
  const [editingCell, setEditingCell] = useState<{ account: Account; month: number; currentVal: number } | null>(null);
  const [cellInputValue, setCellInputValue] = useState('');
  
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#3b82f6');
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [newAccGroupId, setNewAccGroupId] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [newAccSubType, setNewAccSubType] = useState<AssetSubType>('CREDIT_CARD');

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

  // Bulk Copy Modal State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceYear, setCopySourceYear] = useState<number>(selectedYear);
  const [copySourceMonth, setCopySourceMonth] = useState<number>(currentRealMonth === 1 ? 12 : currentRealMonth - 1);
  const [copyTargetYear, setCopyTargetYear] = useState<number>(selectedYear);
  const [copyTargetMonth, setCopyTargetMonth] = useState<number>(currentRealMonth);
  const [copyScope, setCopyScope] = useState<'INCOME_ONLY' | 'FIXED_AND_INCOME' | 'ALL'>('INCOME_ONLY');
  const [copyOnlyEmpty, setCopyOnlyEmpty] = useState<boolean>(true);
  const [copyGroupId, setCopyGroupId] = useState<string>('ALL');

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Helper to open copy modal pre-filled
  const handleOpenCopyModal = (targetY?: number, targetM?: number) => {
    const tYear = targetY ?? selectedYear;
    const tMonth = targetM ?? (viewMode === 'monthly' ? selectedMonth : currentRealMonth);
    const sMonth = tMonth === 1 ? 12 : tMonth - 1;
    const sYear = tMonth === 1 ? tYear - 1 : tYear;

    setCopyTargetYear(tYear);
    setCopyTargetMonth(tMonth);
    setCopySourceYear(sYear);
    setCopySourceMonth(sMonth);
    setCopyScope('INCOME_ONLY');
    setCopyOnlyEmpty(true);
    setCopyGroupId(selectedGroupId);
    setIsCopyModalOpen(true);
  };

  // Helper to find the last recorded positive entry for an account before a given year & month
  const getLastRecordedEntry = (accountId: string, curYear: number, curMonth: number) => {
    const candidates = entries
      .filter(e => e.accountId === accountId && e.amount > 0 && (e.year < curYear || (e.year === curYear && e.month < curMonth)))
      .sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));
    return candidates[0] || null;
  };

  // Calculation of preview items for the copy modal
  const getCopyPreview = () => {
    const isSamePeriod = copySourceYear === copyTargetYear && copySourceMonth === copyTargetMonth;
    if (isSamePeriod) {
      return { itemsToCopy: [], itemsSkipped: [], totalIncome: 0, totalExpense: 0, isSamePeriod: true };
    }

    const candidateAccounts = accounts.filter(acc => {
      if (copyGroupId !== 'ALL' && acc.groupId !== copyGroupId) return false;
      if (copyScope === 'INCOME_ONLY') {
        return acc.type === 'INCOME';
      }
      if (copyScope === 'FIXED_AND_INCOME') {
        return acc.type === 'INCOME' || acc.subType === 'EXPENSE_FIXED' || acc.subType === 'EXPENSE_BILLS';
      }
      return acc.type === 'INCOME' || acc.type === 'EXPENSE';
    });

    const itemsToCopy: Array<{ account: Account; sourceAmount: number; isOverwriting: boolean }> = [];
    const itemsSkipped: Array<{ account: Account; sourceAmount: number; targetAmount: number }> = [];
    let totalIncome = 0;
    let totalExpense = 0;

    for (const acc of candidateAccounts) {
      const sEntry = entries.find(
        e => e.accountId === acc.id && e.year === copySourceYear && e.month === copySourceMonth
      );
      const sAmt = sEntry?.amount || 0;
      if (sAmt <= 0) continue;

      const tEntry = entries.find(
        e => e.accountId === acc.id && e.year === copyTargetYear && e.month === copyTargetMonth
      );
      const tAmt = tEntry?.amount || 0;
      const isTargetFilled = tAmt > 0;

      if (copyOnlyEmpty && isTargetFilled) {
        itemsSkipped.push({ account: acc, sourceAmount: sAmt, targetAmount: tAmt });
      } else {
        itemsToCopy.push({ account: acc, sourceAmount: sAmt, isOverwriting: isTargetFilled });
        if (acc.type === 'INCOME') totalIncome += sAmt;
        if (acc.type === 'EXPENSE') totalExpense += sAmt;
      }
    }

    return { itemsToCopy, itemsSkipped, totalIncome, totalExpense, isSamePeriod: false };
  };

  const handleExecuteCopy = async () => {
    const { itemsToCopy, isSamePeriod } = getCopyPreview();
    if (isSamePeriod || itemsToCopy.length === 0) return;

    const now = new Date().toISOString();
    const entriesToPut: CashFlowEntry[] = itemsToCopy.map(item => ({
      id: `cf_${item.account.id}_${copyTargetYear}_${copyTargetMonth}`,
      accountId: item.account.id,
      year: copyTargetYear,
      month: copyTargetMonth,
      amount: item.sourceAmount,
      updatedAt: now
    }));

    await db.cashFlowEntries.bulkPut(entriesToPut);
    setIsCopyModalOpen(false);
    setToastMessage(`${itemsToCopy.length} kalem ${MONTH_NAMES[copyTargetMonth - 1]} ${copyTargetYear} dönemine başarıyla aktarıldı.`);
    setTimeout(() => setToastMessage(null), 4000);
  };

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

  // Account Editing state
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editAccName, setEditAccName] = useState('');
  const [editAccGroupId, setEditAccGroupId] = useState('');
  const [editAccType, setEditAccType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [editAccSubType, setEditAccSubType] = useState<AssetSubType>('CREDIT_CARD');

  const handleOpenEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setEditAccName(acc.name);
    setEditAccGroupId(acc.groupId);
    setEditAccType(acc.type as 'EXPENSE' | 'INCOME');
    setEditAccSubType(acc.subType);
  };

  const handleSaveEditAccount = async () => {
    if (!editingAccount || !editAccName.trim() || !editAccGroupId) return;
    await db.accounts.update(editingAccount.id, {
      name: editAccName.trim(),
      groupId: editAccGroupId,
      type: editAccType,
      subType: editAccSubType
    });
    setEditingAccount(null);
  };

  const handleCellClick = (account: Account, month: number) => {
    const val = getAmount(account.id, month);
    setEditingCell({ account, month, currentVal: val });
    setCellInputValue(formatForInput(val));
  };

  const handleSaveCell = async () => {
    if (!editingCell) return;
    const val = parseUserInputNumber(cellInputValue);
    
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
      currency: 'TRY',
      order: accounts.length + 1,
      createdAt: new Date().toISOString()
    };
    await db.accounts.add(newAccount);
    setNewAccName('');
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
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Gelir & Gider (Aylık Nakit Akışı)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            12 aylık kredi kartı ekstreleri, sabit giderler ve kişi bazlı net kalan tablosu
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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

          {/* Bulk Copy Month Button */}
          <button
            onClick={() => handleOpenCopyModal()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-colors shadow-sm"
            title="Geçmiş bir aydan bütçe kalemlerini bu aya kopyala"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-400" />
            <span>Önceki Aydan Kopyala</span>
          </button>

          {/* New Account Button */}
          <button
            onClick={() => setIsGroupModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-colors shadow-sm"
          >
            <FolderPlus className="w-3.5 h-3.5 text-blue-400" />
            <span>Yeni Hesap</span>
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
        title="Hesap"
        onAddGroup={() => setIsGroupModalOpen(true)}
        addLabel="Yeni Hesap"
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
          <table className="w-full text-left text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-950 text-slate-400 font-semibold sticky top-0 z-20">
                <th className="py-3 px-3 sm:px-4 min-w-[190px] max-w-[190px] sm:min-w-[230px] sm:max-w-[230px] w-[190px] sm:w-[230px] sticky left-0 z-30 bg-slate-950 border-r border-b border-white/10 shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                  Kalem / Hesap ({selectedYear})
                </th>
                {visibleMonths.map((m) => {
                  const isCurrentMonth = selectedYear === currentRealYear && m === currentRealMonth;
                  return (
                    <th 
                      key={m} 
                      className={`py-3 px-2.5 min-w-[95px] text-right font-medium border-b border-white/10 ${
                        isCurrentMonth ? 'text-amber-400 bg-amber-400/10 font-bold' : 'bg-slate-950'
                      }`}
                    >
                      <div className="flex flex-col items-end group/th">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCopyModal(selectedYear, m);
                            }}
                            title={`${MONTH_NAMES[m - 1]} ${selectedYear} dönemine önceki aydan kopyala`}
                            className="opacity-0 group-hover/th:opacity-100 p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-opacity"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <span>{MONTH_NAMES[m - 1]}</span>
                        </div>
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
            <tbody>
              {filteredGroups.length === 0 && (
                <tr>
                  <td colSpan={visibleMonths.length + 1} className="py-12 text-center text-slate-500 border-b border-white/5">
                    <p className="text-sm font-medium text-slate-400">Henüz kayıtlı bir hesap veya bütçe kalemi bulunmuyor.</p>
                    <p className="text-xs text-slate-500 mt-1">Yukarıdaki "+ Yeni Hesap" butonuna tıklayarak ilk hesabınızı (örn: Ana Hesap, Yatırım Portföyü, Ortak Kasa) oluşturabilirsiniz.</p>
                  </td>
                </tr>
              )}
              {filteredGroups.map((group) => {
                let groupAccounts = accounts.filter(a => a.groupId === group.id && (a.type === 'EXPENSE' || a.type === 'INCOME'));
                
                // If onlyActiveThisYear is active, filter accounts that have data in this year or were recently created
                if (onlyActiveThisYear) {
                  groupAccounts = groupAccounts.filter(a => hasDataThisYear(a.id));
                }

                const expenseAccounts = groupAccounts.filter(a => a.type === 'EXPENSE');
                const incomeAccounts = groupAccounts.filter(a => a.type === 'INCOME');

                // If viewing consolidated ALL and this account has no budget items (e.g. only assets), skip it!
                if (selectedGroupId === 'ALL' && groupAccounts.length === 0) {
                  return null;
                }

                return (
                  <React.Fragment key={group.id}>
                    {/* Group Header Row */}
                    <tr className="font-bold">
                      <td 
                        className="py-2.5 px-3 sm:px-4 text-sm sticky left-0 z-10 min-w-[190px] max-w-[190px] sm:min-w-[230px] sm:max-w-[230px] w-[190px] sm:w-[230px] shadow-[2px_0_5px_rgba(0,0,0,0.4)] border-r border-b transition-colors"
                        style={{
                          backgroundColor: '#0f172a',
                          borderTop: `2px solid ${group.color}`,
                          borderBottomColor: 'rgba(255,255,255,0.1)'
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 truncate pr-2" style={{ color: group.color }}>
                            <div 
                              className="w-2.5 h-2.5 rounded-full shrink-0" 
                              style={{ 
                                backgroundColor: group.color,
                                boxShadow: `0 0 8px ${group.color}`
                              }} 
                            />
                            <span className="truncate tracking-wide">{group.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setEditingGroup(group)}
                              title={`${group.name} Renk Temasını Değiştir`}
                              aria-label={`${group.name} renk temasını değiştir`}
                              className="p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                              style={{ color: group.color }}
                            >
                              <Palette className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteGroup(group)}
                              title={`${group.name} Hesabını Sil`}
                              aria-label={`${group.name} hesabını sil`}
                              className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td 
                        colSpan={visibleMonths.length} 
                        className="border-b transition-colors"
                        style={{
                          background: `linear-gradient(90deg, ${group.color}18 0%, ${group.color}06 35%, rgba(15,23,42,0.9) 100%)`,
                          borderTop: `2px solid ${group.color}70`,
                          borderBottomColor: 'rgba(255,255,255,0.1)'
                        }}
                      />
                    </tr>

                    {/* If this account only tracks assets and has no budget items */}
                    {groupAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={visibleMonths.length + 1} className="py-8 px-4 text-center bg-slate-900/30 border-b border-white/10">
                          <p className="text-xs font-medium text-slate-300">Bu hesapta henüz gelir veya gider kalemi tanımlı değil.</p>
                          <p className="text-[11px] text-slate-500 mt-1">Hesabınızı yalnızca varlık (altın, döviz, fon) birikimi için kullanıyor olabilirsiniz.</p>
                          <button
                            onClick={handleOpenAccountModal}
                            className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Bu Hesaba Gelir / Gider Kalemi Ekle</span>
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <>
                        {/* Expense Accounts */}
                        {expenseAccounts.map((acc) => (
                          <tr key={acc.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="py-2 px-3 sm:px-4 text-slate-300 font-medium sticky left-0 z-10 bg-slate-900 border-r border-b border-white/5 min-w-[190px] max-w-[190px] sm:min-w-[230px] sm:max-w-[230px] w-[190px] sm:w-[230px] shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2 truncate pr-1">
                                  {renderAccountIcon(acc)}
                                  <span className="truncate">{acc.name}</span>
                                </div>
                                <div className="flex items-center gap-0.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditAccount(acc)}
                                    title="Kalemi Düzenle"
                                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 active:text-amber-400 transition-colors"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAccount(acc)}
                                    title="Bu kalemi sil"
                                    className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 active:text-rose-400 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </td>
                            {visibleMonths.map((m) => {
                              const val = getAmount(acc.id, m);
                              const isCurrentMonth = selectedYear === currentRealYear && m === currentRealMonth;
                              return (
                                <td
                                  key={m}
                                  onClick={() => handleCellClick(acc, m)}
                                  className={`py-2 px-2.5 text-right font-mono cursor-pointer hover:bg-amber-400/10 transition-colors border-b border-white/5 ${
                                    isCurrentMonth ? 'bg-amber-500/[0.03]' : ''
                                  } ${val > 0 ? 'text-slate-200' : 'text-slate-600'}`}
                                >
                                  {val > 0 ? formatSmartNumber(val, hideValues) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}

                        {/* Group Expense Subtotal */}
                        <tr className="bg-rose-500/10 font-bold text-rose-400">
                          <td className="py-2 px-3 sm:px-4 sticky left-0 z-10 bg-slate-950 border-r border-b border-t border-rose-500/20 min-w-[190px] max-w-[190px] sm:min-w-[230px] sm:max-w-[230px] w-[190px] sm:w-[230px] shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                            <div className="truncate">
                              {group.name} Gider
                            </div>
                          </td>
                          {visibleMonths.map((m) => {
                            const { totalExpense } = calcGroupTotals(group, m);
                            const isCurrentMonth = selectedYear === currentRealYear && m === currentRealMonth;
                            return (
                              <td key={m} className={`py-2 px-2.5 text-right font-mono border-b border-t border-rose-500/20 ${isCurrentMonth ? 'bg-amber-500/[0.05]' : ''}`}>
                                {formatSmartNumber(totalExpense, hideValues)}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Income Accounts */}
                        {incomeAccounts.map((acc) => (
                          <tr key={acc.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="py-2 px-3 sm:px-4 text-emerald-400 font-medium sticky left-0 z-10 bg-slate-900 border-r border-b border-white/5 min-w-[190px] max-w-[190px] sm:min-w-[230px] sm:max-w-[230px] w-[190px] sm:w-[230px] shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2 truncate pr-1">
                                  {renderAccountIcon(acc)}
                                  <span className="truncate">{acc.name}</span>
                                </div>
                                <div className="flex items-center gap-0.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditAccount(acc)}
                                    title="Kalemi Düzenle"
                                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-amber-400 active:text-amber-400 transition-colors"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAccount(acc)}
                                    title="Bu kalemi sil"
                                    className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 active:text-rose-400 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </td>
                            {visibleMonths.map((m) => {
                              const val = getAmount(acc.id, m);
                              const isCurrentMonth = selectedYear === currentRealYear && m === currentRealMonth;
                              return (
                                <td
                                  key={m}
                                  onClick={() => handleCellClick(acc, m)}
                                  className={`py-2 px-2.5 text-right font-mono cursor-pointer hover:bg-emerald-400/10 transition-colors border-b border-white/5 ${
                                    isCurrentMonth ? 'bg-amber-500/[0.03]' : ''
                                  } ${val > 0 ? 'text-emerald-300' : 'text-slate-600'}`}
                                >
                                  {val > 0 ? formatSmartNumber(val, hideValues) : '-'}
                                </td>
                              );
                            })}
                          </tr>
                        ))}

                        {/* Group Income Subtotal */}
                        <tr className="bg-emerald-500/10 font-bold text-emerald-400">
                          <td className="py-2 px-3 sm:px-4 sticky left-0 z-10 bg-slate-950 border-r border-b border-t border-emerald-500/20 min-w-[190px] max-w-[190px] sm:min-w-[230px] sm:max-w-[230px] w-[190px] sm:w-[230px] shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                            <div className="truncate">
                              {group.name} Gelir
                            </div>
                          </td>
                          {visibleMonths.map((m) => {
                            const { totalIncome } = calcGroupTotals(group, m);
                            const isCurrentMonth = selectedYear === currentRealYear && m === currentRealMonth;
                            return (
                              <td key={m} className={`py-2 px-2.5 text-right font-mono border-b border-t border-emerald-500/20 ${isCurrentMonth ? 'bg-amber-500/[0.05]' : ''}`}>
                                {formatSmartNumber(totalIncome, hideValues)}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Group Remaining Subtotal */}
                        <tr className="bg-blue-500/10 font-bold text-blue-400">
                          <td className="py-2 px-3 sm:px-4 sticky left-0 z-10 bg-slate-950 border-r border-b-2 border-t border-blue-500/20 border-b-white/15 min-w-[190px] max-w-[190px] sm:min-w-[230px] sm:max-w-[230px] w-[190px] sm:w-[230px] shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                            <div className="truncate">
                              {group.name} Kalan
                            </div>
                          </td>
                          {visibleMonths.map((m) => {
                            const { remaining } = calcGroupTotals(group, m);
                            const isCurrentMonth = selectedYear === currentRealYear && m === currentRealMonth;
                            return (
                              <td key={m} className={`py-2 px-2.5 text-right font-mono border-b-2 border-t border-blue-500/20 border-b-white/15 ${isCurrentMonth ? 'bg-amber-500/[0.05]' : ''} ${remaining < 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                                {formatSmartNumber(remaining, hideValues)}
                              </td>
                            );
                          })}
                        </tr>
                      </>
                    )}
                  </React.Fragment>
                );
              })}

              {/* CONSOLIDATED GRAND TOTALS: ONLY SHOWN WHEN selectedGroupId === 'ALL' */}
              {selectedGroupId === 'ALL' && groups.length > 0 && (
                <>
                  <tr className="h-3 bg-slate-950/60"><td colSpan={visibleMonths.length + 1}></td></tr>
                  
                  <tr className="bg-slate-900/60 text-rose-400 font-semibold text-xs">
                    <td className="py-2.5 px-3 sm:px-4 sticky left-0 z-10 bg-slate-950 border-r border-b border-t border-rose-500/20 min-w-[190px] max-w-[190px] sm:min-w-[230px] sm:max-w-[230px] w-[190px] sm:w-[230px] shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                      <div className="truncate">
                        Genel Gider (Konsolide)
                      </div>
                    </td>
                    {visibleMonths.map((m) => {
                      const { grandExpense } = calcConsolidated(m);
                      return (
                        <td key={m} className="py-2.5 px-2.5 text-right font-mono border-b border-t border-rose-500/20">
                          {formatSmartNumber(grandExpense, hideValues)}
                        </td>
                      );
                    })}
                  </tr>

                  <tr className="bg-slate-900/60 text-emerald-400 font-semibold text-xs">
                    <td className="py-2.5 px-3 sm:px-4 sticky left-0 z-10 bg-slate-950 border-r border-b border-white/10 min-w-[190px] max-w-[190px] sm:min-w-[230px] sm:max-w-[230px] w-[190px] sm:w-[230px] shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                      <div className="truncate">
                        Genel Gelir (Konsolide)
                      </div>
                    </td>
                    {visibleMonths.map((m) => {
                      const { grandIncome } = calcConsolidated(m);
                      return (
                        <td key={m} className="py-2.5 px-2.5 text-right font-mono border-b border-white/10">
                          {formatSmartNumber(grandIncome, hideValues)}
                        </td>
                      );
                    })}
                  </tr>

                  <tr className="bg-slate-900/90 text-blue-300 font-semibold text-xs">
                    <td className="py-3 px-3 sm:px-4 sticky left-0 z-10 bg-slate-950 border-r border-b border-t border-blue-500/30 min-w-[190px] max-w-[190px] sm:min-w-[230px] sm:max-w-[230px] w-[190px] sm:w-[230px] shadow-[2px_0_5px_rgba(0,0,0,0.4)]">
                      <div className="truncate">
                        Genel Kalan (Konsolide)
                      </div>
                    </td>
                    {visibleMonths.map((m) => {
                      const { grandRemaining } = calcConsolidated(m);
                      return (
                        <td key={m} className={`py-3 px-2.5 text-right font-mono border-b border-t border-blue-500/30 ${grandRemaining < 0 ? 'text-rose-400' : 'text-blue-300'}`}>
                          {formatSmartNumber(grandRemaining, hideValues)}
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
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenCopyModal(selectedYear, selectedMonth)}
                title="Önceki aydan bu aya verileri kopyala"
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-white/10 transition-colors shadow-sm"
              >
                <Copy className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Önceki Aydan Aktar</span>
              </button>
              <button
                onClick={handleNextMonth}
                title="Sonraki Ay (Yıl Aşımı Destekli)"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Consolidated Month Summary */}
          {(() => {
            const { grandExpense, grandIncome, grandRemaining } = calcConsolidated(selectedMonth);
            return (
              <div className="space-y-3">
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

                {/* Smart Suggestion Banner if no income entered for this month */}
                {grandIncome === 0 && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-slate-900/90 to-slate-900/90 border border-emerald-500/20">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 shrink-0">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Bu ay için henüz gelir girilmemiş</p>
                        <p className="text-[11px] text-slate-400">Önceki ayın maaş, kira ve düzenli gelirlerini tek tıkla buraya aktarabilirsiniz.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenCopyModal(selectedYear, selectedMonth)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20 shrink-0 self-end sm:self-center active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Gelirleri Önceki Aydan Kopyala</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Group Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGroups.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 rounded-2xl bg-slate-900/40 border border-white/5">
                <p className="text-sm font-medium text-slate-400">Henüz kayıtlı bir hesap bulunmuyor.</p>
                <p className="text-xs text-slate-500 mt-1">Yukarıdaki "+ Yeni Hesap" butonuna tıklayarak ilk hesabınızı ekleyebilirsiniz.</p>
              </div>
            )}
            {filteredGroups.map((group) => {
              const { remaining } = calcGroupTotals(group, selectedMonth);
              let groupAccounts = accounts.filter(a => a.groupId === group.id && (a.type === 'EXPENSE' || a.type === 'INCOME'));
              if (onlyActiveThisYear) {
                groupAccounts = groupAccounts.filter(a => hasDataThisYear(a.id));
              }

              if (selectedGroupId === 'ALL' && groupAccounts.length === 0) {
                return null;
              }

              if (groupAccounts.length === 0) {
                return (
                  <div key={group.id} className="rounded-2xl bg-slate-900/80 border border-white/10 p-5 text-center space-y-2 col-span-full">
                    <div className="flex items-center justify-center gap-2 pb-2 border-b border-white/10">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: group.color }} />
                      <h4 className="font-bold text-white text-sm">{group.name}</h4>
                    </div>
                    <p className="text-xs text-slate-300 pt-2">Bu hesapta henüz gelir veya gider kalemi tanımlı değil.</p>
                    <p className="text-[11px] text-slate-500">Hesabınızı yalnızca varlık (altın, döviz, fon) takibi için kullanıyor olabilirsiniz.</p>
                    <button
                      onClick={handleOpenAccountModal}
                      className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Bu Hesaba Kalem Ekle</span>
                    </button>
                  </div>
                );
              }

              return (
                <div 
                  key={group.id} 
                  className="rounded-2xl bg-slate-900/80 border border-white/10 p-4 space-y-3 transition-all"
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
                      <h4 className="font-bold text-sm" style={{ color: group.color }}>{group.name}</h4>
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
                            {renderAccountIcon(acc)}
                            <span className="text-xs text-slate-300 font-medium truncate">{acc.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span 
                              onClick={() => handleCellClick(acc, selectedMonth)}
                              className={`text-xs font-bold font-mono cursor-pointer ${acc.type === 'INCOME' ? 'text-emerald-400' : 'text-slate-200'}`}
                            >
                              {val > 0 ? formatSmartTRY(val, hideValues) : '0,00 ₺'}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditAccount(acc);
                                }}
                                title="Kalemi Düzenle"
                                className="p-1 text-slate-400 hover:text-amber-400 active:text-amber-400 transition-all"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAccount(acc);
                                }}
                                title="Kalemi Sil"
                                className="p-1 text-slate-500 hover:text-rose-400 active:text-rose-400 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveCell();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                {editingCell.account.type === 'INCOME' ? 'Gelir Tutarı (TL)' : 'Ekstre / Gider Tutarı (TL)'}
              </label>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                value={cellInputValue}
                onChange={(e) => setCellInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveCell();
                  }
                }}
                placeholder="Örn: 35000 veya 12,45"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono font-bold text-lg focus:outline-none focus:border-amber-400 transition-colors"
              />

              {/* Quick Fill from Previous Recorded Month */}
              {(() => {
                const lastRecorded = getLastRecordedEntry(editingCell.account.id, selectedYear, editingCell.month);
                if (!lastRecorded) return null;
                return (
                  <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCellInputValue(formatForInput(lastRecorded.amount))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-amber-500/20 text-xs font-semibold transition-all group active:scale-95 shadow-sm"
                      title={`${MONTH_NAMES[lastRecorded.month - 1]} ${lastRecorded.year} tutarını kutucuğa aktar`}
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                      <span>Önceki Tutar:</span>
                      <span className="font-mono font-bold text-white ml-0.5">
                        {formatSmartTRY(lastRecorded.amount, false)}
                      </span>
                    </button>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {MONTH_NAMES[lastRecorded.month - 1]} {lastRecorded.year}
                    </span>
                  </div>
                );
              })()}
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
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20"
              >
                Kaydet
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Edit Account Modal */}
      <Modal
        isOpen={!!editingAccount}
        onClose={() => setEditingAccount(null)}
        title="Kalem Bilgilerini Düzenle"
      >
        {editingAccount && (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveEditAccount();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Bağlı Olduğu Grup</label>
              <select
                value={editAccGroupId}
                onChange={(e) => setEditAccGroupId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Ana Tür</label>
                <select
                  value={editAccType}
                  onChange={(e) => {
                    const t = e.target.value as 'EXPENSE' | 'INCOME';
                    setEditAccType(t);
                    setEditAccSubType(t === 'EXPENSE' ? 'CREDIT_CARD' : 'INCOME_SALARY');
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none"
                >
                  <option value="EXPENSE">Gider</option>
                  <option value="INCOME">Gelir</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Alt Kategori</label>
                <select
                  value={editAccSubType}
                  onChange={(e) => setEditAccSubType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none"
                >
                  {editAccType === 'EXPENSE' ? (
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
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Kalem Adı</label>
              <input
                type="text"
                value={editAccName}
                onChange={(e) => setEditAccName(e.target.value)}
                placeholder="Örn: Garanti Bonus, Maximum, Ev Kirası..."
                className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
              >
                Değişiklikleri Kaydet
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Add New Group Modal */}
      <Modal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        title="Yeni Hesap / Kasa Ekle"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateGroup();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Hesap / Kasa Adı</label>
            <input
              type="text"
              autoFocus
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateGroup();
                }
              }}
              placeholder="Örn: Ana Hesap, Yatırım Portföyü, Tasarruf Fonu, Ortak Kasa..."
              className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Renk Teması</label>
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 p-2 rounded-xl bg-slate-950 border border-white/10">
              {ACCOUNT_THEME_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setNewGroupColor(c.hex)}
                  title={c.name}
                  className={`aspect-square rounded-lg border-2 transition-transform cursor-pointer ${newGroupColor.toLowerCase() === c.hex.toLowerCase() ? 'scale-110 border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsGroupModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={!newGroupName.trim()}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 disabled:opacity-50 cursor-pointer"
            >
              Hesabı Oluştur
            </button>
          </div>
        </form>
      </Modal>

      {/* Add New Account Modal with Pre-selected Group and Dynamic SubTypes */}
      <Modal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        title="Yeni Gelir / Gider Kalemi Ekle"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateAccount();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Bağlı Olduğu Hesap / Kişi</label>
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
              Kalem bu hesabın bütçesine eklenecektir. (Kalem adına kişi adını tekrar yazmanıza gerek yoktur).
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
                <option value="EXPENSE">Gider</option>
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
              autoFocus
              value={newAccName}
              onChange={(e) => setNewAccName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateAccount();
                }
              }}
              placeholder="Örn: Garanti Bonus, Maximum, Ev Kirası, Maaş Geliri..."
              className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAccountModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={!newAccName.trim() || !newAccGroupId}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 disabled:opacity-50 cursor-pointer"
            >
              Kalemi Ekle
            </button>
          </div>
        </form>
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

      {/* Edit Account / Theme Color Modal */}
      <EditAccountModal
        isOpen={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        group={editingGroup}
      />

      {/* Bulk Copy Month Modal */}
      <Modal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        title="Önceki Aydan Veri Kopyala"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Maaş, kira geliri veya sabit giderleri her ay tek tek girmek yerine önceki aydan otomatik aktarabilirsiniz.
          </p>

          {/* Source -> Target Selectors */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Aktarım Yönü</span>
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-slate-400">{MONTH_NAMES[copySourceMonth - 1]} {copySourceYear}</span>
                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold text-amber-300">{MONTH_NAMES[copyTargetMonth - 1]} {copyTargetYear}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              {/* Source Period */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Kaynak Dönem (Nereden)
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={copySourceMonth}
                    onChange={(e) => setCopySourceMonth(Number(e.target.value))}
                    className="flex-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={copySourceYear}
                    onChange={(e) => setCopySourceYear(Number(e.target.value))}
                    className="w-20 px-2 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    {dynamicYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Period */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                  Hedef Dönem (Nereye)
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={copyTargetMonth}
                    onChange={(e) => setCopyTargetMonth(Number(e.target.value))}
                    className="flex-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-amber-400/30 text-white text-xs font-medium focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={copyTargetYear}
                    onChange={(e) => setCopyTargetYear(Number(e.target.value))}
                    className="w-20 px-2 py-1.5 rounded-xl bg-slate-900 border border-amber-400/30 text-white text-xs font-medium focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    {dynamicYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Same Period Warning */}
            {copySourceYear === copyTargetYear && copySourceMonth === copyTargetMonth && (
              <p className="text-xs text-rose-400 font-medium pt-1">
                ⚠️ Kaynak dönem ile hedef dönem aynı olamaz. Lütfen farklı aylar seçin.
              </p>
            )}
          </div>

          {/* Group Filter (If multiple groups exist) */}
          {groups.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Hesap Filtresi</label>
              <select
                value={copyGroupId}
                onChange={(e) => setCopyGroupId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="ALL">Tüm Hesaplar (Ortak)</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Scope Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Hangi Kalemler Kopyalansın?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCopyScope('INCOME_ONLY')}
                className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                  copyScope === 'INCOME_ONLY'
                    ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-md shadow-emerald-500/10'
                    : 'bg-slate-950/40 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Sadece Gelirler</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Maaş, kira geliri ve düzenli gelirler
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCopyScope('FIXED_AND_INCOME')}
                className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                  copyScope === 'FIXED_AND_INCOME'
                    ? 'bg-amber-500/15 border-amber-400 text-white shadow-md shadow-amber-500/10'
                    : 'bg-slate-950/40 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5" />
                  <span>Sabit Kalemler</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Gelirler + Kira, aidat ve sabit faturalar
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCopyScope('ALL')}
                className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                  copyScope === 'ALL'
                    ? 'bg-blue-500/15 border-blue-400 text-white shadow-md shadow-blue-500/10'
                    : 'bg-slate-950/40 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="font-bold text-xs text-blue-400 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Tüm Kalemler</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                  Kart ekstreleri dahil tüm kalemler
                </p>
              </button>
            </div>
          </div>

          {/* Overwrite Protection Option */}
          <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/50 border border-white/5 cursor-pointer hover:bg-slate-950 transition-colors">
            <input
              type="checkbox"
              checked={copyOnlyEmpty}
              onChange={(e) => setCopyOnlyEmpty(e.target.checked)}
              className="mt-0.5 rounded bg-slate-900 border-white/20 text-amber-500 focus:ring-0 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-medium text-white">Yalnızca boş kalemleri doldur (Önerilen)</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Hedef ayda önceden elle girdiğiniz bir tutar varsa korunur, üzerine yazılmaz.
              </p>
            </div>
          </label>

          {/* Preview / Results */}
          {(() => {
            const { itemsToCopy, itemsSkipped, totalIncome, totalExpense, isSamePeriod } = getCopyPreview();
            if (isSamePeriod) return null;

            return (
              <div className="space-y-2 pt-1">
                {itemsToCopy.length > 0 ? (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Aktarılacak Kalemler:</span>
                      <span className="font-bold text-amber-300 font-mono">{itemsToCopy.length} Kalem</span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      {totalIncome > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 font-semibold font-mono">
                          +{formatTRY(totalIncome, false)} Gelir
                        </span>
                      )}
                      {totalExpense > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-400 font-semibold font-mono">
                          -{formatTRY(totalExpense, false)} Gider
                        </span>
                      )}
                    </div>

                    {/* Compact Scrollable List */}
                    <div className="max-h-32 overflow-y-auto space-y-1 pr-1 pt-1 border-t border-white/5">
                      {itemsToCopy.map(({ account, sourceAmount, isOverwriting }) => (
                        <div key={account.id} className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-slate-900">
                          <span className={`truncate mr-2 ${account.type === 'INCOME' ? 'text-emerald-300' : 'text-slate-300'}`}>
                            {account.name}
                            {isOverwriting && <span className="ml-1 text-[10px] text-amber-400 font-normal">(üzerine yazılacak)</span>}
                          </span>
                          <span className="font-mono font-medium text-white shrink-0">
                            {formatSmartTRY(sourceAmount, false)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {itemsSkipped.length > 0 && (
                      <p className="text-[11px] text-amber-400/80 pt-1">
                        ℹ️ {itemsSkipped.length} adet kalem hedef ayda zaten dolu olduğu için atlanacak.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-slate-950/40 border border-white/5 text-center text-xs text-slate-400">
                    <p className="font-medium text-slate-300">Aktarılacak veri bulunamadı.</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {MONTH_NAMES[copySourceMonth - 1]} {copySourceYear} döneminde seçilen kapsama uygun kayıt yok
                      {copyOnlyEmpty && ' veya hedef aydaki kalemler zaten dolu'}.
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsCopyModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Vazgeç
            </button>
            {(() => {
              const { itemsToCopy, isSamePeriod } = getCopyPreview();
              const isDisabled = isSamePeriod || itemsToCopy.length === 0;

              return (
                <button
                  type="button"
                  onClick={handleExecuteCopy}
                  disabled={isDisabled}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg ${
                    isDisabled
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed shadow-none'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 active:scale-95 cursor-pointer'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Kopyala ve Uygula ({itemsToCopy.length})</span>
                </button>
              );
            })()}
          </div>
        </div>
      </Modal>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-2xl shadow-emerald-500/30 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 shrink-0 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
