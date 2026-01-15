import React from 'react';
import { Eye, EyeOff, Layers } from 'lucide-react';

export const defaultDrainageSettings = {
    showGround: true,
    showManholes: true,
    showPipes: true,
    showExcavation: true,
    showLabels: true,
    showHouses: true,
    opacity: 1.0,
};

const DrainageSettings = ({ settings = defaultDrainageSettings, onSettingsChange, isDark }) => {

    const handleChange = (key, value) => {
        onSettingsChange(prev => ({ ...prev, [key]: value }));
    };

    const Toggle = ({ label, value, onChange }) => (
        <label className="flex items-center justify-between cursor-pointer py-1">
            <span className="text-sm">{label}</span>
            <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                <input
                    type="checkbox"
                    name={label}
                    id={label}
                    checked={value}
                    onChange={(e) => onChange(e.target.checked)}
                    className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer"
                    style={{ right: value ? 0 : 'auto', left: value ? 'auto' : 0, borderColor: value ? '#3b82f6' : '#9ca3af' }}
                />
                <label htmlFor={label} className={`toggle-label block overflow-hidden h-5 rounded-full cursor-pointer ${value ? 'bg-blue-500' : 'bg-gray-300'}`}></label>
            </div>
        </label>
    );

    // Alternative simple checkbox style matching RCSettings
    const SimpleToggle = ({ label, value, onChange }) => (
        <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm">{label}</span>
            <input
                type="checkbox"
                checked={value}
                onChange={(e) => onChange(e.target.checked)}
                className="w-4 h-4 rounded"
            />
        </label>
    );

    return (
        <div className="space-y-4">
            <section className={`p-3 rounded ${isDark ? "bg-gray-750" : "bg-gray-50"}`}>
                <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <Layers className="w-4 h-4 mr-2" />
                    Layer Visibility
                </h3>
                <div className="space-y-2">
                    <SimpleToggle
                        label="Ground"
                        value={settings.showGround}
                        onChange={(v) => handleChange('showGround', v)}
                    />
                    <SimpleToggle
                        label="Manholes"
                        value={settings.showManholes}
                        onChange={(v) => handleChange('showManholes', v)}
                    />
                    <SimpleToggle
                        label="Pipes"
                        value={settings.showPipes}
                        onChange={(v) => handleChange('showPipes', v)}
                    />
                    <SimpleToggle
                        label="Excavation"
                        value={settings.showExcavation}
                        onChange={(v) => handleChange('showExcavation', v)}
                    />
                    <SimpleToggle
                        label="Labels"
                        value={settings.showLabels}
                        onChange={(v) => handleChange('showLabels', v)}
                    />
                    <SimpleToggle
                        label="Houses"
                        value={settings.showHouses}
                        onChange={(v) => handleChange('showHouses', v)}
                    />
                </div>
            </section>

            <section className={`p-3 rounded ${isDark ? "bg-gray-750" : "bg-gray-50"}`}>
                <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <Eye className="w-4 h-4 mr-2" />
                    Opacity
                </h3>
                <div>
                    <label className="text-xs block mb-1">
                        Global Opacity: {settings.opacity.toFixed(2)}
                    </label>
                    <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={settings.opacity}
                        onChange={(e) =>
                            handleChange('opacity', parseFloat(e.target.value))
                        }
                        className="w-full"
                    />
                </div>
            </section>
        </div>
    );
};

export default DrainageSettings;
