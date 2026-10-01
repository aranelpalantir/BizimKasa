import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';
import { seedInitialDataIfNeeded, forceResetWithDummyData } from './db/seed';
import { fetchLiveRatesMultiSource, cleanupDeprecatedRates, syncTefasFundRatesWithAssets } from './services/ratesService';
import { getSettings, updateSettings } from './services/securityService';
import { Navbar } from './components/common/Navbar';
import { BottomNav, type TabType } from './components/common/BottomNav';
import { LockScreen } from './components/auth/LockScreen';
import { DashboardView } from './components/dashboard/DashboardView';
import { MonthlyMatrixView } from './components/budget/MonthlyMatrixView';
import { AssetDashboard } from './components/assets/AssetDashboard';
import { InvestmentPlanner } from './components/investment/InvestmentPlanner';
import { SettingsView } from './components/settings/SettingsView';
import { PwaInstallModal } from './components/common/PwaInstallModal';
import type { AppSettings } from './types/finance';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRefreshingRates, setIsRefreshingRates] = useState(false);
  
  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Settings & Security state
  const [settings, setSettings] = useState<AppSettings>({
    biometricsEnabled: false,
    autoLockMinutes: 5,
    lastActiveTimestamp: Date.now(),
    isLocked: false,
    defaultCurrency: 'TRY',
    hideValuesOnScreen: false
  });
  const [isLocked, setIsLocked] = useState(false);

  // Live queries from Dexie IndexedDB
  const groups = useLiveQuery(() => db.groups.orderBy('order').toArray(), []) || [];
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []) || [];
  const cashFlowEntries = useLiveQuery(() => db.cashFlowEntries.toArray(), []) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || [];
  const marketRates = useLiveQuery(() => db.marketRates.toArray(), []) || [];
  const investmentPlans = useLiveQuery(() => db.investmentPlans.toArray(), []) || [];

  // Load Settings and Seed
  const loadSettingsAndInit = async () => {
    // Check if user explicitly cleared all data
    const clearedRecord = await db.settings.get('userClearedData');
    if (clearedRecord && clearedRecord.value) {
      // User explicitly cleared data; do not auto-seed dummy data
    } else {
      const dummyVerRecord = await db.settings.get('dummyDataVersion');
      if (!dummyVerRecord || dummyVerRecord.value < 6) {
        await forceResetWithDummyData();
        await db.settings.put({ key: 'dummyDataVersion', value: 6 });
      } else {
        await seedInitialDataIfNeeded();
      }
    }

    const loadedSettings = await getSettings();
    setSettings(loadedSettings);

    // If PIN is enabled, lock on open
    if (loadedSettings.pinHash) {
      setIsLocked(true);
    }

    setIsInitializing(false);

    // Clean up deprecated rates (GBP, XAG), sync TEFAS funds with active assets, and fetch fresh rates
    await cleanupDeprecatedRates();
    await syncTefasFundRatesWithAssets();
    fetchLiveRatesMultiSource().catch(console.warn);
  };

  useEffect(() => {
    loadSettingsAndInit();
  }, []);

  // Dynamically synchronize TEFAS funds in market rates whenever accounts or transactions change
  useEffect(() => {
    if (!isInitializing) {
      syncTefasFundRatesWithAssets().catch(console.warn);
    }
  }, [accounts, transactions, isInitializing]);

  // Detect Standalone mode and capture beforeinstallprompt
  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = 
        (window.navigator as any).standalone === true || 
        window.matchMedia('(display-mode: standalone)').matches;
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setIsInstallModalOpen(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleTriggerInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsStandalone(true);
      setIsInstallModalOpen(false);
    }
    setDeferredPrompt(null);
  };

  // Handle visibility change and auto-lock
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App went to background
        updateSettings({ lastActiveTimestamp: Date.now() });
      } else {
        // App returned to foreground
        if (settings.pinHash) {
          if (settings.autoLockMinutes === 0) {
            setIsLocked(true);
          } else {
            const elapsedMins = (Date.now() - settings.lastActiveTimestamp) / 60000;
            if (elapsedMins >= settings.autoLockMinutes) {
              setIsLocked(true);
            }
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [settings]);

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    await updateSettings(newSettings);
    const updated = await getSettings();
    setSettings(updated);
  };

  const handleRefreshRates = async () => {
    setIsRefreshingRates(true);
    try {
      await fetchLiveRatesMultiSource();
    } finally {
      setTimeout(() => setIsRefreshingRates(false), 600);
    }
  };

  const handleUnlock = () => {
    setIsLocked(false);
    updateSettings({ lastActiveTimestamp: Date.now() });
  };

  const handleManualLock = () => {
    setIsLocked(true);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#080c14] flex flex-col items-center justify-center text-slate-400 gap-3">
        <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold text-slate-300">Bizim Kasa Yükleniyor...</span>
      </div>
    );
  }

  // Render Lock Screen if locked
  if (isLocked && settings.pinHash) {
    return <LockScreen settings={settings} onUnlock={handleUnlock} />;
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] select-none">
      {/* Top Navbar */}
      <Navbar
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onLock={handleManualLock}
        onRefreshRates={handleRefreshRates}
        isRefreshingRates={isRefreshingRates}
        onGoDashboard={() => setActiveTab('dashboard')}
        onOpenInstallModal={() => setIsInstallModalOpen(true)}
        isStandalone={isStandalone}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 sm:py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            groups={groups}
            accounts={accounts}
            transactions={transactions}
            rates={marketRates}
            cashFlowEntries={cashFlowEntries}
            hideValues={settings.hideValuesOnScreen}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'budget' && (
          <MonthlyMatrixView
            groups={groups}
            accounts={accounts}
            entries={cashFlowEntries}
            hideValues={settings.hideValuesOnScreen}
          />
        )}

        {activeTab === 'assets' && (
          <AssetDashboard
            groups={groups}
            accounts={accounts}
            transactions={transactions}
            rates={marketRates}
            hideValues={settings.hideValuesOnScreen}
          />
        )}

        {activeTab === 'plan' && (
          <InvestmentPlanner
            groups={groups}
            accounts={accounts}
            plans={investmentPlans}
            transactions={transactions}
            hideValues={settings.hideValuesOnScreen}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onRefreshSettings={async () => {
              const s = await getSettings();
              setSettings(s);
            }}
            onLock={handleManualLock}
            onOpenInstallModal={() => setIsInstallModalOpen(true)}
            isStandalone={isStandalone}
            deferredPrompt={deferredPrompt}
            onTriggerInstall={handleTriggerInstall}
          />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation */}
      <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />

      {/* PWA Installation Guide Modal */}
      <PwaInstallModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        deferredPrompt={deferredPrompt}
        onTriggerInstall={handleTriggerInstall}
      />
    </div>
  );
};

export default App;
