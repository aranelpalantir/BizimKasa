import React, { useState } from 'react';
import { Plus, Euro, DollarSign, History, Trash2 } from 'lucide-react';
import { Modal } from '../common/Modal';
import { db } from '../../db/db';
import { formatTRY, formatNumber } from '../../services/portfolioService';
import type { Account, AssetTransaction, MarketRate } from '../../types/finance';

interface CurrencyTrackerProps {
  accounts: Account[];
  transactions: AssetTransaction[];
  rates: MarketRate[];
  hideValues: boolean;
}

const MONTH_NAMES = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'
];

const YEARS = [2023, 2024, 2025, 2026];

export const CurrencyTracker: React.FC<CurrencyTrackerProps> = ({
  accounts,
  transactions,
  rates,
  hideValues
}) => {
  const [selectedCurrency, setSelectedCurrency] = useState<'EUR' | 'USD'>('EUR');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [txType, setTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [amount, setAmount] = useState('');
  const [rateVal, setRateVal] = useState('');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');

  // Account
  const eurAccount = accounts.find(a => a.subType === 'CURRENCY' && a.symbol === 'EUR');
  const usdAccount = accounts.find(a => a.subType === 'CURRENCY' && a.symbol === 'USD');
  const currentAccount = selectedCurrency === 'EUR' ? eurAccount : usdAccount;

  // Live Rates
  const eurRate = rates.find(r => r.symbol === 'EUR')?.rateTRY || 55.24;
  const usdRate = rates.find(r => r.symbol === 'USD')?.rateTRY || 49.03;
  const currentLiveRate = selectedCurrency === 'EUR' ? eurRate : usdRate;

  // Transactions
  const assetTxs = currentAccount ? transactions.filter(t => t.accountId === currentAccount.id) : [];

  // Calculate Net Holdings
  let totalNetUnits = 0;
  for (const t of assetTxs) {
    if (t.type === 'BUY') {
      totalNetUnits += t.quantity;
    } else {
      totalNetUnits -= t.quantity;
    }
  }

  const currentTRYValue = totalNetUnits * currentLiveRate;

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
    for (const y of YEARS) {
      net += getMatrixCell(y, month);
    }
    return net;
  };

  const handleSaveTransaction = async () => {
    if (!currentAccount) return;
    const q = parseFloat(amount.replace(',', '.'));
    const r = parseFloat(rateVal.replace(',', '.')) || currentLiveRate;
    if (isNaN(q) || q <= 0) return;

    const dateObj = new Date(txDate);
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const totalTRY = q * r;

    const newTx: AssetTransaction = {
      id: `tx-${Date.now()}`,
      accountId: currentAccount.id,
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

  const handleDeleteTx = async (id: string) => {
    await db.transactions.delete(id);
  };

  return (
    <div className="space-y-4">
      {/* Switcher & Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex p-1 rounded-xl bg-slate-900 border border-white/5">
          <button
            onClick={() => setSelectedCurrency('EUR')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              selectedCurrency === 'EUR' ? 'bg-indigo-500 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Euro className="w-3.5 h-3.5" />
            <span>Euro (EUR)</span>
          </button>
          <button
            onClick={() => setSelectedCurrency('USD')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              selectedCurrency === 'USD' ? 'bg-blue-500 text-white font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Dolar (USD)</span>
          </button>
        </div>

        <button
          onClick={() => {
            setRateVal(currentLiveRate.toString());
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>Döviz Al / Sat</span>
        </button>
      </div>

      {/* METRIC HEADER (Image 4 Replica) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg">
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">
            {selectedCurrency === 'EUR' ? 'EURO Toplam Değer' : 'USD Toplam Değer'}
          </span>
          <span className="text-xl sm:text-2xl font-extrabold text-white mt-1 font-mono">
            {formatTRY(currentTRYValue, hideValues)}
          </span>
          <span className="text-xs text-slate-500 mt-0.5">
            Canlı Kur: 1 {selectedCurrency} = {formatNumber(currentLiveRate, 2)} ₺
          </span>
        </div>

        <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Döviz Bakiyesi</span>
          <span className="text-xl sm:text-2xl font-extrabold text-indigo-300 mt-1 font-mono">
            {hideValues ? '••••' : `${formatNumber(totalNetUnits, 2)} ${selectedCurrency}`}
          </span>
          <span className="text-xs text-slate-500 mt-0.5">Kümülatif Net Varlık</span>
        </div>

        <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0 sm:pl-3">
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Hareket Sayısı</span>
          <span className="text-xl sm:text-2xl font-extrabold text-slate-200 mt-1 font-mono">
            {assetTxs.length}
          </span>
          <span className="text-xs text-slate-500 mt-0.5">Kayıtlı Alış / Çıkış</span>
        </div>
      </div>

      {/* MULTI-YEAR MONTHLY MATRIX TABLE (Image 4 Exact Layout) */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 shadow-xl">
        <div className="p-3 bg-slate-950/80 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-200">
            {selectedCurrency} Miktar & Hareket Matrisi (Giriş / Çıkış)
          </span>
          <span className="text-[10px] text-slate-400">Eksi değerler harcanan dövizi temsil eder</span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/90 border-b border-white/10 text-slate-400 font-semibold">
              <th className="py-2.5 px-3 min-w-[70px] sticky left-0 z-20 bg-slate-950/95 border-r border-white/10">
                Yıl
              </th>
              {MONTH_NAMES.map((m, idx) => (
                <th key={idx} className="py-2.5 px-2 min-w-[65px] text-right font-medium">
                  {m}
                </th>
              ))}
              <th className="py-2.5 px-3 min-w-[90px] text-right font-bold text-indigo-400 bg-slate-950/95">
                Genel Toplam
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-mono">
            {YEARS.map((year) => {
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

            {/* Bottom Total Row (Genel Toplam Across All Years) */}
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

      {/* RECENT CURRENCY MOVEMENTS */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span>{selectedCurrency} Alış ve Çıkış Hareketleri</span>
          </h4>
          <span className="text-[11px] text-slate-500">{assetTxs.length} Kayıt</span>
        </div>

        {assetTxs.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">Kayıtlı döviz hareketi bulunmuyor.</p>
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
                    {tx.type === 'BUY' ? 'GİRİŞ / ALIŞ' : 'ÇIKIŞ / BOZDURMA'}
                  </span>
                  <div>
                    <span className="text-slate-200 font-medium">
                      {formatNumber(tx.quantity, 2, hideValues)} {selectedCurrency}
                    </span>
                    <span className="text-slate-500 text-[10px] ml-1.5 font-mono">
                      @ {formatNumber(tx.unitPriceTRY, 2, hideValues)} ₺
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

      {/* ADD CURRENCY TRANSACTION MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${selectedCurrency} Hareketi Ekle`}
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
              Giriş / Alış (+)
            </button>
            <button
              type="button"
              onClick={() => setTxType('SELL')}
              className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                txType === 'SELL' ? 'bg-rose-500 text-white' : 'text-slate-400'
              }`}
            >
              Çıkış / Harcama (-)
            </button>
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
                placeholder="Örn: 250"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Kur (TL)</label>
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
              <label className="block text-xs font-medium text-slate-400 mb-1">Tarih</label>
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
                placeholder="Örn: Tatil harcaması"
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
