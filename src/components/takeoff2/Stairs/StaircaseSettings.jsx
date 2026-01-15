import React from 'react';

export const defaultStaircaseSettings = {
    concreteColor: "#cccccc",
    timberColor: "#8b4513",
    steelColor: "#808080",
    glassColor: "#88ccff",
    glassOpacity: 0.3,
    handrailColor: "#444444"
};

export const StaircaseSettings = ({ settings, setSettings }) => {
    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-4 p-4">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b pb-2">Material Finishes</h3>

            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Concrete</label>
                    <input type="color" value={settings.concreteColor} onChange={(e) => handleChange('concreteColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Timber</label>
                    <input type="color" value={settings.timberColor} onChange={(e) => handleChange('timberColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Steel</label>
                    <input type="color" value={settings.steelColor} onChange={(e) => handleChange('steelColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Handrails</label>
                    <input type="color" value={settings.handrailColor} onChange={(e) => handleChange('handrailColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>
            </div>

            <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b pb-2 pt-2">Glass Settings</h3>

            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Glass Color</label>
                    <input type="color" value={settings.glassColor} onChange={(e) => handleChange('glassColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                        Opacity ({Math.round(settings.glassOpacity * 100)}%)
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.glassOpacity}
                        onChange={(e) => handleChange('glassOpacity', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </div>

        </div>
    );
};

export default StaircaseSettings;
