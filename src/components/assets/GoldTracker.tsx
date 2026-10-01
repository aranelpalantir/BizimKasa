import React, { useState } from 'react';
import { Plus, Coins, ArrowUpRight, ArrowDownRight, History, Trash2, Calendar, Filter, Sparkles } from 'lucide-react';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { GroupFilterBar } from '../common/GroupFilterBar';
import { db } from '../../db/db';
import { formatTRY, formatNumber } from '../../services/portfolioService';
import type { Account, AssetTransaction, MarketRate, Group, AssetSubType } from '../../types/finance';

interface GoldTrackerProps {
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

type GoldTypeTab = 'PHYSICAL_GRAM' | 'BANK_GRAM' | 'CEYREK';
type HistoryFilter = 'ALL' | '1M' | '3M' | '6M' | 'THIS_YEAR' | 'PREV_YEAR';

export const GoldTracker: React.FC<GoldTrackerProps> = ({
  groups,
  accounts,
  transactions,
  rates,
  hideValues
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [activeGoldType, setActiveGoldType] = useState<GoldTypeTab>('BANK_GRAM');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Transaction Form
  const [targetGroupId, setTargetGroupId] = useState<string>(groups[0]?.id || '');
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [txType, setTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('');
  const [totalTRY, setTotalTRY] = useState('');
  const [unitTRY, setUnitTRY] = useState('');
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

  // Rates
  const physGramRate = rates.find(r => r.symbol === 'XAU_GR_PHYSICAL')?.rateTRY || 6710.00;
  const bankGramRate = rates.find(r => r.symbol === 'XAU_GR_BANK')?.rateTRY || 6561.65;
  const ceyrekRate = rates.find(r => r.symbol === 'XAU_CEYREK')?.rateTRY || 10980.00;
  
  const currentRate = 
    activeGoldType === 'PHYSICAL_GRAM' ? physGramRate :
    activeGoldType === 'BANK_GRAM' ? bankGramRate : ceyrekRate;

  // CONSOLIDATED GOLD CALCULATION IN GRAMS ACROSS ALL 3 TYPES
  const calcTotalGoldEquivalent = () => {
    const physAccounts = accounts.filter(a => a.subType === 'GOLD_GRAM_PHYSICAL' && (selectedGroupId === 'ALL' || a.groupId === selectedGroupId));
    const bankAccounts = accounts.filter(a => a.subType === 'GOLD_GRAM_BANK' && (selectedGroupId === 'ALL' || a.groupId === selectedGroupId));
    const ceyrekAccounts = accounts.filter(a => a.subType === 'GOLD_CEYREK' && (selectedGroupId === 'ALL' || a.groupId === selectedGroupId));

    const physIds = new Set(physAccounts.map(a => a.id));
    const bankIds = new Set(bankAccounts.map(a => a.id));
    const ceyrekIds = new Set(ceyrekAccounts.map(a => a.id));

    let physQty = 0;
    let bankQty = 0;
    let ceyrekQty = 0;

    for (const t of transactions) {
      if (physIds.has(t.accountId)) {
        physQty += (t.type === 'BUY' ? t.quantity : -t.quantity);
      } else if (bankIds.has(t.accountId)) {
        bankQty += (t.type === 'BUY' ? t.quantity : -t.quantity);
      } else if (ceyrekIds.has(t.accountId)) {
        ceyrekQty += (t.type === 'BUY' ? t.quantity : -t.quantity);
      }
    }

    physQty = Math.max(0, physQty);
    bankQty = Math.max(0, bankQty);
    ceyrekQty = Math.max(0, ceyrekQty);

    // 1 Çeyrek Altın = 1.75 gr kabul edilir
    const ceyrekInGrams = ceyrekQty * 1.75;
    const totalGrams = physQty + bankQty + ceyrekInGrams;
    const totalValueTRY = (physQty * physGramRate) + (bankQty * bankGramRate) + (ceyrekQty * ceyrekRate);

    return { physQty, bankQty, ceyrekQty, ceyrekInGrams, totalGrams, totalValueTRY };
  };

  const goldSummary = calcTotalGoldEquivalent();

  // Filter groups: only show groups that have gold accounts with at least one transaction
  const groupsWithGold = groups.filter(g => {
    const gAccounts = accounts.filter(a => a.groupId === g.id && (a.subType === 'GOLD_GRAM_PHYSICAL' || a.subType === 'GOLD_GRAM_BANK' || a.subType === 'GOLD_CEYREK'));
    if (gAccounts.length === 0) return false;
    const gAccIds = new Set(gAccounts.map(a => a.id));
    return transactions.some(t => gAccIds.has(t.accountId));
  });

  // Determine current asset subType
  const currentSubType: AssetSubType = 
    activeGoldType === 'PHYSICAL_GRAM' ? 'GOLD_GRAM_PHYSICAL' :
    activeGoldType === 'BANK_GRAM' ? 'GOLD_GRAM_BANK' : 'GOLD_CEYREK';

  // Filter accounts for this gold subType, respecting group filter
  const matchingAccounts = accounts.filter(a => {
    const isType = a.subType === currentSubType;
    const isGroup = selectedGroupId === 'ALL' || a.groupId === selectedGroupId;
    return isType && isGroup;
  });

  const matchingAccountIds = new Set(matchingAccounts.map(a => a.id));

  // Transactions for matching accounts
  const assetTxs = transactions.filter(t => matchingAccountIds.has(t.accountId));

  // Dynamic years from asset transactions
  const uniqueYears = Array.from(new Set(assetTxs.map(t => t.year)));
  const dynamicYears = Array.from(new Set([2024, 2025, 2026, 2027, ...uniqueYears])).sort((a, b) => a - b);

  // Multi-Year Monthly Matrix calculations
  const getMatrixCell = (year: number, month: number) => {
    const mtx = assetTxs.filter(t => t.year === year && t.month === month);
    let net = 0;
    for (const t of mtx) {
      if (t.type === 'BUY') net += t.quantity;
      else net -= t.quantity;
    }
    return net;
  };

  const getYearTotal = (year: number) => {
    const ytx = assetTxs.filter(t => t.year === year);
    let net = 0;
    for (const t of ytx) {
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

  // Monthly aggregates for selectedYear (Months 1-12)
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const mtx = assetTxs.filter(t => t.year === selectedYear && t.month === month);
    let qty = 0;
    let cost = 0;
    for (const t of mtx) {
      if (t.type === 'BUY') {
        qty += t.quantity;
        cost += t.totalAmountTRY;
      } else {
        qty -= t.quantity;
        cost -= t.totalAmountTRY;
      }
    }
    const avgCost = qty > 0 ? cost / qty : 0;
    return { month, qty, cost, avgCost };
  });

  // Overall holdings across all time for this gold type
  let totalBoughtQty = 0;
  let totalCostTRY = 0;
  for (const t of assetTxs) {
    if (t.type === 'BUY') {
      totalBoughtQty += t.quantity;
      totalCostTRY += t.totalAmountTRY;
    } else {
      totalBoughtQty -= t.quantity;
      totalCostTRY -= t.totalAmountTRY;
    }
  }

  const currentHoldingQty = Math.max(0, totalBoughtQty);
  const avgUnitCost = currentHoldingQty > 0 ? totalCostTRY / currentHoldingQty : 0;
  const currentValueTRY = currentHoldingQty * currentRate;
  const profitLossTRY = currentValueTRY - totalCostTRY;
  const profitLossPct = totalCostTRY > 0 ? (profitLossTRY / totalCostTRY) * 100 : 0;
  const isProfit = profitLossTRY >= 0;

  // Date Range Filter logic for Transaction History
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

  // Inputs sync
  const handleQuantityChange = (qVal: string) => {
    setQuantity(qVal);
    const q = parseFloat(qVal.replace(',', '.'));
    const u = parseFloat(unitTRY.replace(',', '.'));
    if (!isNaN(q) && !isNaN(u) && q > 0) {
      setTotalTRY((q * u).toFixed(2));
    }
  };

  const handleUnitChange = (uVal: string) => {
    setUnitTRY(uVal);
    const q = parseFloat(quantity.replace(',', '.'));
    const u = parseFloat(uVal.replace(',', '.'));
    if (!isNaN(q) && !isNaN(u) && q > 0) {
      setTotalTRY((q * u).toFixed(2));
    }
  };

  const handleTotalChange = (tVal: string) => {
    setTotalTRY(tVal);
    const q = parseFloat(quantity.replace(',', '.'));
    const t = parseFloat(tVal.replace(',', '.'));
    if (!isNaN(q) && !isNaN(t) && q > 0) {
      setUnitTRY((t / q).toFixed(2));
    }
  };

  const handleOpenAddModal = () => {
    // If a group is selected in the filter, pre-select it
    const targetGrp = selectedGroupId !== 'ALL' ? selectedGroupId : (groups[0]?.id || '');
    setTargetGroupId(targetGrp);

    const existingAcc = accounts.find(a => a.groupId === targetGrp && a.subType === currentSubType);
    setTargetAccountId(existingAcc?.id || '');
    setUnitTRY(currentRate.toString());
    setQuantity('');
    setTotalTRY('');
    setNote('');
    setIsModalOpen(true);
  };

  const handleSaveTransaction = async () => {
    let finalAccountId = targetAccountId;

    if (!finalAccountId) {
      const existingAcc = accounts.find(a => a.groupId === targetGroupId && a.subType === currentSubType);
      if (existingAcc) {
        finalAccountId = existingAcc.id;
      } else {
        const groupObj = groups.find(g => g.id === targetGroupId);
        const typeTitle = 
          activeGoldType === 'PHYSICAL_GRAM' ? 'Fiziki Gram Altın' :
          activeGoldType === 'BANK_GRAM' ? 'Banka Gram Altın' : 'Çeyrek Altın';

        const newAcc: Account = {
          id: `acc-gold-${Date.now()}`,
          groupId: targetGroupId,
          name: `${groupObj?.name || ''} ${typeTitle}`.trim(),
          type: 'ASSET',
          subType: currentSubType,
          symbol: activeGoldType === 'PHYSICAL_GRAM' ? 'XAU_GR_PHYSICAL' :
                  activeGoldType === 'BANK_GRAM' ? 'XAU_GR_BANK' : 'XAU_CEYREK',
          currency: 'TRY',
          order: accounts.length + 1,
          createdAt: new Date().toISOString()
        };
        await db.accounts.add(newAcc);
        finalAccountId = newAcc.id;
      }
    }

    const q = parseFloat(quantity.replace(',', '.'));
    const t = parseFloat(totalTRY.replace(',', '.'));
    const u = parseFloat(unitTRY.replace(',', '.')) || (t / q);

    if (isNaN(q) || q <= 0 || isNaN(t) || t <= 0) return;

    const dateObj = new Date(txDate);
    const newTx: AssetTransaction = {
      id: `tx-${Date.now()}`,
      accountId: finalAccountId,
      groupId: targetGroupId,
      date: txDate,
      year: dateObj.getFullYear(),
      month: dateObj.getMonth() + 1,
      type: txType,
      quantity: q,
      totalAmountTRY: t,
      unitPriceTRY: u,
      note: note.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    await db.transactions.add(newTx);
    setIsModalOpen(false);
    setQuantity('');
    setTotalTRY('');
    setUnitTRY('');
    setNote('');
  };

  const handleDeleteTx = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'İşlemi Sil',
      message: 'Bu altın alış/satış kaydını silmek istediğinize emin misiniz?',
      onConfirm: async () => {
        await db.transactions.delete(id);
      }
    });
  };

  const unitLabel = activeGoldType === 'CEYREK' ? 'Adet' : 'Gram';

  return (
    <div className="space-y-4">
      {/* CONSOLIDATED GOLD IN GRAMS BANNER */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-slate-900 border border-amber-500/30 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider block">
                Toplam Altın Varlığı (Gram Karşılığı)
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-white font-mono">
                  {hideValues ? '••••' : `${formatNumber(goldSummary.totalGrams, 2)} gr`}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  ≈ {formatTRY(goldSummary.totalValueTRY, hideValues)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick breakdown tags */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="px-2.5 py-1 rounded-xl bg-slate-950/60 border border-white/10 text-slate-300">
              <span className="text-slate-500 mr-1.5">Banka:</span>
              <span className="font-bold text-amber-300 font-mono">{formatNumber(goldSummary.bankQty, 2, hideValues)} gr</span>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-slate-950/60 border border-white/10 text-slate-300">
              <span className="text-slate-500 mr-1.5">Fiziki:</span>
              <span className="font-bold text-amber-300 font-mono">{formatNumber(goldSummary.physQty, 2, hideValues)} gr</span>
            </div>
            <div className="px-2.5 py-1 rounded-xl bg-slate-950/60 border border-white/10 text-slate-300">
              <span className="text-slate-500 mr-1.5">Çeyrek:</span>
              <span className="font-bold text-amber-300 font-mono">{formatNumber(goldSummary.ceyrekQty, 0, hideValues)} Adet (~{formatNumber(goldSummary.ceyrekInGrams, 2, hideValues)} gr)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Type Switcher Tabs & Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-white/5">
        <div className="flex flex-wrap p-1 rounded-xl bg-slate-800 border border-white/5">
          <button
            onClick={() => setActiveGoldType('BANK_GRAM')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeGoldType === 'BANK_GRAM' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Banka Gram Altın</span>
          </button>
          <button
            onClick={() => setActiveGoldType('PHYSICAL_GRAM')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeGoldType === 'PHYSICAL_GRAM' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Fiziki Gram Altın</span>
          </button>
          <button
            onClick={() => setActiveGoldType('CEYREK')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeGoldType === 'CEYREK' ? 'bg-amber-500 text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Çeyrek Altın</span>
          </button>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Altın Al / Bozdur</span>
        </button>
      </div>

      {/* Group Filter Bar: Only show groups that have gold assets */}
      <GroupFilterBar
        groups={groupsWithGold.length > 0 ? groupsWithGold : groups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={setSelectedGroupId}
        title="Hesap Grubu"
      />

      {/* METRIC HEADER */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-4 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg">
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">
            Toplam Değer
          </span>
          <span className="text-base sm:text-lg font-bold text-white mt-1 font-mono">
            {formatTRY(currentValueTRY, hideValues)}
          </span>
          <span className="text-[10px] text-slate-500">
            {formatNumber(currentHoldingQty, activeGoldType === 'CEYREK' ? 0 : 2, hideValues)} {unitLabel}
          </span>
        </div>

        <div className="flex flex-col border-l border-white/10 pl-2.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Maliyet</span>
          <span className="text-base sm:text-lg font-bold text-slate-200 mt-1 font-mono">
            {formatTRY(totalCostTRY, hideValues)}
          </span>
          <span className="text-[10px] text-slate-500">Toplam Ödenen</span>
        </div>

        <div className="flex flex-col border-l border-white/10 pl-2.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Kâr / Zarar</span>
          <span className={`text-base sm:text-lg font-bold mt-1 font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isProfit ? '+' : ''}{formatTRY(profitLossTRY, hideValues)}
          </span>
          <span className="text-[10px] text-slate-500">Net Getiri</span>
        </div>

        <div className="flex flex-col border-l border-white/10 pl-2.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Kâr / Zarar %</span>
          <div className={`flex items-center gap-0.5 text-base sm:text-lg font-bold mt-1 font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isProfit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            <span>%{formatNumber(Math.abs(profitLossPct), 2)}</span>
          </div>
          <span className="text-[10px] text-slate-500">Yüzdesel Oran</span>
        </div>

        <div className="flex flex-col col-span-2 sm:col-span-1 border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-2.5">
          <span className="text-[11px] font-semibold text-amber-400 uppercase">Ort. Brm. Mlyt.</span>
          <span className="text-base sm:text-lg font-bold text-amber-300 mt-1 font-mono">
            {formatTRY(avgUnitCost, hideValues)}
          </span>
          <span className="text-[10px] text-slate-500">
            Güncel: {formatTRY(currentRate, hideValues)}
          </span>
        </div>
      </div>

      {/* MULTI-YEAR MONTHLY MOVEMENT MATRIX (Yıllar x Aylar) */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
        <div className="p-3 bg-slate-950/80 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200">
            {activeGoldType === 'PHYSICAL_GRAM' ? 'Fiziki Gram Altın' : activeGoldType === 'BANK_GRAM' ? 'Banka Gram Altın' : 'Çeyrek Altın'} Yıllık Hareket Matrisi (Giriş / Çıkış)
          </span>
          <span className="text-[10px] text-slate-400">Net {unitLabel} değişimi (Satışlar eksi olarak gösterilir)</span>
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
              <th className="py-2.5 px-3 min-w-[90px] text-right font-bold text-amber-400 bg-slate-950/95">
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
                        {val !== 0 ? formatNumber(val, activeGoldType === 'CEYREK' ? 0 : 2, hideValues) : '-'}
                      </td>
                    );
                  })}
                  <td className={`py-2 px-3 text-right font-bold bg-slate-900/90 ${yearTotal < 0 ? 'text-rose-400' : 'text-amber-300'}`}>
                    {yearTotal !== 0 ? formatNumber(yearTotal, activeGoldType === 'CEYREK' ? 0 : 2, hideValues) : '-'}
                  </td>
                </tr>
              );
            })}

            <tr className="bg-slate-950/95 font-bold text-amber-300 border-t-2 border-white/10">
              <td className="py-2.5 px-3 sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                Genel Toplam
              </td>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                const monthTotal = getMonthTotalAcrossYears(month);
                return (
                  <td key={month} className={`py-2.5 px-2 text-right ${monthTotal < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                    {monthTotal !== 0 ? formatNumber(monthTotal, activeGoldType === 'CEYREK' ? 0 : 2, hideValues) : '-'}
                  </td>
                );
              })}
              <td className="py-2.5 px-3 text-right font-extrabold text-amber-400 text-sm bg-slate-950">
                {formatNumber(currentHoldingQty, activeGoldType === 'CEYREK' ? 0 : 2, hideValues)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SINGLE YEAR DETAILED METRICS BREAKDOWN (Clean Turkish, no "SUM") */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
        <div className="p-3 bg-slate-950/80 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-200">
              Aylık Detay Göstergeleri ({selectedYear})
            </span>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800 border border-white/10">
            <Calendar className="w-3.5 h-3.5 text-amber-400 ml-1.5" />
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
              {monthlyData.map((d) => (
                <th key={d.month} className="py-2.5 px-2.5 min-w-[80px] text-right font-medium">
                  {MONTH_NAMES[d.month - 1].slice(0, 3)}
                </th>
              ))}
              <th className="py-2.5 px-3 min-w-[95px] text-right font-bold text-amber-400 bg-slate-950/95">
                Genel Toplam
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {/* Row 1: Toplam Miktar */}
            <tr className="hover:bg-white/[0.02]">
              <td className="py-2 px-3 text-slate-300 font-sans font-medium sticky left-0 z-10 bg-slate-900/95 border-r border-white/10">
                Toplam Miktar ({unitLabel})
              </td>
              {monthlyData.map((d) => (
                <td key={d.month} className="py-2 px-2 text-right text-slate-300">
                  {d.qty > 0 ? formatNumber(d.qty, activeGoldType === 'CEYREK' ? 0 : 2, hideValues) : '-'}
                </td>
              ))}
              <td className="py-2 px-3 text-right font-bold text-amber-300 bg-slate-900/90">
                {formatNumber(monthlyData.reduce((s, d) => s + d.qty, 0), activeGoldType === 'CEYREK' ? 0 : 2, hideValues)}
              </td>
            </tr>

            {/* Row 2: Toplam Maliyet */}
            <tr className="hover:bg-white/[0.02]">
              <td className="py-2 px-3 text-slate-300 font-sans font-medium sticky left-0 z-10 bg-slate-900/95 border-r border-white/10">
                Toplam Maliyet (TL)
              </td>
              {monthlyData.map((d) => (
                <td key={d.month} className="py-2 px-2 text-right text-slate-300">
                  {d.cost > 0 ? formatNumber(d.cost, 0, hideValues) : '-'}
                </td>
              ))}
              <td className="py-2 px-3 text-right font-bold text-amber-300 bg-slate-900/90">
                {formatNumber(monthlyData.reduce((s, d) => s + d.cost, 0), 0, hideValues)}
              </td>
            </tr>

            {/* Row 3: Ortalama Birim Maliyet */}
            <tr className="bg-amber-500/5 font-semibold text-amber-200">
              <td className="py-2 px-3 font-sans sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                Ortalama Birim Maliyet (TL)
              </td>
              {monthlyData.map((d) => (
                <td key={d.month} className="py-2 px-2 text-right">
                  {d.avgCost > 0 ? formatNumber(d.avgCost, 0, hideValues) : '-'}
                </td>
              ))}
              <td className="py-2 px-3 text-right font-bold text-amber-400 bg-slate-950/95">
                {formatNumber(avgUnitCost, 0, hideValues)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TRANSACTION HISTORY WITH DATE FILTERS */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Alış & Satış Hareket Geçmişi</span>
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
                    ? 'bg-amber-500 text-slate-950 font-bold'
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
                          {formatNumber(tx.quantity, activeGoldType === 'CEYREK' ? 0 : 2, hideValues)} {unitLabel}
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
                        @ {formatTRY(tx.unitPriceTRY, hideValues)} {tx.note ? `• ${tx.note}` : ''}
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

      {/* ADD TRANSACTION MODAL WITH GROUP SELECTION */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          activeGoldType === 'PHYSICAL_GRAM' ? 'Fiziki Gram Altın İşlemi' :
          activeGoldType === 'BANK_GRAM' ? 'Banka Gram Altın İşlemi' : 'Çeyrek Altın İşlemi'
        }
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

          {/* Group Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Hangi Gruba Ait?
            </label>
            <select
              value={targetGroupId}
              onChange={(e) => {
                setTargetGroupId(e.target.value);
                setTargetAccountId('');
              }}
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
                Miktar ({unitLabel})
              </label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder="Örn: 5.0"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Birim Fiyat (TL)</label>
              <input
                type="text"
                value={unitTRY}
                onChange={(e) => handleUnitChange(e.target.value)}
                placeholder={`Örn: ${currentRate}`}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Toplam Tutar (TL)</label>
            <input
              type="text"
              value={totalTRY}
              onChange={(e) => handleTotalChange(e.target.value)}
              placeholder="Örn: 33500"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono font-bold text-base focus:outline-none focus:border-amber-400"
            />
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
                placeholder="Örn: Ay başı birikimi"
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

      {/* Modern Confirm Dialog for Deletion */}
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
