import React, { useState, useRef, useEffect } from 'react';
import { 
  Shield, 
  KeyRound, 
  ScanFace,
  Clock, 
  Download, 
  Upload, 
  RotateCcw, 
  Check, 
  AlertTriangle,
  Lock,
  FileJson,
  Trash2,
  ShieldCheck,
  Eye,
  EyeOff,
  Smartphone,
  ExternalLink,
  Info,
  Palette,
  Plus
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { GithubIcon } from '../common/GithubIcon';
import { EditAccountModal } from '../common/EditAccountModal';
import { AddAccountModal } from '../common/AddAccountModal';
import { getThemeColorName } from '../../constants/themeColors';
import { db } from '../../db/db';
import { APP_VERSION, APP_BUILD_DATE } from '../../version';
import { hashPin, verifyPin, registerBiometrics, updateSettings } from '../../services/securityService';
import { 
  exportDatabaseToJSON, 
  exportEncryptedBackup,
  inspectBackupFile,
  restoreEncryptedBackup,
  restorePlainBackup,
  resetToSampleData, 
  clearAllDatabaseData 
} from '../../services/exportService';
import type { AppSettings, Group } from '../../types/finance';

interface SettingsViewProps {
  settings: AppSettings;
  groups: Group[];
  onRefreshSettings: () => void;
  onLock: () => void;
  onOpenInstallModal?: () => void;
  isStandalone?: boolean;
  deferredPrompt?: any;
  onTriggerInstall?: () => Promise<void>;
}

interface PinAuthRequest {
  title: string;
  description: string;
  confirmButtonText?: string;
  isDestructive?: boolean;
  onSuccess: () => void | Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  groups,
  onRefreshSettings,
  onLock,
  onOpenInstallModal,
  isStandalone,
  deferredPrompt,
  onTriggerInstall
}) => {
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Step-Up PIN Authorization modal state (for sensitive operations)
  const [pinAuthRequest, setPinAuthRequest] = useState<PinAuthRequest | null>(null);
  const [pinAuthInput, setPinAuthInput] = useState('');
  const [pinAuthError, setPinAuthError] = useState<string | null>(null);

  // Encrypted Export state
  const [isEncryptedExportModalOpen, setIsEncryptedExportModalOpen] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [confirmExportPassword, setConfirmExportPassword] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Decrypt & Restore state
  const [isDecryptModalOpen, setIsDecryptModalOpen] = useState(false);
  const [encryptedBackupData, setEncryptedBackupData] = useState<any>(null);
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Version and Cache Refresh state
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);

  const handleForceCacheRefresh = async () => {
    setIsRefreshingCache(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
        }
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
    } catch (err) {
      console.warn('Önbellek temizleme hatası:', err);
    }
    window.location.reload();
  };

  // Input refs for automatic focus when modals open
  const currentPinInputRef = useRef<HTMLInputElement>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const confirmPinInputRef = useRef<HTMLInputElement>(null);
  const pinAuthInputRef = useRef<HTMLInputElement>(null);
  const exportPasswordInputRef = useRef<HTMLInputElement>(null);
  const importPasswordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPinModalOpen) {
      const timer = setTimeout(() => {
        if (settings.pinHash) {
          currentPinInputRef.current?.focus();
        } else {
          pinInputRef.current?.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isPinModalOpen, settings.pinHash]);

  useEffect(() => {
    if (pinAuthRequest) {
      const timer = setTimeout(() => {
        pinAuthInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [pinAuthRequest]);

  useEffect(() => {
    if (isEncryptedExportModalOpen) {
      const timer = setTimeout(() => {
        exportPasswordInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isEncryptedExportModalOpen]);

  useEffect(() => {
    if (isDecryptModalOpen) {
      const timer = setTimeout(() => {
        importPasswordInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isDecryptModalOpen]);

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Helper to enforce PIN verification before sensitive actions
  const requirePinAuth = (
    title: string,
    description: string,
    onSuccess: () => void | Promise<void>,
    options?: { confirmButtonText?: string; isDestructive?: boolean }
  ) => {
    if (!settings.pinHash) {
      onSuccess();
      return;
    }
    setPinAuthInput('');
    setPinAuthError(null);
    setPinAuthRequest({
      title,
      description,
      confirmButtonText: options?.confirmButtonText || 'Onayla',
      isDestructive: options?.isDestructive ?? false,
      onSuccess
    });
  };

  const handleVerifyPinAuth = async () => {
    if (!pinAuthRequest) return;
    if (!settings.pinHash) {
      const action = pinAuthRequest.onSuccess;
      setPinAuthRequest(null);
      await action();
      return;
    }

    if (!pinAuthInput) {
      setPinAuthError('Lütfen PIN kodunuzu girin.');
      pinAuthInputRef.current?.focus();
      return;
    }

    const isValid = await verifyPin(pinAuthInput, settings.pinHash);
    if (!isValid) {
      setPinAuthError('Hatalı PIN kodu!');
      pinAuthInputRef.current?.focus();
      return;
    }

    const action = pinAuthRequest.onSuccess;
    setPinAuthRequest(null);
    setPinAuthInput('');
    setPinAuthError(null);
    await action();
  };

  const handleSavePin = async () => {
    // If PIN already exists, verify current PIN first
    if (settings.pinHash) {
      if (!currentPin) {
        setPinError('Lütfen mevcut PIN kodunuzu girin.');
        currentPinInputRef.current?.focus();
        return;
      }
      const isCurrentValid = await verifyPin(currentPin, settings.pinHash);
      if (!isCurrentValid) {
        setPinError('Mevcut PIN kodunuz hatalı!');
        currentPinInputRef.current?.focus();
        return;
      }
      if (newPin === currentPin) {
        setPinError('Yeni PIN mevcut PIN ile aynı olamaz.');
        return;
      }
    }

    if (newPin.length < 4) {
      setPinError('PIN en az 4 haneli olmalıdır.');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('Girdiğiniz PIN kodları uyuşmuyor.');
      return;
    }

    try {
      const hashed = await hashPin(newPin);
      await updateSettings({ pinHash: hashed, pinLength: newPin.length });
      onRefreshSettings();
      setIsPinModalOpen(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setPinError(null);
      showFeedback('success', settings.pinHash ? 'PIN kodu başarıyla güncellendi!' : 'PIN kodu başarıyla kaydedildi!');
    } catch (err: any) {
      setPinError(`Kayıt sırasında hata oluştu: ${err?.message || 'Bilinmeyen hata'}`);
    }
  };

  const handleRemovePin = () => {
    requirePinAuth(
      'PIN Korumasını Kaldır',
      'PIN korumasını ve biyometrik kilidi kaldırmak için lütfen mevcut PIN kodunuzu girin.',
      async () => {
        await updateSettings({
          pinHash: undefined,
          pinLength: undefined,
          biometricsEnabled: false,
          biometricCredentialId: undefined
        });
        onRefreshSettings();
        showFeedback('success', 'PIN koruması kaldırıldı.');
      },
      { confirmButtonText: 'Kaldır', isDestructive: true }
    );
  };

  const handleToggleBiometrics = async () => {
    if (!settings.pinHash) {
      showFeedback('error', 'Biyometrik kilit için önce yukarıdan bir PIN kodu belirlemelisiniz.');
      setIsPinModalOpen(true);
      return;
    }

    if (!settings.biometricsEnabled) {
      const res = await registerBiometrics();
      if (res.success) {
        await updateSettings({
          biometricsEnabled: true,
          biometricCredentialId: res.credentialId
        });
        onRefreshSettings();
        showFeedback('success', 'Biyometrik doğrulama (Face ID / Touch ID) aktifleştirildi.');
      } else {
        showFeedback('error', res.errorReason || 'Biyometrik sensör bulunamadı veya onaylanmadı.');
      }
    } else {
      // Prompt for PIN to disable biometrics
      requirePinAuth(
        'Biyometrik Korumayı Kapat',
        'Biyometrik doğrulamayı devre dışı bırakmak için lütfen mevcut PIN kodunuzu girin.',
        async () => {
          await updateSettings({
            biometricsEnabled: false,
            biometricCredentialId: undefined
          });
          onRefreshSettings();
          showFeedback('success', 'Biyometrik doğrulama devre dışı bırakıldı.');
        },
        { confirmButtonText: 'Kapat', isDestructive: false }
      );
    }
  };

  const handleAutoLockChange = async (minutes: number) => {
    await updateSettings({ autoLockMinutes: minutes });
    onRefreshSettings();
  };

  const handleBackupExport = () => {
    requirePinAuth(
      'Yedeği İndir (JSON)',
      'Finansal verilerinizin şifresiz JSON yedeğini indirmek için lütfen PIN kodunuzu girin.',
      async () => {
        try {
          await exportDatabaseToJSON();
          showFeedback('success', 'Yedek dosyası cihazınıza indirildi.');
        } catch {
          showFeedback('error', 'Yedekleme sırasında hata oluştu.');
        }
      },
      { confirmButtonText: 'İndir' }
    );
  };

  const handleExecuteEncryptedExport = async () => {
    if (!exportPassword || exportPassword.length < 4) {
      setExportError('Yedek şifresi en az 4 karakter olmalıdır.');
      return;
    }
    if (exportPassword !== confirmExportPassword) {
      setExportError('Girdiğiniz şifreler birbiriyle uyuşmuyor.');
      return;
    }

    setIsExporting(true);
    setExportError(null);
    try {
      await exportEncryptedBackup(exportPassword);
      setIsEncryptedExportModalOpen(false);
      setExportPassword('');
      setConfirmExportPassword('');
      showFeedback('success', 'AES-256 şifreli yedek başarıyla indirildi!');
    } catch (err: any) {
      setExportError(err?.message || 'Yedekleme sırasında hata oluştu.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const check = await inspectBackupFile(file);
      if (!check.valid || !check.data) {
        showFeedback('error', check.error || 'Geçersiz yedek dosyası!');
        return;
      }

      if (check.isEncrypted) {
        setEncryptedBackupData(check.data);
        setImportPassword('');
        setDecryptError(null);
        setIsDecryptModalOpen(true);
      } else {
        setConfirmState({
          isOpen: true,
          title: 'Yedekten Geri Yükle',
          message: 'Mevcut tüm veriler silinecek ve seçtiğiniz standart yedek dosyası yüklenecektir. Bu işlemi onaylıyor musunuz?',
          confirmText: 'Yedeği Yükle',
          isDestructive: true,
          onConfirm: () => {
            requirePinAuth(
              'Yedeği Geri Yükleme Onayı',
              'Mevcut verilerin üzerine yazıp yedeği geri yüklemek için lütfen PIN kodunuzu girin.',
              async () => {
                const res = await restorePlainBackup(check.data);
                if (res.success) {
                  showFeedback('success', res.message);
                  setTimeout(() => window.location.reload(), 800);
                } else {
                  showFeedback('error', res.message);
                }
              },
              { confirmButtonText: 'Yedeği Yükle', isDestructive: true }
            );
          }
        });
      }
    } catch (err: any) {
      showFeedback('error', `Dosya incelenirken hata oluştu: ${err?.message || 'Bilinmeyen hata'}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleExecuteDecryptRestore = async () => {
    if (!importPassword) {
      setDecryptError('Lütfen yedek şifresini girin.');
      return;
    }

    requirePinAuth(
      'Şifreli Yedeği Yükle',
      'Şifresi çözülen yedeği mevcut verilerin üzerine yazmak için lütfen PIN kodunuzu girin.',
      async () => {
        setIsDecrypting(true);
        setDecryptError(null);
        try {
          const res = await restoreEncryptedBackup(encryptedBackupData, importPassword);
          if (res.success) {
            setIsDecryptModalOpen(false);
            showFeedback('success', res.message);
            setTimeout(() => window.location.reload(), 800);
          } else {
            setDecryptError(res.message);
          }
        } catch (err: any) {
          setDecryptError(err?.message || 'Şifre çözme hatası!');
        } finally {
          setIsDecrypting(false);
        }
      },
      { confirmButtonText: 'Yedeği Yükle', isDestructive: true }
    );
  };

  const handleResetSample = () => {
    setConfirmState({
      isOpen: true,
      title: 'Örnek Verileri Yükle',
      message: 'Mevcut tüm veriler sıfırlanıp zengin ve gerçekçi örnek başlangıç verileri yeniden yüklenecektir. Bu işlemi onaylıyor musunuz?',
      confirmText: 'Örnek Verileri Yükle',
      isDestructive: true,
      onConfirm: () => {
        requirePinAuth(
          'Örnek Verileri Yükle',
          'Mevcut verileri sıfırlayıp örnek verileri yüklemek için lütfen PIN kodunuzu girin.',
          async () => {
            await resetToSampleData();
            showFeedback('success', 'Örnek veriler başarıyla yüklendi.');
            setTimeout(() => window.location.reload(), 800);
          },
          { confirmButtonText: 'Örnek Verileri Yükle', isDestructive: true }
        );
      }
    });
  };

  const handleClearAllData = () => {
    setConfirmState({
      isOpen: true,
      title: 'Tüm Verileri Sil',
      message: 'DİKKAT! Kayıtlı tüm ana gruplar, hesaplar, bütçe/nakit akışı verileri, varlık (altın, döviz, fon) alım-satım hareketleri ve hedefler kalıcı olarak silinecektir. Güvenlik ve PIN ayarlarınız korunur. Bu işlem geri alınamaz. Onaylıyor musunuz?',
      confirmText: 'Evet, Tümünü Sil',
      isDestructive: true,
      onConfirm: () => {
        requirePinAuth(
          'Tüm Verileri Silmeyi Onayla',
          'Tüm verilerinizi kalıcı olarak silmek üzeresiniz. Bu işlemi onaylamak için lütfen PIN kodunuzu girin.',
          async () => {
            try {
              await clearAllDatabaseData();
              showFeedback('success', 'Tüm kullanıcı verileri başarıyla silindi.');
              setTimeout(() => window.location.reload(), 800);
            } catch (err: any) {
              showFeedback('error', `Silme işlemi sırasında hata oluştu: ${err?.message || 'Bilinmeyen hata'}`);
            }
          },
          { confirmButtonText: 'Tümünü Sil', isDestructive: true }
        );
      }
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Feedback Toast */}
      {feedbackMsg && (
        <div className={`p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-3 duration-200 border ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
        }`}>
          {feedbackMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* SECTION 1: SECURITY */}
      <div className="rounded-3xl bg-slate-900/80 border border-white/5 p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Güvenlik & Giriş Kilidi</h3>
            <p className="text-xs text-slate-400">PIN kodu ve cihaz biyometrik doğrulaması</p>
          </div>
        </div>

        {/* PIN Code Setup */}
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold text-white block">Uygulama PIN Kodu</span>
              <span className="text-xs text-slate-400">
                {settings.pinHash ? 'PIN koruması aktif' : 'Henüz PIN belirlenmedi'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {settings.pinHash ? (
              <>
                <button
                  onClick={() => setIsPinModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                >
                  Değiştir
                </button>
                <button
                  onClick={handleRemovePin}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-400 border border-rose-500/20"
                >
                  Kaldır
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsPinModalOpen(true)}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20"
              >
                PIN Belirle
              </button>
            )}
          </div>
        </div>

        {/* Biometrics (Face ID / Touch ID) */}
        <div className={`flex items-center justify-between py-3 border-b border-white/5 transition-opacity ${!settings.pinHash ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <div className={`p-2 rounded-xl shrink-0 transition-colors ${
              settings.biometricsEnabled 
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                : settings.pinHash 
                  ? 'bg-slate-800 text-slate-300 border border-white/5' 
                  : 'bg-slate-800/50 text-slate-500 border border-white/5'
            }`}>
              <ScanFace className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white block">Face ID / Parmak İzi</span>
                {!settings.pinHash && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-semibold border border-amber-500/20 shrink-0">
                    PIN Gerekli
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 block">
                {settings.pinHash 
                  ? 'Cihaz biyometrisi ile şifresiz anında açılış' 
                  : 'Etkinleştirebilmek için önce yukarıdan bir PIN kodu belirleyin'}
              </span>
              {typeof window !== 'undefined' && !window.isSecureContext && (
                <span className="text-[10px] text-amber-400/90 block mt-0.5">
                  ⚠️ Apple güvenlik kuralı: Yalnızca HTTPS (Cloudflare Pages vb.) üzerinde çalışır.
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleBiometrics}
            disabled={!settings.pinHash}
            title={settings.pinHash ? 'Face ID / Biyometrik Kilidi Aç/Kapat' : 'Önce PIN kodu belirlemelisiniz'}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.biometricsEnabled
                ? 'bg-emerald-500'
                : settings.pinHash
                  ? 'bg-slate-700 hover:bg-slate-600'
                  : 'bg-slate-800/60 opacity-50 cursor-not-allowed'
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                settings.biometricsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Auto Lock Duration */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold text-white block">Otomatik Kilitlenme Süresi</span>
              <span className="text-xs text-slate-400">Arka plana geçildiğinde veya boşta kalındığında</span>
            </div>
          </div>

          <select
            value={settings.autoLockMinutes}
            onChange={(e) => handleAutoLockChange(Number(e.target.value))}
            className="px-3 py-1.5 rounded-xl bg-slate-800 border border-white/10 text-white text-xs font-semibold focus:outline-none"
          >
            <option value={0}>Anında</option>
            <option value={1}>1 Dakika</option>
            <option value={5}>5 Dakika</option>
            <option value={15}>15 Dakika</option>
          </select>
        </div>

        {settings.pinHash && (
          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-slate-400">Güvenlik kilidini hemen etkinleştir</span>
            <button
              onClick={onLock}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-semibold transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Şimdi Kilitle</span>
            </button>
          </div>
        )}
      </div>

      {/* SECTION: ACCOUNTS & COLOR THEMES */}
      <div className="rounded-3xl bg-slate-900/80 border border-white/5 p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Hesaplar ve Renk Temaları</h3>
              <p className="text-xs text-slate-400">Hesaplarınızı yönetin, adlarını ve renk temalarını kişiselleştirin</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAddAccountModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Yeni Hesap</span>
          </button>
        </div>

        {/* List of Accounts */}
        <div className="space-y-2.5">
          {groups.map((grp) => (
            <div
              key={grp.id}
              className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/5 hover:border-white/15 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-md transition-transform"
                  style={{
                    backgroundColor: `${grp.color}25`,
                    borderColor: grp.color
                  }}
                >
                  <div
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: grp.color }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{grp.name}</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{
                        backgroundColor: `${grp.color}15`,
                        color: grp.color
                      }}
                    >
                      {getThemeColorName(grp.color)}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 uppercase">
                    HEX: {grp.color}
                  </span>
                </div>
              </div>

              {/* Quick swatch buttons & Edit button */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                {/* 5 popular quick-switch swatches */}
                <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-white/5">
                  {['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#a855f7'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={async () => {
                        await db.groups.update(grp.id, { color: c });
                      }}
                      title={`${getThemeColorName(c)} yap`}
                      className={`w-4 h-4 rounded-full transition-transform cursor-pointer ${
                        grp.color.toLowerCase() === c.toLowerCase()
                          ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-slate-900'
                          : 'opacity-70 hover:opacity-100 hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setEditingGroup(grp)}
                  title={`${grp.name} Renk Temasını Değiştir`}
                  aria-label={`${grp.name} rengini değiştir`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-white/10 hover:border-amber-400/30 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <Palette className="w-3.5 h-3.5 text-amber-400" />
                  <span>Rengi Değiştir</span>
                </button>
              </div>
            </div>
          ))}

          {groups.length === 0 && (
            <div className="text-center py-6 text-slate-500 text-xs">
              Henüz tanımlı bir hesap bulunmuyor.
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: BACKUP & RESTORE */}
      <div className="rounded-3xl bg-slate-900/80 border border-white/5 p-5 space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-white/10">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
            <FileJson className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Yedekleme & Geri Yükleme</h3>
            <p className="text-xs text-slate-400">Verilerinizi şifreli (AES-256) veya standart JSON olarak saklayın</p>
          </div>
        </div>

        {/* Encrypted Export Feature Card (Highlighted / Recommended) */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900/40 to-slate-900 border border-amber-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-300">Güvenli Şifreli Yedekleme (AES-256)</span>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Önerilen
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Yedeğiniz askeri düzeyde <strong>AES-256-GCM</strong> ile belirleyeceğiniz parola ile şifrelenir. Google Drive, iCloud veya e-postanızda güvenle saklayabilirsiniz.
          </p>
          <button
            onClick={() => {
              setExportPassword('');
              setConfirmExportPassword('');
              setExportError(null);
              setIsEncryptedExportModalOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Şifreli Yedek İndir (Korumalı)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Download JSON */}
          <button
            onClick={handleBackupExport}
            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-white text-xs font-bold border border-white/5 transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Yedeği İndir (JSON)</span>
          </button>

          {/* Import JSON */}
          <label className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-white text-xs font-bold border border-white/5 transition-all shadow-md active:scale-95 cursor-pointer">
            <Upload className="w-4 h-4 text-blue-400" />
            <span>Yedekten Geri Yükle</span>
            <input
              type="file"
              accept=".json,.enc.json,application/json,text/plain"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>
        </div>

        <p className="text-[11px] text-slate-500 text-center">
          💡 &quot;Yedekten Geri Yükle&quot; butonu hem şifreli hem standart yedek dosyalarını otomatik algılar.
        </p>

        {/* Reset to Sample Data */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-300 block">Örnek Verileri Yeniden Yükle</span>
            <span className="text-[11px] text-slate-500">Sistemi zengin ve gerçekçi örnek verilerle baştan başlatır</span>
          </div>

          <button
            onClick={handleResetSample}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-white/5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Örnek Verileri Yükle</span>
          </button>
        </div>

        {/* Delete All Data */}
        <div className="pt-3 border-t border-rose-500/10 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-rose-400 block">Tüm Verileri Sil</span>
            <span className="text-[11px] text-slate-500">Kayıtlı grupları, hesapları, bütçeyi ve varlık hareketlerini kalıcı olarak siler</span>
          </div>

          <button
            onClick={handleClearAllData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-xs font-semibold text-rose-400 border border-rose-500/30 transition-colors active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Tüm Verileri Sil</span>
          </button>
        </div>
      </div>

      {/* PWA Install Card (only shown when not installed/standalone) */}
      {!isStandalone && (
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Ana Ekrana Ekle</span>
              <span className="text-[11px] text-slate-400">Tam ekran ve çevrimdışı yerel uygulama deneyimi</span>
            </div>
          </div>

          {deferredPrompt ? (
            <button
              type="button"
              onClick={onTriggerInstall}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Yükle</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenInstallModal}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-amber-400/20 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              Nasıl Eklenir? 📲
            </button>
          )}
        </div>
      )}

      {/* SECTION 3: PRIVACY & ARCHITECTURE NOTE */}
      <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-2 text-xs text-slate-400">
        <div className="font-bold text-slate-300 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>%100 Local-First Gizlilik Güvencesi</span>
        </div>
        <p>
          Bizim Kasa uygulamasındaki tüm bütçe, altın, döviz ve fon verileriniz yalnızca bu cihazın yerel tarayıcı veritabanında (IndexedDB) tutulur. Hiçbir harici sunucuya aktarılmaz ve gizliliğiniz tamamen size aittir.
        </p>
      </div>

      {/* SECTION 4: VERSION & CACHE UPDATE */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Bizim Kasa</span>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                v{APP_VERSION}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Son Güncelleme: {APP_BUILD_DATE} • Yerel Sürüm
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleForceCacheRefresh}
          disabled={isRefreshingCache}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-white/5 active:scale-95 transition-all shrink-0 cursor-pointer disabled:opacity-50 shadow-sm"
          title="Servis işçisi ve tarayıcı önbelleğini temizleyerek en güncel sürümü yükler"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isRefreshingCache ? 'animate-spin text-amber-400' : ''}`} />
          <span>{isRefreshingCache ? 'Yenileniyor...' : 'Sürümü Yenile & Önbelleği Temizle'}</span>
        </button>
      </div>

      {/* Minimal Footer */}
      <div className="pt-1 pb-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-[11px] text-slate-500">
        <span className="font-mono">Bizim Kasa v{APP_VERSION}</span>
        <span className="hidden sm:inline opacity-40">•</span>
        <a
          href="https://github.com/aranelpalantir/BizimKasa"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          <GithubIcon className="w-3.5 h-3.5" />
          <span>GitHub Deposu (Açık Kaynak)</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* PIN Setup / Change Modal */}
      <Modal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPinError(null);
          setCurrentPin('');
          setNewPin('');
          setConfirmPin('');
        }}
        title={settings.pinHash ? 'PIN Kodunu Değiştir' : 'Uygulama PIN Kodu Belirle'}
      >
        <div className="space-y-4">
          {settings.pinHash && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Mevcut PIN Kodunuz
              </label>
              <input
                ref={currentPinInputRef}
                autoFocus
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={6}
                value={currentPin}
                onChange={(e) => {
                  setCurrentPin(e.target.value.replace(/\D/g, ''));
                  setPinError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    pinInputRef.current?.focus();
                  }
                }}
                placeholder="••••"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-center text-xl tracking-widest focus:outline-none focus:border-amber-400"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              {settings.pinHash ? 'Yeni 4 veya 6 Haneli PIN' : '4 veya 6 Haneli Sayısal PIN'}
            </label>
            <input
              ref={pinInputRef}
              autoFocus={!settings.pinHash}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              value={newPin}
              onChange={(e) => {
                setNewPin(e.target.value.replace(/\D/g, ''));
                setPinError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (!confirmPin) {
                    confirmPinInputRef.current?.focus();
                  } else {
                    handleSavePin();
                  }
                }
              }}
              placeholder="••••"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-center text-xl tracking-widest focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              {settings.pinHash ? 'Yeni PIN Kodunu Tekrar Girin' : 'PIN Kodunu Tekrar Girin'}
            </label>
            <input
              ref={confirmPinInputRef}
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => {
                setConfirmPin(e.target.value.replace(/\D/g, ''));
                setPinError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePin();
              }}
              placeholder="••••"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-center text-xl tracking-widest focus:outline-none focus:border-amber-400"
            />
          </div>

          {pinError && (
            <p className="text-xs text-rose-400 font-medium">{pinError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setIsPinModalOpen(false);
                setPinError(null);
                setCurrentPin('');
                setNewPin('');
                setConfirmPin('');
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSavePin}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
            >
              {settings.pinHash ? 'PIN Kodunu Güncelle' : 'PIN Kodunu Kaydet'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Step-Up PIN Authorization Modal */}
      <Modal
        isOpen={!!pinAuthRequest}
        onClose={() => {
          setPinAuthRequest(null);
          setPinAuthInput('');
          setPinAuthError(null);
        }}
        title={pinAuthRequest?.title || 'PIN Doğrulaması'}
      >
        <div className="space-y-4">
          <div className={`p-3 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
            pinAuthRequest?.isDestructive
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-200/90'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-200/90'
          }`}>
            <Lock className={`w-4 h-4 shrink-0 mt-0.5 ${
              pinAuthRequest?.isDestructive ? 'text-rose-400' : 'text-amber-400'
            }`} />
            <span>{pinAuthRequest?.description || 'Devam etmek için lütfen PIN kodunuzu girin.'}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 text-center">
              Mevcut PIN Kodunuzu Girin
            </label>
            <input
              ref={pinAuthInputRef}
              autoFocus
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              value={pinAuthInput}
              onChange={(e) => {
                setPinAuthInput(e.target.value.replace(/\D/g, ''));
                setPinAuthError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVerifyPinAuth();
              }}
              placeholder="••••"
              className={`w-full px-4 py-2.5 rounded-xl bg-slate-950 border text-white font-mono text-center text-xl tracking-widest focus:outline-none transition-colors ${
                pinAuthRequest?.isDestructive
                  ? 'border-rose-500/30 focus:border-rose-400'
                  : 'border-white/10 focus:border-amber-400'
              }`}
            />
          </div>

          {pinAuthError && (
            <p className="text-xs text-rose-400 font-medium text-center">{pinAuthError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setPinAuthRequest(null);
                setPinAuthInput('');
                setPinAuthError(null);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
            >
              Vazgeç
            </button>
            <button
              onClick={handleVerifyPinAuth}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                pinAuthRequest?.isDestructive
                  ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              }`}
            >
              {pinAuthRequest?.confirmButtonText || 'Onayla'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Encrypted Export Modal */}
      <Modal
        isOpen={isEncryptedExportModalOpen}
        onClose={() => {
          setIsEncryptedExportModalOpen(false);
          setExportError(null);
        }}
        title="Şifreli Yedek Oluştur (AES-256)"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
            Bu dosya yalnızca belirleyeceğiniz parola ile açılabilir. Şifrenizi unutursanız yedek içerisindeki veriler kurtarılamaz.
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Yedek Şifresi (En az 4 karakter)
            </label>
            <div className="relative">
              <input
                ref={exportPasswordInputRef}
                autoFocus
                type={showExportPassword ? 'text' : 'password'}
                value={exportPassword}
                onChange={(e) => {
                  setExportPassword(e.target.value);
                  setExportError(null);
                }}
                placeholder="Güçlü bir parola girin"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => setShowExportPassword(!showExportPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                {showExportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Şifreyi Tekrar Girin
            </label>
            <input
              type={showExportPassword ? 'text' : 'password'}
              value={confirmExportPassword}
              onChange={(e) => {
                setConfirmExportPassword(e.target.value);
                setExportError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExecuteEncryptedExport();
              }}
              placeholder="Şifreyi doğrulayın"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          {exportError && (
            <p className="text-xs text-rose-400 font-medium">{exportError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsEncryptedExportModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              onClick={handleExecuteEncryptedExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 disabled:opacity-50 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Şifreleniyor...' : 'Şifrele ve İndir'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Decrypt & Restore Modal */}
      <Modal
        isOpen={isDecryptModalOpen}
        onClose={() => {
          setIsDecryptModalOpen(false);
          setDecryptError(null);
          setImportPassword('');
        }}
        title="Şifreli Yedeği Aç & Geri Yükle"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200/90 leading-relaxed">
            Seçtiğiniz yedek dosyası <strong>AES-256-GCM</strong> ile şifrelenmiştir. Devam etmek için bu yedeğe ait parolayı girin.
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Yedek Parolası
            </label>
            <div className="relative">
              <input
                ref={importPasswordInputRef}
                autoFocus
                type={showImportPassword ? 'text' : 'password'}
                value={importPassword}
                onChange={(e) => {
                  setImportPassword(e.target.value);
                  setDecryptError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleExecuteDecryptRestore();
                }}
                placeholder="Parolanızı girin"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-400"
              />
              <button
                type="button"
                onClick={() => setShowImportPassword(!showImportPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
              >
                {showImportPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {decryptError && (
            <p className="text-xs text-rose-400 font-medium">{decryptError}</p>
          )}

          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
            ⚠️ Uyarı: Parola doğru çözüldüğünde mevcut veriler silinip yedek içeriği yüklenecektir.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsDecryptModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              onClick={handleExecuteDecryptRestore}
              disabled={isDecrypting}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-400 disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isDecrypting ? 'Çözülüyor...' : 'Şifreyi Çöz ve Yükle'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        isDestructive={confirmState.isDestructive}
      />

      {/* Edit Account Modal */}
      <EditAccountModal
        isOpen={!!editingGroup}
        onClose={() => setEditingGroup(null)}
        group={editingGroup}
      />

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isAddAccountModalOpen}
        onClose={() => setIsAddAccountModalOpen(false)}
      />
    </div>
  );
};
