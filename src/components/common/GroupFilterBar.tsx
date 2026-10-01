import React from 'react';
import { Users, Layers } from 'lucide-react';
import type { Group } from '../../types/finance';

interface GroupFilterBarProps {
  groups: Group[];
  selectedGroupId: string; // 'ALL' or group.id
  onSelectGroup: (groupId: string) => void;
  title?: string;
}

export const GroupFilterBar: React.FC<GroupFilterBarProps> = ({
  groups,
  selectedGroupId,
  onSelectGroup,
  title
}) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
      {title && (
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1 flex-shrink-0">
          <Users className="w-3.5 h-3.5 text-amber-400" />
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
          <button
            key={group.id}
            onClick={() => onSelectGroup(group.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex-shrink-0 border ${
              isSelected
                ? 'text-white font-bold shadow-md'
                : 'bg-slate-900/80 text-slate-300 border-white/5 hover:border-white/15 hover:bg-slate-800'
            }`}
            style={{
              backgroundColor: isSelected ? `${group.color}25` : undefined,
              borderColor: isSelected ? group.color : undefined,
              color: isSelected ? '#ffffff' : undefined
            }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: group.color }}
            />
            <span>{group.name}</span>
          </button>
        );
      })}
    </div>
  );
};
