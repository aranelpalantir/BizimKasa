import React, { useState } from 'react';
import { Plus, Euro, DollarSign, History, Trash2, Filter, Calendar } from 'lucide-react';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { GroupFilterBar } from '../common/GroupFilterBar';
import { db } from '../../db/db';
import { formatTRY, formatNumber } from '../../services/portfolioService';
import type { Account, AssetTransaction, MarketRate, Group } from '../../types/finance';

interface CurrencyTrackerProps {
  groups: Group[];
  accounts: Account[];
  transactions: AssetTransaction[];
  rates: MarketRate[];
  hideValues: boolean;
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
  hideValues
}) => {
  const [selectedCurrency, setSelectedCurrency] = useState<'EUR' | 'USD'>('EUR');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [targetGroupId, setTargetGroupId] = useState<string>(groups[0]?.id || '');
  const [txType, setTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [rateVal, setRateVal] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

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

  // Dynamic years from all transactions
  const uniqueYears = Array.from(new Set(assetTxs.map(t => t.year)));
  const dynamicYears = Array.from(new Set([2024, 2025, 2026, 2027, ...uniqueYears])).sort((a, b) => a - b);

  // Filter groups: only show groups having this currency with at least one transaction
  const groupsWithCurrency = groups.filter(g => {
    const gAccounts = accounts.filter(a => a.groupId === g.id && a.subType === 'CURRENCY' && a.symbol === selectedCurrency);
    if (gAccounts.length === 0) return false;
    const gAccIds = new Set(gAccounts.map(a => a.id));
    return transactions.some(t => gAccIds.has(t.accountId));
  });

  // Calculate Net Holdings
  let totalNetUnits = 0;
  let totalCostTRY = 0;
  for (const t of assetTxs) {
    if (t.type === 'BUY') {
      totalNetUnits += t.quantity;
      totalCostTRY += t.totalAmountTRY;
    } else {
      totalNetUnits -= t.quantity;
      totalCostTRY -= t.totalAmountTRY;
    }
  }

  const currentTRYValue = totalNetUnits * currentLiveRate;
  const avgCostPerUnit = totalNetUnits > 0 ? Math.max(0, totalCostTRY / totalNetUnits) : 0;
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

  // Date Filter logic for History
  const filteredTxs = assetTxs.filter((tx) => {
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
  });

  const handleOpenAddModal = () => {
    const targetGrp = selectedGroupId !== 'ALL' ? selectedGroupId : (groups[0]?.id || '');
    setTargetGroupId(targetGrp);
    setRateVal(currentLiveRate.toString());
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

    const q = parseFloat(amount.replace(',', '.'));
    const r = parseFloat(rateVal.replace(',', '.')) || currentLiveRate;
    if (isNaN(q) || q <= 0) return;

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

  const handleDeleteTx = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'İşlemi Sil',
      message: 'Bu döviz alım/satım kaydını silmek istediğinize emin misiniz?',
      onConfirm: async () => {
        await db.transactions.delete(id);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Switcher & Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-white/5">
        <div className="flex p-1 rounded-xl bg-slate-800 border border-white/5">
          <button
            onClick={() => setSelectedCurrency('EUR')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              selectedCurrency === 'EUR' ? 'bg-indigo-500 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Euro className="w-3.5 h-3.5" />
            <span>Euro (EUR)</span>
          </button>
          <button
            onClick={() => setSelectedCurrency('USD')}
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
        onSelectGroup={setSelectedGroupId}
        title="Hesap Grubu"
      />

      {/* METRIC HEADER */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg">
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">
            {selectedCurrency} Toplam Değer (TL)
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

      {/* RECENT MOVEMENTS WITH DATE FILTER */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span>{selectedCurrency} Hareket Geçmişi</span>
          </h4>

          {/* Date Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <Filter className="w-3 h-3 text-slate-500 mr-1 flex-shrink-0" />
            {[
              { id: 'ALL' as const, label: 'Tümü' },
              { id: '1M' as const, label: 'Son 1 Ay' },
              { id: '3M' as const, label: 'Son 3 Ay' },
              { id: '6M' as const, label: 'Son 6 Ay' },
              { id: 'THIS_YEAR' as const, label: '2026' },
              { id: 'PREV_YEAR' as const, label: '2025' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setHistoryFilter(f.id)}
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

        {filteredTxs.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">Bu filtreye uygun işlem kaydı bulunamadı.</p>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {filteredTxs.map((tx) => {
              const acc = accounts.find(a => a.id === tx.accountId);
              const grp = groups.find(g => g.id === acc?.groupId || g.id === tx.groupId);

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 border border-white/5 text-xs"
                >
                  <div className="flex items-center gap-2">
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
                        {grp && (
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
              Hangi Gruba Ait?
            </label>
            <select
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">İşlem Tarihi</label>
              <input
                type="date"
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Açıklama / Not</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Örn: Tatil birikimi"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none"
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
