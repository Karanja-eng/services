import React from 'react';

export const defaultSubstructureSettings = {
    foundationWallColor: "#64748b",
    stripFoundationColor: "#94a3b8",
    columnStubColor: "#475569",
    columnBaseColor: "#cbd5e1",
    groundColor: "#1e293b",
    groundOpacity: 0.3
};

export const SubstructureSettings = ({ settings, setSettings }) => {
    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-4 p-4">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b pb-2">Ground</h3>

            <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Ground Opacity ({Math.round(settings.groundOpacity * 100)}%)
                </label>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.groundOpacity}
                    onChange={(e) => handleChange('groundOpacity', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Ground Color</label>
                    <input type="color" value={settings.groundColor} onChange={(e) => handleChange('groundColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>
            </div>

            <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b pb-2 pt-2">Elements</h3>

            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Foundation Wall</label>
                    <input type="color" value={settings.foundationWallColor} onChange={(e) => handleChange('foundationWallColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Strip Foundation</label>
                    <input type="color" value={settings.stripFoundationColor} onChange={(e) => handleChange('stripFoundationColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Column Stub</label>
                    <input type="color" value={settings.columnStubColor} onChange={(e) => handleChange('columnStubColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Column Base</label>
                    <input type="color" value={settings.columnBaseColor} onChange={(e) => handleChange('columnBaseColor', e.target.value)} className="h-8 w-full rounded cursor-pointer border-0 p-0" />
                </div>
            </div>

        </div>
    );
};

export default SubstructureSettings;
