import React from 'react';
import { Eye, Droplet, Box, Ruler } from 'lucide-react';

/**
 * Pool-specific settings component for the universal visualization canvas
 */
export function PoolSettings({ settings, onSettingsChange, isDark = false }) {
    const handleChange = (key, value) => {
        onSettingsChange({ ...settings, [key]: value });
    };

    const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
    const bgSection = isDark ? 'bg-gray-750' : 'bg-gray-50';

    return (
        <div className="space-y-4">
            {/* Visibility Controls */}
            <section className={`p-3 rounded ${bgSection}`}>
                <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <Eye className="w-4 h-4 mr-2" />
                    Display Options
                </h3>
                <div className="space-y-2">
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Walls</span>
                        <input
                            type="checkbox"
                            checked={settings.showWalls}
                            onChange={(e) => handleChange('showWalls', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600"
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Water</span>
                        <input
                            type="checkbox"
                            checked={settings.showWater}
                            onChange={(e) => handleChange('showWater', e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                        <span className="text-sm">Dimensions</span>
                        <input
                            type="checkbox"
                            checked={settings.showDimensions}
                            onChange={(e) => handleChange('showDimensions', e.target.checked)}
                            className="w-4 h-4 rounded"
                        />
                    </label>
                </div>
            </section>

            {/* Opacity Controls */}
            <section>
                <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <Droplet className="w-4 h-4 mr-2" />
                    Transparency
                </h3>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs block mb-1">
                            Water Opacity: {settings.waterOpacity.toFixed(2)}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={settings.waterOpacity}
                            onChange={(e) => handleChange('waterOpacity', parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className="text-xs block mb-1">
                            Wall Opacity: {settings.wallOpacity.toFixed(2)}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={settings.wallOpacity}
                            onChange={(e) => handleChange('wallOpacity', parseFloat(e.target.value))}
                            className="w-full"
                        />
                    </div>
                </div>
            </section>

            {/* Pool Info */}
            <section className={`p-3 rounded ${isDark ? 'bg-blue-900 bg-opacity-20' : 'bg-blue-50'}`}>
                <h3 className="text-sm font-semibold mb-2">Pool Info</h3>
                <div className="space-y-1.5 text-xs">
                    <div className="flex items-center">
                        <Box className="w-4 h-4 mr-2 text-blue-500" />
                        <span>Swimming Pool Structure</span>
                    </div>
                    <div className="flex items-center">
                        <Ruler className="w-4 h-4 mr-2 text-blue-500" />
                        <span>Dimensions shown in meters</span>
                    </div>
                </div>
            </section>
        </div>
    );
}

// Default settings for pool visualization
export const defaultPoolSettings = {
    showWalls: true,
    showWater: true,
    showDimensions: true,
    waterOpacity: 0.5,
    wallOpacity: 0.8,
};

export default PoolSettings;
