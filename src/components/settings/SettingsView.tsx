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
  Plus,
  Cloud,
  CloudUpload,
  CloudDownload,
  LogOut,
  RefreshCw
} from 'lucide-react';
import {
  requestGoogleAccessToken,
  disconnectGoogleDrive,
  getConnectedUserEmail,
  uploadToGoogleDrive,
  fetchFromGoogleDrive,
  syncWithGoogleDrive,
  getLastSyncTime,
  isGoogleDriveConfigured,
  isGoogleDriveTokenValid
} from '../../services/googleDriveService';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { GithubIcon } from '../common/GithubIcon';
import { EditAccountModal } from '../common/EditAccountModal';
import { AddAccountModal } from '../common/AddAccountModal';
import { getThemeColorName } from '../../constants/themeColors';
import { db } from '../../db/db';
import { APP_VERSION, APP_BUILD_DATE } from '../../version';
import { 
  hashPin, 
  verifyPin, 
  registerBiometrics, 
  updateSettings, 
  setSessionPin, 
  getSessionPin,
  isBiometricsActiveForDevice,
  isMobileDevice,
  setDeviceBiometrics
} from '../../services/securityService';
import { 
  exportDatabaseToJSON, 
  exportEncryptedBackup,
  inspectBackupFile,
  restorePlainBackup,
  decryptBackupPayload,
  resetToSampleData, 
  clearAllDatabaseData 
} from '../../services/exportService';
import type { AppSettings, Group } from '../../types/finance';
import { formatLastModified, formatFullDateTime, compareTimestamps } from '../../utils/dateUtils';

interface SettingsViewProps {
  settings: AppSettings;
  groups: Group[];
  onRefreshSettings: () => void;
  onLock: () => void;
  onOpenInstallModal?: () => void;
  isStandalone?: boolean;
  deferredPrompt?: any;
  onTriggerInstall?: () => Promise<void>;
  lastModifiedAt?: string;
}

interface PinAuthRequest {
  title: string;
  description: string;
  confirmButtonText?: string;
  isDestructive?: boolean;
  onSuccess: (enteredPin?: string) => void | Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  groups,
  onRefreshSettings,
  onLock,
  onOpenInstallModal,
  isStandalone,
  deferredPrompt,
  onTriggerInstall,
  lastModifiedAt
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

  // Google Drive Sync state
  const [isGdriveConfigured, setIsGdriveConfigured] = useState(isGoogleDriveConfigured());
  const [isTokenActive, setIsTokenActive] = useState(isGoogleDriveTokenValid());
  const [gdriveEmail, setGdriveEmail] = useState<string | null>(getConnectedUserEmail());
  const [isGdriveSyncing, setIsGdriveSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTimeState] = useState<string | null>(getLastSyncTime());

  // Google Drive durumunu odaklanma ve sekme görünürlüğünde tazele
  useEffect(() => {
    const refreshGdriveState = () => {
      setIsGdriveConfigured(isGoogleDriveConfigured());
      setIsTokenActive(isGoogleDriveTokenValid());
      setGdriveEmail(getConnectedUserEmail());
      setLastSyncTimeState(getLastSyncTime());
    };
    window.addEventListener('focus', refreshGdriveState);
    document.addEventListener('visibilitychange', refreshGdriveState);
    return () => {
      window.removeEventListener('focus', refreshGdriveState);
      document.removeEventListener('visibilitychange', refreshGdriveState);
    };
  }, []);

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
    message: React.ReactNode;
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
    onSuccess: (enteredPin?: string) => void | Promise<void>,
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

