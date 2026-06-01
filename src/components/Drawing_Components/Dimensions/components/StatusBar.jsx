import React from 'react';
import { STATUS_HINTS } from '../utils/constants';
import { useAnnotationStore } from '../stores/annotationStore';

export function StatusBar({ activeTool, clickPoints, selectedId }) {
  const { annotations } = useAnnotationStore();
  return (
    <div className="flex items-center justify-between px-4 py-1 bg-[#050510] border-t border-[#141428] text-[8px] text-[#2a3a5a] z-10 shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-[#3a6a9a] font-bold tracking-wider">
          {activeTool.toUpperCase().replace(/_/g, ' ')}
        </span>
        {clickPoints.length > 0 && (
          <span className="text-[#1a5a2a]">● {clickPoints.length} pt{clickPoints.length !== 1 ? 's' : ''}</span>
        )}
        {selectedId && (
          <span className="text-[#6a5a1a]">✦ {selectedId.slice(-8)}</span>
        )}
      </div>
      <div className="flex items-center gap-6">
        <span className="text-[#1a2a3a] max-w-md truncate">{STATUS_HINTS[activeTool] || ''}</span>
        <span className="text-[#1a2a3a]">{annotations.length} ann</span>
        <span className="text-[#141428]">ESC cancel</span>
      </div>
    </div>
  );
}
