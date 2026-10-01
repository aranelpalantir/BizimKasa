import React, { useState } from 'react';
import { Plus, ArrowUpRight, Trash2 } from 'lucide-react';
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
import { db } from '../../db/db';
import { formatTRY, formatNumber } from '../../services/portfolioService';
import type { Account, AssetTransaction, MarketRate } from '../../types/finance';

interface FundsTrackerProps {
  accounts: Account[];
  transactions: AssetTransaction[];
  rates: MarketRate[];
  hideValues: boolean;
}

export const FundsTracker: React.FC<FundsTrackerProps> = ({
  accounts,
  transactions,
  rates,
  hideValues
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [newFundCode, setNewFundCode] = useState('');
  const [newFundName, setNewFundName] = useState('');
  const [isCreatingNewFund, setIsCreatingNewFund] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [totalTRY, setTotalTRY] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  // Fund accounts
  const fundAccounts = accounts.filter(a => a.subType === 'FUND' || a.subType === 'STOCK');

  // Rate lookup map
  const rateMap = new Map<string, number>();
  for (const r of rates) {
    rateMap.set(r.symbol, r.rateTRY);
  }

  // Calculate detailed metrics for each fund
  let totalFundsCost = 0;
  let totalFundsValue = 0;

  const fundData = fundAccounts.map((acc) => {
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

    return {
      account: acc,
      symbol,
      name: acc.name,
      netQty,
      avgCost,
      costTRY,
      currentRate,
      valueTRY,
      profitLossTRY,
      profitLossPct,
      ratioPct: 0 // Will compute below
    };
  });

  // Calculate ratio %
  for (const item of fundData) {
    item.ratioPct = totalFundsValue > 0 ? (item.valueTRY / totalFundsValue) * 100 : 0;
  }

  const totalFundsProfitLoss = totalFundsValue - totalFundsCost;
  const totalFundsProfitPct = totalFundsCost > 0 ? (totalFundsProfitLoss / totalFundsCost) * 100 : 0;

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

  const handleSaveTransaction = async () => {
    let targetAccId = selectedAccountId;

    // Create new account if requested
    if (isCreatingNewFund) {
      if (!newFundCode.trim()) return;
      const code = newFundCode.trim().toUpperCase();
      const newAcc: Account = {
        id: `acc-fund-${Date.now()}`,
        groupId: 'group-ortak',
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

      // Add default market rate for this fund
      const p = parseFloat(unitPrice.replace(',', '.')) || 10;
      await db.marketRates.put({
        symbol: code,
        name: newAcc.name,
        category: 'FUND',
        rateTRY: p,
        changeDailyPct: 0.5,
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

  const chartColors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899'];

  return (
    <div className="space-y-4">
      {/* Top Header & Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>TEFAS Fonları & Borsa Portföyü</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {fundAccounts.length} Fon
            </span>
          </h3>
          <p className="text-xs text-slate-400">TTE, GSP, DVT vb. yatırım fonları kâr/zarar ve portföy ağırlıkları</p>
        </div>

        <button
          onClick={() => {
            if (fundAccounts.length > 0) setSelectedAccountId(fundAccounts[0].id);
            else setIsCreatingNewFund(true);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Fon Alımı Ekle</span>
        </button>
      </div>

      {/* SUMMARY TOTALS (Image 5 Replica) */}
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
          <span className="text-lg sm:text-xl font-extrabold text-emerald-400 mt-1 font-mono">
            +{formatTRY(totalFundsProfitLoss, hideValues)}
          </span>
          <span className="text-[10px] text-slate-500">Toplam Kazanç</span>
        </div>

        <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-2.5">
          <span className="text-[11px] font-semibold text-emerald-400 uppercase">Kâr Oranı</span>
          <div className="flex items-center gap-1 text-lg sm:text-xl font-extrabold text-emerald-400 mt-1 font-mono">
            <ArrowUpRight className="w-5 h-5" />
            <span>%{formatNumber(totalFundsProfitPct, 2)}</span>
          </div>
          <span className="text-[10px] text-slate-500">Yüzdesel Getiri</span>
        </div>
      </div>

      {/* DETAILED FUNDS TABLE (Image 5 Exact Columns) */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/80 border-b border-white/10 text-slate-400 font-semibold">
              <th className="py-3 px-4 min-w-[140px]">Fon Adı / Kodu</th>
              <th className="py-3 px-3 text-right">Portföy Oranı</th>
              <th className="py-3 px-3 text-right">Maliyet (TL)</th>
              <th className="py-3 px-3 text-right">Değer (TL)</th>
              <th className="py-3 px-3 text-right">Kâr / Zarar (TL)</th>
              <th className="py-3 px-3 text-right">Kâr / Zarar (%)</th>
              <th className="py-3 px-2 text-center w-10">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {fundData.map((f) => (
              <tr key={f.account.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-4 font-sans">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold font-mono border border-emerald-500/20 text-xs">
                      {f.symbol}
                    </span>
                    <span className="font-semibold text-slate-200 truncate max-w-[150px]">{f.name}</span>
                  </div>
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
                <td className="py-3 px-3 text-right font-bold text-emerald-400">
                  +{formatTRY(f.profitLossTRY, hideValues)}
                </td>
                <td className="py-3 px-3 text-right font-bold text-emerald-400">
                  +%{formatNumber(f.profitLossPct, 2)}
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
            ))}
          </tbody>
        </table>
      </div>

      {/* VISUAL CHARTS (Image 5 Bar Charts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Value Chart */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 space-y-3">
          <span className="text-xs font-bold text-slate-300">Değer (TL) Karşılaştırması</span>
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

        {/* Profit Chart */}
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

      {/* ADD TRANSACTION MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Fon Alımı Ekle"
      >
        <div className="space-y-4">
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fon Kodu</label>
                <input
                  type="text"
                  value={newFundCode}
                  onChange={(e) => setNewFundCode(e.target.value.toUpperCase())}
                  placeholder="Örn: TTE, GSP, DVT"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono uppercase text-sm focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fon Adı</label>
                <input
                  type="text"
                  value={newFundName}
                  onChange={(e) => setNewFundName(e.target.value)}
                  placeholder="Örn: BIST Teknoloji"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          ) : (
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none"
            >
              {fundAccounts.map((f) => (
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
                placeholder="Örn: 12.2328"
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
              placeholder="Örn: 12232.80"
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
              Fon Alımını Kaydet
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
