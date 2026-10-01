import React from 'react';
import { LayoutDashboard, TableProperties, Coins, Target, Settings } from 'lucide-react';

export type TabType = 'dashboard' | 'budget' | 'assets' | 'plan' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    { id: 'dashboard' as TabType, label: 'Özet', icon: LayoutDashboard },
    { id: 'budget' as TabType, label: 'Bütçe & Kart', icon: TableProperties },
    { id: 'assets' as TabType, label: 'Varlıklar', icon: Coins },
    { id: 'plan' as TabType, label: 'Yatırım', icon: Target },
    { id: 'settings' as TabType, label: 'Ayarlar', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-white/10 px-2 py-1.5 backdrop-blur-xl">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? 'text-amber-400 bg-amber-400/10 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
              <span className="text-[10px] tracking-tight truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
