import React, { useState } from 'react';
import { MainLayout } from './components/ui/MainLayout';
import { Toolbar } from './components/ui/Toolbar';
import { PropertiesPanel } from './components/ui/PropertiesPanel';
import { Viewport3D } from './components/3d/Viewport3D';
import { Viewport2D } from './components/2d/Viewport2D';
import { useStore } from './store/useStore';
import { StatusBar } from './components/ui/StatusBar';
import { AICommandPanel } from './components/ui/AICommandPanel';

export default function App() {
    const [viewMode, setViewMode] = useState('split'); // '3d' | '2d' | 'split'
    const { selectedTool } = useStore();

    return (
        <div className="flex flex-col h-screen w-screen bg-[#0f1117] text-[#e2e8f0] font-mono overflow-hidden">
            {/* Top Bar */}
            <header className="flex items-center justify-between px-4 py-2 bg-[#161b27] border-b border-[#2a3144] z-50">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#00d4ff] rounded-sm flex items-center justify-center">
                            <span className="text-[#0f1117] text-xs font-bold">S</span>
                        </div>
                        <span className="text-[#00d4ff] font-bold text-sm tracking-widest uppercase">SiteCraft</span>
                        <span className="text-[#4a5568] text-xs">v2.0 — AI Civil Design</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {['3d', 'split', '2d'].map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-3 py-1 text-xs font-bold uppercase tracking-widest rounded transition-all ${viewMode === mode
                                    ? 'bg-[#00d4ff] text-[#0f1117]'
                                    : 'text-[#4a6fa5] hover:text-[#00d4ff] hover:bg-[#1a2035]'
                                }`}
                        >
                            {mode === 'split' ? '⬛ Split' : mode === '3d' ? '◈ 3D' : '▣ Plan'}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-[#4a5568]">
                    <span className="text-[#00ff88]">● Online</span>
                    <span>Untitled Project</span>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Toolbar */}
                <Toolbar />

                {/* Main Viewport */}
                <main className="flex-1 flex overflow-hidden">
                    {viewMode === 'split' ? (
                        <>
                            <div className="flex-1 border-r border-[#2a3144]">
                                <Viewport3D />
                            </div>
                            <div className="flex-1">
                                <Viewport2D />
                            </div>
                        </>
                    ) : viewMode === '3d' ? (
                        <div className="flex-1"><Viewport3D /></div>
                    ) : (
                        <div className="flex-1"><Viewport2D /></div>
                    )}
                </main>

                {/* Right Panel */}
                <aside className="w-64 bg-[#161b27] border-l border-[#2a3144] flex flex-col">
                    <PropertiesPanel />
                    <AICommandPanel />
                </aside>
            </div>

            <StatusBar />
        </div>
    );
}