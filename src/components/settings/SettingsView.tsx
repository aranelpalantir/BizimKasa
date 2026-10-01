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
  FileJson
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { hashPin, registerBiometrics, updateSettings } from '../../services/securityService';
import { exportDatabaseToJSON, importDatabaseFromJSON, resetToSampleData } from '../../services/exportService';
import type { AppSettings } from '../../types/finance';

interface SettingsViewProps {
  settings: AppSettings;
  onRefreshSettings: () => void;
  onLock: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefreshSettings,
  onLock
}) => {
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

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

    const hashed = await hashPin(newPin);
    await updateSettings({ pinHash: hashed });
    onRefreshSettings();
    setIsPinModalOpen(false);
    setNewPin('');
    setConfirmPin('');
    showFeedback('success', 'PIN kodu başarıyla kaydedildi!');
  };

  const handleRemovePin = async () => {
    if (window.confirm('PIN korumasını kaldırmak istediğinize emin misiniz?')) {
      await updateSettings({ pinHash: undefined, biometricsEnabled: false });
      onRefreshSettings();
      showFeedback('success', 'PIN koruması kaldırıldı.');
    }
  };

  const handleToggleBiometrics = async () => {
    if (!settings.biometricsEnabled) {
      const success = await registerBiometrics();
      if (success) {
        await updateSettings({ biometricsEnabled: true });
        onRefreshSettings();
        showFeedback('success', 'Biyometrik doğrulama (FaceID / TouchID) aktifleştirildi.');
      } else {
        showFeedback('error', 'Cihazınızda biyometrik sensör bulunamadı veya onaylanmadı.');
      }
    } else {
      await updateSettings({ biometricsEnabled: false });
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

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (window.confirm('Mevcut veriler silinip seçtiğiniz yedek yüklenecek. Onaylıyor musunuz?')) {
      const res = await importDatabaseFromJSON(file);
      if (res.success) {
        showFeedback('success', res.message);
        setTimeout(() => window.location.reload(), 1000);
      } else {
        showFeedback('error', res.message);
      }
    }
    e.target.value = '';
  };

  const handleResetSample = async () => {
    if (window.confirm('Tüm veriler sıfırlanıp Google Sheets başlangıç verileri yeniden yüklenecektir. Emin misiniz?')) {
      await resetToSampleData();
      showFeedback('success', 'Başlangıç verileri başarıyla geri yüklendi.');
      setTimeout(() => window.location.reload(), 800);
    }
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
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
              <Fingerprint className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold text-white block">Biyometrik Kilit (FaceID / Parmak İzi)</span>
              <span className="text-xs text-slate-400">Telefonun donanımsal biyometrisi ile anında açılış</span>
            </div>
          </div>

          <button
            onClick={handleToggleBiometrics}
            className={`w-12 h-6.5 rounded-full transition-colors relative p-0.5 border ${
              settings.biometricsEnabled
                ? 'bg-emerald-500 border-emerald-400'
                : 'bg-slate-800 border-white/10'
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
            <p className="text-xs text-slate-400">Verilerinizi tek tıkla JSON olarak saklayın veya yükleyin</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Download JSON */}
          <button
            onClick={handleBackupExport}
            className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-white text-xs font-bold border border-white/5 transition-all shadow-md active:scale-95"
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

        {/* Reset to Google Sheet Sample Data */}
        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-slate-300 block">Örnek Verileri Yeniden Yükle</span>
            <span className="text-[11px] text-slate-500">Google Sheets tablolarındaki ilk şablonu geri getirir</span>
          </div>

          <button
            onClick={handleResetSample}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-white/5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Şablonu Geri Yükle</span>
          </button>
        </div>
      </div>

      {/* SECTION 3: PRIVACY & ARCHITECTURE NOTE */}
      <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-2 text-xs text-slate-400">
        <div className="font-bold text-slate-300 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>%100 Local-First Gizlilik Güvencesi</span>
        </div>
        <p>
          BizimKasa uygulamasındaki tüm bütçe, altın, döviz ve fon verileriniz yalnızca bu cihazın yerel tarayıcı veritabanında (IndexedDB) tutulur. Hiçbir sunucuya gönderilmez ve üçüncü taraflarla paylaşılmaz.
        </p>
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
              maxLength={6}
              value={newPin}
              onChange={(e) => {
                setNewPin(e.target.value.replace(/\D/g, ''));
                setPinError(null);
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
              maxLength={6}
              value={confirmPin}
              onChange={(e) => {
                setConfirmPin(e.target.value.replace(/\D/g, ''));
                setPinError(null);
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
    </div>
  );
};
