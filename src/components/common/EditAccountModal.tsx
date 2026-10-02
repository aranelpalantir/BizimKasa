import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { db } from '../../db/db';
import { Palette, Check, Sparkles, Layers } from 'lucide-react';
import { ACCOUNT_THEME_COLORS, getThemeColorName } from '../../constants/themeColors';
import type { Group } from '../../types/finance';

interface EditAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group | null;
  onAccountUpdated?: (updatedGroup: Group) => void;
}

export const EditAccountModal: React.FC<EditAccountModalProps> = ({
  isOpen,
  onClose,
  group,
  onAccountUpdated
}) => {
  const [accountName, setAccountName] = useState('');
  const [accountColor, setAccountColor] = useState('#3b82f6');
  const [customHexInput, setCustomHexInput] = useState('#3b82f6');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (group && isOpen) {
      setAccountName(group.name);
      setAccountColor(group.color);
      setCustomHexInput(group.color);
      setError(null);
    }
  }, [group, isOpen]);

  const handleSelectColor = (hex: string) => {
    setAccountColor(hex);
    setCustomHexInput(hex);
  };

  const handleCustomHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      setAccountColor(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;

    const trimmed = accountName.trim();
    if (!trimmed) {
      setError('Lütfen bir hesap adı girin.');
      return;
    }

    setIsSaving(true);
    try {
      await db.groups.update(group.id, {
        name: trimmed,
        color: accountColor
      });

      const updated: Group = {
        ...group,
        name: trimmed,
        color: accountColor
      };

      setError(null);
      if (onAccountUpdated) {
        onAccountUpdated(updated);
      }
      onClose();
    } catch (err: any) {
      setError(`Hesap güncellenemedi: ${err?.message || 'Bilinmeyen hata'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!group) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title="Hesap Renk Temasını Değiştir"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Account Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Hesap / Kasa Adı
          </label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => {
              setAccountName(e.target.value);
              setError(null);
            }}
            placeholder="Örn: Ana Hesap, Yatırım Portföyü, Tasarruf Fonu..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400 transition-colors"
          />
          {error && (
            <p className="text-xs text-rose-400 mt-1">{error}</p>
          )}
        </div>

        {/* Color Palette Grid */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-slate-300">
              Renk Teması Seçimi
            </label>
            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: accountColor }} />
              <span>{getThemeColorName(accountColor)}</span>
              <span className="font-mono text-slate-500 uppercase">({accountColor})</span>
            </span>
          </div>

          <div className="grid grid-cols-6 sm:grid-cols-9 gap-2 p-2.5 rounded-2xl bg-slate-950/80 border border-white/10">
            {ACCOUNT_THEME_COLORS.map((c) => {
              const isSelected = accountColor.toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => handleSelectColor(c.hex)}
                  title={`${c.name} (${c.hex})`}
                  className={`relative aspect-square rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'scale-110 shadow-lg ring-2 ring-white ring-offset-2 ring-offset-slate-950 z-10'
                      : 'hover:scale-105 opacity-85 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {isSelected && (
                    <Check className="w-4 h-4 text-white drop-shadow-md stroke-[3]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Color Input */}
        <div className="p-3 rounded-2xl bg-slate-950/50 border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <span>Özel Renk Kodu (HEX)</span>
            </span>
            <div className="flex items-center gap-2">
              <label
                title="Renk Seçiciyi Aç"
                className="relative inline-flex items-center justify-center w-8 h-8 rounded-xl cursor-pointer border border-white/20 overflow-hidden shadow-sm hover:scale-105 transition-transform"
                style={{ backgroundColor: accountColor }}
              >
                <input
                  type="color"
                  value={accountColor}
                  onChange={(e) => handleSelectColor(e.target.value)}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </label>
              <input
                type="text"
                maxLength={7}
                value={customHexInput}
                onChange={handleCustomHexChange}
                placeholder="#3B82F6"
                className="w-24 px-2.5 py-1 text-xs font-mono uppercase rounded-lg bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        </div>

        {/* Live Preview Section */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Canlı Önizleme</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 space-y-3">
            {/* 1. Filter pill preview */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">Filtre Düğmesi:</span>
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-md transition-all"
                style={{
                  backgroundColor: `${accountColor}25`,
                  borderColor: accountColor,
                  color: '#ffffff'
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: accountColor }}
                />
                <span>{accountName || 'Hesap Adı'}</span>
              </div>
            </div>

            {/* 2. Asset badge preview */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">Varlık Rozeti:</span>
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                style={{
                  backgroundColor: `${accountColor}20`,
                  color: accountColor
                }}
              >
                <Layers className="w-3 h-3" />
                <span>{accountName || 'Hesap Adı'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>{isSaving ? 'Kaydediliyor...' : 'Temayı Kaydet'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
