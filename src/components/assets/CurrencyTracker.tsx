import React, { useState } from 'react';
import { Plus, Euro, DollarSign, History, Trash2, Edit2, Filter, Calendar } from 'lucide-react';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { GroupFilterBar } from '../common/GroupFilterBar';
import { db } from '../../db/db';
import { formatTRY, formatNumber, parseUserInputNumber, formatForInput } from '../../services/portfolioService';
import type { Account, AssetTransaction, MarketRate, Group } from '../../types/finance';

interface CurrencyTrackerProps {
  groups: Group[];
  accounts: Account[];
  transactions: AssetTransaction[];
  rates: MarketRate[];
  hideValues: boolean;
  selectedCurrency?: 'EUR' | 'USD';
  onSelectCurrency?: (curr: 'EUR' | 'USD') => void;
  selectedGroupId?: string;
  onSelectGroup?: (groupId: string) => void;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

type HistoryFilter = 'ALL' | '1M' | '3M' | '6M' | 'THIS_YEAR' | 'PREV_YEAR';

export const CurrencyTracker: React.FC<CurrencyTrackerProps> = ({
  groups,
  accounts,
  transactions,
  rates,
  hideValues,
  selectedCurrency: selectedCurrencyProp,
  onSelectCurrency: onSelectCurrencyProp,
  selectedGroupId: selectedGroupIdProp,
  onSelectGroup: onSelectGroupProp
}) => {
  const [internalCurrency, setInternalCurrency] = useState<'EUR' | 'USD'>('EUR');
  const selectedCurrency = selectedCurrencyProp !== undefined ? selectedCurrencyProp : internalCurrency;

  const [internalGroupId, setInternalGroupId] = useState<string>('ALL');
  const selectedGroupId = selectedGroupIdProp !== undefined ? selectedGroupIdProp : internalGroupId;
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('ALL');
  const [historyYearFilter, setHistoryYearFilter] = useState<string>('ALL');
  const [historyStartDate, setHistoryStartDate] = useState<string>('');
  const [historyEndDate, setHistoryEndDate] = useState<string>('');
  const [historyPage, setHistoryPage] = useState<number>(1);
  const itemsPerPage = 10;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  // Form State
  const [targetGroupId, setTargetGroupId] = useState<string>(groups[0]?.id || '');
  const [txType, setTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [rateVal, setRateVal] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  // Edit Transaction Form State
  const [editingTx, setEditingTx] = useState<AssetTransaction | null>(null);
  const [editTxType, setEditTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [editGroupId, setEditGroupId] = useState<string>('');
  const [editAmount, setEditAmount] = useState('');
  const [editRateVal, setEditRateVal] = useState('');
  const [editTxDate, setEditTxDate] = useState('');
  const [editNote, setEditNote] = useState('');

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

  // Live Rates
  const eurRate = rates.find(r => r.symbol === 'EUR')?.rateTRY || 55.24;
  const usdRate = rates.find(r => r.symbol === 'USD')?.rateTRY || 49.03;
  const currentLiveRate = selectedCurrency === 'EUR' ? eurRate : usdRate;

  // Filter currency accounts by symbol and group
  const matchingAccounts = accounts.filter(a => {
    const isCurrency = a.subType === 'CURRENCY' && a.symbol === selectedCurrency;
    const isGroup = selectedGroupId === 'ALL' || a.groupId === selectedGroupId;
    return isCurrency && isGroup;
  });

  const matchingAccountIds = new Set(matchingAccounts.map(a => a.id));
  const assetTxs = transactions.filter(t => matchingAccountIds.has(t.accountId));

  // Dynamic years from all transactions: only include years with transactions!
  const uniqueYears = Array.from(new Set(assetTxs.map(t => t.year))).sort((a, b) => a - b);
  const dynamicYears = uniqueYears;

  // Filter groups: only show groups having this currency with at least one transaction
  const groupsWithCurrency = groups.filter(g => {
    const gAccounts = accounts.filter(a => a.groupId === g.id && a.subType === 'CURRENCY' && a.symbol === selectedCurrency);
    if (gAccounts.length === 0) return false;
    const gAccIds = new Set(gAccounts.map(a => a.id));
    return transactions.some(t => gAccIds.has(t.accountId));
  });

  // Calculate Net Holdings
  let totalBoughtUnits = 0;
  let totalBoughtCostTRY = 0;
  let totalSoldUnits = 0;

  for (const t of assetTxs) {
    if (t.type === 'BUY') {
      totalBoughtUnits += t.quantity;
      totalBoughtCostTRY += t.totalAmountTRY;
    } else {
      totalSoldUnits += t.quantity;
    }
  }

  const totalNetUnits = Math.max(0, totalBoughtUnits - totalSoldUnits);
  const avgCostPerUnit = totalBoughtUnits > 0 ? totalBoughtCostTRY / totalBoughtUnits : 0;
  const totalCostTRY = totalNetUnits * avgCostPerUnit;
  const currentTRYValue = totalNetUnits * currentLiveRate;
  const profitLossTRY = currentTRYValue - totalCostTRY;
  const profitLossPct = totalCostTRY > 0 ? (profitLossTRY / totalCostTRY) * 100 : 0;

  // Calculate monthly matrix by Year & Month
  const getMatrixCell = (year: number, month: number) => {
    const txs = assetTxs.filter(t => t.year === year && t.month === month);
    let net = 0;
    for (const t of txs) {
      if (t.type === 'BUY') net += t.quantity;
      else net -= t.quantity;
    }
    return net;
  };

  const getYearTotal = (year: number) => {
    const txs = assetTxs.filter(t => t.year === year);
    let net = 0;
    for (const t of txs) {
      if (t.type === 'BUY') net += t.quantity;
      else net -= t.quantity;
    }
    return net;
  };

  const getMonthTotalAcrossYears = (month: number) => {
    let net = 0;
    for (const y of dynamicYears) {
      net += getMatrixCell(y, month);
    }
    return net;
  };

  // Detailed monthly metrics for selectedYear
  const monthlyMetrics = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const mtx = assetTxs.filter(t => t.year === selectedYear && t.month === month);
    let bought = 0;
    let sold = 0;
    let cost = 0;
    for (const t of mtx) {
      if (t.type === 'BUY') {
        bought += t.quantity;
        cost += t.totalAmountTRY;
      } else {
        sold += t.quantity;
        cost -= t.totalAmountTRY;
      }
    }
    const net = bought - sold;
    const avgRate = bought > 0 ? cost / bought : 0;
    return { month, bought, sold, net, cost, avgRate };
  });

  // Date Range, Year & Custom Filter logic for History
  const filteredTxs = assetTxs.filter((tx) => {
    if (historyYearFilter !== 'ALL' && tx.year !== Number(historyYearFilter)) return false;
    if (historyStartDate && tx.date < historyStartDate) return false;
    if (historyEndDate && tx.date > historyEndDate) return false;

    if (historyFilter === 'ALL') return true;
    const txTime = new Date(tx.date).getTime();
    const now = Date.now();
    const msInDay = 86400000;

    if (historyFilter === '1M') return (now - txTime) <= 30 * msInDay;
    if (historyFilter === '3M') return (now - txTime) <= 90 * msInDay;
    if (historyFilter === '6M') return (now - txTime) <= 180 * msInDay;
    if (historyFilter === 'THIS_YEAR') return tx.year === 2026;
    if (historyFilter === 'PREV_YEAR') return tx.year === 2025;
    return true;
  }).sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  const totalPages = Math.max(1, Math.ceil(filteredTxs.length / itemsPerPage));
  const currentPage = Math.min(historyPage, totalPages);
  const paginatedTxs = filteredTxs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleOpenAddModal = () => {
    const targetGrp = selectedGroupId !== 'ALL' ? selectedGroupId : (groups[0]?.id || '');
    setTargetGroupId(targetGrp);
    setRateVal(formatForInput(currentLiveRate));
    setAmount('');
    setNote('');
    setIsModalOpen(true);
  };

  const handleSaveTransaction = async () => {
    // Find or create account for targetGroupId
    let targetAcc = accounts.find(a => a.groupId === targetGroupId && a.subType === 'CURRENCY' && a.symbol === selectedCurrency);
    if (!targetAcc) {
      const groupObj = groups.find(g => g.id === targetGroupId);
      const newAcc: Account = {
        id: `acc-curr-${Date.now()}`,
        groupId: targetGroupId,
        name: `${groupObj?.name || ''} ${selectedCurrency} Hesabı`.trim(),
        type: 'ASSET',
        subType: 'CURRENCY',
        symbol: selectedCurrency,
        currency: selectedCurrency,
        order: accounts.length + 1,
        createdAt: new Date().toISOString()
      };
      await db.accounts.add(newAcc);
      targetAcc = newAcc;
    }

    const q = parseUserInputNumber(amount);
    const r = parseUserInputNumber(rateVal) || currentLiveRate;
    if (q <= 0) return;

    const dateObj = new Date(txDate);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const totalTRY = q * r;

    const newTx: AssetTransaction = {
      id: `tx-${Date.now()}`,
      accountId: targetAcc.id,
      groupId: targetGroupId,
      date: txDate,
      year,
      month,
      type: txType,
      quantity: q,
      totalAmountTRY: totalTRY,
      unitPriceTRY: r,
      note: note.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    await db.transactions.add(newTx);
    setIsModalOpen(false);
    setAmount('');
    setRateVal('');
    setNote('');
  };

  const handleOpenEditTx = (tx: AssetTransaction) => {
    const defaultGid = tx.groupId || accounts.find(a => a.id === tx.accountId)?.groupId || groups[0]?.id || '';
    setEditingTx(tx);
    setEditTxType(tx.type);
    setEditGroupId(defaultGid);
    setEditAmount(formatForInput(tx.quantity));
    setEditRateVal(formatForInput(tx.unitPriceTRY));
    setEditTxDate(tx.date);
    setEditNote(tx.note || '');
  };

  const handleSaveEditTransaction = async () => {
    if (!editingTx) return;

    let targetAcc = accounts.find(a => a.groupId === editGroupId && a.subType === 'CURRENCY' && a.symbol === selectedCurrency);
    if (!targetAcc) {
      const groupObj = groups.find(g => g.id === editGroupId);
      const newAcc: Account = {
        id: `acc-curr-${Date.now()}`,
        groupId: editGroupId,
        name: `${groupObj?.name || ''} ${selectedCurrency} Hesabı`.trim(),
        type: 'ASSET',
        subType: 'CURRENCY',
        symbol: selectedCurrency,
        currency: selectedCurrency,
        order: accounts.length + 1,
        createdAt: new Date().toISOString()
      };
      await db.accounts.add(newAcc);
      targetAcc = newAcc;
    }

    const q = parseUserInputNumber(editAmount);
    const r = parseUserInputNumber(editRateVal) || currentLiveRate;
    if (q <= 0) return;

    const dateObj = new Date(editTxDate);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const totalTRY = q * r;

    await db.transactions.update(editingTx.id, {
      accountId: targetAcc.id,
      groupId: editGroupId,
      date: editTxDate,
      year,
      month,
      type: editTxType,
      quantity: q,
      totalAmountTRY: totalTRY,
      unitPriceTRY: r,
      note: editNote.trim() || undefined
    });

    setEditingTx(null);
  };

  const handleToggleSelectTx = (id: string) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllSelected = filteredTxs.length > 0 && filteredTxs.every(t => selectedTxIds.has(t.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTxs.map(t => t.id)));
    }
  };

