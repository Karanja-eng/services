import React from 'react';
import { useStore } from '../../store/useStore';

const TOOL_GROUPS = [
  {
    label: 'Selection',
    tools: [
      { id: 'select', icon: '↖', label: 'Select', shortcut: 'S' },
    ],
  },
  {
    label: 'Roads',
    tools: [
      { id: 'road', icon: '═', label: 'Road', shortcut: 'R' },
      { id: 'path', icon: '─', label: 'Footpath', shortcut: 'P' },
      { id: 'driveway', icon: '▬', label: 'Driveway', shortcut: 'D' },
    ],
  },
  {
    label: 'Layout',
    tools: [
      { id: 'parking', icon: '⊞', label: 'Parking', shortcut: 'K' },
      { id: 'roundabout', icon: '◎', label: 'Roundabout', shortcut: 'O' },
      { id: 'cul_de_sac', icon: '◑', label: 'Cul-de-sac', shortcut: 'C' },
    ],
  },
  {
    label: 'Landscape',
    tools: [
      { id: 'tree', icon: '♠', label: 'Tree', shortcut: 'T' },
      { id: 'fence', icon: '⋯', label: 'Fence', shortcut: 'F' },
      { id: 'water', icon: '≋', label: 'Water', shortcut: 'W' },
    ],
  },
  {
    label: 'Site',
    tools: [
      { id: 'terrain', icon: '▲', label: 'Terrain', shortcut: 'E' },
      { id: 'light', icon: '✦', label: 'Light', shortcut: 'L' },
      { id: 'measure', icon: '⟺', label: 'Measure', shortcut: 'M' },
    ],
  },
];

export function Toolbar() {
  const { selectedTool, setSelectedTool, undo, redo } = useStore();

  React.useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      if (e.ctrlKey && key === 'z') { undo(); return; }
      if (e.ctrlKey && key === 'y') { redo(); return; }
      for (const group of TOOL_GROUPS) {
        for (const tool of group.tools) {
          if (tool.shortcut.toLowerCase() === key) {
            setSelectedTool(tool.id);
            return;
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setSelectedTool, undo, redo]);

  return (
    <aside className="w-14 bg-[#161b27] border-r border-[#2a3144] flex flex-col items-center py-2 gap-1 z-40 overflow-y-auto">
      {/* Undo / Redo */}
      <div className="flex flex-col items-center gap-1 mb-2 pb-2 border-b border-[#2a3144] w-full px-1">
        <ToolButton icon="↩" label="Undo" shortcut="Ctrl+Z" onClick={undo} />
        <ToolButton icon="↪" label="Redo" shortcut="Ctrl+Y" onClick={redo} />
      </div>

      {TOOL_GROUPS.map(group => (
        <div key={group.label} className="flex flex-col items-center gap-1 mb-1 pb-2 border-b border-[#2a3144] w-full px-1">
          <span className="text-[9px] text-[#3a4a60] font-mono uppercase tracking-widest mb-1">
            {group.label.slice(0, 3)}
          </span>
          {group.tools.map(tool => (
            <ToolButton
              key={tool.id}
              icon={tool.icon}
              label={tool.label}
              shortcut={tool.shortcut}
              active={selectedTool === tool.id}
              onClick={() => setSelectedTool(tool.id)}
            />
          ))}
        </div>
      ))}
    </aside>
  );
}

function ToolButton({ icon, label, shortcut, active, onClick }) {
  const [showTip, setShowTip] = React.useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        className={`w-10 h-10 rounded flex items-center justify-center text-lg transition-all
          ${active
            ? 'bg-[#00d4ff] text-[#0d1420] shadow-[0_0_8px_#00d4ff66]'
            : 'text-[#4a6fa5] hover:bg-[#1e2840] hover:text-[#00d4ff]'
          }`}
        title={`${label} (${shortcut})`}
      >
        {icon}
      </button>

      {showTip && (
        <div className="absolute left-12 top-1/2 -translate-y-1/2 z-50 pointer-events-none
          bg-[#0d1420] border border-[#2a3144] rounded px-2 py-1 whitespace-nowrap
          text-xs text-[#a0b4d0] font-mono shadow-lg">
          {label}
          <span className="ml-2 text-[#4a6fa5] text-[10px]">[{shortcut}]</span>
        </div>
      )}
    </div>
  );
}