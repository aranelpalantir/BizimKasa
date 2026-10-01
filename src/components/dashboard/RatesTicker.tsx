import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  RotateCcw, 
  RefreshCw, 
  History, 
  Coins, 
  Euro, 
  LineChart, 
  Layers, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { 
  saveOrUpdateRate, 
  resetManualRate, 
  fetchLiveRatesMultiSource, 
  getSymbolRateHistory 
} from '../../services/ratesService';
import { formatNumber } from '../../services/portfolioService';
import type { MarketRate, MarketRateHistoryRecord } from '../../types/finance';

interface RatesTickerProps {
  rates: MarketRate[];
}

export const RatesTicker: React.FC<RatesTickerProps> = ({ rates }) => {
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'CURRENCY' | 'GOLD' | 'STOCK_INDEX' | 'FUND'>('ALL');
  const [selectedRate, setSelectedRate] = useState<MarketRate | null>(null);
  const [overrideValue, setOverrideValue] = useState<string>('');
  
  // Rate History state for modal
  const [activeModalTab, setActiveModalTab] = useState<'edit' | 'history'>('edit');
  const [historyRecords, setHistoryRecords] = useState<MarketRateHistoryRecord[]>([]);
  const [newHistDate, setNewHistDate] = useState(new Date().toISOString().split('T')[0]);
  const [newHistRate, setNewHistRate] = useState('');

  // Status & loading
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const categories = [
    { id: 'ALL' as const, label: 'Tümü', icon: Layers },
    { id: 'CURRENCY' as const, label: 'Döviz', icon: Euro },
    { id: 'GOLD' as const, label: 'Altın & Emtia', icon: Coins },
    { id: 'STOCK_INDEX' as const, label: 'Borsa', icon: LineChart },
    { id: 'FUND' as const, label: 'TEFAS Fonları', icon: LineChart },
  ];

  const filteredRates = activeCategory === 'ALL'
    ? rates
    : rates.filter(r => r.category === activeCategory);

  const handleOpenModal = async (rate: MarketRate) => {
    setSelectedRate(rate);
    setOverrideValue(rate.rateTRY.toString());
    setActiveModalTab('edit');
    const hist = await getSymbolRateHistory(rate.symbol, 10);
    setHistoryRecords(hist);
  };

  const handleMultiSourceFetch = async () => {
    setIsUpdating(true);
    setStatusMessage(null);
    try {
      const res = await fetchLiveRatesMultiSource();
      setStatusMessage({
        text: res.message,
        isError: !res.success
      });
    } catch {
      setStatusMessage({
        text: 'Kur sunucusuna erişilemedi. Kayıtlı son kurlar korunuyor.',
        isError: true
      });
    } finally {
      setIsUpdating(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleSaveOverride = async () => {
    if (!selectedRate) return;
    const val = parseFloat(overrideValue.replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      await saveOrUpdateRate(
        selectedRate.symbol,
        selectedRate.name,
        selectedRate.category,
        val,
        'Manuel Giriş',
        todayStr,
        new Date().toISOString(),
        true
      );
      setSelectedRate(null);
    }
  };

  const handleResetToLive = async () => {
    if (!selectedRate) return;
    await resetManualRate(selectedRate.symbol);
    setSelectedRate(null);
  };

  const handleAddOrUpdateHistoryRecord = async () => {
    if (!selectedRate) return;
    const val = parseFloat(newHistRate.replace(',', '.'));
    if (!isNaN(val) && val > 0 && newHistDate) {
      await saveOrUpdateRate(
        selectedRate.symbol,
        selectedRate.name,
        selectedRate.category,
        val,
        'Manuel Tarihçe',
        newHistDate,
        new Date().toISOString(),
        true
      );
      const updatedHist = await getSymbolRateHistory(selectedRate.symbol, 10);
      setHistoryRecords(updatedHist);
      setNewHistRate('');
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Category Tabs & Multi-Source Update Action */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex p-0.5 rounded-xl bg-slate-900 border border-white/5 overflow-x-auto no-scrollbar">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleMultiSourceFetch}
          disabled={isUpdating}
          className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-white/10 transition-colors shadow-sm active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isUpdating ? 'animate-spin' : ''}`} />
          <span>{isUpdating ? 'Kurlar Alınıyor...' : 'Piyasayı Güncelle'}</span>
        </button>
      </div>

      {/* Status Feedback Toast */}
      {statusMessage && (
        <div className={`p-2 px-3 rounded-xl flex items-center gap-2 text-xs font-medium border transition-all ${
          statusMessage.isError
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
        }`}>
          {statusMessage.isError ? <AlertCircle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Horizontal Rate Cards */}
      <div className="flex gap-2 overflow-x-auto pb-2 pt-0.5 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {filteredRates.map((rate) => {
          const isUp = rate.changeDailyPct >= 0;
          return (
            <button
              key={rate.symbol}
              onClick={() => handleOpenModal(rate)}
              className="flex-shrink-0 flex items-center gap-3 px-3 py-2 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-white/5 hover:border-white/15 transition-all text-left group"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                    {rate.symbol}
                  </span>
                  {rate.isManualOverride && (
                    <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30">
                      Özel
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 max-w-[100px] truncate">{rate.name}</span>
                <span className="text-[9px] text-slate-500 font-mono mt-0.5">
                  {rate.dataDate || 'Bugün'} • {rate.source}
                </span>
              </div>

              <div className="flex flex-col items-end pl-2 border-l border-white/5">
                <span className="text-xs font-semibold text-slate-200 font-mono">
                  {formatNumber(rate.rateTRY, rate.rateTRY > 100 ? 2 : 4)} ₺
                </span>
                <div className={`flex items-center text-[10px] font-medium font-mono ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isUp ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                  <span>%{formatNumber(Math.abs(rate.changeDailyPct), 2)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal: Kur Düzenleme & Son 10 Günün Tarihçesi */}
      <Modal
        isOpen={!!selectedRate}
        onClose={() => setSelectedRate(null)}
        title={selectedRate ? `${selectedRate.name} (${selectedRate.symbol})` : ''}
      >
        {selectedRate && (
          <div className="space-y-4">
            {/* Modal Tabs */}
            <div className="flex p-1 rounded-xl bg-slate-950 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveModalTab('edit')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeModalTab === 'edit' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                Güncel Kur & Özel Makas
              </button>
              <button
                type="button"
                onClick={() => setActiveModalTab('history')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${
                  activeModalTab === 'history' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Son 10 Gün Tarihçesi</span>
              </button>
            </div>

            {/* TAB 1: Edit Rate */}
            {activeModalTab === 'edit' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1 text-xs text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mevcut Kaynak:</span>
                    <span className="font-medium text-slate-200">{selectedRate.source}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Veri Tarihi:</span>
                    <span className="font-mono text-slate-200">{selectedRate.dataDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Son Güncelleme:</span>
                    <span className="font-mono text-slate-200">{new Date(selectedRate.updatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Güncel TL Fiyatı (₺)
                  </label>
                  <input
                    type="text"
                    value={overrideValue}
                    onChange={(e) => setOverrideValue(e.target.value)}
                    placeholder="Örn: 6561.65"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono font-bold text-base focus:outline-none focus:border-amber-400 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Kapalıçarşı veya banka makasını yansıtmak için elle değer girebilirsiniz.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  {selectedRate.isManualOverride && (
                    <button
                      type="button"
                      onClick={handleResetToLive}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Canlı Kura Sıfırla</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveOverride}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-amber-500/20"
                  >
                    Kaydet
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: History (Son 10 Gün) */}
            {activeModalTab === 'history' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Kayıtlı Son 10 Günlük Fiyat Geçmişi</span>
                  <span className="font-mono">{historyRecords.length} gün</span>
                </div>

                {/* History Table */}
                <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-slate-950">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-500 bg-slate-900/50">
                        <th className="py-2 px-3">Tarih</th>
                        <th className="py-2 px-3 text-right">Fiyat (TL)</th>
                        <th className="py-2 px-3 text-right">Kaynak</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {historyRecords.map((h) => (
                        <tr key={h.id} className="hover:bg-white/[0.02]">
                          <td className="py-1.5 px-3 text-slate-300">{h.date}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-white">
                            {formatNumber(h.rateTRY, h.rateTRY > 100 ? 2 : 4)} ₺
                          </td>
                          <td className="py-1.5 px-3 text-right text-[10px] text-slate-400 font-sans">
                            {h.source}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Manual Add / Edit Date Record */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-white/5 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-300 block">
                    + Belirli Bir Gün İçin Kur Gir / Düzelt
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={newHistDate}
                      onChange={(e) => setNewHistDate(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-xs"
                    />
                    <input
                      type="text"
                      value={newHistRate}
                      onChange={(e) => setNewHistRate(e.target.value)}
                      placeholder="Fiyat (TL)"
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white font-mono text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddOrUpdateHistoryRecord}
                    className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors border border-white/10"
                  >
                    Tarihçe Kaydını Ekle / Güncelle
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
