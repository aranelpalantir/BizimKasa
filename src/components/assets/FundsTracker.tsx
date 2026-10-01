import React, { useState } from 'react';
import { 
  Plus, 
  ArrowUpRight, 
  ArrowDownRight, 
  Trash2, 
  Edit2,
  Filter, 
  History, 
  PieChart, 
  TrendingUp, 
  DollarSign
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList
} from 'recharts';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { GroupFilterBar } from '../common/GroupFilterBar';
import { db } from '../../db/db';
import { formatTRY, formatNumber, parseUserInputNumber, formatForInput } from '../../services/portfolioService';
import { lookupTefasFund, searchTefasFunds } from '../../services/ratesService';
import type { Account, AssetTransaction, MarketRate, Group } from '../../types/finance';

interface FundsTrackerProps {
  groups: Group[];
  accounts: Account[];
  transactions: AssetTransaction[];
  rates: MarketRate[];
  hideValues: boolean;
}

type HistoryFilter = 'ALL' | '1M' | '3M' | '6M' | 'THIS_YEAR' | 'PREV_YEAR';

export const FundsTracker: React.FC<FundsTrackerProps> = ({
  groups,
  accounts,
  transactions,
  rates,
  hideValues
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('ALL');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [txType, setTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [targetGroupId, setTargetGroupId] = useState<string>(groups[0]?.id || '');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [newFundCode, setNewFundCode] = useState('');
  const [newFundName, setNewFundName] = useState('');
  const [isCreatingNewFund, setIsCreatingNewFund] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [totalTRY, setTotalTRY] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [fundSuggestions, setFundSuggestions] = useState<Array<{ code: string; name: string }>>([]);

  // Edit Transaction Form State
  const [editingTx, setEditingTx] = useState<AssetTransaction | null>(null);
  const [editTxType, setEditTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [editGroupId, setEditGroupId] = useState<string>('');
  const [editAccountId, setEditAccountId] = useState<string>('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnitPrice, setEditUnitPrice] = useState('');
  const [editTotalTRY, setEditTotalTRY] = useState('');
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

  // Filter fund accounts by group
  const matchingFundAccounts = accounts.filter(a => {
    const isFund = a.subType === 'FUND' || a.subType === 'STOCK';
    const isGroup = selectedGroupId === 'ALL' || a.groupId === selectedGroupId;
    return isFund && isGroup;
  });

  const matchingAccountIds = new Set(matchingFundAccounts.map(a => a.id));

  // Filter groups: only show groups that have fund accounts with transactions
  const groupsWithFunds = groups.filter(g => {
    const gAccounts = accounts.filter(a => a.groupId === g.id && (a.subType === 'FUND' || a.subType === 'STOCK'));
    if (gAccounts.length === 0) return false;
    const gAccIds = new Set(gAccounts.map(a => a.id));
    return transactions.some(t => gAccIds.has(t.accountId));
  });

  // Rate lookup map
  const rateMap = new Map<string, number>();
  for (const r of rates) {
    rateMap.set(r.symbol, r.rateTRY);
  }

  // Calculate detailed metrics for each fund
  const fundData = matchingFundAccounts.map((acc) => {
    const accTxs = transactions.filter(t => t.accountId === acc.id);
    let boughtQty = 0;
    let boughtCost = 0;
    let soldQty = 0;
    let soldRevenue = 0;

    for (const t of accTxs) {
      if (t.type === 'BUY') {
        boughtQty += t.quantity;
        boughtCost += t.totalAmountTRY;
      } else {
        soldQty += t.quantity;
        soldRevenue += t.totalAmountTRY;
      }
    }

    const netQty = Math.max(0, boughtQty - soldQty);
    const avgCost = boughtQty > 0 ? boughtCost / boughtQty : 0;
    const costTRY = netQty * avgCost;

    const symbol = acc.symbol || acc.name;
    const currentRate = rateMap.get(symbol) || (netQty > 0 ? (accTxs[0]?.unitPriceTRY || avgCost) : 1);
    const valueTRY = netQty * currentRate;
    const profitLossTRY = valueTRY - costTRY;
    const profitLossPct = costTRY > 0 ? (profitLossTRY / costTRY) * 100 : 0;

    const grp = groups.find(g => g.id === acc.groupId);

    // Identify all groups holding transactions for this fund
    const txGroupIds = Array.from(new Set(accTxs.map(t => t.groupId).filter(Boolean)));
    if (txGroupIds.length === 0 && acc.groupId) {
      txGroupIds.push(acc.groupId);
    }
    const holdingGroups = groups.filter(g => txGroupIds.includes(g.id));

    return {
      account: acc,
      symbol,
      name: acc.name,
      groupName: grp?.name,
      groupColor: grp?.color,
      holdingGroups,
      netQty,
      avgCost,
      costTRY,
      currentRate,
      valueTRY,
      profitLossTRY,
      profitLossPct,
      ratioPct: 0
    };
  });
 
  const totalFundsCost = fundData.reduce((sum, f) => sum + f.costTRY, 0);
  const totalFundsValue = fundData.reduce((sum, f) => sum + f.valueTRY, 0);

  // Calculate ratio %
  for (const item of fundData) {
    item.ratioPct = totalFundsValue > 0 ? (item.valueTRY / totalFundsValue) * 100 : 0;
  }

  // Sorting state for the detailed funds table
  type FundSortField = 'symbol' | 'ratioPct' | 'netQty' | 'costTRY' | 'valueTRY' | 'profitLossTRY' | 'profitLossPct';
  const [sortField, setSortField] = useState<FundSortField>('valueTRY');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const handleSort = (field: FundSortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedFundData = [...fundData].sort((a, b) => {
    let diff = 0;
    if (sortField === 'symbol') diff = a.symbol.localeCompare(b.symbol);
    else diff = (a[sortField] || 0) - (b[sortField] || 0);
    return sortAsc ? diff : -diff;
  });

  const totalFundsProfitLoss = totalFundsValue - totalFundsCost;
  const totalFundsProfitPct = totalFundsCost > 0 ? (totalFundsProfitLoss / totalFundsCost) * 100 : 0;

  // History filtering
  const allFundTxs = transactions.filter(t => matchingAccountIds.has(t.accountId));
  const filteredTxs = allFundTxs.filter((tx) => {
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

  // Sync inputs
  const handleQtyChange = (qVal: string) => {
    setQuantity(qVal);
    const q = parseUserInputNumber(qVal);
    const u = parseUserInputNumber(unitPrice);
    if (q > 0 && u > 0) {
      setTotalTRY(formatForInput(Math.round(q * u * 100) / 100));
    }
  };

  const handleUnitPriceChange = (uVal: string) => {
    setUnitPrice(uVal);
    const q = parseUserInputNumber(quantity);
    const u = parseUserInputNumber(uVal);
    if (q > 0 && u > 0) {
      setTotalTRY(formatForInput(Math.round(q * u * 100) / 100));
    }
  };

  const handleTotalTRYChange = (tVal: string) => {
    setTotalTRY(tVal);
    const q = parseUserInputNumber(quantity);
    const t = parseUserInputNumber(tVal);
    if (q > 0 && t > 0) {
      setUnitPrice(formatForInput(Math.round((t / q) * 10000) / 10000));
    }
  };

  // TEFAS Fund Code Lookup handler
  const handleFundCodeChange = (codeVal: string) => {
    const upper = codeVal.toUpperCase();
    setNewFundCode(upper);

    if (upper.length >= 2) {
      const suggestions = searchTefasFunds(upper);
      setFundSuggestions(suggestions);

      const matched = lookupTefasFund(upper);
      if (matched) {
        setNewFundName(matched.name);
        if (!unitPrice) {
          setUnitPrice(formatForInput(matched.estimatedPrice));
        }
      }
    } else {
      setFundSuggestions([]);
    }
  };

  const handleSelectSuggestion = (code: string, name: string) => {
    setNewFundCode(code);
    setNewFundName(name);
    setFundSuggestions([]);
    const matched = lookupTefasFund(code);
    if (matched && !unitPrice) {
      setUnitPrice(matched.estimatedPrice.toString());
    }
  };

  const handleOpenModal = () => {
    const targetGrp = selectedGroupId !== 'ALL' ? selectedGroupId : (groups[0]?.id || '');
    setTargetGroupId(targetGrp);
    setTxType('BUY');

    const groupFunds = accounts.filter(a => a.groupId === targetGrp && (a.subType === 'FUND' || a.subType === 'STOCK'));
    if (groupFunds.length > 0) {
      setSelectedAccountId(groupFunds[0].id);
      setIsCreatingNewFund(false);
      const sym = groupFunds[0].symbol || groupFunds[0].name;
      const rate = rateMap.get(sym);
      if (rate) setUnitPrice(rate.toString());
    } else {
      setIsCreatingNewFund(true);
      setSelectedAccountId('');
      setUnitPrice('');
    }

    setQuantity('');
    setTotalTRY('');
    setNote('');
    setIsModalOpen(true);
  };

  const handleSaveTransaction = async () => {
    let targetAccId = selectedAccountId;

    if (txType === 'BUY' && isCreatingNewFund) {
      if (!newFundCode.trim()) return;
      const code = newFundCode.trim().toUpperCase();
      const newAcc: Account = {
        id: `acc-fund-${Date.now()}`,
        groupId: targetGroupId,
        name: newFundName.trim() || code,
        type: 'ASSET',
        subType: 'FUND',
        symbol: code,
        currency: 'TRY',
        order: accounts.length + 1,
        createdAt: new Date().toISOString()
      };
      await db.accounts.add(newAcc);
      targetAccId = newAcc.id;

      // Add default market rate
      const p = parseUserInputNumber(unitPrice) || 10;
      await db.marketRates.put({
        symbol: code,
        name: newAcc.name,
        category: 'FUND',
        rateTRY: p,
        changeDailyPct: 0.5,
        source: 'TEFAS',
        dataDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString(),
        isManualOverride: false
      });
    }

    if (!targetAccId) return;

    const q = parseUserInputNumber(quantity);
    const t = parseUserInputNumber(totalTRY);
    const u = parseUserInputNumber(unitPrice) || (q > 0 ? t / q : 0);

    if (q <= 0 || t <= 0) return;

    const dateObj = new Date(txDate);
    const newTx: AssetTransaction = {
      id: `tx-${Date.now()}`,
      accountId: targetAccId,
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
    setUnitPrice('');
    setTotalTRY('');
    setNote('');
    setIsCreatingNewFund(false);
    setFundSuggestions([]);
  };

  const handleOpenEditTx = (tx: AssetTransaction) => {
    const defaultGid = tx.groupId || accounts.find(a => a.id === tx.accountId)?.groupId || groups[0]?.id || '';
    setEditingTx(tx);
    setEditTxType(tx.type);
    setEditGroupId(defaultGid);
    setEditAccountId(tx.accountId);
    setEditQuantity(formatForInput(tx.quantity));
    setEditUnitPrice(formatForInput(tx.unitPriceTRY));
    setEditTotalTRY(formatForInput(tx.totalAmountTRY));
    setEditTxDate(tx.date);
    setEditNote(tx.note || '');
  };

  const handleEditQtyChange = (qVal: string) => {
    setEditQuantity(qVal);
    const q = parseUserInputNumber(qVal);
    const u = parseUserInputNumber(editUnitPrice);
    if (q > 0 && u > 0) {
      setEditTotalTRY(formatForInput(Math.round(q * u * 100) / 100));
    }
  };

  const handleEditUnitPriceChange = (uVal: string) => {
    setEditUnitPrice(uVal);
    const q = parseUserInputNumber(editQuantity);
    const u = parseUserInputNumber(uVal);
    if (q > 0 && u > 0) {
      setEditTotalTRY(formatForInput(Math.round(q * u * 100) / 100));
    }
  };

  const handleEditTotalTRYChange = (tVal: string) => {
    setEditTotalTRY(tVal);
    const q = parseUserInputNumber(editQuantity);
    const t = parseUserInputNumber(tVal);
    if (q > 0 && t > 0) {
      setEditUnitPrice(formatForInput(Math.round((t / q) * 10000) / 10000));
    }
  };

  const handleSaveEditTransaction = async () => {
    if (!editingTx || !editAccountId) return;

    const q = parseUserInputNumber(editQuantity);
    const t = parseUserInputNumber(editTotalTRY);
    const u = parseUserInputNumber(editUnitPrice) || (q > 0 ? t / q : 0);

    if (q <= 0 || t <= 0) return;

    const dateObj = new Date(editTxDate);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;

    await db.transactions.update(editingTx.id, {
      accountId: editAccountId,
      groupId: editGroupId,
      date: editTxDate,
      year,
      month,
      type: editTxType,
      quantity: q,
      totalAmountTRY: t,
      unitPriceTRY: u,
      note: editNote.trim() || undefined
    });

    setEditingTx(null);
  };

  const handleDeleteFund = (acc: Account) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Fonu Sil',
      message: `"${acc.name}" (${acc.symbol}) fonunu ve buna ait geçmiş tüm alım/satım işlemlerini silmek istediğinize emin misiniz?`,
      onConfirm: async () => {
        await db.accounts.delete(acc.id);
        const txs = transactions.filter(t => t.accountId === acc.id);
        for (const t of txs) {
          await db.transactions.delete(t.id);
        }
      }
    });
  };

  const handleDeleteTx = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'İşlemi Sil',
      message: 'Bu fon alım/satım hareket kaydını silmek istediğinize emin misiniz?',
      onConfirm: async () => {
        await db.transactions.delete(id);
      }
    });
  };

  const chartColors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

  // Current holding for selected sell account
  const sellAccountData = fundData.find(f => f.account.id === selectedAccountId);

  return (
    <div className="space-y-4">
      {/* Top Header & Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/80 border border-white/5">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>Yatırım Fonları & Borsa Portföyü</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {matchingFundAccounts.length} Fon
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            TEFAS yatırım fonları portföy ağırlıkları, maliyet ve kâr/zarar oranları
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Fon Al / Bozdur</span>
        </button>
      </div>

      {/* Group Filter Bar: Only show groups that have funds */}
      <GroupFilterBar
        groups={groupsWithFunds.length > 0 ? groupsWithFunds : groups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={setSelectedGroupId}
        title="Hesap"
      />

      {/* SUMMARY TOTALS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg">
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Toplam Fon Değeri</span>
          <span className="text-lg sm:text-xl font-extrabold text-white mt-1 font-mono">
            {formatTRY(totalFundsValue, hideValues)}
          </span>
          <span className="text-[10px] text-slate-500">Güncel Piyasa</span>
        </div>

        <div className="flex flex-col border-l border-white/10 pl-2.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Toplam Maliyet</span>
          <span className="text-lg sm:text-xl font-extrabold text-slate-300 mt-1 font-mono">
            {formatTRY(totalFundsCost, hideValues)}
          </span>
          <span className="text-[10px] text-slate-500">Ödenen Anapara</span>
        </div>

        <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-2.5">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase">Net Kâr / Zarar</span>
          <span className={`text-lg sm:text-xl font-extrabold mt-1 font-mono ${totalFundsProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalFundsProfitLoss >= 0 ? '+' : ''}{formatTRY(totalFundsProfitLoss, hideValues)}
          </span>
          <span className="text-[10px] text-slate-500">Net Kazanç</span>
        </div>

        <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-2.5">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase">Kâr Oranı</span>
          <div className={`flex items-center gap-1 text-lg sm:text-xl font-extrabold mt-1 font-mono ${totalFundsProfitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalFundsProfitLoss >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
            <span>%{formatNumber(totalFundsProfitPct, 2)}</span>
          </div>
          <span className="text-[10px] text-slate-500">Yüzdesel Getiri</span>
        </div>
      </div>

      {/* 4 DISTINCT CHARTS (PORTFÖY ORANI, MALİYET, DEĞER, KÂR/ZARAR) */}
      {fundData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Chart 1: Portföye Oranı (%) */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 space-y-2 shadow-md">
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <PieChart className="w-3.5 h-3.5 text-blue-400" />
                <span>1. Portföye Oranı (%)</span>
              </span>
              <span className="text-[10px] text-slate-400">Yüzdesel Dağılım</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fundData} margin={{ top: 20, right: 10, left: -15, bottom: 0 }}>
                  <XAxis dataKey="symbol" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `%${v}`} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const val = Number(payload[0].value) || 0;
                        return (
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-white/15 shadow-xl text-xs space-y-1">
                            <p className="font-bold text-white">{label}</p>
                            <p className="font-semibold font-mono text-sky-400">
                              Portföy Oranı : %{formatNumber(val, 2)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="ratioPct" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="ratioPct" position="top" fill="#94a3b8" fontSize={9} formatter={(v: any) => `%${Number(v).toFixed(1)}`} />
                    {fundData.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Toplam Maliyet (TL) */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 space-y-2 shadow-md">
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span>2. Toplam Maliyet (TL)</span>
              </span>
              <span className="text-[10px] text-slate-400">Ödenen Anapara</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fundData} margin={{ top: 20, right: 10, left: -15, bottom: 0 }}>
                  <XAxis dataKey="symbol" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const val = Number(payload[0].value) || 0;
                        return (
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-white/15 shadow-xl text-xs space-y-1">
                            <p className="font-bold text-white">{label}</p>
                            <p className="font-semibold font-mono text-amber-400">
                              Toplam Maliyet : {formatTRY(val, hideValues)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="costTRY" fill="#f59e0b" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="costTRY" position="top" fill="#f59e0b" fontSize={9} formatter={(v: any) => `${(Number(v) / 1000).toFixed(0)}k`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Güncel Değer (TL) */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 space-y-2 shadow-md">
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                <span>3. Güncel Değer (TL)</span>
              </span>
              <span className="text-[10px] text-slate-400">Piyasa Değeri</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fundData} margin={{ top: 20, right: 10, left: -15, bottom: 0 }}>
                  <XAxis dataKey="symbol" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const val = Number(payload[0].value) || 0;
                        return (
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-white/15 shadow-xl text-xs space-y-1">
                            <p className="font-bold text-white">{label}</p>
                            <p className="font-semibold font-mono text-indigo-300">
                              Güncel Değer : {formatTRY(val, hideValues)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="valueTRY" fill="#6366f1" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="valueTRY" position="top" fill="#a5b4fc" fontSize={9} formatter={(v: any) => `${(Number(v) / 1000).toFixed(0)}k`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Kâr / Zarar (TL) */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 space-y-2 shadow-md">
            <div className="flex items-center justify-between pb-1 border-b border-white/5">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>4. Net Kâr / Zarar (TL)</span>
              </span>
              <span className="text-[10px] text-slate-400">Kâr/Zarar Karşılaştırması</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fundData} margin={{ top: 20, right: 10, left: -15, bottom: 0 }}>
                  <XAxis dataKey="symbol" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const val = Number(payload[0].value) || 0;
                        const isProfit = val >= 0;
                        return (
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-white/15 shadow-xl text-xs space-y-1">
                            <p className="font-bold text-white">{label}</p>
                            <p className={`font-semibold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                              Net Kâr / Zarar : {isProfit ? '+' : ''}{formatTRY(val, hideValues)}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="profitLossTRY" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="profitLossTRY" position="top" fill="#34d399" fontSize={9} formatter={(v: any) => `${(Number(v) / 1000).toFixed(0)}k`} />
                    {fundData.map((entry, i) => (
                      <Cell key={i} fill={entry.profitLossTRY >= 0 ? '#10b981' : '#f43f5e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* DETAILED FUNDS TABLE WITH SORTABLE COLUMNS */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/80 border-b border-white/10 text-slate-400 font-semibold select-none">
              <th onClick={() => handleSort('symbol')} className="py-3 px-4 min-w-[150px] cursor-pointer hover:text-white">
                <div className="flex items-center gap-1">
                  <span>Fon Adı / Kodu</span>
                  {sortField === 'symbol' && <span>{sortAsc ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th className="py-3 px-2.5 text-left">Hesap</th>
              <th onClick={() => handleSort('netQty')} className="py-3 px-3 text-right cursor-pointer hover:text-white">
                <div className="flex items-center justify-end gap-1">
                  <span>Adet</span>
                  {sortField === 'netQty' && <span>{sortAsc ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th onClick={() => handleSort('ratioPct')} className="py-3 px-3 text-right cursor-pointer hover:text-white">
                <div className="flex items-center justify-end gap-1">
                  <span>Portföy Oranı</span>
                  {sortField === 'ratioPct' && <span>{sortAsc ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th onClick={() => handleSort('costTRY')} className="py-3 px-3 text-right cursor-pointer hover:text-white">
                <div className="flex items-center justify-end gap-1">
                  <span>Maliyet (TL)</span>
                  {sortField === 'costTRY' && <span>{sortAsc ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th onClick={() => handleSort('valueTRY')} className="py-3 px-3 text-right cursor-pointer hover:text-white">
                <div className="flex items-center justify-end gap-1">
                  <span>Değer (TL)</span>
                  {sortField === 'valueTRY' && <span>{sortAsc ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th onClick={() => handleSort('profitLossTRY')} className="py-3 px-3 text-right cursor-pointer hover:text-white">
                <div className="flex items-center justify-end gap-1">
                  <span>Kâr / Zarar (TL)</span>
                  {sortField === 'profitLossTRY' && <span>{sortAsc ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th onClick={() => handleSort('profitLossPct')} className="py-3 px-3 text-right cursor-pointer hover:text-white">
                <div className="flex items-center justify-end gap-1">
                  <span>Kâr / Zarar (%)</span>
                  {sortField === 'profitLossPct' && <span>{sortAsc ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th className="py-3 px-2 text-center w-10">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {sortedFundData.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-slate-400 font-sans text-xs">
                  Bu hesapta kayıtlı fon bulunmuyor.
                </td>
              </tr>
            ) : (
              sortedFundData.map((f) => (
                <tr key={f.account.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-sans">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold font-mono border border-emerald-500/20 text-xs">
                        {f.symbol}
                      </span>
                      <span className="font-semibold text-slate-200 truncate max-w-[160px]">{f.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2.5 font-sans">
                    {selectedGroupId === 'ALL' ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {f.holdingGroups.map((g) => (
                          <span
                            key={g.id}
                            className="text-[10px] px-2 py-0.5 rounded font-semibold whitespace-nowrap"
                            style={{ backgroundColor: `${g.color}20`, color: g.color }}
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      f.groupName && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded font-semibold whitespace-nowrap"
                          style={{ backgroundColor: `${f.groupColor}20`, color: f.groupColor }}
                        >
                          {f.groupName}
                        </span>
                      )
                    )}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-300">
                    {formatNumber(f.netQty, 0, hideValues)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-300">
                    %{formatNumber(f.ratioPct, 2)}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-300">
                    {formatTRY(f.costTRY, hideValues)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-white">
                    {formatTRY(f.valueTRY, hideValues)}
                  </td>
                  <td className={`py-3 px-3 text-right font-bold ${f.profitLossTRY >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {f.profitLossTRY >= 0 ? '+' : ''}{formatTRY(f.profitLossTRY, hideValues)}
                  </td>
                  <td className={`py-3 px-3 text-right font-bold ${f.profitLossTRY >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {f.profitLossTRY >= 0 ? '+' : ''}%{formatNumber(f.profitLossPct, 2)}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <button
                      onClick={() => handleDeleteFund(f.account)}
                      title="Fonu ve tüm işlemlerini sil"
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* TRANSACTION HISTORY WITH DATE FILTERS */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>Fon Alış & Satış Hareket Geçmişi</span>
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
                    ? 'bg-emerald-500 text-slate-950 font-bold'
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
                        <span className="font-semibold text-slate-200">
                          {acc?.symbol || acc?.name}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          • {formatNumber(tx.quantity, 0, hideValues)} adet
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
      </div>

      {/* TRANSACTION MODAL WITH BUY / SELL SUPPORT */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIsCreatingNewFund(false);
          setFundSuggestions([]);
        }}
        title="Fon Alım / Satım (Bozdurma)"
      >
        <div className="space-y-4">
          {/* BUY / SELL Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-white/10">
            <button
              type="button"
              onClick={() => setTxType('BUY')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                txType === 'BUY' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              Fon Alışı (+)
            </button>
            <button
              type="button"
              onClick={() => {
                setTxType('SELL');
                setIsCreatingNewFund(false);
                // Preselect first account that has net holdings
                const availableToSell = fundData.filter(f => f.account.groupId === targetGroupId && f.netQty > 0);
                if (availableToSell.length > 0) {
                  setSelectedAccountId(availableToSell[0].account.id);
                  setUnitPrice(availableToSell[0].currentRate.toString());
                }
              }}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                txType === 'SELL' ? 'bg-rose-500 text-white' : 'text-slate-400'
              }`}
            >
              Fon Satışı / Bozdurma (-)
            </button>
          </div>

          {/* Account Selection */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Hangi Hesaba Ait?</label>
            {groups.length === 0 ? (
              <p className="text-xs text-amber-400">Henüz kayıtlı bir hesap bulunmuyor. Önce yukarıdan 'Yeni Hesap' eklemelisiniz.</p>
            ) : (
              <select
                value={targetGroupId}
                onChange={(e) => {
                  const gid = e.target.value;
                  setTargetGroupId(gid);
                  const gFunds = accounts.filter(a => a.groupId === gid && (a.subType === 'FUND' || a.subType === 'STOCK'));
                  if (gFunds.length > 0) {
                    setSelectedAccountId(gFunds[0].id);
                    const rate = rateMap.get(gFunds[0].symbol || gFunds[0].name);
                    if (rate) setUnitPrice(rate.toString());
                  } else {
                    setSelectedAccountId('');
                    setIsCreatingNewFund(true);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* If BUY: can select existing or create new fund */}
          {txType === 'BUY' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-400">Yatırım Fonu Seçimi</label>
                <button
                  type="button"
                  onClick={() => setIsCreatingNewFund(!isCreatingNewFund)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                >
                  {isCreatingNewFund ? 'Mevcut Fonlardan Seç' : '+ Yeni Fon Kodu Ekle'}
                </button>
              </div>

              {!isCreatingNewFund ? (
                <select
                  value={selectedAccountId}
                  onChange={(e) => {
                    const accId = e.target.value;
                    setSelectedAccountId(accId);
                    const acc = accounts.find(a => a.id === accId);
                    if (acc) {
                      const sym = acc.symbol || acc.name;
                      const rate = rateMap.get(sym);
                      if (rate) setUnitPrice(rate.toString());
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none"
                >
                  {matchingFundAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.symbol ? `[${acc.symbol}] ` : ''}{acc.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-3 p-3 rounded-xl bg-slate-950/60 border border-amber-500/20">
                  <div className="relative">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      TEFAS Fon Kodu (örn: MAC, TI2, AFT, TI1)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={newFundCode}
                      onChange={(e) => handleFundCodeChange(e.target.value)}
                      placeholder="Fon Kodunu Yazın..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white font-mono uppercase font-bold text-sm focus:outline-none focus:border-amber-400"
                    />

                    {/* Autocomplete suggestions */}
                    {fundSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden max-h-40 overflow-y-auto divide-y divide-white/5">
                        {fundSuggestions.map((s) => (
                          <div
                            key={s.code}
                            onClick={() => handleSelectSuggestion(s.code, s.name)}
                            className="p-2 hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-amber-400 font-mono">{s.code}</span>
                            <span className="text-slate-300 text-[11px] truncate max-w-[200px]">{s.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">Fon Adı</label>
                    <input
                      type="text"
                      value={newFundName}
                      onChange={(e) => setNewFundName(e.target.value)}
                      placeholder="Fon adı otomatik gelir ya da elle yazabilirsiniz"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* If SELL: only existing funds with holdings */}
          {txType === 'SELL' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Satılacak Fon</label>
              <select
                value={selectedAccountId}
                onChange={(e) => {
                  const accId = e.target.value;
                  setSelectedAccountId(accId);
                  const fItem = fundData.find(f => f.account.id === accId);
                  if (fItem) setUnitPrice(fItem.currentRate.toString());
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none"
              >
                {matchingFundAccounts.map((acc) => {
                  const fItem = fundData.find(f => f.account.id === acc.id);
                  return (
                    <option key={acc.id} value={acc.id}>
                      {acc.symbol ? `[${acc.symbol}] ` : ''}{acc.name} (Eldeki: {formatNumber(fItem?.netQty || 0, 0)} adet)
                    </option>
                  );
                })}
              </select>
              {sellAccountData && (
                <p className="text-[11px] text-slate-400 mt-1">
                  Mevcut Bakiye: <span className="font-bold text-white font-mono">{formatNumber(sellAccountData.netQty, 0)} adet</span> (≈ {formatTRY(sellAccountData.valueTRY, hideValues)})
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {txType === 'BUY' ? 'Alınan Adet' : 'Satılan Adet'}
              </label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => handleQtyChange(e.target.value)}
                placeholder="Örn: 1000"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {txType === 'BUY' ? 'Birim Alış Fiyatı (TL)' : 'Birim Satış Fiyatı (TL)'}
              </label>
              <input
                type="text"
                value={unitPrice}
                onChange={(e) => handleUnitPriceChange(e.target.value)}
                placeholder="Örn: 14.50"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              {txType === 'BUY' ? 'Toplam Ödenen Tutar (TL)' : 'Toplam Satış Geliri (TL)'}
            </label>
            <input
              type="text"
              value={totalTRY}
              onChange={(e) => handleTotalTRYChange(e.target.value)}
              placeholder="Örn: 14500"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono font-bold text-base focus:outline-none focus:border-amber-400"
            />
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
              onClick={() => {
                setIsModalOpen(false);
                setIsCreatingNewFund(false);
                setFundSuggestions([]);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSaveTransaction}
              className={`px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-colors ${
                txType === 'BUY' 
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20' 
                  : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
              }`}
            >
              {txType === 'BUY' ? 'Alışı Kaydet' : 'Satışı Kaydet'}
            </button>
          </div>
        </div>
      </Modal>

      {/* EDIT TRANSACTION MODAL */}
      <Modal
        isOpen={!!editingTx}
        onClose={() => setEditingTx(null)}
        title="Fon İşlemini Düzenle"
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
              Fon Alışı (+)
            </button>
            <button
              type="button"
              onClick={() => setEditTxType('SELL')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                editTxType === 'SELL' ? 'bg-rose-500 text-white' : 'text-slate-400'
              }`}
            >
              Fon Satışı / Bozdurma (-)
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Hangi Hesaba Ait?</label>
            <select
              value={editGroupId}
              onChange={(e) => {
                const gid = e.target.value;
                setEditGroupId(gid);
                const gFunds = accounts.filter(a => a.groupId === gid && (a.subType === 'FUND' || a.subType === 'STOCK'));
                if (gFunds.length > 0 && !gFunds.some(a => a.id === editAccountId)) {
                  setEditAccountId(gFunds[0].id);
                }
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">İşlem Gören Fon</label>
            <select
              value={editAccountId}
              onChange={(e) => setEditAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
            >
              {(accounts.some(a => a.groupId === editGroupId && (a.subType === 'FUND' || a.subType === 'STOCK'))
                ? accounts.filter(a => a.groupId === editGroupId && (a.subType === 'FUND' || a.subType === 'STOCK'))
                : accounts.filter(a => a.subType === 'FUND' || a.subType === 'STOCK')
              ).map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.symbol ? `[${acc.symbol}] ` : ''}{acc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {editTxType === 'BUY' ? 'Alınan Adet' : 'Satılan Adet'}
              </label>
              <input
                type="text"
                value={editQuantity}
                onChange={(e) => handleEditQtyChange(e.target.value)}
                placeholder="Örn: 1000"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {editTxType === 'BUY' ? 'Birim Alış Fiyatı (TL)' : 'Birim Satış Fiyatı (TL)'}
              </label>
              <input
                type="text"
                value={editUnitPrice}
                onChange={(e) => handleEditUnitPriceChange(e.target.value)}
                placeholder="Örn: 14.50"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              {editTxType === 'BUY' ? 'Toplam Ödenen Tutar (TL)' : 'Toplam Satış Geliri (TL)'}
            </label>
            <input
              type="text"
              value={editTotalTRY}
              onChange={(e) => handleEditTotalTRYChange(e.target.value)}
              placeholder="Örn: 14500"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono font-bold text-base focus:outline-none focus:border-amber-400"
            />
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

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setEditingTx(null)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSaveEditTransaction}
              className={`px-5 py-2 rounded-xl text-xs font-bold shadow-md transition-colors ${
                editTxType === 'BUY' 
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20' 
                  : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
              }`}
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
