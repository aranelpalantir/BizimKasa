import React, { useState } from 'react';
import { Plus, ArrowUpRight, Trash2, Filter, History, Sparkles } from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { Modal } from '../common/Modal';
import { GroupFilterBar } from '../common/GroupFilterBar';
import { db } from '../../db/db';
import { formatTRY, formatNumber } from '../../services/portfolioService';
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

  // Filter fund accounts by group
  const matchingFundAccounts = accounts.filter(a => {
    const isFund = a.subType === 'FUND' || a.subType === 'STOCK';
    const isGroup = selectedGroupId === 'ALL' || a.groupId === selectedGroupId;
    return isFund && isGroup;
  });

  const matchingAccountIds = new Set(matchingFundAccounts.map(a => a.id));

  // Rate lookup map
  const rateMap = new Map<string, number>();
  for (const r of rates) {
    rateMap.set(r.symbol, r.rateTRY);
  }

  // Calculate detailed metrics for each fund
  let totalFundsCost = 0;
  let totalFundsValue = 0;

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

    totalFundsCost += costTRY;
    totalFundsValue += valueTRY;

    const grp = groups.find(g => g.id === acc.groupId);

    return {
      account: acc,
      symbol,
      name: acc.name,
      groupName: grp?.name,
      groupColor: grp?.color,
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

  // Calculate ratio %
  for (const item of fundData) {
    item.ratioPct = totalFundsValue > 0 ? (item.valueTRY / totalFundsValue) * 100 : 0;
  }

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
  });

  // Sync inputs
  const handleQtyChange = (qVal: string) => {
    setQuantity(qVal);
    const q = parseFloat(qVal.replace(',', '.'));
    const u = parseFloat(unitPrice.replace(',', '.'));
    if (!isNaN(q) && !isNaN(u) && q > 0) {
      setTotalTRY((q * u).toFixed(2));
    }
  };

  const handleUnitPriceChange = (uVal: string) => {
    setUnitPrice(uVal);
    const q = parseFloat(quantity.replace(',', '.'));
    const u = parseFloat(uVal.replace(',', '.'));
    if (!isNaN(q) && !isNaN(u) && q > 0) {
      setTotalTRY((q * u).toFixed(2));
    }
  };

  const handleTotalTRYChange = (tVal: string) => {
    setTotalTRY(tVal);
    const q = parseFloat(quantity.replace(',', '.'));
    const t = parseFloat(tVal.replace(',', '.'));
    if (!isNaN(q) && !isNaN(t) && q > 0) {
      setUnitPrice((t / q).toFixed(4));
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
          setUnitPrice(matched.estimatedPrice.toString());
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

  const handleSaveTransaction = async () => {
    let targetAccId = selectedAccountId;

    if (isCreatingNewFund) {
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
      const p = parseFloat(unitPrice.replace(',', '.')) || 10;
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

    const q = parseFloat(quantity.replace(',', '.'));
    const t = parseFloat(totalTRY.replace(',', '.'));
    const u = parseFloat(unitPrice.replace(',', '.')) || (t / q);

    if (isNaN(q) || q <= 0 || isNaN(t) || t <= 0) return;

    const dateObj = new Date(txDate);
    const newTx: AssetTransaction = {
      id: `tx-${Date.now()}`,
      accountId: targetAccId,
      groupId: targetGroupId,
      date: txDate,
      year: dateObj.getFullYear(),
      month: dateObj.getMonth() + 1,
      type: 'BUY',
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

  const handleDeleteFund = async (accId: string) => {
    if (window.confirm('Bu fonu ve geçmiş tüm alımlarını silmek istediğinize emin misiniz?')) {
      await db.accounts.delete(accId);
      const txs = transactions.filter(t => t.accountId === accId);
      for (const t of txs) {
        await db.transactions.delete(t.id);
      }
    }
  };

  const chartColors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

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
            TEFAS yatırım fonları kâr/zarar oranları ve portföy ağırlıkları
          </p>
        </div>

        <button
          onClick={() => {
            if (matchingFundAccounts.length > 0) setSelectedAccountId(matchingFundAccounts[0].id);
            else setIsCreatingNewFund(true);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Fon Alımı Ekle</span>
        </button>
      </div>

      {/* Group Filter Bar */}
      <GroupFilterBar
        groups={groups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={setSelectedGroupId}
        title="Hesap Grubu"
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
            <ArrowUpRight className="w-5 h-5" />
            <span>%{formatNumber(totalFundsProfitPct, 2)}</span>
          </div>
          <span className="text-[10px] text-slate-500">Yüzdesel Getiri</span>
        </div>
      </div>

      {/* DETAILED FUNDS TABLE */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/80 border-b border-white/10 text-slate-400 font-semibold">
              <th className="py-3 px-4 min-w-[150px]">Fon Adı / Kodu</th>
              <th className="py-3 px-2.5 text-left">Grup</th>
              <th className="py-3 px-3 text-right">Portföy Oranı</th>
              <th className="py-3 px-3 text-right">Maliyet (TL)</th>
              <th className="py-3 px-3 text-right">Değer (TL)</th>
              <th className="py-3 px-3 text-right">Kâr / Zarar (TL)</th>
              <th className="py-3 px-3 text-right">Kâr / Zarar (%)</th>
              <th className="py-3 px-2 text-center w-10">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {fundData.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-slate-400 font-sans text-xs">
                  Bu grupta kayıtlı fon bulunmuyor.
                </td>
              </tr>
            ) : (
              fundData.map((f) => (
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
                    {f.groupName && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded font-semibold"
                        style={{ backgroundColor: `${f.groupColor}20`, color: f.groupColor }}
                      >
                        {f.groupName}
                      </span>
                    )}
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
                      onClick={() => handleDeleteFund(f.account.id)}
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

      {/* CHARTS */}
      {fundData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 space-y-3">
            <span className="text-xs font-bold text-slate-300">Fon Güncel Değerleri (TL)</span>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fundData}>
                  <XAxis dataKey="symbol" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(val: any) => [formatTRY(Number(val) || 0, hideValues), 'Değer']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Bar dataKey="valueTRY" radius={[6, 6, 0, 0]}>
                    {fundData.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 space-y-3">
            <span className="text-xs font-bold text-slate-300">Kâr / Zarar (TL) Karşılaştırması</span>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fundData}>
                  <XAxis dataKey="symbol" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(val: any) => [formatTRY(Number(val) || 0, hideValues), 'Kâr']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Bar dataKey="profitLossTRY" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTION HISTORY WITH DATE FILTERS */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-emerald-400" />
            <span>Fon Alış & Hareket Geçmişi</span>
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
          <p className="text-xs text-slate-400 py-3 text-center">Bu filtreye uygun fon işlemi bulunamadı.</p>
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
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-500/15 text-emerald-400 font-mono">
                      {acc?.symbol || 'FON'}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-200 font-medium">
                          {formatNumber(tx.quantity, 0, hideValues)} Adet
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
                      onClick={() => db.transactions.delete(tx.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
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

      {/* ADD TRANSACTION MODAL WITH TEFAS AUTO-COMPLETE */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Yatırım Fonu Alımı Ekle"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Hangi Gruba Ait?</label>
            <select
              value={targetGroupId}
              onChange={(e) => setTargetGroupId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-400">Yatırım Fonu</label>
            <button
              type="button"
              onClick={() => setIsCreatingNewFund(!isCreatingNewFund)}
              className="text-xs text-amber-400 font-semibold hover:underline"
            >
              {isCreatingNewFund ? 'Mevcut Fonlardan Seç' : '+ Yeni Fon Kodu Ekle'}
            </button>
          </div>

          {isCreatingNewFund ? (
            <div className="space-y-2 relative">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="block text-xs text-slate-400 mb-1">
                    Fon Kodu (TEFAS)
                  </label>
                  <input
                    type="text"
                    value={newFundCode}
                    onChange={(e) => handleFundCodeChange(e.target.value)}
                    placeholder="Örn: MAC, TI2, AFT..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono uppercase text-sm focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Fon Adı</label>
                  <input
                    type="text"
                    value={newFundName}
                    onChange={(e) => setNewFundName(e.target.value)}
                    placeholder="Otomatik gelir veya yazın"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* TEFAS Autocomplete Suggestions Dropdown */}
              {fundSuggestions.length > 0 && (
                <div className="absolute top-16 left-0 right-0 z-50 rounded-xl bg-slate-900 border border-amber-500/30 shadow-2xl p-1.5 space-y-1">
                  <span className="text-[10px] text-amber-400 font-semibold px-2 block flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Önerilen TEFAS Fonları:</span>
                  </span>
                  {fundSuggestions.map((s) => (
                    <div
                      key={s.code}
                      onClick={() => handleSelectSuggestion(s.code, s.name)}
                      className="px-2.5 py-1.5 rounded-lg hover:bg-white/10 cursor-pointer flex items-center justify-between text-xs"
                    >
                      <span className="font-mono font-bold text-amber-400">{s.code}</span>
                      <span className="text-slate-300 truncate max-w-[220px] text-[11px]">{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none"
            >
              {matchingFundAccounts.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.symbol} — {f.name}
                </option>
              ))}
            </select>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Adet / Pay</label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => handleQtyChange(e.target.value)}
                placeholder="Örn: 1000"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Birim Pay Fiyatı (TL)</label>
              <input
                type="text"
                value={unitPrice}
                onChange={(e) => handleUnitPriceChange(e.target.value)}
                placeholder="Örn: 15.42"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Toplam Alış Tutarı (TL)</label>
            <input
              type="text"
              value={totalTRY}
              onChange={(e) => handleTotalTRYChange(e.target.value)}
              placeholder="Örn: 15420.00"
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
                placeholder="Örn: Portföy eklemesi"
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
              Fon Alımını Kaydet
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
