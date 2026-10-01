import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  RotateCcw, 
  Coins, 
  Euro, 
  LineChart, 
  Layers, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw as ResetIcon
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { 
  saveOrUpdateRate, 
  resetManualRate 
} from '../../services/ratesService';
import { formatNumber, formatForInput, parseUserInputNumber } from '../../services/portfolioService';
import type { MarketRate } from '../../types/finance';

interface RatesTickerProps {
  rates: MarketRate[];
}

export const DEFAULT_RATES_ORDER: string[] = [
  'USD',
  'EUR',
  'XAU_GR_BANK',
  'XAU_GR_PHYSICAL',
  'XAU_CEYREK',
  'XAU_YARIM',
  'XAU_TAM',
  'XAU_CUMHURIYET',
  'XAU_ONS',
  'XU100',
  'NASDAQ100',
  'TI2',
  'MAC',
  'AFT'
];

export function formatRateDisplay(symbol: string, rate: number): string {
  if (symbol === 'XAU_ONS') {
    return `$${formatNumber(rate, 2)}`;
  }
  if (symbol === 'NASDAQ100' || symbol === 'NDX') {
    return `${formatNumber(rate, 0)} P`;
  }
  if (symbol === 'XU100' || symbol === 'BIST100') {
    return `${formatNumber(rate, 0)} P`;
  }
  return `${formatNumber(rate, rate > 100 ? 2 : 4)} ₺`;
}

export function getRateUnitLabel(symbol: string): string {
  if (symbol === 'XAU_ONS') return 'Dolar ($)';
  if (symbol === 'NASDAQ100' || symbol === 'XU100') return 'Puan';
  return 'TL (₺)';
}

