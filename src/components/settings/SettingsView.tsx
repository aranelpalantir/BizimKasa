import React, { useState } from 'react';
import { 
  Shield, 
  KeyRound, 
  Fingerprint, 
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
  ExternalLink
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { GithubIcon } from '../common/GithubIcon';
import { hashPin, registerBiometrics, updateSettings } from '../../services/securityService';
import { 
  exportDatabaseToJSON, 
  exportEncryptedBackup,
  inspectBackupFile,
  restoreEncryptedBackup,
  restorePlainBackup,
  resetToSampleData, 
  clearAllDatabaseData 
} from '../../services/exportService';
import type { AppSettings } from '../../types/finance';

interface SettingsViewProps {
  settings: AppSettings;
  onRefreshSettings: () => void;
  onLock: () => void;
  onOpenInstallModal?: () => void;
  isStandalone?: boolean;
  deferredPrompt?: any;
  onTriggerInstall?: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefreshSettings,
  onLock,
  onOpenInstallModal,
  isStandalone,
  deferredPrompt,
  onTriggerInstall
}) => {
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

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

  const handleSavePin = async () => {
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
      setNewPin('');
      setConfirmPin('');
      showFeedback('success', 'PIN kodu başarıyla kaydedildi!');
    } catch (err: any) {
      setPinError(`Kayıt sırasında hata oluştu: ${err?.message || 'Bilinmeyen hata'}`);
    }
  };

  const handleRemovePin = () => {
    setConfirmState({
      isOpen: true,
      title: 'PIN Korumasını Kaldır',
      message: 'Uygulama PIN koruması ve biyometrik kilit devre dışı bırakılacaktır. Onaylıyor musunuz?',
      confirmText: 'Kaldır',
      isDestructive: true,
      onConfirm: async () => {
        await updateSettings({
          pinHash: undefined,
          pinLength: undefined,
          biometricsEnabled: false,
          biometricCredentialId: undefined
        });
        onRefreshSettings();
        showFeedback('success', 'PIN koruması kaldırıldı.');
      }
    });
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
      await updateSettings({
        biometricsEnabled: false,
        biometricCredentialId: undefined
      });
      onRefreshSettings();
      showFeedback('success', 'Biyometrik doğrulama devre dışı bırakıldı.');
    }
  };

  const handleAutoLockChange = async (minutes: number) => {
    await updateSettings({ autoLockMinutes: minutes });
    onRefreshSettings();
  };

  const handleBackupExport = async () => {
    try {
      await exportDatabaseToJSON();
      showFeedback('success', 'Yedek dosyası cihazınıza indirildi.');
    } catch {
      showFeedback('error', 'Yedekleme sırasında hata oluştu.');
    }
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
          onConfirm: async () => {
            const res = await restorePlainBackup(check.data);
            if (res.success) {
              showFeedback('success', res.message);
              setTimeout(() => window.location.reload(), 800);
            } else {
              showFeedback('error', res.message);
            }
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
  };

  const handleResetSample = () => {
    setConfirmState({
      isOpen: true,
      title: 'Örnek Verileri Yükle',
      message: 'Mevcut tüm veriler sıfırlanıp zengin ve gerçekçi örnek başlangıç verileri yeniden yüklenecektir. Bu işlemi onaylıyor musunuz?',
      confirmText: 'Örnek Verileri Yükle',
      isDestructive: true,
      onConfirm: async () => {
        await resetToSampleData();
        showFeedback('success', 'Örnek veriler başarıyla yüklendi.');
        setTimeout(() => window.location.reload(), 800);
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
      onConfirm: async () => {
        try {
          await clearAllDatabaseData();
          showFeedback('success', 'Tüm kullanıcı verileri başarıyla silindi.');
          setTimeout(() => window.location.reload(), 800);
        } catch (err: any) {
          showFeedback('error', `Silme işlemi sırasında hata oluştu: ${err?.message || 'Bilinmeyen hata'}`);
        }
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

        {/* Biometrics (FaceID / TouchID) */}
        <div className={`flex items-center justify-between py-2 border-b border-white/5 transition-opacity ${!settings.pinHash ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl transition-colors ${settings.pinHash ? 'bg-slate-800 text-slate-300' : 'bg-slate-800/50 text-slate-500'}`}>
              <Fingerprint className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white block">Biyometrik Kilit (FaceID / Parmak İzi)</span>
                {!settings.pinHash && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-semibold border border-amber-500/20">
                    PIN Gerekli
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 block">
                {settings.pinHash 
                  ? 'Telefonun donanımsal biyometrisi ile anında açılış' 
                  : 'Etkinleştirebilmek için önce yukarıdan bir PIN kodu belirlemelisiniz'}
              </span>
              {settings.biometricsEnabled && (
                <span className="text-[11px] text-amber-400/90 block mt-1">
                  💡 iOS İpucu: Apple yerel Face ID tarayıcısının doğrudan tetiklenmesi için anahtarı harici uygulama (KeePass vb.) yerine <strong>iCloud Anahtar Zinciri</strong>'ne kaydedin.
                </span>
              )}
              {typeof window !== 'undefined' && !window.isSecureContext && (
                <span className="text-[10px] text-amber-400/90 block mt-0.5">
                  ⚠️ Apple güvenlik kuralı: Yalnızca HTTPS bağlantısında (örn: Cloudflare Pages) çalışır.
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleToggleBiometrics}
            title={settings.pinHash ? 'Biyometrik Kilidi Aç/Kapat' : 'Önce PIN kodu belirlemelisiniz'}
            className={`w-12 h-6.5 rounded-full transition-all relative p-0.5 border cursor-pointer ${
              settings.biometricsEnabled
                ? 'bg-emerald-500 border-emerald-400'
                : settings.pinHash
                  ? 'bg-slate-800 border-white/10 hover:border-white/20'
                  : 'bg-slate-800/50 border-white/5'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.biometricsEnabled ? 'translate-x-5.5' : 'translate-x-0'
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
              accept=".json"
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

      {/* Minimal Footer */}
      <div className="pt-1 pb-4 flex items-center justify-center text-[11px] text-slate-500">
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

      {/* PIN Setup Modal */}
      <Modal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPinError(null);
        }}
        title="Uygulama PIN Kodu Belirle"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              4 veya 6 Haneli Sayısal PIN
            </label>
            <input
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
                if (e.key === 'Enter') handleSavePin();
              }}
              placeholder="••••"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white font-mono text-center text-xl tracking-widest focus:outline-none focus:border-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              PIN Kodunu Tekrar Girin
            </label>
            <input
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
              onClick={() => setIsPinModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Vazgeç
            </button>
            <button
              onClick={handleSavePin}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
            >
              PIN Kodunu Kaydet
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
    </div>
  );
};
