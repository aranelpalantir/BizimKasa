import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getLastModifiedTimestamp, onDatabaseModified, cleanupExpiredTombstones } from './db/db';
import { seedInitialDataIfNeeded, forceResetWithDummyData } from './db/seed';
import { fetchLiveRatesMultiSource, cleanupDeprecatedRates, cleanupDuplicateAssetAccounts, syncTefasFundRatesWithAssets } from './services/ratesService';
import { getSettings, updateSettings, setSessionPin } from './services/securityService';
import { 
  syncWithGoogleDrive, 
  requestGoogleAccessTokenSilently, 
  isGoogleDriveConfigured, 
  isGoogleDriveTokenValid,
  getLastSyncTime 
} from './services/googleDriveService';
import { Navbar } from './components/common/Navbar';
import { BottomNav, type TabType } from './components/common/BottomNav';
import { LockScreen } from './components/auth/LockScreen';
import { DashboardView } from './components/dashboard/DashboardView';
import { MonthlyMatrixView } from './components/budget/MonthlyMatrixView';
import { AssetDashboard } from './components/assets/AssetDashboard';
import { InvestmentPlanner } from './components/investment/InvestmentPlanner';
import { SettingsView } from './components/settings/SettingsView';
import { PwaInstallModal } from './components/common/PwaInstallModal';
import { Modal } from './components/common/Modal';
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
    hideValuesOnScreen: false,
    autoSyncGoogleDrive: false
  });
  const [isLocked, setIsLocked] = useState(false);

  // Auto-Sync PIN Prompt state
  const [isAutoSyncPromptModalOpen, setIsAutoSyncPromptModalOpen] = useState(false);
  const [autoSyncPinInput, setAutoSyncPinInput] = useState('');
  const [autoSyncPinError, setAutoSyncPinError] = useState<string | null>(null);
  const [isAutoSyncSubmitting, setIsAutoSyncSubmitting] = useState(false);
  const [lastSyncTime, setLastSyncTimeState] = useState<string | null>(getLastSyncTime());
  const [isCloudConfigured, setIsCloudConfigured] = useState(isGoogleDriveConfigured());

  // Listen for sync updates and window focus to keep cloud sync status fresh
  useEffect(() => {
    const handleSyncUpdate = () => {
      setLastSyncTimeState(getLastSyncTime());
      setIsCloudConfigured(isGoogleDriveConfigured());
    };
    window.addEventListener('bizimkasa:sync_updated', handleSyncUpdate);
    window.addEventListener('focus', handleSyncUpdate);
    document.addEventListener('visibilitychange', handleSyncUpdate);
    return () => {
      window.removeEventListener('bizimkasa:sync_updated', handleSyncUpdate);
      window.removeEventListener('focus', handleSyncUpdate);
      document.removeEventListener('visibilitychange', handleSyncUpdate);
    };
  }, []);

  // Live queries from Dexie IndexedDB
  const groups = useLiveQuery(() => db.groups.orderBy('order').toArray(), []) || [];
  const accounts = useLiveQuery(() => db.accounts.orderBy('order').toArray(), []) || [];
  const cashFlowEntries = useLiveQuery(() => db.cashFlowEntries.toArray(), []) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray(), []) || [];
  const marketRates = useLiveQuery(() => db.marketRates.toArray(), []) || [];
  const investmentPlans = useLiveQuery(() => db.investmentPlans.toArray(), []) || [];
  const lastModifiedRecord = useLiveQuery(() => db.settings.get('lastModifiedAt'), []);
  const lastModifiedAt = lastModifiedRecord?.value as string | undefined;

  const triggerAutoSync = async (explicitPin?: string) => {
    try {
      const res = await syncWithGoogleDrive(explicitPin);
      if (res.action === 'downloaded') {
        setTimeout(() => window.location.reload(), 500);
      } else if (res.action === 'prompt_pin') {
        setAutoSyncPinInput('');
        setAutoSyncPinError(null);
        setIsAutoSyncPromptModalOpen(true);
      }
    } catch (err) {
      console.warn('Auto-sync execution error:', err);
    }
  };

  const handleConfirmAutoSyncPin = async () => {
    if (!autoSyncPinInput) {
      setAutoSyncPinError('Lütfen PIN kodunuzu girin.');
      return;
    }
    setAutoSyncPinError(null);
    setIsAutoSyncSubmitting(true);
    try {
      const res = await syncWithGoogleDrive(autoSyncPinInput);
      if (res.action === 'downloaded') {
        setSessionPin(autoSyncPinInput);
        setIsAutoSyncPromptModalOpen(false);
        setTimeout(() => window.location.reload(), 500);
      } else if (res.action === 'prompt_pin') {
        setAutoSyncPinError('Girdiğiniz PIN kodu hatalı!');
      } else if (res.action === 'error') {
        setAutoSyncPinError(res.message);
      } else {
        setIsAutoSyncPromptModalOpen(false);
      }
    } catch (e: any) {
      setAutoSyncPinError(e?.message || 'Eşitleme hatası!');
    } finally {
      setIsAutoSyncSubmitting(false);
    }
  };

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

    // If PIN is enabled, lock on open (unless restored just now)
    const bypassLock = typeof window !== 'undefined' ? sessionStorage.getItem('bizimkasa_bypass_lock_once') : null;
    let willLock = false;
    if (bypassLock) {
      sessionStorage.removeItem('bizimkasa_bypass_lock_once');
      setIsLocked(false);
    } else if (loadedSettings.pinHash) {
      setIsLocked(true);
      willLock = true;
    }

    // Ensure lastModifiedAt exists and is initialized
    await getLastModifiedTimestamp();

    setIsInitializing(false);

    // Clean up deprecated rates (GBP, XAG), deduplicate duplicate asset accounts, sync TEFAS funds with active assets, and fetch fresh rates
    await cleanupDeprecatedRates();
    await cleanupDuplicateAssetAccounts();
    await syncTefasFundRatesWithAssets();
    cleanupExpiredTombstones().catch(console.warn);
    fetchLiveRatesMultiSource().catch(console.warn);

    if (!willLock && loadedSettings.autoSyncGoogleDrive) {
      triggerAutoSync();
    }
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
            setSessionPin(null);
            setIsLocked(true);
          } else {
            const elapsedMins = (Date.now() - settings.lastActiveTimestamp) / 60000;
            if (elapsedMins >= settings.autoLockMinutes) {
              setSessionPin(null);
              setIsLocked(true);
            } else if (!isLocked && settings.autoSyncGoogleDrive) {
              triggerAutoSync();
            }
          }
        } else if (settings.autoSyncGoogleDrive) {
          triggerAutoSync();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [settings, isLocked]);

  // Auto-sync when local data modifications occur
  useEffect(() => {
    let syncDebounceTimer: any = null;
    const unsubscribe = onDatabaseModified(() => {
      if (settings.autoSyncGoogleDrive && !isLocked) {
        if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
        syncDebounceTimer = setTimeout(() => {
          triggerAutoSync();
        }, 3500);
      }
    });

    return () => {
      unsubscribe();
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    };
  }, [settings.autoSyncGoogleDrive, isLocked]);

  // Google Drive oturumunu uygulama açıkken süresi dolmadan sessizce tazelemeyi dene
  useEffect(() => {
    if (!settings.autoSyncGoogleDrive) return;

    const interval = setInterval(async () => {
      if (isGoogleDriveConfigured() && !isGoogleDriveTokenValid()) {
        try {
          await requestGoogleAccessTokenSilently();
        } catch {
          // Sessiz yenileme yapılamazsa kullanıcıyı rahatsız etme
        }
      }
    }, 5 * 60 * 1000); // 5 dakikada bir kontrol

    return () => clearInterval(interval);
  }, [settings.autoSyncGoogleDrive]);

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
    if (settings.autoSyncGoogleDrive) {
      setTimeout(() => triggerAutoSync(), 300);
    }
  };

  const handleManualLock = () => {
    setSessionPin(null);
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
        lastModifiedAt={lastModifiedAt}
        isCloudConfigured={isCloudConfigured}
        lastSyncTime={lastSyncTime}
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
            lastModifiedAt={lastModifiedAt}
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
            groups={groups}
            onRefreshSettings={async () => {
              const s = await getSettings();
              setSettings(s);
            }}
            onLock={handleManualLock}
            onOpenInstallModal={() => setIsInstallModalOpen(true)}
            isStandalone={isStandalone}
            deferredPrompt={deferredPrompt}
            onTriggerInstall={handleTriggerInstall}
            lastModifiedAt={lastModifiedAt}
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

      {/* Auto-Sync Prompt PIN Modal */}
      <Modal
        isOpen={isAutoSyncPromptModalOpen}
        onClose={() => setIsAutoSyncPromptModalOpen(false)}
        title="Bulut Eşitleme (PIN Doğrulama)"
        zIndex="z-[75]"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200/90 leading-relaxed">
            Google Drive'da diğer cihazınızdan gelen daha güncel bir yedek bulundu. Verilerinizi içeri aktarmak için bulut yedeğinin PIN kodunu girin.
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Buluttaki Yedeğin PIN Kodu
            </label>
            <input
              type="password"
              value={autoSyncPinInput}
              onChange={(e) => setAutoSyncPinInput(e.target.value)}
              placeholder="PIN kodunu girin..."
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-400"
              autoFocus
            />
          </div>

          {autoSyncPinError && (
            <p className="text-xs text-rose-400 font-medium">{autoSyncPinError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsAutoSyncPromptModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
            >
              Daha Sonra
            </button>
            <button
              onClick={handleConfirmAutoSyncPin}
              disabled={isAutoSyncSubmitting}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 cursor-pointer disabled:opacity-50"
            >
              {isAutoSyncSubmitting ? 'Eşitleniyor...' : 'Eşitle ve Yükle'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default App;
