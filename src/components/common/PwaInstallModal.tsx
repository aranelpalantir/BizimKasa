import React, { useState } from 'react';
import { Download, Share, PlusSquare, MoreVertical, Sparkles } from 'lucide-react';
import { Modal } from './Modal';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt?: any;
  onTriggerInstall?: () => Promise<void>;
}

export const PwaInstallModal: React.FC<PwaInstallModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onTriggerInstall
}) => {
  // Detect iOS default
  const isIosDevice = typeof window !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );

  const [activeOs, setActiveOs] = useState<'ios' | 'android'>(isIosDevice ? 'ios' : 'android');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ana Ekrana Ekleme Rehberi"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        {/* OS Segmented Control */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-950 border border-white/10 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveOs('ios')}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeOs === 'ios'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🍏 iPhone (Safari)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveOs('android')}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeOs === 'android'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🤖 Android / Chrome</span>
          </button>
        </div>

        {/* Direct One-Click Install Button if supported by browser */}
        {deferredPrompt && (
          <button
            type="button"
            onClick={async () => {
              if (onTriggerInstall) {
                await onTriggerInstall();
                onClose();
              }
            }}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>⚡ Tek Tıkla Uygulamayı Yükle</span>
          </button>
        )}

        {/* iOS Step by Step */}
        {activeOs === 'ios' && (
          <div className="space-y-2.5">
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/5 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div>
                <strong className="text-xs text-white block">Safari Tarayıcısında Açın</strong>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Bu sayfayı Apple Safari tarayıcısında görüntülediğinizden emin olun.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div>
                <strong className="text-xs text-amber-200 block flex items-center gap-1.5">
                  <span>Paylaş Simgesine Dokunun</span>
                  <Share className="w-3.5 h-3.5 text-amber-400 inline" />
                </strong>
                <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                  Safari'nin alt menü çubuğundaki <strong>Paylaş</strong> simgesine dokunun (kare içinde yukarı ok).
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/5 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <div>
                <strong className="text-xs text-white block flex items-center gap-1.5">
                  <span>"Ana Ekrana Ekle" Seçeneğini Seçin</span>
                  <PlusSquare className="w-3.5 h-3.5 text-slate-400 inline" />
                </strong>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Açılan menüyü hafifçe yukarı kaydırıp <strong>"Ana Ekrana Ekle"</strong> (+ simgesi) satırına tıklayın.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/5 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                4
              </span>
              <div>
                <strong className="text-xs text-white block">"Ekle" Butonuna Basın</strong>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Sağ üst köşedeki mavi <strong>"Ekle"</strong> düğmesine dokunun. Artık ana ekranınızda bağımsız bir uygulama olarak yer alacaktır.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Android Step by Step */}
        {activeOs === 'android' && (
          <div className="space-y-2.5">
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/5 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <div>
                <strong className="text-xs text-white block flex items-center gap-1.5">
                  <span>Chrome Menüsünü Açın</span>
                  <MoreVertical className="w-3.5 h-3.5 text-slate-400 inline" />
                </strong>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Tarayıcının sağ üst köşesindeki <strong>üç nokta (⋮)</strong> menü simgesine dokunun.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <div>
                <strong className="text-xs text-amber-200 block">"Uygulamayı Yükle"yi Seçin</strong>
                <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                  Menü seçenekleri arasından <strong>"Uygulamayı Yükle"</strong> veya <strong>"Ana Ekrana Ekle"</strong> satırına dokunun.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/5 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <div>
                <strong className="text-xs text-white block">Onaylayıp Yükleyin</strong>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  Açılan onay penceresinde <strong>"Yükle"</strong> düğmesine basın. Uygulama telefonunuzun ana ekranına eklenecektir.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Benefits Note */}
        <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5 text-xs text-blue-200/90 leading-relaxed">
          <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-white block font-semibold mb-0.5">Neden Ana Ekrana Eklemelisiniz?</strong>
            <span>
              Tarayıcı çubukları gizlenir, tam ekran yerel uygulama deneyimi sunar ve internet bağlantınız olmasa dahi anında açılır!
            </span>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
        >
          Anladım, Harika!
        </button>
      </div>
    </Modal>
  );
};
