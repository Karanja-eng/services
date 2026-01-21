import React from 'react';

export const defaultInternalFinishesSettings = {
    showCeiling: false,
    wallOpacity: 0.3,
    wallColor: "#f1f5f9",
    ceilingColor: "#f8fafc",
    bedroomColor: "#60a5fa",
    bathColor: "#34d399",
    kitchenColor: "#fb923c",
    livingColor: "#fbbf24",
    defaultFloorColor: "#94a3b8"
};

export const InternalFinishesSettings = ({ settings, setSettings }) => {
    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-4 p-4">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b pb-2">Visibility</h3>

            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Floor Ceilings</label>
                <input
                    type="checkbox"
                    checked={settings.showCeiling}
                    onChange={(e) => handleChange('showCeiling', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
            </div>

            <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Wall Opacity ({Math.round(settings.wallOpacity * 100)}%)
                </label>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.wallOpacity}
                    onChange={(e) => handleChange('wallOpacity', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b pb-2 pt-2">Colors</h3>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Walls</label>
                    <input type="color" value={settings.wallColor} onChange={(e) => handleChange('wallColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ceiling</label>
                    <input type="color" value={settings.ceilingColor} onChange={(e) => handleChange('ceilingColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600 dark:text-gray-400">Living Room</label>
                    <input type="color" value={settings.livingColor} onChange={(e) => handleChange('livingColor', e.target.value)} className="h-6 w-8 rounded cursor-pointer border-0 p-0" />
                </div>
                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600 dark:text-gray-400">Bedroom</label>
                    <input type="color" value={settings.bedroomColor} onChange={(e) => handleChange('bedroomColor', e.target.value)} className="h-6 w-8 rounded cursor-pointer border-0 p-0" />
                </div>
                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600 dark:text-gray-400">Kitchen</label>
                    <input type="color" value={settings.kitchenColor} onChange={(e) => handleChange('kitchenColor', e.target.value)} className="h-6 w-8 rounded cursor-pointer border-0 p-0" />
                </div>
                <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-600 dark:text-gray-400">Bath</label>
                    <input type="color" value={settings.bathColor} onChange={(e) => handleChange('bathColor', e.target.value)} className="h-6 w-8 rounded cursor-pointer border-0 p-0" />
                </div>
            </div>

        </div>
    );
};

export default InternalFinishesSettings;
