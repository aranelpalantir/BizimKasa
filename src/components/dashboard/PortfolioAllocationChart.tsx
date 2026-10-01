import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatTRY, formatNumber } from '../../services/portfolioService';
import type { PortfolioSummary } from '../../services/portfolioService';

interface PortfolioAllocationChartProps {
  summary: PortfolioSummary;
  hideValues: boolean;
}

export const PortfolioAllocationChart: React.FC<PortfolioAllocationChartProps> = ({ summary, hideValues }) => {
  // Detailed asset buckets breakdown
  const buckets: { [key: string]: { name: string; value: number; color: string } } = {
    'BANK_GOLD': { name: 'Banka Gram Altın', value: 0, color: '#f59e0b' },
    'PHYS_GOLD': { name: 'Fiziki Gram Altın', value: 0, color: '#d97706' },
    'CEYREK_GOLD': { name: 'Çeyrek Altın', value: 0, color: '#eab308' },
    'EUR': { name: 'Euro (EUR)', value: 0, color: '#3b82f6' },
    'USD': { name: 'Dolar (USD)', value: 0, color: '#6366f1' },
    'FUND': { name: 'Yatırım Fonları', value: 0, color: '#10b981' },
    'OTHER': { name: 'Diğer Varlıklar', value: 0, color: '#a855f7' },
  };

  for (const pos of summary.positions) {
    const sym = pos.symbol?.toUpperCase() || '';
    const nm = pos.name?.toLowerCase() || '';
    const sub = pos.subType || '';

    if (sub === 'GOLD_GRAM_BANK' || sym === 'XAU_GR_BANK' || (sub === 'GOLD_GRAM' && !sym.includes('FIZIKI') && !nm.includes('fiziki'))) {
      buckets['BANK_GOLD'].value += pos.currentValueTRY;
    } else if (sub === 'GOLD_GRAM_PHYSICAL' || sym === 'XAU_GR_PHYSICAL' || nm.includes('fiziki')) {
      buckets['PHYS_GOLD'].value += pos.currentValueTRY;
    } else if (sub === 'GOLD_CEYREK' || sub === 'GOLD_PIECE' || sym === 'XAU_CEYREK' || nm.includes('çeyrek') || nm.includes('ceyrek')) {
      buckets['CEYREK_GOLD'].value += pos.currentValueTRY;
    } else if (sym === 'EUR' || (sub === 'CURRENCY' && nm.includes('euro'))) {
      buckets['EUR'].value += pos.currentValueTRY;
    } else if (sym === 'USD' || (sub === 'CURRENCY' && (nm.includes('dolar') || nm.includes('usd')))) {
      buckets['USD'].value += pos.currentValueTRY;
    } else if (sub === 'FUND' || sub === 'STOCK') {
      buckets['FUND'].value += pos.currentValueTRY;
    } else {
      buckets['OTHER'].value += pos.currentValueTRY;
    }
  }

  const chartData = Object.values(buckets).filter(d => d.value > 0);

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
                  borderColor: 'rgba(255,255,255,0.15)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#fff',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                }}
                itemStyle={{ color: '#f8fafc', fontWeight: 600 }}
                labelStyle={{ color: '#ffffff', fontWeight: 700 }}
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
