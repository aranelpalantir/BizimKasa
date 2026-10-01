import React, { useState } from 'react';
import { TrendingUp, TrendingDown, RotateCcw } from 'lucide-react';
import { Modal } from '../common/Modal';
import { updateRate, resetManualRate } from '../../services/ratesService';
import { formatNumber } from '../../services/portfolioService';
import type { MarketRate } from '../../types/finance';

interface RatesTickerProps {
  rates: MarketRate[];
}

export const RatesTicker: React.FC<RatesTickerProps> = ({ rates }) => {
  const [selectedRate, setSelectedRate] = useState<MarketRate | null>(null);
  const [overrideValue, setOverrideValue] = useState<string>('');

  const handleOpenEdit = (rate: MarketRate) => {
    setSelectedRate(rate);
    setOverrideValue(rate.rateTRY.toString());
  };

  const handleSaveOverride = async () => {
    if (!selectedRate) return;
    const val = parseFloat(overrideValue.replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      await updateRate(selectedRate.symbol, val, true);
      setSelectedRate(null);
    }
  };

  const handleResetToLive = async () => {
    if (!selectedRate) return;
    await resetManualRate(selectedRate.symbol);
    setSelectedRate(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Canlı Piyasa Fiyatları & Kurlar
        </h3>
        <span className="text-[11px] text-slate-500">Düzenlemek için dokunun</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {rates.map((rate) => {
          const isUp = rate.changeDailyPct >= 0;
          return (
            <button
              key={rate.symbol}
              onClick={() => handleOpenEdit(rate)}
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
                <span className="text-[10px] text-slate-400 max-w-[90px] truncate">{rate.name}</span>
              </div>

              <div className="flex flex-col items-end pl-1 border-l border-white/5">
                <span className="text-xs font-semibold text-slate-200">
                  {formatNumber(rate.rateTRY, rate.rateTRY > 100 ? 2 : 4)} ₺
                </span>
                <div className={`flex items-center text-[10px] font-medium ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isUp ? <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="w-2.5 h-2.5 mr-0.5" />}
                  <span>%{formatNumber(Math.abs(rate.changeDailyPct), 2)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Manual Rate Edit Modal */}
      <Modal
        isOpen={!!selectedRate}
        onClose={() => setSelectedRate(null)}
        title={selectedRate ? `${selectedRate.name} (${selectedRate.symbol}) Kurunu Düzenle` : ''}
      >
        {selectedRate && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 text-xs text-slate-300">
              Banka veya Kapalıçarşı serbest piyasa alış/satış makas farkını yansıtmak için özel kur belirleyebilirsiniz.
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
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-semibold focus:outline-none focus:border-amber-400 transition-colors"
              />
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
      </Modal>
    </div>
  );
};
