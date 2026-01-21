import React from 'react';

export const defaultElectricalPlumbingSettings = {
    electricalColor: "#fbbf24",
    plumbingColor: "#38bdf8",
    wallColor: "#f1f5f9",
    wallOpacity: 0.1,
    groundColor: "#0f172a"
};

export const ElectricalPlumbingSettings = ({ settings, setSettings }) => {
    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-4 p-4">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b pb-2">Systems</h3>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Electrical</label>
                    <div className="flex items-center gap-2">
                        <input type="color" value={settings.electricalColor} onChange={(e) => handleChange('electricalColor', e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0 p-0" />
                        <span className="text-xs text-gray-500">{settings.electricalColor}</span>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Plumbing</label>
                    <div className="flex items-center gap-2">
                        <input type="color" value={settings.plumbingColor} onChange={(e) => handleChange('plumbingColor', e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0 p-0" />
                        <span className="text-xs text-gray-500">{settings.plumbingColor}</span>
                    </div>
                </div>
            </div>

            <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b pb-2 pt-2">Environment</h3>

            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Wall Color</label>
                    <input type="color" value={settings.wallColor} onChange={(e) => handleChange('wallColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>

                <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                        Wall Opacity ({Math.round(settings.wallOpacity * 100)}%)
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.wallOpacity}
                        onChange={(e) => handleChange('wallOpacity', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ground Color</label>
                    <input type="color" value={settings.groundColor} onChange={(e) => handleChange('groundColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>
            </div>

        </div>
    );
};

export default ElectricalPlumbingSettings;
