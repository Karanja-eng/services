import React from 'react';
import { Layers, Eye } from 'lucide-react';

export const defaultRoofSettings = {
    rafters: true,
    purlins: true,
    wallPlates: true,
    covering: true,
    ridge: true,
    fascia: true,
    rainwaterGoods: true,
};

const RoofSettings = ({ settings = defaultRoofSettings, onSettingsChange, isDark }) => {

    const handleChange = (key, value) => {
        onSettingsChange(prev => ({ ...prev, [key]: value }));
    };

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
        <section className={`p-3 rounded ${isDark ? "bg-gray-750" : "bg-gray-50"}`}>
            <h3 className="text-sm font-semibold mb-3 flex items-center">
                <Layers className="w-4 h-4 mr-2" />
                Structural Components
            </h3>
            <div className="space-y-2">
                {Object.entries(settings).map(([key, value]) => (
                    <SimpleToggle
                        key={key}
                        label={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        value={value}
                        onChange={(v) => handleChange(key, v)}
                    />
                ))}
            </div>
        </section>
    );
};

export default RoofSettings;
