import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Sil',
  cancelText = 'Vazgeç',
  isDestructive = true
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex items-start gap-3.5 p-3 rounded-2xl bg-slate-950/60 border border-white/5">
          <div className={`p-2.5 rounded-xl flex-shrink-0 ${
            isDestructive 
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' 
              : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
          }`}>
            {isDestructive ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-300 leading-relaxed font-medium">
              {message}
            </p>
            {isDestructive && (
              <p className="text-[11px] text-rose-400/80 font-normal">
                Bu işlem geri alınamaz.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors active:scale-95"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
