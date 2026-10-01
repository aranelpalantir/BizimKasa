import React from 'react';
import { Shield, Eye, EyeOff, Lock, RefreshCw, Smartphone } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import type { AppSettings } from '../../types/finance';

interface NavbarProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onLock: () => void;
  onRefreshRates: () => void;
  isRefreshingRates: boolean;
  onGoDashboard?: () => void;
  onOpenInstallModal?: () => void;
  isStandalone?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  onUpdateSettings,
  onLock,
  onRefreshRates,
  isRefreshingRates,
  onGoDashboard,
  onOpenInstallModal,
  isStandalone
}) => {
  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-white/10 px-4 py-3 select-none">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div 
          onClick={onGoDashboard}
          role="button"
          tabIndex={0}
          title="Özet Ekranına Dön"
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Shield className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-lg text-white">Bizim Kasa</span>
            </div>
            <p className="text-[11px] text-slate-400 -mt-0.5">Ortak Bütçe & Varlık Portföyü</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Refresh Rates */}
          <button
            onClick={onRefreshRates}
            title="Kurları Güncelle"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-white/5 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingRates ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {/* Privacy Toggle */}
          <button
            onClick={() => onUpdateSettings({ hideValuesOnScreen: !settings.hideValuesOnScreen })}
            title={settings.hideValuesOnScreen ? 'Değerleri Göster' : 'Değerleri Gizle'}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-white/5 active:scale-95"
          >
            {settings.hideValuesOnScreen ? (
               <EyeOff className="w-4 h-4 text-amber-400" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>

          {/* GitHub Repo Button */}
          <a
            href="https://github.com/aranelpalantir/BizimKasa"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub Deposu (Açık Kaynak)"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-white/5 active:scale-95 flex items-center justify-center"
          >
            <GithubIcon className="w-4 h-4" />
          </a>

          {/* Install PWA Button (shown if not standalone) */}
          {!isStandalone && onOpenInstallModal && (
            <button
              onClick={onOpenInstallModal}
              title="Ana Ekrana Ekle (PWA)"
              className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-colors border border-amber-500/20 active:scale-95 flex items-center justify-center"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          )}

          {/* Lock App Button */}
          {settings.pinHash && (
            <button
              onClick={onLock}
              title="Uygulamayı Kilitle"
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 transition-all text-xs font-medium active:scale-95"
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kilitle</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
