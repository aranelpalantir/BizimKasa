import React, { useState } from 'react';
import { Modal } from './Modal';
import { db } from '../../db/db';
import type { Group } from '../../types/finance';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated?: (newGroupId: string) => void;
}

const PRESET_COLORS = ['#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#64748b'];

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  onAccountCreated
}) => {
  const [accountName, setAccountName] = useState('');
  const [accountColor, setAccountColor] = useState('#3b82f6');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = accountName.trim();
    if (!trimmed) {
      setError('Lütfen bir hesap adı girin.');
      return;
    }

    try {
      const count = await db.groups.count();
      const newGroup: Group = {
        id: `group-${Date.now()}`,
        name: trimmed,
        color: accountColor,
        order: count + 1,
        createdAt: new Date().toISOString()
      };
      await db.groups.add(newGroup);
      setAccountName('');
      setError(null);
      onClose();
      if (onAccountCreated) {
        onAccountCreated(newGroup.id);
      }
    } catch (err: any) {
      setError(`Hesap oluşturulamadı: ${err?.message || 'Bilinmeyen hata'}`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setError(null);
        onClose();
      }}
      title="Yeni Hesap / Kasa Ekle"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Hesap Adı
          </label>
          <input
            type="text"
            autoFocus
            value={accountName}
            onChange={(e) => {
              setAccountName(e.target.value);
              setError(null);
            }}
            placeholder="Örn: Ana Hesap, Yatırım Hesabı, Tasarruf Fonu, Ortak Kasa..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400"
          />
          {error && (
            <p className="text-xs text-rose-400 mt-1">{error}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Renk Teması
          </label>
          <div className="flex items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAccountColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${accountColor === c ? 'scale-110 border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors shadow-md shadow-amber-500/20"
          >
            Hesabı Oluştur
          </button>
        </div>
      </form>
    </Modal>
  );
};