  const handleBatchDelete = () => {
    if (selectedTxIds.size === 0) return;
    const count = selectedTxIds.size;
    setConfirmDialog({
      isOpen: true,
      title: 'Seçilen İşlemleri Sil',
      message: `${count} adet ${selectedCurrency === 'EUR' ? 'Euro' : 'Dolar'} hareket kaydını kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      onConfirm: async () => {
        await db.transactions.bulkDelete(Array.from(selectedTxIds));
        setSelectedTxIds(new Set());
      }
    });
  };

  const handleDeleteTx = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'İşlemi Sil',
      message: 'Bu döviz alım/satım kaydını silmek istediğinize emin misiniz?',
      onConfirm: async () => {
        await db.transactions.delete(id);
        setSelectedTxIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Switcher & Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-white/5">
        <div className="flex p-1 rounded-xl bg-slate-800 border border-white/5">
          <button
            onClick={() => {
              if (onSelectCurrencyProp) {
                onSelectCurrencyProp('EUR');
              } else {
                setInternalCurrency('EUR');
              }
              setSelectedTxIds(new Set());
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              selectedCurrency === 'EUR' ? 'bg-indigo-500 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Euro className="w-3.5 h-3.5" />
            <span>Euro (EUR)</span>
          </button>
          <button
            onClick={() => {
              if (onSelectCurrencyProp) {
                onSelectCurrencyProp('USD');
              } else {
                setInternalCurrency('USD');
              }
              setSelectedTxIds(new Set());
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              selectedCurrency === 'USD' ? 'bg-blue-500 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Dolar (USD)</span>
          </button>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Döviz Al / Bozdur</span>
        </button>
      </div>

      {/* Group Filter Bar: Only show groups that have this currency */}
      <GroupFilterBar
        groups={groupsWithCurrency.length > 0 ? groupsWithCurrency : groups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={(g) => {
          if (onSelectGroupProp) {
            onSelectGroupProp(g);
          } else {
            setInternalGroupId(g);
          }
          setSelectedTxIds(new Set());
        }}
        title="Hesap"
      />

      {/* METRIC HEADER */}
      {(() => {
        const activeGroup = selectedGroupId !== 'ALL' ? groups.find(g => g.id === selectedGroupId) : undefined;
        return (
          <div 
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg transition-all"
            style={{
              borderTop: activeGroup ? `3px solid ${activeGroup.color}` : undefined,
              boxShadow: activeGroup ? `0 10px 25px -8px ${activeGroup.color}25` : undefined
            }}
          >
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold text-slate-400 uppercase flex items-center gap-1.5">
                {activeGroup && <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: activeGroup.color }} />}
                <span>{selectedCurrency} Toplam Değer (TL)</span>
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-white mt-1 font-mono">
            {formatTRY(currentTRYValue, hideValues)}
          </span>
          <span className="text-xs text-slate-500 mt-0.5">
            Canlı Kur: 1 {selectedCurrency} = {formatNumber(currentLiveRate, 2)} ₺
          </span>
        </div>

        <div className="flex flex-col border-l border-white/10 pl-3">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Döviz Bakiyesi</span>
          <span className="text-xl sm:text-2xl font-extrabold text-indigo-300 mt-1 font-mono">
            {hideValues ? '••••' : `${formatNumber(totalNetUnits, 2)} ${selectedCurrency}`}
          </span>
          <span className="text-xs text-slate-500 mt-0.5">Net Varlık</span>
        </div>

        <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Ortalama Maliyet</span>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-200 mt-1 font-mono">
            {formatTRY(avgCostPerUnit, hideValues)}
          </span>
          <span className="text-xs text-slate-500 mt-0.5">1 {selectedCurrency} Alış Maliyeti</span>
        </div>

        <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase">Kâr / Zarar</span>
          <span className={`text-xl sm:text-2xl font-extrabold mt-1 font-mono ${profitLossTRY >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {profitLossTRY >= 0 ? '+' : ''}{formatTRY(profitLossTRY, hideValues)}
          </span>
          <span className="text-xs text-slate-500 mt-0.5">
            {profitLossTRY >= 0 ? '+' : ''}%{formatNumber(profitLossPct, 2)} Getiri
          </span>
            </div>
          </div>
        );
      })()}

