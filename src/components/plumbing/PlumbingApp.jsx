import React, { useEffect } from 'react';
import { usePlumbingStore } from './stores/plumbingStore';
import PlumbingSidebar from './ui/PlumbingSidebar';
import PropertiesPanel from './ui/PropertiesPanel';
import Plumbing2DView from './components/2D/Plumbing2DView';
import Plumbing3DView from './components/3D/Plumbing3DView';

export default function PlumbingApp({ isDark }) {
  const { viewMode, setViewMode, loadMockData } = usePlumbingStore();

  useEffect(() => {
    loadMockData(); // Load some initial data for demonstration
  }, [loadMockData]);

  return (
    <div className={`relative w-full h-screen overflow-hidden flex font-mono ${isDark ? 'dark bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      
      {/* Top Toolbar */}
      <div className="absolute top-0 left-0 right-0 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-20 flex items-center px-4 justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white font-bold">P</div>
          <div>
            <h1 className="text-sm font-bold tracking-wider">PlumbingCAD</h1>
            <p className="text-[10px] text-gray-500">BS EN 806 / WRAS Compliant</p>
          </div>
        </div>
        
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button 
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === '2D' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
            onClick={() => setViewMode('2D')}
          >
            2D Plan
          </button>
          <button 
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${viewMode === '3D' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}
            onClick={() => setViewMode('3D')}
          >
            3D View
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm">
            Generate Schedule
          </button>
          <button className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded shadow-sm">
            Check Compliance
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="absolute inset-0 pt-14 pb-8 flex">
        <PlumbingSidebar />
        
        <div className="flex-1 relative overflow-hidden bg-gray-100 dark:bg-[#121212]">
          {viewMode === '2D' ? <Plumbing2DView /> : <Plumbing3DView />}
        </div>
        
        <PropertiesPanel />
      </div>

      {/* Status Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-20 flex items-center px-4 justify-between text-[10px] text-gray-500">
        <div className="flex items-center gap-4">
          <span>Mode: {viewMode}</span>
          <span>System: UK / Kenya Standards</span>
        </div>
        <div>
          Powered by Plumbing Compliance Engine
        </div>
      </div>
    </div>
  );
}
