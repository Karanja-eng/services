import React from 'react';
import { STANDARD_SOCKETS, STANDARD_SWITCHES, STANDARD_LIGHTS } from '../utils/constants';

export default function ElectricalSidebar() {
  return (
    <div className="w-64 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-10 shrink-0 shadow-sm overflow-y-auto">
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Component Library</h2>
      </div>
      
      <div className="p-4 space-y-6 text-xs">
        
        {/* Sockets */}
        <div>
          <h3 className="font-semibold text-blue-600 mb-2">Sockets & Power</h3>
          <div className="space-y-2">
            {STANDARD_SOCKETS.map(s => (
              <div key={s.id} className="p-2 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900 cursor-grab">
                {s.name}
              </div>
            ))}
          </div>
        </div>

        {/* Switches */}
        <div>
          <h3 className="font-semibold text-blue-600 mb-2">Switches & Controls</h3>
          <div className="space-y-2">
            {STANDARD_SWITCHES.map(s => (
              <div key={s.id} className="p-2 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900 cursor-grab">
                {s.name}
              </div>
            ))}
          </div>
        </div>

        {/* Lighting */}
        <div>
          <h3 className="font-semibold text-blue-600 mb-2">Lighting Fixtures</h3>
          <div className="space-y-2">
            {STANDARD_LIGHTS.map(s => (
              <div key={s.id} className="p-2 border border-gray-200 dark:border-gray-700 rounded bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900 cursor-grab">
                {s.name}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
