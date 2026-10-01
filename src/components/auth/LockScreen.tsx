import React, { useState, useEffect } from 'react';
import { Shield, ScanFace, Delete, AlertCircle } from 'lucide-react';
import { verifyPin, authenticateWithBiometrics } from '../../services/securityService';
import type { AppSettings } from '../../types/finance';

interface LockScreenProps {
  settings: AppSettings;
  onUnlock: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ settings, onUnlock }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Auto trigger biometrics if enabled
  useEffect(() => {
    if (settings.biometricsEnabled) {
      triggerBiometrics();
    }
  }, [settings.biometricsEnabled]);

  const triggerBiometrics = async () => {
    setIsVerifying(true);
    setError(null);
    try {
      const success = await authenticateWithBiometrics();
      if (success) {
        onUnlock();
      }
    } catch {
      // Ignored, user can use PIN
    } finally {
      setIsVerifying(false);
    }
  };

  const maxDigits = settings.pinLength || 6;
  const dotsCount = settings.pinLength || 4;

  const handleKeyPress = async (digit: string) => {
    let currentPin = pin;
    if (shake || currentPin.length >= maxDigits) {
      currentPin = '';
      setShake(false);
    }
    const newPin = currentPin + digit;
    setPin(newPin);
    setError(null);

    if (settings.pinHash) {
      if (newPin.length >= 4) {
        const isValid = await verifyPin(newPin, settings.pinHash);
        if (isValid) {
          onUnlock();
          return;
        }
      }

      if (newPin.length === maxDigits) {
        setError('Hatalı PIN kodu!');
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin('');
        }, 500);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  // Physical and external keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, shake, settings.pinHash, settings.pinLength]);

  return (
    <div className="fixed inset-0 z-50 bg-[#080c14] flex flex-col items-center justify-between p-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] select-none">
      {/* Brand Header */}
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/20 mb-4">
          <Shield className="w-8 h-8 text-slate-950 stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Bizim Kasa</h1>
        <p className="text-sm text-slate-400 mt-1">Lütfen devam etmek için kilidi açın</p>
      </div>

      {/* PIN Dots Display */}
      <div className="flex flex-col items-center my-6">
        <div className={`flex items-center gap-3 mb-3 ${shake ? 'animate-bounce' : ''}`}>
          {Array.from({ length: dotsCount }).map((_, idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-200 border ${
                idx < pin.length
                  ? 'bg-amber-400 border-amber-300 scale-110 shadow-sm shadow-amber-400'
                  : 'bg-slate-800/80 border-slate-700'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Numeric Keypad */}
      <div className="w-full max-w-xs space-y-3 pb-8">
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="h-16 rounded-2xl bg-slate-800/60 hover:bg-slate-700 active:scale-90 text-2xl font-medium text-white transition-all border border-white/5 shadow-md flex items-center justify-center"
            >
              {num}
            </button>
          ))}
          
          {/* Biometrics or Clear Button */}
          {settings.biometricsEnabled ? (
            <button
              onClick={triggerBiometrics}
              disabled={isVerifying}
              className="h-16 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 active:scale-90 text-amber-400 transition-all border border-amber-500/20 flex flex-col items-center justify-center gap-1"
            >
              <ScanFace className="w-6 h-6" />
              <span className="text-[10px] font-medium">Face ID</span>
            </button>
          ) : (
            <button
              onClick={handleClear}
              className="h-16 rounded-2xl bg-slate-800/30 hover:bg-slate-800 active:scale-90 text-slate-400 text-sm font-medium transition-all border border-white/5 flex items-center justify-center"
            >
              Temizle
            </button>
          )}

          <button
            onClick={() => handleKeyPress('0')}
            className="h-16 rounded-2xl bg-slate-800/60 hover:bg-slate-700 active:scale-90 text-2xl font-medium text-white transition-all border border-white/5 shadow-md flex items-center justify-center"
          >
            0
          </button>

          <button
            onClick={handleDelete}
            className="h-16 rounded-2xl bg-slate-800/40 hover:bg-slate-800 active:scale-90 text-slate-300 transition-all border border-white/5 flex items-center justify-center"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