export const RatesTicker: React.FC<RatesTickerProps> = ({ rates }) => {
  const [activeCategory, setActiveCategory] = useState<'ALL' | 'CURRENCY' | 'GOLD' | 'STOCK_INDEX' | 'FUND'>('ALL');
  const [selectedRate, setSelectedRate] = useState<MarketRate | null>(null);
  const [overrideValue, setOverrideValue] = useState<string>('');
  const [isResetting, setIsResetting] = useState(false);
  
  // Custom manual order state
  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('bizimkasa_rates_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_RATES_ORDER;
  });

  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);

  // Synchronize new rates symbols into custom order if not present
  useEffect(() => {
    setCustomOrder(prev => {
      const existingSet = new Set(prev);
      const newSymbols = rates
        .map(r => r.symbol)
        .filter(s => s !== 'GBP' && s !== 'XAG' && !existingSet.has(s));
      if (newSymbols.length === 0) return prev;
      const updated = [...prev, ...newSymbols];
      try {
        localStorage.setItem('bizimkasa_rates_order', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, [rates]);

  const categories = [
    { id: 'ALL' as const, label: 'Tümü', icon: Layers },
    { id: 'CURRENCY' as const, label: 'Döviz', icon: Euro },
    { id: 'GOLD' as const, label: 'Altın', icon: Coins },
    { id: 'STOCK_INDEX' as const, label: 'Borsa', icon: LineChart },
    { id: 'FUND' as const, label: 'TEFAS Fonları', icon: LineChart },
  ];

  // Filter out GBP and XAG always, then apply category filter and custom sort
  const availableRates = rates.filter(r => r.symbol !== 'GBP' && r.symbol !== 'XAG');

  const filteredRates = (activeCategory === 'ALL'
    ? availableRates
    : availableRates.filter(r => r.category === activeCategory)
  ).slice().sort((a, b) => {
    const idxA = customOrder.indexOf(a.symbol);
    const idxB = customOrder.indexOf(b.symbol);
    const posA = idxA >= 0 ? idxA : 999;
    const posB = idxB >= 0 ? idxB : 999;
    return posA - posB;
  });

  // Rates available for reordering (sorted by current custom order)
  const allOrderableRates = availableRates.slice().sort((a, b) => {
    const idxA = customOrder.indexOf(a.symbol);
    const idxB = customOrder.indexOf(b.symbol);
    const posA = idxA >= 0 ? idxA : 999;
    const posB = idxB >= 0 ? idxB : 999;
    return posA - posB;
  });

  const handleOpenModal = (rate: MarketRate) => {
    setSelectedRate(rate);
    setOverrideValue(formatForInput(rate.rateTRY));
  };

  const handleSaveOverride = async () => {
    if (!selectedRate) return;
    const val = parseUserInputNumber(overrideValue);
    if (val > 0) {
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
    setIsResetting(true);
    try {
      await resetManualRate(selectedRate.symbol);
      setSelectedRate(null);
    } catch (err) {
      console.error('Reset to live failed:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Move item up or down in custom order
  const handleMoveOrderItem = (symbol: string, direction: -1 | 1) => {
    const currentList = allOrderableRates.map(r => r.symbol);
    const fromIndex = currentList.indexOf(symbol);
    if (fromIndex < 0) return;
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= currentList.length) return;

    const updated = [...currentList];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);

    setCustomOrder(updated);
    try {
      localStorage.setItem('bizimkasa_rates_order', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleResetOrderToDefault = () => {
    setCustomOrder(DEFAULT_RATES_ORDER);
    try {
      localStorage.setItem('bizimkasa_rates_order', JSON.stringify(DEFAULT_RATES_ORDER));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Category Tabs & Actions */}
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

        {/* Elle Sıralama Butonu */}
        <button
          onClick={() => setIsReorderModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-white/10 transition-colors shadow-sm active:scale-95 whitespace-nowrap"
          title="Piyasa kartlarının sıralamasını elle düzenle"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
          <span>Sırala</span>
        </button>
      </div>

      {/* Horizontal Rate Cards */}
      <div className="flex gap-2 overflow-x-auto pb-2 pt-0.5 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {filteredRates.map((rate) => {
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
                <span className="text-[10px] text-slate-400 max-w-[110px] truncate">{rate.name}</span>
                <span className="text-[9px] text-slate-500 font-mono mt-0.5">
                  {rate.dataDate || 'Bugün'} • {rate.source}
                </span>
              </div>

              <div className="flex flex-col items-end pl-2 border-l border-white/5">
                <span className="text-xs font-semibold text-slate-200 font-mono whitespace-nowrap">
                  {formatRateDisplay(rate.symbol, rate.rateTRY)}
                </span>
                <div className={`flex items-center text-[10px] font-medium font-mono ${
                  rate.changeDailyPct > 0 
                    ? 'text-emerald-400' 
                    : rate.changeDailyPct < 0 
                    ? 'text-rose-400' 
                    : 'text-slate-400'
                }`}>
                  {rate.changeDailyPct > 0 && <TrendingUp className="w-2.5 h-2.5 mr-0.5" />}
                  {rate.changeDailyPct < 0 && <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                  <span>
                    {rate.changeDailyPct > 0 ? '+' : rate.changeDailyPct < 0 ? '-' : ''}%{formatNumber(Math.abs(rate.changeDailyPct), 2)}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* MODAL 1: Kur Düzenleme (Sade & Anlık Değer Odaklı) */}
      <Modal
        isOpen={!!selectedRate}
        onClose={() => setSelectedRate(null)}
        title={selectedRate ? `${selectedRate.name} (${selectedRate.symbol})` : ''}
      >
        {selectedRate && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 space-y-1.5 text-xs text-slate-300">
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
                <span className="font-mono text-slate-200">
                  {new Date(selectedRate.updatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {selectedRate.isManualOverride && (
                <div className="flex justify-between pt-1 border-t border-white/5 text-amber-400 font-semibold text-[11px]">
                  <span>Durum:</span>
                  <span>Özel Manuel Fiyat Tanımlı</span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Güncel Değer ({getRateUnitLabel(selectedRate.symbol)})
              </label>
              <input
                type="text"
                value={overrideValue}
                onChange={(e) => setOverrideValue(e.target.value)}
                placeholder="Örn: 55.24"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono font-bold text-base focus:outline-none focus:border-amber-400 transition-colors"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Kapalıçarşı veya banka makasını yansıtmak için elle özel değer belirleyebilirsiniz.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              {selectedRate.isManualOverride && (
                <button
                  type="button"
                  onClick={handleResetToLive}
                  disabled={isResetting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
                  title="Manuel değeri silip piyasa canlı kuruna geri dön"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                  <span>{isResetting ? 'Canlı Kura Dönülüyor...' : 'Canlı Kura Sıfırla'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedRate(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Vazgeç
              </button>
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
      </Modal>

      {/* MODAL 2: Elle Kart Sıralaması Düzenleme */}
      <Modal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        title="Piyasa Kartları Sıralaması"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            Varlıkların ekrandaki görünüm sırasını yukarı ve aşağı ok butonlarıyla dilediğiniz gibi düzenleyebilirsiniz.
          </p>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-slate-950 divide-y divide-white/5">
            {allOrderableRates.map((rate, index) => {
              const isFirst = index === 0;
              const isLast = index === allOrderableRates.length - 1;
              return (
                <div 
                  key={rate.symbol}
                  className="flex items-center justify-between p-2.5 hover:bg-white/[0.02] text-xs transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-slate-500 text-[11px] w-4 text-center">
                      {index + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white font-mono">{rate.symbol}</span>
                        <span className="text-[10px] text-slate-400">({rate.name})</span>
                      </div>
                      <span className="text-[11px] font-mono text-amber-400 font-semibold">
                        {formatRateDisplay(rate.symbol, rate.rateTRY)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMoveOrderItem(rate.symbol, -1)}
                      disabled={isFirst}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-slate-900 text-slate-300 hover:text-white transition-colors"
                      title="Yukarı Taşı"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveOrderItem(rate.symbol, 1)}
                      disabled={isLast}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-slate-900 text-slate-300 hover:text-white transition-colors"
                      title="Aşağı Taşı"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={handleResetOrderToDefault}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              <ResetIcon className="w-3 h-3 text-slate-400" />
              <span>Varsayılana Sıfırla</span>
            </button>

            <button
              type="button"
              onClick={() => setIsReorderModalOpen(false)}
              className="px-5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors shadow-md shadow-amber-500/20"
            >
              Tamam
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