    const entered = pinAuthInput;
    const action = pinAuthRequest.onSuccess;
    setSessionPin(entered);
    setPinAuthRequest(null);
    setPinAuthInput('');
    setPinAuthError(null);
    await action(entered);
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
      setSessionPin(newPin);
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
        setSessionPin(null);
        onRefreshSettings();
        showFeedback('success', 'PIN koruması kaldırıldı.');
      },
      { confirmButtonText: 'Kaldır', isDestructive: true }
    );
  };

  const isBioActive = isBiometricsActiveForDevice(settings);
  const isMobile = isMobileDevice();

  const handleToggleBiometrics = async () => {
    if (!settings.pinHash) {
      showFeedback('error', 'Biyometrik kilit için önce yukarıdan bir PIN kodu belirlemelisiniz.');
      setIsPinModalOpen(true);
      return;
    }

    if (!isBioActive) {
      const res = await registerBiometrics();
      if (res.success) {
        setDeviceBiometrics(true, res.credentialId);
        await updateSettings({
          biometricsEnabled: true,
          biometricCredentialId: res.credentialId
        });
        onRefreshSettings();
        showFeedback('success', isMobile 
          ? 'Biyometrik doğrulama (Face ID / Touch ID) bu cihazda aktifleştirildi.' 
          : 'Biyometrik doğrulama (Geçiş Anahtarı / Windows Hello) bu cihazda aktifleştirildi.');
      } else {
        showFeedback('error', res.errorReason || 'Biyometrik sensör bulunamadı veya onaylanmadı.');
      }
    } else {
      // Prompt for PIN to disable biometrics
      requirePinAuth(
        'Biyometrik Korumayı Kapat',
        'Biyometrik doğrulamayı devre dışı bırakmak için lütfen mevcut PIN kodunuzu girin.',
        async () => {
          setDeviceBiometrics(false);
          await updateSettings({
            biometricsEnabled: false,
            biometricCredentialId: undefined
          });
          onRefreshSettings();
          showFeedback('success', 'Biyometrik doğrulama bu cihazda devre dışı bırakıldı.');
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
        setEncryptedBackupData({
          ...check.data,
          lastModifiedAt: check.lastModifiedAt
        });
        setImportPassword('');
        setDecryptError(null);
        setIsDecryptModalOpen(true);
      } else {
        const fileDate = check.lastModifiedAt;
        const comparison = compareTimestamps(fileDate, lastModifiedAt);
        const isOlder = comparison === 'older';

        const dialogMessage = (
          <div className="space-y-3 pt-1">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 space-y-2 text-xs">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400">📁 Seçilen Yedek:</span>
                <span className="text-white font-mono font-medium text-right">{formatFullDateTime(fileDate)}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400">💻 Bu Cihazdaki Veriler:</span>
                <span className="text-white font-mono font-medium text-right">{formatFullDateTime(lastModifiedAt)}</span>
              </div>
            </div>

            {comparison === 'newer' && (
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 font-medium flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Seçilen yedek, bu cihazdaki son işlemden daha <strong>GÜNCEL</strong>.</span>
              </div>
            )}

            {comparison === 'older' && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 font-medium flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span>
                  <strong>DİKKAT:</strong> Seçilen yedek dosyası, bu cihazdaki son değişiklikten <strong>DAHA ESKİ</strong>! Yedeği yüklerseniz bu cihazdaki yeni işlemleriniz silinecektir.
                </span>
              </div>
            )}

            {comparison === 'equal' && (
              <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-xs text-blue-300 font-medium flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0 text-blue-400" />
                <span>Yedek dosyası ile bu cihazdaki veriler <strong>aynı tarihe</strong> sahip.</span>
              </div>
            )}

            <p className="text-xs text-slate-300 leading-relaxed">
              Mevcut tüm veriler silinecek ve seçtiğiniz standart yedek içeriği yüklenecektir. Bu işlemi onaylıyor musunuz?
            </p>
          </div>
        );

        setConfirmState({
          isOpen: true,
          title: isOlder ? '⚠️ Eski Yedek Uyarısı' : 'Yedekten Geri Yükle',
          message: dialogMessage,
          confirmText: isOlder ? 'Yine de Yükle' : 'Yedeği Yükle',
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

    setIsDecrypting(true);
    setDecryptError(null);

    let decryptedData: any = null;
    try {
      decryptedData = await decryptBackupPayload(encryptedBackupData, importPassword);
    } catch {
      setIsDecrypting(false);
      setDecryptError('Girdiğiniz yedek şifresi hatalı! Lütfen kontrol edin.');
      return;
    }

    setIsDecrypting(false);
    setIsDecryptModalOpen(false);

    try {
      const res = await restorePlainBackup(decryptedData);
      if (res.success) {
        setSessionPin(importPassword);
        showFeedback('success', 'Yedek başarıyla çözüldü, verileriniz ve PIN kodunuz güncellendi!');
        setTimeout(() => window.location.reload(), 800);
      } else {
        showFeedback('error', res.message);
      }
    } catch (err: any) {
      showFeedback('error', err?.message || 'Geri yükleme hatası!');
    }
  };

  const handleToggleAutoSync = async () => {
    const nextVal = !settings.autoSyncGoogleDrive;
    await updateSettings({ autoSyncGoogleDrive: nextVal });
    onRefreshSettings();
    if (nextVal) {
      showFeedback('success', 'Otomatik eşitleme açıldı. Senkronizasyon başlatılıyor...');
      setIsGdriveSyncing(true);
      try {
        const res = await syncWithGoogleDrive();
        setLastSyncTimeState(getLastSyncTime());
        if (res.action === 'downloaded') {
          showFeedback('success', 'Buluttan güncel veriler çekildi.');
          setTimeout(() => window.location.reload(), 500);
        } else if (res.action === 'uploaded') {
          showFeedback('success', 'Verileriniz bulutla başarıyla eşitlendi!');
        } else if (res.action === 'prompt_pin') {
          setImportPassword('');
          setEncryptedBackupData(res.remoteData);
          setIsDecryptModalOpen(true);
        } else {
          showFeedback('success', res.message);
        }
      } catch (err: any) {
        showFeedback('error', `Eşitleme hatası: ${err?.message || 'Bilinmeyen hata'}`);
      } finally {
        setIsGdriveSyncing(false);
      }
    } else {
      showFeedback('success', 'Otomatik eşitleme kapatıldı (Manuel mod).');
    }
  };

  const handleSyncNow = async () => {
    setIsGdriveSyncing(true);
    try {
      if (!isGoogleDriveTokenValid()) {
        await requestGoogleAccessToken(false);
        setIsTokenActive(true);
        setGdriveEmail(getConnectedUserEmail());
      }
      const res = await syncWithGoogleDrive();
      setLastSyncTimeState(getLastSyncTime());
      setIsTokenActive(isGoogleDriveTokenValid());
      if (res.action === 'downloaded') {
        showFeedback('success', 'Buluttan yeni veriler alındı, yenileniyor...');
        setTimeout(() => window.location.reload(), 500);
      } else if (res.action === 'uploaded') {
        showFeedback('success', 'Yerel veriler buluta yüklendi.');
        onRefreshSettings();
      } else if (res.action === 'prompt_pin') {
        setImportPassword('');
        setEncryptedBackupData(res.remoteData);
        setIsDecryptModalOpen(true);
      } else if (res.action === 'error') {
        showFeedback('error', res.message);
      } else {
        showFeedback('success', res.message || 'Verileriniz zaten güncel.');
      }
    } catch (err: any) {
      showFeedback('error', `Eşitleme hatası: ${err?.message || 'Bilinmeyen hata'}`);
    } finally {
      setIsGdriveSyncing(false);
    }
  };

  const handleConnectGoogleDrive = async () => {
    setIsGdriveSyncing(true);
    try {
      await requestGoogleAccessToken(true);
      setIsGdriveConfigured(true);
      setIsTokenActive(true);
      setGdriveEmail(getConnectedUserEmail());
      showFeedback('success', 'Google Drive başarıyla bağlandı!');
    } catch (err: any) {
      showFeedback('error', err?.message || 'Google Drive bağlantısı kurulamadı.');
    } finally {
      setIsGdriveSyncing(false);
    }
  };

  const handleRefreshGoogleSession = async () => {
    setIsGdriveSyncing(true);
    try {
      await requestGoogleAccessToken(false);
      setIsTokenActive(true);
      setGdriveEmail(getConnectedUserEmail());
      showFeedback('success', 'Google oturumu başarıyla yenilendi!');
    } catch (err: any) {
      showFeedback('error', err?.message || 'Google oturumu yenilenemedi.');
    } finally {
      setIsGdriveSyncing(false);
    }
  };

  const handleDisconnectGoogleDrive = () => {
    disconnectGoogleDrive();
    setIsGdriveConfigured(false);
    setIsTokenActive(false);
    setGdriveEmail(null);
    showFeedback('success', 'Google Drive bağlantısı kaldırıldı.');
  };

  const handleUploadGoogleDrive = () => {
    if (!settings.pinHash) {
      showFeedback('error', 'Buluta şifreli yedekleme için önce bir PIN kodu belirlemelisiniz.');
      setIsPinModalOpen(true);
      return;
    }

    const sessionPin = getSessionPin();
    if (sessionPin) {
      executeUploadToDrive(sessionPin);
      return;
    }

    requirePinAuth(
      'PIN ile Şifrele ve Buluta Gönder',
      'Finansal verileriniz PIN kodunuzla askeri düzeyde (AES-256) şifrelenerek Google Drive özel alanınıza yüklenecektir.',
      async (verifiedPin) => {
        if (verifiedPin) setSessionPin(verifiedPin);
        await executeUploadToDrive(verifiedPin);
      },
      { confirmButtonText: 'Şifrele ve Gönder' }
    );
  };

  const executeUploadToDrive = async (pin?: string) => {
    setIsGdriveSyncing(true);
    try {
      if (!isGoogleDriveTokenValid()) {
        await requestGoogleAccessToken(false);
        setIsTokenActive(true);
        setGdriveEmail(getConnectedUserEmail());
      }
      const res = await uploadToGoogleDrive(pin);
      setLastSyncTimeState(res.modifiedTime);
      setIsTokenActive(isGoogleDriveTokenValid());
      showFeedback('success', 'Verileriniz PIN kodunuz ile şifrelenerek Google Drive’a başarıyla yüklendi!');
    } catch (err: any) {
      showFeedback('error', `Eşitleme başarısız: ${err?.message || 'Bilinmeyen hata'}`);
    } finally {
      setIsGdriveSyncing(false);
    }
  };

  const handleDownloadGoogleDrive = async () => {
    setIsGdriveSyncing(true);
    try {
      if (!isGoogleDriveTokenValid()) {
        await requestGoogleAccessToken(false);
        setIsTokenActive(true);
        setGdriveEmail(getConnectedUserEmail());
      }
      const res = await fetchFromGoogleDrive();
      setIsTokenActive(isGoogleDriveTokenValid());
      if (!res) {
        showFeedback('error', 'Google Drive üzerinde henüz BizimKasa yedeği bulunamadı.');
        return;
      }

      if (res.isEncrypted) {
        // Buluttaki dosya şifreli: PIN sormak için şifre çözme modalını aç
        setEncryptedBackupData({
          ...res.fileData,
          lastModifiedAt: res.lastModifiedAt
        });
        setImportPassword('');
        setDecryptError(null);
        setIsDecryptModalOpen(true);
        return;
      }

      // Şifresiz dosya ise standart tarih kontrolü ve onay
      const fileDate = res.lastModifiedAt;
      const comparison = compareTimestamps(fileDate, lastModifiedAt);
      const isOlder = comparison === 'older';

      const dialogMessage = (
        <div className="space-y-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 space-y-2 text-xs">
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-400">☁️ Google Drive Yedeği:</span>
              <span className="text-white font-mono font-medium text-right">{formatFullDateTime(fileDate)}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-400">💻 Bu Cihazdaki Veriler:</span>
              <span className="text-white font-mono font-medium text-right">{formatFullDateTime(lastModifiedAt)}</span>
            </div>
          </div>

          {comparison === 'newer' && (
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 font-medium flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Google Drive'daki yedek, bu cihazdaki son işlemden daha <strong>GÜNCEL</strong>.</span>
            </div>
          )}

          {comparison === 'older' && (
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>
                <strong>DİKKAT:</strong> Google Drive'daki yedek, bu cihazdaki son değişiklikten <strong>DAHA ESKİ</strong>! Yüklerseniz bu cihazdaki yeni işlemleriniz silinecektir.
              </span>
            </div>
          )}

          {comparison === 'equal' && (
            <div className="p-2.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-xs text-blue-300 font-medium flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-blue-400" />
              <span>Google Drive'daki yedek ile bu cihazdaki veriler <strong>aynı tarihe</strong> sahip.</span>
            </div>
          )}

          <p className="text-xs text-slate-300 leading-relaxed">
            Mevcut tüm veriler silinecek ve Google Drive'daki yedek yüklenecektir. Bu işlemi onaylıyor musunuz?
          </p>
        </div>
      );

      setConfirmState({
        isOpen: true,
        title: isOlder ? '⚠️ Eski Bulut Yedeği Uyarısı' : 'Google Drive’dan Geri Yükle',
        message: dialogMessage,
        confirmText: isOlder ? 'Yine de Yükle' : 'Yedeği Yükle',
        isDestructive: true,
        onConfirm: () => {
          requirePinAuth(
            'Bulut Yedeğini Geri Yükleme Onayı',
            'Google Drive yedeğini bu cihaza geri yüklemek için lütfen PIN kodunuzu girin.',
            async () => {
              const r = await restorePlainBackup(res.fileData);
              if (r.success) {
                showFeedback('success', 'Google Drive yedeği başarıyla geri yüklendi!');
                setTimeout(() => window.location.reload(), 800);
              } else {
                showFeedback('error', r.message);
              }
            },
            { confirmButtonText: 'Yükle', isDestructive: true }
          );
        }
      });
    } catch (err: any) {
      showFeedback('error', `Buluttan yükleme hatası: ${err?.message || 'Bilinmeyen hata'}`);
    } finally {
      setIsGdriveSyncing(false);
    }
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

        {/* Biometrics (Face ID / Touch ID / Windows Hello) */}
        <div className={`flex items-center justify-between py-3 border-b border-white/5 transition-opacity ${!settings.pinHash ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <div className={`p-2 rounded-xl shrink-0 transition-colors ${
              isBioActive 
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                : settings.pinHash 
                  ? 'bg-slate-800 text-slate-300 border border-white/5' 
                  : 'bg-slate-800/50 text-slate-500 border border-white/5'
            }`}>
              <ScanFace className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white block">
                  {isMobile ? 'Face ID / Parmak İzi' : 'Geçiş Anahtarı / Windows Hello'}
                </span>
                {!settings.pinHash && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-semibold border border-amber-500/20 shrink-0">
                    PIN Gerekli
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 block">
                {settings.pinHash 
                  ? (isMobile ? 'Cihaz biyometrisi ile PIN girmeden anında açılış (Bu cihaza özel)' : 'Bu tarayıcıda Windows Hello / geçiş anahtarı ile giriş (Bu cihaza özel)')
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
            title={settings.pinHash ? 'Biyometrik Kilidi Aç/Kapat' : 'Önce PIN kodu belirlemelisiniz'}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isBioActive
                ? 'bg-emerald-500'
                : settings.pinHash
                  ? 'bg-slate-700 hover:bg-slate-600'
                  : 'bg-slate-800/60 opacity-50 cursor-not-allowed'
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                isBioActive ? 'translate-x-5' : 'translate-x-0'
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

      {/* SECTION 1.5: GOOGLE DRIVE CLOUD SYNC */}
      <div className="rounded-3xl bg-slate-900/80 border border-emerald-500/20 p-5 space-y-4 shadow-lg shadow-emerald-950/20">
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Google Drive ile Bulut Eşitleme</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Otomatik & Kolay
                </span>
              </div>
              <p className="text-xs text-slate-400">Telefon ve bilgisayarınız arasında tek tıkla zahmetsiz senkronizasyon</p>
            </div>
          </div>

          {isGdriveConfigured && (
            <button
              onClick={handleDisconnectGoogleDrive}
              title="Google Drive Bağlantısını Kes"
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 text-xs transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Bağlantı Durumu & Kontroller */}
        {!isGdriveConfigured ? (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800/60 to-slate-900 border border-white/10 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 shrink-0 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-1 text-xs leading-relaxed text-slate-300">
                <span className="font-semibold text-white block">Dosya İndir/Yükle Derdine Son</span>
                Google hesabınızı bağlayarak PC ve telefonunuzdaki BizimKasa verilerini doğrudan Google Drive özel alanınızla eşitleyebilirsiniz.
                <span className="block text-[11px] text-slate-400 pt-1">
                  🛡️ <strong>Sıfır Risk:</strong> Uygulama kişisel Drive dosyalarınıza ASLA erişemez; yalnızca kendi özel gizli yedek alanını kullanır.
                </span>
              </div>
            </div>

            <div className="pt-1">
              <button
                onClick={handleConnectGoogleDrive}
                disabled={isGdriveSyncing}
                className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                <span>{isGdriveSyncing ? 'Bağlanılıyor...' : 'Google Drive ile Bağlan'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Connected / Token Status Bar */}
            {isTokenActive ? (
              <div className="p-3 rounded-2xl bg-slate-950/70 border border-emerald-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-slate-300 font-medium">Bağlı Hesap:</span>
                  <span className="text-emerald-300 font-semibold">{gdriveEmail || 'Google Hesabı Bağlandı'}</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Aktif
                </span>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="text-slate-300 font-medium">Bağlı Hesap:</span>
                    <span className="text-amber-300 font-semibold">{gdriveEmail || 'Google Hesabı'}</span>
                  </div>
                  <span className="text-[10px] text-amber-300 font-medium bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                    Oturum Süresi Doldu
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-amber-500/15">
                  <p className="text-[11px] text-slate-400 leading-snug">
                    Google güvenlik kuralı gereği 1 saatlik erişim anahtarı doldu. Eşitlemeye devam etmek için oturumu yenileyin.
                  </p>
                  <button
                    type="button"
                    onClick={handleRefreshGoogleSession}
                    disabled={isGdriveSyncing}
                    className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-sm active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isGdriveSyncing ? 'animate-spin' : ''}`} />
                    <span>Oturumu Yenile</span>
                  </button>
                </div>
              </div>
            )}

            {/* Encryption status info */}
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-emerald-300 font-bold block">
                    PIN Korumalı AES-256 Şifreleme
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Verileriniz Google Drive'a gönderilirken PIN kodunuzla askeri düzeyde şifrelenir
                  </span>
                </div>
              </div>
            </div>

            {/* Auto-Sync Toggle Card */}
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 pr-2">
                  <div className={`p-2 rounded-xl transition-colors ${
                    settings.autoSyncGoogleDrive 
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    <RefreshCw className={`w-4 h-4 ${isGdriveSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white block">Otomatik Eşitleme (Tam Senkronizasyon)</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        settings.autoSyncGoogleDrive 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {settings.autoSyncGoogleDrive ? 'Açık' : 'Kapalı'}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      Verileriniz değiştikçe arka planda otomatik yükler; diğer cihazınızdaki yeni verileri otomatik çeker
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleAutoSync}
                  disabled={isGdriveSyncing}
                  title="Otomatik Eşitlemeyi Aç/Kapat"
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.autoSyncGoogleDrive ? 'bg-emerald-500' : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      settings.autoSyncGoogleDrive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {lastSyncTime && (
                <div className="px-3 py-1.5 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Son Bulut Eşitlemesi:</span>
                  <span className="text-emerald-400 font-mono font-semibold">{formatLastModified(lastSyncTime)}</span>
                </div>
              )}
            </div>

            {/* Sync Action Buttons */}
            <div className="space-y-2.5">
              {/* Şimdi Eşitle (Auto-Sync trigger) */}
              <button
                onClick={handleSyncNow}
                disabled={isGdriveSyncing}
                className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isGdriveSyncing ? 'animate-spin' : ''}`} />
                <span>{isGdriveSyncing ? 'Eşitleniyor...' : 'Şimdi Eşitle (Bulutla Senkronize Et)'}</span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Buluta Gönder (Upload) */}
                <button
                  onClick={handleUploadGoogleDrive}
                  disabled={isGdriveSyncing}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-white text-xs font-semibold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <CloudUpload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Buluta Gönder (PIN Korumalı)</span>
                </button>

                {/* Buluttan Al (Download) */}
                <button
                  onClick={handleDownloadGoogleDrive}
                  disabled={isGdriveSyncing}
                  className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-white text-xs font-semibold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <CloudDownload className="w-3.5 h-3.5 text-blue-400" />
                  <span>Buluttan Al (Geri Yükle)</span>
                </button>
              </div>
            </div>
          </div>
        )}
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

        {/* Device Sync & Last Modified Information Block */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800/60 to-slate-900 border border-white/10 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-400/10 text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Bu Cihazdaki Son Veri Değişikliği</span>
                <span className="text-[11px] text-slate-400">Yerel veritabanında son yapılan işlem tarihi</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20">
              {formatLastModified(lastModifiedAt)}
            </span>
          </div>

          <div className="px-3 py-2 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Tam Zaman Damgası:</span>
            <span className="text-white font-mono font-medium">{formatFullDateTime(lastModifiedAt)}</span>
          </div>

          <div className="pt-1.5 border-t border-white/5 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
            <Info className="w-4 h-4 text-amber-400/90 shrink-0 mt-0.5" />
            <span>
              <strong>Cihaz Eşitleme İpucu:</strong> Hem telefon hem bilgisayarda çalışıyorsanız, en güncel verinin hangi cihazda olduğunu buradaki son değişiklik saatinden anlayabilirsiniz. Yedek yüklerken sistem otomatik olarak dosya tarihiyle bu cihazı karşılaştırır ve sizi uyarır.
            </span>
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
              autoComplete="off"
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
              autoComplete="off"
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
        zIndex="z-[70]"
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
                autoComplete="off"
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
              autoComplete="off"
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

          {encryptedBackupData && (
            <div className="p-3 rounded-xl bg-slate-900 border border-white/10 space-y-2 text-xs">
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400">📁 Şifreli Yedek Tarihi:</span>
                <span className="text-white font-mono font-medium">
                  {formatFullDateTime(encryptedBackupData.lastModifiedAt || encryptedBackupData.exportDate)}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-slate-400">💻 Bu Cihazdaki Veriler:</span>
                <span className="text-white font-mono font-medium">
                  {formatFullDateTime(lastModifiedAt)}
                </span>
              </div>
              {compareTimestamps(encryptedBackupData.lastModifiedAt || encryptedBackupData.exportDate, lastModifiedAt) === 'older' && (
                <div className="pt-1.5 border-t border-rose-500/20 text-[11px] text-rose-300 flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                  <span>DİKKAT: Bu yedek bu cihazdaki mevcut verilerden daha eski!</span>
                </div>
              )}
            </div>
          )}

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
