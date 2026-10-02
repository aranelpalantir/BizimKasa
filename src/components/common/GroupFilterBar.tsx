import React, { useState } from 'react';
import { Wallet, Layers, Plus, Palette } from 'lucide-react';
import { EditAccountModal } from './EditAccountModal';
import type { Group } from '../../types/finance';

interface GroupFilterBarProps {
  groups: Group[];
  selectedGroupId: string; // 'ALL' or group.id
  onSelectGroup: (groupId: string) => void;
  title?: string;
  onAddGroup?: () => void;
  addLabel?: string;
  onEditGroup?: (group: Group) => void;
}

export const GroupFilterBar: React.FC<GroupFilterBarProps> = ({
  groups,
  selectedGroupId,
  onSelectGroup,
  title,
  onAddGroup,
  addLabel,
  onEditGroup
}) => {
  const [internalEditingGroup, setInternalEditingGroup] = useState<Group | null>(null);

  const handleEditGroup = (group: Group) => {
    if (onEditGroup) {
      onEditGroup(group);
    } else {
      setInternalEditingGroup(group);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
        {title && (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1.5 flex-shrink-0">
            <Wallet className="w-3.5 h-3.5 text-amber-400" />
            <span>{title}:</span>
          </span>
        )}

        {/* ALL (Konsolide) Button */}
        <button
          onClick={() => onSelectGroup('ALL')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex-shrink-0 border ${
            selectedGroupId === 'ALL'
              ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-md shadow-amber-500/20'
              : 'bg-slate-900/80 text-slate-300 border-white/5 hover:border-white/15 hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Tümü (Konsolide)</span>
        </button>

        {/* Individual Group Buttons */}
        {groups.map((group) => {
          const isSelected = selectedGroupId === group.id;
          return (
            <div key={group.id} className="relative inline-flex items-center flex-shrink-0 group/pill">
              <button
                onClick={() => onSelectGroup(group.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex-shrink-0 border cursor-pointer ${
                  isSelected
                    ? 'text-white font-bold shadow-lg scale-[1.02]'
                    : 'bg-slate-900/80 text-slate-300 border-white/5 hover:border-white/20 hover:bg-slate-800'
                }`}
                style={{
                  backgroundColor: isSelected ? `${group.color}35` : undefined,
                  borderColor: isSelected ? group.color : undefined,
                  boxShadow: isSelected ? `0 0 16px ${group.color}45, inset 0 1px 0 rgba(255,255,255,0.2)` : undefined,
                  color: isSelected ? '#ffffff' : undefined
                }}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform"
                  style={{
                    backgroundColor: group.color,
                    boxShadow: isSelected ? `0 0 8px ${group.color}` : undefined
                  }}
                />
                <span className={isSelected ? 'tracking-wide font-bold' : ''}>{group.name}</span>
              </button>

              {/* Quick Edit Color Theme Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditGroup(group);
                }}
                title={`${group.name} Renk Temasını Değiştir`}
                aria-label={`${group.name} renk temasını değiştir`}
                className={`ml-1 p-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border transition-all flex items-center justify-center cursor-pointer shadow-sm active:scale-95 ${
                  isSelected
                    ? 'flex opacity-100'
                    : 'hidden sm:flex sm:opacity-0 sm:group-hover/pill:opacity-100 text-slate-400 hover:text-white border-white/10'
                }`}
                style={{
                  borderColor: isSelected ? `${group.color}70` : undefined,
                  color: isSelected ? group.color : undefined,
                  boxShadow: isSelected ? `0 0 10px ${group.color}30` : undefined
                }}
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {/* Add New Account Button */}
        {onAddGroup && (
          <button
            onClick={onAddGroup}
            title={addLabel || "Yeni Hesap Ekle"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-amber-300 bg-slate-900/40 hover:bg-slate-800 border border-dashed border-white/20 hover:border-amber-400/50 transition-all flex-shrink-0 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>{addLabel || '+ Yeni Hesap'}</span>
          </button>
        )}
      </div>

      {/* Internal Modal if not controlled from outside */}
      <EditAccountModal
        isOpen={!!internalEditingGroup}
        onClose={() => setInternalEditingGroup(null)}
        group={internalEditingGroup}
      />
    </>
  );
};
