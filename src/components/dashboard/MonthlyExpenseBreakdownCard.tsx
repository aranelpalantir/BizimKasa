import React from 'react';
import { ArrowRight, Receipt } from 'lucide-react';
import { formatTRY, formatNumber } from '../../services/portfolioService';

export interface ExpenseItemBreakdown {
  id: string;
  name: string;
  amount: number;
  percentage: number;
}

interface MonthlyExpenseBreakdownCardProps {
  monthName: string;
  year: number;
  expenses: ExpenseItemBreakdown[];
  totalExpense: number;
  hideValues: boolean;
  onNavigateBudget: () => void;
}

// Color palette for the expense progress bars
const PROGRESS_COLORS = [
  'from-rose-500 to-rose-400',
  'from-amber-500 to-amber-400',
  'from-orange-500 to-amber-500',
  'from-violet-500 to-purple-400',
  'from-sky-500 to-blue-400',
  'from-slate-500 to-slate-400',
];

export const MonthlyExpenseBreakdownCard: React.FC<MonthlyExpenseBreakdownCardProps> = ({
  monthName,
  year,
  expenses,
  totalExpense,
  hideValues,
  onNavigateBudget,
}) => {
  const topExpenses = expenses.slice(0, 5);
  const remainingCount = expenses.length > 5 ? expenses.length - 5 : 0;
  const otherExpensesTotal = expenses.slice(5).reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="p-5 rounded-3xl bg-slate-900/80 border border-white/5 space-y-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {monthName} {year} Harcama Dağılımı
          </h3>
          <span className="text-[11px] text-slate-500">Kalem Bazında Giderler</span>
        </div>

        <button
          onClick={onNavigateBudget}
          className="flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors group cursor-pointer"
        >
          <span>Matrisi Aç</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Main Content */}
      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-300">Bu ay için henüz gider kaydı yok</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Maaş, kira, fatura vb. bütçenizi matristen ekleyebilirsiniz.</p>
          </div>
          <button
            onClick={onNavigateBudget}
            className="mt-1 text-xs text-amber-400 hover:text-amber-300 font-semibold"
          >
            + Gider Kalemi Gir
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {topExpenses.map((item, idx) => {
            const colorClass = PROGRESS_COLORS[idx % PROGRESS_COLORS.length];
            return (
              <div key={item.id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200 truncate pr-2 max-w-[180px]">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0 font-mono">
                    <span className="text-rose-400 font-semibold">
                      {formatTRY(item.amount, hideValues)}
                    </span>
                    <span className="text-[11px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded-md min-w-[36px] text-right">
                      %{formatNumber(item.percentage, 0)}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full bg-slate-950/80 rounded-full overflow-hidden border border-white/5">
                  <div
                    className={`h-full bg-gradient-to-r ${colorClass} transition-all duration-500 rounded-full`}
                    style={{ width: `${Math.max(3, Math.min(100, item.percentage))}%` }}
                  />
                </div>
              </div>
            );
          })}

          {remainingCount > 0 && (
            <div className="pt-1 flex items-center justify-between text-xs text-slate-400">
              <span className="italic">+{remainingCount} diğer gider kalemi</span>
              <span className="font-mono text-slate-300">
                {formatTRY(otherExpensesTotal, hideValues)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Footer Total */}
      <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
        <span className="text-slate-400">Toplam Aylık Harcama</span>
        <span className="text-sm font-bold font-mono text-rose-400">
          {formatTRY(totalExpense, hideValues)}
        </span>
      </div>
    </div>
  );
};
