import React from 'react';
import { TOOL_GROUPS } from '../utils/constants';

export function Toolbar({ activeTool, setActiveTool, clickPoints }) {
  return (
    <div className="w-14 flex flex-col bg-[#0d0d1a] border-r border-[#2a2a4a] overflow-y-auto z-10 shrink-0">
      {TOOL_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="text-[#2a2a4a] text-[7px] text-center tracking-widest py-1 pt-2 select-none">
            {group.label}
          </div>
          {group.tools.map((tool) => {
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                title={`${tool.label} [${tool.key}]`}
                onClick={() => setActiveTool(tool.id)}
                className={`
                  relative w-full flex flex-col items-center justify-center py-2 px-1 transition-all duration-100 group
                  ${isActive ? 'bg-[#1a2a4a] text-[#4a9eff]' : 'text-[#5a5a8a] hover:text-[#8090c0] hover:bg-[#141428]'}
                `}
              >
                {isActive && (
                  <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-[#4a9eff] rounded-r" />
                )}
                <span className="text-sm leading-none mb-0.5 select-none">{tool.icon}</span>
                <span className="text-[6.5px] leading-none opacity-60 tracking-wider select-none">
                  {tool.label.slice(0, 5).toUpperCase()}
                </span>
                {/* Tooltip */}
                <div className="absolute left-full ml-1.5 z-50 hidden group-hover:flex items-center pointer-events-none whitespace-nowrap">
                  <div className="bg-[#0a0a1a] border border-[#3a3a5a] text-[#a0b0d0] text-[10px] px-2 py-1 rounded shadow-xl">
                    {tool.label}
                    <span className="ml-1.5 text-[#3a4a6a]">[{tool.key}]</span>
                  </div>
                </div>
              </button>
            );
          })}
          <div className="border-b border-[#1a1a2e] mx-3 my-1" />
        </div>
      ))}

      {clickPoints.length > 0 && (
        <div className="mx-1 mt-2 bg-[#0a1a0a] border border-[#1a3a1a] rounded p-1.5 text-center">
          <div className="text-[#28c840] text-xs font-bold">{clickPoints.length}</div>
          <div className="text-[#1a3a1a] text-[7px]">pts</div>
        </div>
      )}
    </div>
  );
}
