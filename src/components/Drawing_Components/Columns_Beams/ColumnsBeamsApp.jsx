import React, { useState } from 'react';
import Scene3D from './Scene3D';
import PlanCanvas2D from './PlanCanvas2D';
import SectionLibrary from './SectionLibrary.jsx';
import { useStore } from './store';

export default function ColumnsBeamsApp({ isDark }) {
  const { activeView, setActiveView, activeTool, setActiveTool } = useStore();
  
  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-[#070e1a] text-white' : 'bg-gray-100 text-black'} overflow-hidden font-sans`}>
      {/* Header / Sub-nav */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#0a1628] border-b border-[#1a2d4a]">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-bold tracking-tight text-[#4a9eff] font-mono">COLUMNS & BEAMS DESIGN</h1>
          <div className="h-4 w-[1px] bg-[#1a2d4a]" />
          <div className="flex gap-2">
            <button
              onClick={() => setActiveView('2d')}
              className={`px-3 py-1 text-[10px] font-mono rounded transition-all ${activeView === '2d' ? 'bg-[#4a9eff] text-white' : 'text-[#4a9eff] border border-[#4a9eff33] hover:bg-[#4a9eff11]'}`}
            >
              2D PLAN
            </button>
            <button
              onClick={() => setActiveView('3d')}
              className={`px-3 py-1 text-[10px] font-mono rounded transition-all ${activeView === '3d' ? 'bg-[#4a9eff] text-white' : 'text-[#4a9eff] border border-[#4a9eff33] hover:bg-[#4a9eff11]'}`}
            >
              3D VIEW
            </button>
          </div>
        </div>
        
        <div className="flex gap-2">
          {['select', 'place_column', 'place_beam'].map(tool => (
            <button
              key={tool}
              onClick={() => setActiveTool(tool)}
              className={`px-3 py-1 text-[10px] font-mono rounded capitalize transition-all ${activeTool === tool ? 'bg-[#f39c12] text-white' : 'text-[#f39c12] border border-[#f39c1233] hover:bg-[#f39c1211]'}`}
            >
              {tool.replace('_', ' ')}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Section Library */}
        <aside className="w-72 bg-[#0a1220] border-r border-[#1a2d4a]">
          <SectionLibrary />
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 relative bg-[#070e1a]">
          {activeView === '3d' ? (
            <Scene3D />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-8">
              <div className="w-full h-full border border-[#1a2d4a] rounded-lg shadow-2xl overflow-hidden bg-[#0a1628]">
                 <PlanCanvas2D width={1200} height={800} />
              </div>
            </div>
          )}
        </main>
      </div>
      
      {/* Footer Info */}
      <footer className="px-4 py-1.5 bg-[#0a1220] border-t border-[#1a2d4a] text-[10px] font-mono text-[#3a5a7a] flex justify-between">
        <div className="flex gap-4">
          <span>Mode: <span className="text-[#4a9eff] uppercase">{activeTool}</span></span>
          <span>View: <span className="text-[#4a9eff] uppercase">{activeView}</span></span>
        </div>
        <span>Fundi Engineering Suite · 2026</span>
      </footer>
    </div>
  );
}