      {/* DYNAMIC MULTI-YEAR MONTHLY MATRIX TABLE */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
        <div className="p-3 bg-slate-950/80 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200">
            {selectedCurrency} Çok Yıllı Hareket Matrisi (Giriş / Çıkış)
          </span>
          <span className="text-[10px] text-slate-400">Net {selectedCurrency} değişimi (Bozdurulanlar eksi gösterilir)</span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/90 border-b border-white/10 text-slate-400 font-semibold">
              <th className="py-2.5 px-3 min-w-[70px] sticky left-0 z-20 bg-slate-950/95 border-r border-white/10">
                Yıl
              </th>
              {MONTH_NAMES.map((m, idx) => (
                <th key={idx} className="py-2.5 px-2 min-w-[65px] text-right font-medium">
                  {m.slice(0, 3)}
                </th>
              ))}
              <th className="py-2.5 px-3 min-w-[90px] text-right font-bold text-indigo-400 bg-slate-950/95">
                Genel Toplam
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {dynamicYears.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-8 text-center text-slate-400 font-sans text-xs">
                  Bu döviz türünde henüz hareket kaydı bulunmuyor. Yeni işlem eklediğinizde yıllık hareket matrisi burada oluşacaktır.
                </td>
              </tr>
            ) : (
              <>
                {dynamicYears.map((year) => {
                  const yearTotal = getYearTotal(year);
                  return (
                    <tr key={year} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 px-3 text-slate-300 font-sans font-bold sticky left-0 z-10 bg-slate-900/95 border-r border-white/10">
                        {year}
                      </td>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                        const val = getMatrixCell(year, month);
                        return (
                          <td
                            key={month}
                            className={`py-2 px-2 text-right ${
                              val > 0 ? 'text-slate-200' : val < 0 ? 'text-rose-400 font-bold' : 'text-slate-600'
                            }`}
                          >
                            {val !== 0 ? formatNumber(val, 2, hideValues) : '-'}
                          </td>
                        );
                      })}
                      <td className={`py-2 px-3 text-right font-bold bg-slate-900/90 ${yearTotal < 0 ? 'text-rose-400' : 'text-indigo-300'}`}>
                        {yearTotal !== 0 ? formatNumber(yearTotal, 2, hideValues) : '0,00'}
                      </td>
                    </tr>
                  );
                })}

                <tr className="bg-slate-950/95 font-bold text-indigo-300 border-t-2 border-white/10">
                  <td className="py-2.5 px-3 sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                    Genel Toplam
                  </td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                    const monthTotal = getMonthTotalAcrossYears(month);
                    return (
                      <td key={month} className={`py-2.5 px-2 text-right ${monthTotal < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                        {monthTotal !== 0 ? formatNumber(monthTotal, 2, hideValues) : '0,00'}
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 text-right font-extrabold text-indigo-400 text-sm bg-slate-950">
                    {formatNumber(totalNetUnits, 2, hideValues)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* SINGLE YEAR DETAILED METRICS BREAKDOWN (Clean Turkish) */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
        <div className="p-3 bg-slate-950/80 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200">
            Aylık Detay Göstergeleri ({selectedYear})
          </span>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800 border border-white/10">
            <Calendar className="w-3.5 h-3.5 text-indigo-400 ml-1.5" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-white font-bold text-xs focus:outline-none pr-2 cursor-pointer"
            >
              {dynamicYears.map((y) => (
                <option key={y} value={y} className="bg-slate-900 text-white">
                  {y} Yılı
                </option>
              ))}
            </select>
          </div>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/80 border-b border-white/10 text-slate-400 font-semibold">
              <th className="py-2.5 px-3 min-w-[170px] sticky left-0 z-20 bg-slate-950/95 border-r border-white/10">
                Ay / Göstergeler ({selectedYear})
              </th>
              {monthlyMetrics.map((d) => (
                <th key={d.month} className="py-2.5 px-2.5 min-w-[80px] text-right font-medium">
                  {MONTH_NAMES[d.month - 1].slice(0, 3)}
                </th>
              ))}
              <th className="py-2.5 px-3 min-w-[95px] text-right font-bold text-indigo-400 bg-slate-950/95">
                Genel Toplam
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {/* Toplam Alınan */}
            <tr className="hover:bg-white/[0.02]">
              <td className="py-2 px-3 text-slate-300 font-sans font-medium sticky left-0 z-10 bg-slate-900/95 border-r border-white/10">
                Alınan Miktar ({selectedCurrency})
              </td>
              {monthlyMetrics.map((d) => (
                <td key={d.month} className="py-2 px-2 text-right text-slate-300">
                  {d.bought > 0 ? formatNumber(d.bought, 2, hideValues) : '-'}
                </td>
              ))}
              <td className="py-2 px-3 text-right font-bold text-indigo-300 bg-slate-900/90">
                {formatNumber(monthlyMetrics.reduce((s, d) => s + d.bought, 0), 2, hideValues)}
              </td>
            </tr>

            {/* Toplam Bozdurulan */}
            <tr className="hover:bg-white/[0.02]">
              <td className="py-2 px-3 text-slate-300 font-sans font-medium sticky left-0 z-10 bg-slate-900/95 border-r border-white/10">
                Bozdurulan ({selectedCurrency})
              </td>
              {monthlyMetrics.map((d) => (
                <td key={d.month} className="py-2 px-2 text-right text-rose-400">
                  {d.sold > 0 ? `-${formatNumber(d.sold, 2, hideValues)}` : '-'}
                </td>
              ))}
              <td className="py-2 px-3 text-right font-bold text-rose-400 bg-slate-900/90">
                {formatNumber(monthlyMetrics.reduce((s, d) => s + d.sold, 0), 2, hideValues)}
              </td>
            </tr>

            {/* Net Değişim */}
            <tr className="hover:bg-white/[0.02]">
              <td className="py-2 px-3 text-slate-300 font-sans font-medium sticky left-0 z-10 bg-slate-900/95 border-r border-white/10">
                Net Değişim ({selectedCurrency})
              </td>
              {monthlyMetrics.map((d) => (
                <td key={d.month} className={`py-2 px-2 text-right font-bold ${d.net < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {d.net !== 0 ? formatNumber(d.net, 2, hideValues) : '-'}
                </td>
              ))}
              <td className="py-2 px-3 text-right font-bold text-indigo-300 bg-slate-900/90">
                {formatNumber(monthlyMetrics.reduce((s, d) => s + d.net, 0), 2, hideValues)}
              </td>
            </tr>

            {/* Toplam Maliyet */}
            <tr className="bg-indigo-500/5 font-semibold text-indigo-200">
              <td className="py-2 px-3 font-sans sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                Toplam Tutar (TL)
              </td>
              {monthlyMetrics.map((d) => (
                <td key={d.month} className="py-2 px-2 text-right">
                  {d.cost !== 0 ? formatNumber(d.cost, 0, hideValues) : '-'}
                </td>
              ))}
              <td className="py-2 px-3 text-right font-bold text-indigo-400 bg-slate-950/95">
                {formatNumber(monthlyMetrics.reduce((s, d) => s + d.cost, 0), 0, hideValues)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* RECENT MOVEMENTS WITH DATE FILTER & PAGINATION */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(el) => {
                if (el) {
                  el.indeterminate = selectedTxIds.size > 0 && !isAllSelected;
                }
              }}
              onChange={handleToggleSelectAll}
              className="w-4 h-4 rounded border-white/20 bg-slate-950 text-indigo-500 focus:ring-0 cursor-pointer accent-indigo-500"
              title={isAllSelected ? 'Tüm seçimleri kaldır' : 'Tüm filtrelenmiş işlemleri seç'}
            />
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-400" />
              <span>{selectedCurrency} Hareket Geçmişi</span>
              <span className="text-[10px] text-slate-400 font-normal">({filteredTxs.length} İşlem)</span>
            </h4>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <Filter className="w-3 h-3 text-slate-500 mr-1 flex-shrink-0" />
            {[
              { id: 'ALL' as const, label: 'Tümü' },
              { id: '1M' as const, label: 'Son 1 Ay' },
              { id: '3M' as const, label: 'Son 3 Ay' },
              { id: '6M' as const, label: 'Son 6 Ay' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setHistoryFilter(f.id);
                  setHistoryPage(1);
                }}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-colors flex-shrink-0 ${
                  historyFilter === f.id
                    ? 'bg-indigo-500 text-white font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Batch Selection Action Bar */}
        {selectedTxIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 px-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="font-bold text-indigo-300">
                {selectedTxIds.size} işlem seçildi
              </span>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-[11px] text-slate-400 hover:text-white underline ml-1"
              >
                {isAllSelected ? 'Seçimi Kaldır' : `Tümünü Seç (${filteredTxs.length})`}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedTxIds(new Set())}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleBatchDelete}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] transition-colors shadow-sm active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Seçilenleri Sil ({selectedTxIds.size})</span>
              </button>
            </div>
          </div>
        )}

        {/* Extended Filter Bar: Year & Custom Date Range */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5 text-xs">
          {/* Year Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400">Yıl:</span>
            <select
              value={historyYearFilter}
              onChange={(e) => {
                setHistoryYearFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="px-2 py-1 rounded-lg bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400 cursor-pointer"
            >
              <option value="ALL">Tüm Yıllar</option>
              {uniqueYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Custom Date Range */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400">Tarih:</span>
            <input
              type="date"
              value={historyStartDate}
              onChange={(e) => {
                setHistoryStartDate(e.target.value);
                setHistoryPage(1);
              }}
              className="px-2 py-1 rounded-lg bg-slate-950 border border-white/10 text-white text-[11px] focus:outline-none"
              title="Başlangıç Tarihi"
            />
            <span className="text-slate-500">-</span>
            <input
              type="date"
              value={historyEndDate}
              onChange={(e) => {
                setHistoryEndDate(e.target.value);
                setHistoryPage(1);
              }}
              className="px-2 py-1 rounded-lg bg-slate-950 border border-white/10 text-white text-[11px] focus:outline-none"
              title="Bitiş Tarihi"
            />
          </div>

          {(historyYearFilter !== 'ALL' || historyStartDate || historyEndDate || historyFilter !== 'ALL') && (
            <button
              onClick={() => {
                setHistoryFilter('ALL');
                setHistoryYearFilter('ALL');
                setHistoryStartDate('');
                setHistoryEndDate('');
                setHistoryPage(1);
              }}
              className="text-[10px] text-indigo-400 hover:underline ml-auto"
            >
              Filtreleri Temizle
            </button>
          )}
        </div>

        {filteredTxs.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">Bu filtreye uygun işlem kaydı bulunamadı.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {paginatedTxs.map((tx) => {
              const acc = accounts.find(a => a.id === tx.accountId);
              const grp = groups.find(g => g.id === acc?.groupId || g.id === tx.groupId);
              const isSelected = selectedTxIds.has(tx.id);

              return (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors ${
                    isSelected
                      ? 'bg-indigo-500/10 border-indigo-500/40 shadow-sm'
                      : 'bg-slate-950/50 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectTx(tx.id)}
                      className="w-4 h-4 rounded border-white/20 bg-slate-950 text-indigo-500 focus:ring-0 cursor-pointer accent-indigo-500 flex-shrink-0"
                      title="İşlemi seç"
                    />
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      tx.type === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                    }`}>
                      {tx.type === 'BUY' ? 'ALIŞ' : 'SATIŞ'}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-200 font-medium">
                          {formatNumber(tx.quantity, 2, hideValues)} {selectedCurrency}
                        </span>
                        {selectedGroupId === 'ALL' && grp && (
                          <span
                            className="text-[9px] px-1.5 py-0.2 rounded font-semibold"
                            style={{ backgroundColor: `${grp.color}20`, color: grp.color }}
                          >
                            {grp.name}
                          </span>
                        )}
                      </div>
                      <span className="text-slate-500 text-[10px] font-mono">
                        @ {formatNumber(tx.unitPriceTRY, 2)} ₺ {tx.note ? `• ${tx.note}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="font-bold font-mono text-white block">
                        {formatTRY(tx.totalAmountTRY, hideValues)}
                      </span>
                      <span className="text-[10px] text-slate-500">{tx.date}</span>
                    </div>
                    <button
                      onClick={() => handleOpenEditTx(tx)}
                      className="p-1 text-slate-500 hover:text-amber-400 transition-colors"
                      title="İşlemi Düzenle"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTx(tx.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="İşlemi Sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-400">
            <button
              onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white font-medium transition-colors"
            >
              Önceki
            </button>
            <span className="font-mono text-[11px]">
              Sayfa {currentPage} / {totalPages} ({filteredTxs.length} işlem)
            </span>
            <button
              onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-white font-medium transition-colors"
            >
              Sonraki
            </button>
          </div>
        )}
      </div>

      {/* MODAL WITH PRE-SELECTED GROUP */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${selectedCurrency === 'EUR' ? 'Euro' : 'Dolar'} İşlemi`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-white/10">
            <button
              type="button"
              onClick={() => setTxType('BUY')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                txType === 'BUY' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Alış (+)
            </button>
            <button
              type="button"
              onClick={() => setTxType('SELL')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                txType === 'SELL' ? 'bg-rose-500 text-white' : 'text-slate-400'
              }`}
            >
              Satış / Bozdurma (-)
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Hangi Hesaba Ait?
            </label>
            {groups.length === 0 ? (
              <p className="text-xs text-amber-400">Henüz kayıtlı bir hesap bulunmuyor. Önce yukarıdan 'Yeni Hesap' eklemelisiniz.</p>
            ) : (
              <select
                value={targetGroupId}
                onChange={(e) => setTargetGroupId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Miktar ({selectedCurrency})
              </label>
              <input
                type="text"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Örn: 500"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Kur (TL)
              </label>
              <input
                type="text"
                value={rateVal}
                onChange={(e) => setRateVal(e.target.value)}
                placeholder={`Örn: ${currentLiveRate}`}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-400 mb-1">İşlem Tarihi</label>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full min-w-0 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-400 mb-1">Açıklama / Not</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full min-w-0 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSaveTransaction}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
            >
              İşlemi Kaydet
            </button>
          </div>
        </div>
      </Modal>

      {/* EDIT TRANSACTION MODAL */}
      <Modal
        isOpen={!!editingTx}
        onClose={() => setEditingTx(null)}
        title={`${selectedCurrency === 'EUR' ? 'Euro' : 'Dolar'} İşlemini Düzenle`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-white/10">
            <button
              type="button"
              onClick={() => setEditTxType('BUY')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                editTxType === 'BUY' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Alış (+)
            </button>
            <button
              type="button"
              onClick={() => setEditTxType('SELL')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                editTxType === 'SELL' ? 'bg-rose-500 text-white' : 'text-slate-400'
              }`}
            >
              Satış / Bozdurma (-)
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Hangi Hesaba Ait?
            </label>
            <select
              value={editGroupId}
              onChange={(e) => setEditGroupId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Miktar ({selectedCurrency})
              </label>
              <input
                type="text"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder="Örn: 500"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Kur (TL)
              </label>
              <input
                type="text"
                value={editRateVal}
                onChange={(e) => setEditRateVal(e.target.value)}
                placeholder={`Örn: ${currentLiveRate}`}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-400 mb-1">İşlem Tarihi</label>
              <input
                type="date"
                value={editTxDate}
                onChange={(e) => setEditTxDate(e.target.value)}
                className="w-full min-w-0 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="min-w-0">
              <label className="block text-xs font-medium text-slate-400 mb-1">Açıklama / Not</label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="w-full min-w-0 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Total TRY preview */}
          {parseUserInputNumber(editAmount) > 0 && parseUserInputNumber(editRateVal) > 0 && (
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-400">Toplam Karşılık:</span>
              <span className="font-bold font-mono text-amber-400">
                {formatTRY(parseUserInputNumber(editAmount) * parseUserInputNumber(editRateVal))}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setEditingTx(null)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSaveEditTransaction}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
            >
              Değişiklikleri Kaydet
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
