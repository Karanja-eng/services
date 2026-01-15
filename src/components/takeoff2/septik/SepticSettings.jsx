import React from 'react';

export const defaultSepticSettings = {
    concreteColor: "#8b9098",
    waterColor: "#3b82f6",
    groundColor: "#a8a29e"
};

export const SepticSettings = ({ settings, setSettings }) => {
    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-4 p-4">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b pb-2">Materials</h3>

            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Concrete Color</label>
                    <input type="color" value={settings.concreteColor} onChange={(e) => handleChange('concreteColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Water Color</label>
                    <input type="color" value={settings.waterColor} onChange={(e) => handleChange('waterColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ground Color</label>
                    <input type="color" value={settings.groundColor} onChange={(e) => handleChange('groundColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>
            </div>

            <div className="text-xs text-gray-500 mt-4 p-2 bg-gray-100 rounded">
                Note: Soakpit walls are rendered semi-transparent to show fill material.
            </div>

        </div>
    );
};

export default SepticSettings;
