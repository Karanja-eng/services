import React from 'react';

export const defaultDoorWindowSettings = {
    windowColor: "#38bdf8",
    doorColor: "#92400e",
    frameColor: "#1e293b",
    glassOpacity: 0.6,
    showWireframe: true
};

export const DoorWindowSettings = ({ settings, setSettings }) => {
    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-4 p-4">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 border-b pb-2">Appearance</h3>

            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Window Color</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={settings.windowColor}
                            onChange={(e) => handleChange('windowColor', e.target.value)}
                            className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                        />
                        <span className="text-xs text-gray-500">{settings.windowColor}</span>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Door Color</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={settings.doorColor}
                            onChange={(e) => handleChange('doorColor', e.target.value)}
                            className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                        />
                        <span className="text-xs text-gray-500">{settings.doorColor}</span>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Frame Color</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={settings.frameColor}
                            onChange={(e) => handleChange('frameColor', e.target.value)}
                            className="h-8 w-8 rounded cursor-pointer border-0 p-0"
                        />
                        <span className="text-xs text-gray-500">{settings.frameColor}</span>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Opacity ({Math.round(settings.glassOpacity * 100)}%)
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={settings.glassOpacity}
                        onChange={(e) => handleChange('glassOpacity', parseFloat(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Wireframe</label>
                    <input
                        type="checkbox"
                        checked={settings.showWireframe}
                        onChange={(e) => handleChange('showWireframe', e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                </div>
            </div>
        </div>
    );
};

export default DoorWindowSettings;
