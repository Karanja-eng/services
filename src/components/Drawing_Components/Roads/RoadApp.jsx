import React, { useState } from 'react';
import FloatingPalette from '../../FloatingPalette';

import { Toolbar } from './Toolbar';
import { PropertiesPanel } from './Propertiespanel';
import { Viewport3D } from './Viewport3D';
import { Viewport2D } from './Viewport2D';
import { useStore } from './useStore';
import { StatusBar } from './StatusBar';
import { AICommandPanel } from './AICommandPanel';

export default function App() {
    const [viewMode, setViewMode] = useState('split'); // '3d' | '2d' | 'split'
    const [showTools, setShowTools] = useState(true);
    const [showProperties, setShowProperties] = useState(true);
    const { selectedTool } = useStore();

    return (
        <div className="flex flex-col flex-1 w-full bg-[#0f1117] text-[#e2e8f0] font-mono overflow-hidden" style={{ height: 'calc(100vh - 96px)' }}>
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
                    <div className="h-4 w-[1px] bg-[#2a3144] mx-2" />
                    <button
                        onClick={() => setShowTools(!showTools)}
                        className={`px-3 py-1 text-xs font-bold uppercase tracking-widest rounded transition-all ${showTools ? 'bg-[#4a6fa5] text-white' : 'text-[#4a6fa5] hover:bg-[#1a2035]'}`}
                    >
                        Road Tools
                    </button>
                    <button
                        onClick={() => setShowProperties(!showProperties)}
                        className={`px-3 py-1 text-xs font-bold uppercase tracking-widest rounded transition-all ${showProperties ? 'bg-[#4a6fa5] text-white' : 'text-[#4a6fa5] hover:bg-[#1a2035]'}`}
                    >
                        Properties & AI
                    </button>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#4a5568]">
                    <span className="text-[#00ff88]">● Online</span>
                    <span>Untitled Project</span>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden h-full relative">
                {showTools && (
                    <FloatingPalette title="Road Tools" onClose={() => setShowTools(false)} width={72}>
                        <Toolbar />
                    </FloatingPalette>
                )}

                {showProperties && (
                    <FloatingPalette title="Properties & AI" onClose={() => setShowProperties(false)} width={300}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, background: '#161b27' }}>
                            <PropertiesPanel />
                            <AICommandPanel />
                        </div>
                    </FloatingPalette>
                )}

                {/* Main Viewport */}
                <main className="flex-1 flex overflow-hidden w-full h-full">
                    {viewMode === 'split' ? (
                        <>
                            <div className="flex-1 border-r border-[#2a3144] h-full w-full relative">
                                <Viewport3D />
                            </div>
                            <div className="flex-1 h-full w-full relative">
                                <Viewport2D />
                            </div>
                        </>
                    ) : viewMode === '3d' ? (
                        <div className="flex-1 h-full w-full relative"><Viewport3D /></div>
                    ) : (
                        <div className="flex-1 h-full w-full relative"><Viewport2D /></div>
                    )}
                </main>
            </div>

            <StatusBar />
        </div>
    );
}