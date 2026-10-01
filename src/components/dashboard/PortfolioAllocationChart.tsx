import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatTRY, formatNumber } from '../../services/portfolioService';
import type { PortfolioSummary } from '../../services/portfolioService';

interface PortfolioAllocationChartProps {
  summary: PortfolioSummary;
  hideValues: boolean;
}

export const PortfolioAllocationChart: React.FC<PortfolioAllocationChartProps> = ({ summary, hideValues }) => {
  // Aggregate by category
  let goldVal = 0;
  let currencyVal = 0;
  let fundVal = 0;
  let otherVal = 0;

  for (const pos of summary.positions) {
    if (pos.subType === 'GOLD_GRAM' || pos.subType === 'GOLD_PIECE') {
      goldVal += pos.currentValueTRY;
    } else if (pos.subType === 'CURRENCY') {
      currencyVal += pos.currentValueTRY;
    } else if (pos.subType === 'FUND' || pos.subType === 'STOCK') {
      fundVal += pos.currentValueTRY;
    } else {
      otherVal += pos.currentValueTRY;
    }
  }

  const chartData = [
    { name: 'Altın & Emtia', value: goldVal, color: '#fbbf24' },
    { name: 'Döviz (EUR/USD)', value: currencyVal, color: '#3b82f6' },
    { name: 'Yatırım Fonları', value: fundVal, color: '#10b981' },
    { name: 'Diğer / Nakit', value: otherVal, color: '#a855f7' },
  ].filter(d => d.value > 0);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="p-5 rounded-3xl bg-slate-900/80 border border-white/5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Portföy Varlık Dağılımı
        </h3>
        <span className="text-[11px] text-slate-500">Kategori Bazında</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        {/* Donut Chart */}
        <div className="h-44 w-full relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={50}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any) => [formatTRY(Number(value) || 0, hideValues), 'Değer']}
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#fff'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] text-slate-400 font-medium">Toplam</span>
            <span className="text-xs font-bold text-white">
              {formatTRY(summary.totalValueTRY, hideValues)}
            </span>
          </div>
        </div>

        {/* Legend list */}
        <div className="space-y-2.5">
          {chartData.map((item) => {
            const pct = summary.totalValueTRY > 0 ? (item.value / summary.totalValueTRY) * 100 : 0;
            return (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-300 font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">
                    {formatTRY(item.value, hideValues)}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono w-12 text-right">
                    %{formatNumber(pct, 1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
