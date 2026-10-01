import React, { useState } from 'react';
import { Plus, Coins, ArrowUpRight, ArrowDownRight, History, Trash2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { db } from '../../db/db';
import { formatTRY, formatNumber } from '../../services/portfolioService';
import type { Account, AssetTransaction, MarketRate } from '../../types/finance';

interface GoldTrackerProps {
  accounts: Account[];
  transactions: AssetTransaction[];
  rates: MarketRate[];
  hideValues: boolean;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export const GoldTracker: React.FC<GoldTrackerProps> = ({
  accounts,
  transactions,
  rates,
  hideValues
}) => {
  const currentYear = 2026;
  const [activeGoldType, setActiveGoldType] = useState<'GRAM' | 'CEYREK'>('GRAM');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Transaction Form
  const [txType, setTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('');
  const [totalTRY, setTotalTRY] = useState('');
  const [unitTRY, setUnitTRY] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  // Find corresponding accounts
  const gramAccount = accounts.find(a => a.subType === 'GOLD_GRAM');
  const ceyrekAccount = accounts.find(a => a.subType === 'GOLD_PIECE');
  const currentAccount = activeGoldType === 'GRAM' ? gramAccount : ceyrekAccount;

  // Rates
  const gramRate = rates.find(r => r.symbol === 'XAU_GR')?.rateTRY || 6561.65;
  const ceyrekRate = rates.find(r => r.symbol === 'XAU_CEYREK')?.rateTRY || 10738.00;
  const currentRate = activeGoldType === 'GRAM' ? gramRate : ceyrekRate;

  // Filter transactions for this asset
  const assetTxs = currentAccount ? transactions.filter(t => t.accountId === currentAccount.id) : [];

  // Monthly aggregates for 2026 (Months 1-12)
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const mtx = assetTxs.filter(t => t.year === currentYear && t.month === month);
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

  // Overall totals
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

  // Handle auto-calc of unit or total price
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

  const handleSaveTransaction = async () => {
    if (!currentAccount) return;
    const q = parseFloat(quantity.replace(',', '.'));
    const t = parseFloat(totalTRY.replace(',', '.'));
    const u = parseFloat(unitTRY.replace(',', '.')) || (t / q);

    if (isNaN(q) || q <= 0 || isNaN(t) || t <= 0) return;

    const dateObj = new Date(txDate);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;

    const newTx: AssetTransaction = {
      id: `tx-${Date.now()}`,
      accountId: currentAccount.id,
      date: txDate,
      year,
      month,
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

  const handleDeleteTx = async (id: string) => {
    await db.transactions.delete(id);
  };

  return (
    <div className="space-y-4">
      {/* Switcher & Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex p-1 rounded-xl bg-slate-900 border border-white/5">
          <button
            onClick={() => setActiveGoldType('GRAM')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeGoldType === 'GRAM' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Gram Altın (gr)</span>
          </button>
          <button
            onClick={() => setActiveGoldType('CEYREK')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              activeGoldType === 'CEYREK' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Çeyrek Altın (Adet)</span>
          </button>
        </div>

        <button
          onClick={() => {
            setUnitTRY(currentRate.toString());
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Alış / Satış Ekle</span>
        </button>
      </div>

      {/* METRIC HEADER (Image 2 & 3 Exact Layout) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-4 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg">
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">
            {activeGoldType === 'GRAM' ? 'Altın Değer' : 'Çeyrek Altın Değer'}
          </span>
          <span className="text-base sm:text-lg font-bold text-white mt-1 font-mono">
            {formatTRY(currentValueTRY, hideValues)}
          </span>
          <span className="text-[10px] text-slate-500">
            {formatNumber(currentHoldingQty, activeGoldType === 'GRAM' ? 2 : 0, hideValues)} {activeGoldType === 'GRAM' ? 'gr' : 'adet'}
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
          <span className="text-[10px] text-slate-500">Yüzdesel Getiri</span>
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

      {/* MONTHLY BREAKDOWN TABLE (Image 2 & 3 Table Replica) */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/80 border-b border-white/10 text-slate-400 font-semibold">
              <th className="py-2.5 px-3 min-w-[130px] sticky left-0 z-20 bg-slate-950/95 border-r border-white/10">
                Ay / Metrik ({currentYear})
              </th>
              {monthlyData.map((d) => (
                <th key={d.month} className="py-2.5 px-2.5 min-w-[85px] text-right font-medium">
                  {MONTH_NAMES[d.month - 1]}
                </th>
              ))}
              <th className="py-2.5 px-3 min-w-[100px] text-right font-bold text-amber-400 bg-slate-950/95">
                Genel Toplam
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {/* Row 1: SUM / Miktar */}
            <tr className="hover:bg-white/[0.02]">
              <td className="py-2 px-3 text-slate-300 font-sans font-medium sticky left-0 z-10 bg-slate-900/95 border-r border-white/10">
                SUM / {activeGoldType === 'GRAM' ? 'Miktar (gr)' : 'Adet'}
              </td>
              {monthlyData.map((d) => (
                <td key={d.month} className="py-2 px-2.5 text-right text-slate-300">
                  {d.qty > 0 ? formatNumber(d.qty, activeGoldType === 'GRAM' ? 2 : 0, hideValues) : '0,00'}
                </td>
              ))}
              <td className="py-2 px-3 text-right font-bold text-amber-300 bg-slate-900/90">
                {formatNumber(currentHoldingQty, activeGoldType === 'GRAM' ? 2 : 0, hideValues)}
              </td>
            </tr>

            {/* Row 2: SUM / Tutar */}
            <tr className="hover:bg-white/[0.02]">
              <td className="py-2 px-3 text-slate-300 font-sans font-medium sticky left-0 z-10 bg-slate-900/95 border-r border-white/10">
                SUM / Tutar (TL)
              </td>
              {monthlyData.map((d) => (
                <td key={d.month} className="py-2 px-2.5 text-right text-slate-300">
                  {d.cost > 0 ? formatNumber(d.cost, 2, hideValues) : '0,00'}
                </td>
              ))}
              <td className="py-2 px-3 text-right font-bold text-amber-300 bg-slate-900/90">
                {formatNumber(totalCostTRY, 2, hideValues)}
              </td>
            </tr>

            {/* Row 3: Ortalama Maliyetler */}
            <tr className="bg-amber-500/5 font-semibold text-amber-200">
              <td className="py-2 px-3 font-sans sticky left-0 z-10 bg-slate-950/95 border-r border-white/10">
                Ortalama Maliyetler
              </td>
              {monthlyData.map((d) => (
                <td key={d.month} className="py-2 px-2.5 text-right">
                  {d.avgCost > 0 ? formatNumber(d.avgCost, 2, hideValues) : '0,00'}
                </td>
              ))}
              <td className="py-2 px-3 text-right font-bold text-amber-400 bg-slate-950/95">
                {formatNumber(avgUnitCost, 2, hideValues)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TRANSACTION HISTORY */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Alış & Satış Hareket Geçmişi</span>
          </h4>
          <span className="text-[11px] text-slate-500">{assetTxs.length} İşlem</span>
        </div>

        {assetTxs.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">Henüz kayıtlı işlem yok.</p>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {assetTxs.map((tx) => (
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
                    <span className="text-slate-200 font-medium">
                      {formatNumber(tx.quantity, activeGoldType === 'GRAM' ? 2 : 0, hideValues)} {activeGoldType === 'GRAM' ? 'gr' : 'adet'}
                    </span>
                    <span className="text-slate-500 text-[10px] ml-1.5 font-mono">
                      @ {formatTRY(tx.unitPriceTRY, hideValues)}
                    </span>
                    {tx.note && <span className="text-slate-400 text-[11px] ml-2">({tx.note})</span>}
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
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ADD TRANSACTION MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={activeGoldType === 'GRAM' ? 'Gram Altın İşlemi Ekle' : 'Çeyrek Altın İşlemi Ekle'}
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
              Alış
            </button>
            <button
              type="button"
              onClick={() => setTxType('SELL')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                txType === 'SELL' ? 'bg-rose-500 text-white' : 'text-slate-400'
              }`}
            >
              Satış / Bozdurma
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {activeGoldType === 'GRAM' ? 'Miktar (Gram)' : 'Adet'}
              </label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder="Örn: 4.31"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Birim Fiyat (TL)</label>
              <input
                type="text"
                value={unitTRY}
                onChange={(e) => handleUnitChange(e.target.value)}
                placeholder="Örn: 6561.65"
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
              placeholder="Örn: 29373.38"
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
                placeholder="Örn: Nisan kuyumcu alımı"
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
    </div>
  );
};
