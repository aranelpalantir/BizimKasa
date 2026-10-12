import React from 'react';
import { 
  TrendingUp, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowDownRight,
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  ArrowRight,
  PiggyBank
} from 'lucide-react';
import { formatTRY, formatNumber } from '../../services/portfolioService';

interface MonthlyCashFlowHeroCardProps {
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onResetMonth: () => void;
  income: number;
  expense: number;
  remaining: number;
  hideValues: boolean;
  themeColor?: string;
  accountName?: string;
  onNavigateBudget: () => void;
  topExpense?: { name: string; amount: number };
  incomeCount: number;
  expenseCount: number;
}

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export const MonthlyCashFlowHeroCard: React.FC<MonthlyCashFlowHeroCardProps> = ({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  onResetMonth,
  income,
  expense,
  remaining,
  hideValues,
  themeColor,
  accountName,
  onNavigateBudget,
  topExpense,
  incomeCount,
  expenseCount
}) => {
  const currentDate = new Date();
  const isCurrentMonth = year === 2026 && month === (currentDate.getMonth() + 1);

  const savingsRate = income > 0 ? ((remaining / income) * 100) : 0;
  const expenseRate = income > 0 ? Math.min(100, Math.round((expense / income) * 100)) : (expense > 0 ? 100 : 0);
  const isSurplus = remaining >= 0;

  return (
    <div 
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 p-5 sm:p-6 border shadow-2xl transition-all duration-300 flex flex-col justify-between"
      style={{
        borderColor: themeColor ? `${themeColor}40` : 'rgba(255, 255, 255, 0.1)',
        boxShadow: themeColor ? `0 15px 35px -10px ${themeColor}25` : undefined
      }}
    >
      {/* Decorative theme color top bar */}
      {themeColor && (
        <div 
          className="absolute top-0 left-0 right-0 h-1 z-20 transition-all duration-500"
          style={{ background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)` }}
        />
      )}

      {/* Decorative gradient glow */}
      <div 
        className="absolute top-0 right-0 -mt-8 -mr-8 w-56 h-56 rounded-full blur-3xl pointer-events-none transition-colors duration-500" 
        style={{ backgroundColor: isSurplus ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)' }}
      />
      <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col gap-4">
        {/* Top Header: Title & Interactive Month Switcher */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-400 min-w-0">
            <div 
              className="p-1.5 rounded-lg border transition-colors shrink-0"
              style={{
                backgroundColor: themeColor ? `${themeColor}15` : 'rgba(255, 255, 255, 0.05)',
                borderColor: themeColor ? `${themeColor}30` : 'rgba(255, 255, 255, 0.1)'
              }}
            >
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="truncate">
              <span className="text-xs font-medium uppercase tracking-wider block truncate">
                {accountName ? `${accountName} Bütçesi` : 'Aylık Nakit Akışı'}
              </span>
            </div>
          </div>

          {/* Month Selector Pill */}
          <div className="flex items-center gap-1 bg-slate-950/80 border border-white/10 rounded-2xl px-2 py-1 shrink-0 shadow-inner">
            <button
              type="button"
              onClick={onPrevMonth}
              title="Önceki Ay"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors active:scale-90"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="text-xs font-bold text-white px-1 select-none min-w-[76px] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>

            <button
              type="button"
              onClick={onNextMonth}
              title="Sonraki Ay"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors active:scale-90"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {!isCurrentMonth && (
              <button
                type="button"
                onClick={onResetMonth}
                title="Bu Aya Dön"
                className="ml-1 p-1 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Main Big Number: Net Remaining / Cash Surplus */}
        <div>
          <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight font-mono whitespace-nowrap ${
            remaining > 0 ? 'text-emerald-400' : remaining < 0 ? 'text-rose-400' : 'text-white'
          }`}>
            {!hideValues && remaining > 0 ? '+' : ''}{formatTRY(remaining, hideValues)}
          </h2>

          <div className="flex items-center justify-between gap-2 mt-1.5">
            <p className="text-xs text-slate-400 flex items-center gap-1.5 min-w-0">
              <span className="truncate">{remaining >= 0 ? 'Net Tasarruf / Kalan' : 'Aylık Bütçe Açığı'}</span>
              {income > 0 && (
                <span className="text-slate-500 font-mono hidden sm:inline shrink-0">
                  (Gelirin %{formatNumber(Math.abs(savingsRate), 0)}'si)
                </span>
              )}
            </p>

            {/* Performance Pill */}
            <div className="shrink-0">
              {income > 0 ? (
                <div className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  isSurplus
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    : 'bg-rose-500/15 text-rose-400 border border-rose-500/25'
                }`}>
                  {isSurplus ? <PiggyBank className="w-3.5 h-3.5 shrink-0" /> : <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />}
                  <span className="whitespace-nowrap">
                    {isSurplus 
                      ? (savingsRate > 0 ? `+%${formatNumber(savingsRate, 0)} Tasarruf` : `%0 Tasarruf`) 
                      : `-%${formatNumber(Math.abs(savingsRate), 0)} Açık`}
                  </span>
                </div>
              ) : expense > 0 ? (
                <div className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/25 whitespace-nowrap">
                  Gider Kaydı
                </div>
              ) : (
                <div className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-white/5 whitespace-nowrap">
                  Kayıt Yok
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Twin Sub-Cards: Gelir & Gider */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Gelir Kartı */}
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-emerald-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold mb-1">
              <span className="flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5" />
                Toplam Gelir
              </span>
              {incomeCount > 0 && (
                <span className="text-[10px] text-slate-400 font-normal">{incomeCount} kalem</span>
              )}
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-emerald-300">
              {formatTRY(income, hideValues)}
            </div>
          </div>

          {/* Gider Kartı */}
          <div className="p-3 rounded-2xl bg-slate-950/60 border border-rose-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-rose-400 font-semibold mb-1">
              <span className="flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Toplam Gider
              </span>
              {expenseCount > 0 && (
                <span className="text-[10px] text-slate-400 font-normal">{expenseCount} kalem</span>
              )}
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-rose-300">
              {formatTRY(expense, hideValues)}
            </div>
          </div>
        </div>

        {/* Visual Progress Bar (Expense vs Savings) */}
        {income > 0 && (
          <div className="space-y-1">
            <div className="h-2 w-full bg-slate-950/80 rounded-full overflow-hidden flex border border-white/5">
              <div 
                className="bg-gradient-to-r from-rose-500 to-amber-500 h-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (expense / income) * 100)}%` }}
                title={`Gider Oranı: %${expenseRate}`}
              />
              {remaining > 0 && (
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500" 
                  style={{ width: `${Math.max(0, (remaining / income) * 100)}%` }}
                  title={`Tasarruf Oranı: %${formatNumber(savingsRate, 0)}`}
                />
              )}
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
              <span className="text-rose-400 font-mono">%{expenseRate} Harcandı</span>
              <span className="text-emerald-400 font-mono">%{Math.max(0, Math.round(savingsRate))} Tasarruf</span>
            </div>
          </div>
        )}

        {/* Bottom Metrics & Matrix Link */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
          <div className="truncate pr-2">
            {topExpense ? (
              <span className="text-slate-400 truncate">
                En Yüksek: <span className="text-slate-200 font-semibold">{topExpense.name}</span>{' '}
                <span className="text-rose-400 font-mono">({formatTRY(topExpense.amount, hideValues)})</span>
              </span>
            ) : (
              <span className="text-slate-400">
                {income === 0 && expense === 0 ? 'Bu ay için veri girişi yapılmadı' : 'Bütçe dengeli'}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onNavigateBudget}
            className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 shrink-0 transition-colors group cursor-pointer"
          >
            <span>Bütçe Matrisi</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
