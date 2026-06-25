import React, { useEffect, useState } from 'react';
import { usePlumbingStore } from './stores/plumbingStore';
import FloatingPalette from '../FloatingPalette';
import PlumbingPaletteContent from './ui/PlumbingSidebar';
import PlumbingPropertiesContent from './ui/PropertiesPanel';
import Plumbing2DView from './components/2D/Plumbing2DView';
import Plumbing3DView from './components/3D/Plumbing3DView';

export default function PlumbingApp({ isDark }) {
  const { viewMode, setViewMode, loadMockData } = usePlumbingStore();
  const [showLibrary, setShowLibrary] = useState(true);
  const [showProperties, setShowProperties] = useState(true);

  useEffect(() => { loadMockData(); }, [loadMockData]);

  return (
    <div className={`relative w-full h-screen overflow-hidden ${isDark ? 'dark bg-gray-950' : 'bg-gray-100'}`}>

      {/* ── Top toolbar ──────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 h-14 bg-white/80 dark:bg-gray-900/80
        backdrop-blur-md border-b border-gray-200/60 dark:border-gray-800/60
        z-40 flex items-center px-4 justify-between shadow-sm">

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center text-white font-black text-sm shadow">🔧</div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">PlumbingCAD</h1>
            <p className="text-[10px] text-gray-400">BS EN 806 · BS EN 12056 · WRAS · Kenya Water Act</p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shadow-inner">
          {['2D', '3D'].map(mode => (
            <button key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === mode
                  ? 'bg-white dark:bg-gray-700 shadow text-cyan-600 dark:text-cyan-400'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >{mode === '2D' ? '2D Plan' : '3D View'}</button>
          ))}
        </div>

        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              showLibrary
                ? 'bg-cyan-650 text-white shadow'
                : 'text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-855'
            }`}
          >
            PLUMBING LIBRARY
          </button>
          <button
            onClick={() => setShowProperties(!showProperties)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              showProperties
                ? 'bg-cyan-650 text-white shadow'
                : 'text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-855'
            }`}
          >
            PROPERTIES
          </button>
          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1" />
          <button className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold rounded-lg shadow">
            Generate Schedule
          </button>
          <button className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow">
            Check Compliance
          </button>
        </div>
      </div>

      {/* ── Full-bleed viewport ───────────────────────────── */}
      <div className="absolute inset-0 pt-14">
        {viewMode === '2D' ? <Plumbing2DView /> : <Plumbing3DView />}
      </div>

      {/* ── Floating Palette (left) ───────────────────────── */}
      {showLibrary && (
        <FloatingPalette
          title="Plumbing Library"
          onClose={() => setShowLibrary(false)}
          width={258}
        >
          <PlumbingPaletteContent />
        </FloatingPalette>
      )}

      {/* ── Floating Properties Panel (right) ────────────── */}
      {showProperties && (
        <FloatingPalette
          title="Properties"
          onClose={() => setShowProperties(false)}
          width={288}
        >
          <PlumbingPropertiesContent />
        </FloatingPalette>
      )}

      {/* ── Status bar ───────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 h-7 z-40
        bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm
        border-t border-gray-200/60 dark:border-gray-800/60
        flex items-center px-4 justify-between text-[10px] text-gray-500">
        <div className="flex gap-4">
          <span>View: {viewMode}</span>
          <span>UK / Kenya Standards</span>
        </div>
        <span>Plumbing Compliance Engine</span>
      </div>
    </div>
  );
}
