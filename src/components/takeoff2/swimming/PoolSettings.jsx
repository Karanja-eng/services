import React from 'react';
import { Eye, Droplet, Box, Ruler } from 'lucide-react';
import { CheckboxField } from '../../shared/ui/Fields';
import { text } from '../../shared/ui/tokens';

/**
 * Pool-specific settings component for the universal visualization canvas.
 *
 * Presentation migrated to the shared design system (chats/ §7): the display
 * toggles use the shared `CheckboxField` (44 px tap row, real associated label,
 * 20 px box) and the typography comes from `tokens.text`. Field names, state
 * shape, `onSettingsChange` payload and `defaultPoolSettings` are unchanged.
 */
export function PoolSettings({ settings, onSettingsChange, isDark = false }) {
    const handleChange = (key, value) => {
        onSettingsChange({ ...settings, [key]: value });
    };

    const bgSection = isDark ? 'bg-slate-800' : 'bg-gray-50';

    return (
        <div className="space-y-4">
            {/* Visibility Controls */}
            <section className={`p-3 rounded-lg ${bgSection}`}>
                <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${text.title}`}>
                    <Eye className="w-4 h-4" aria-hidden="true" />
                    Display Options
                </h3>
                <div className="space-y-1">
                    <CheckboxField
                        label="Walls"
                        checked={settings.showWalls}
                        onChange={(checked) => handleChange('showWalls', checked)}
                    />
                    <CheckboxField
                        label="Water"
                        checked={settings.showWater}
                        onChange={(checked) => handleChange('showWater', checked)}
                    />
                    <CheckboxField
                        label="Dimensions"
                        checked={settings.showDimensions}
                        onChange={(checked) => handleChange('showDimensions', checked)}
                    />
                </div>
            </section>

            {/* Opacity Controls */}
            <section>
                <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${text.title}`}>
                    <Droplet className="w-4 h-4" aria-hidden="true" />
                    Transparency
                </h3>
                <div className="space-y-3">
                    <div>
                        <label htmlFor="pool-water-opacity" className={`text-xs block mb-1 ${text.label}`}>
                            Water opacity: {settings.waterOpacity.toFixed(2)}
                        </label>
                        <input
                            id="pool-water-opacity"
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={settings.waterOpacity}
                            onChange={(e) => handleChange('waterOpacity', parseFloat(e.target.value))}
                            className="w-full h-11 accent-blue-600"
                        />
                    </div>
                    <div>
                        <label htmlFor="pool-wall-opacity" className={`text-xs block mb-1 ${text.label}`}>
                            Wall opacity: {settings.wallOpacity.toFixed(2)}
                        </label>
                        <input
                            id="pool-wall-opacity"
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={settings.wallOpacity}
                            onChange={(e) => handleChange('wallOpacity', parseFloat(e.target.value))}
                            className="w-full h-11 accent-blue-600"
                        />
                    </div>
                </div>
            </section>

            {/* Pool Info */}
            <section className={`p-3 rounded-lg ${isDark ? 'bg-blue-900/20' : 'bg-blue-50'}`}>
                <h3 className={`text-sm font-semibold mb-2 ${text.title}`}>Pool info</h3>
                <div className={`space-y-1.5 text-xs ${text.helper}`}>
                    <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                        <span>Swimming pool structure</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Ruler className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                        <span>Dimensions shown in metres</span>
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
