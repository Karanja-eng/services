import React from 'react';
import { useElectricalStore } from '../stores/electricalStore';

export default function PropertiesPanel() {
  const { selectedElementId, elements, deleteElement } = useElectricalStore();
  const selectedElement = selectedElementId ? elements[selectedElementId] : null;

  if (!selectedElement) {
    return (
      <div className="w-64 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col z-10 shrink-0 shadow-sm p-4 text-xs text-gray-500">
        No element selected.
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col z-10 shrink-0 shadow-sm">
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">Properties</h2>
        <button onClick={() => deleteElement(selectedElementId)} className="text-red-500 hover:bg-red-50 p-1 rounded">Delete</button>
      </div>
      
      <div className="p-4 space-y-4 text-xs">
        <div>
          <label className="block text-gray-400 mb-1">Type</label>
          <div className="font-semibold text-gray-900 dark:text-gray-100">{selectedElement.subType}</div>
        </div>
        
        <div>
          <label className="block text-gray-400 mb-1">Circuit Reference</label>
          <input type="text" className="w-full border border-gray-300 dark:border-gray-700 rounded p-1.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100" defaultValue={selectedElement.circuitRef || 'None'} />
        </div>

        {selectedElement.config?.gang && (
          <div>
            <label className="block text-gray-400 mb-1">Gangs</label>
            <input type="number" className="w-full border border-gray-300 dark:border-gray-700 rounded p-1.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100" defaultValue={selectedElement.config.gang} />
          </div>
        )}

        {selectedElement.config?.wattage && (
          <div>
            <label className="block text-gray-400 mb-1">Wattage (W)</label>
            <input type="number" className="w-full border border-gray-300 dark:border-gray-700 rounded p-1.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100" defaultValue={selectedElement.config.wattage} />
          </div>
        )}

        {selectedElement.config?.cct && (
          <div>
            <label className="block text-gray-400 mb-1">CCT (Kelvin)</label>
            <select className="w-full border border-gray-300 dark:border-gray-700 rounded p-1.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100" defaultValue={selectedElement.config.cct}>
              <option value={2700}>2700K Warm</option>
              <option value={3000}>3000K Warm White</option>
              <option value={4000}>4000K Cool White</option>
              <option value={6500}>6500K Daylight</option>
            </select>
          </div>
        )}
        
        {selectedElement.position && (
          <div>
            <label className="block text-gray-400 mb-1">Height (AFF m)</label>
            <input type="number" step="0.1" className="w-full border border-gray-300 dark:border-gray-700 rounded p-1.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100" defaultValue={selectedElement.position.y} />
          </div>
        )}
      </div>
    </div>
  );
}
