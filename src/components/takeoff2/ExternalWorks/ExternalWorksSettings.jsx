import React from 'react';
import { Layers, Move, Ruler, Map } from 'lucide-react';

export const defaultExternalWorksSettings = {
    roadWidth: 9,
    roadLength: 40,
    roadRotation: 0,
    parkingWidth: 10,
    parkingLength: 20,
    parkingRotation: 90,
    parkingPosX: 10,
    parkingPosZ: 0,
    bellmouthRadius1: 6,
    bellmouthRadius2: 6,
    drivewayWidth: 6,
    surfaceType: "bitumen",
    showLayers: {
        subBase: true,
        hardcore: true,
        baseCoarse: true,
        bitumen: true,
        kerb: true,
        channel: true,
        invertBlock: true,
        bellmouth: true,
    },
};

const ExternalWorksSettings = ({ settings = defaultExternalWorksSettings, onSettingsChange, isDark }) => {

    const handleChange = (key, value) => {
        onSettingsChange(prev => ({ ...prev, [key]: value }));
    };

    const handleLayerToggle = (layer) => {
        onSettingsChange(prev => ({
            ...prev,
            showLayers: {
                ...prev.showLayers,
                [layer]: !prev.showLayers[layer]
            }
        }));
    };

    const ControlGroup = ({ label, value, onChange, type = "number", min, max, step = "0.5" }) => (
        <label className="block mb-3">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <input
                type={type}
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(e) => onChange(type === "number" || type === "range" ? parseFloat(e.target.value) || 0 : e.target.value)}
                className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} focus:outline-none focus:border-blue-500 transition-colors`}
            />
        </label>
    );

    return (
        <div className="space-y-4">
            {/* Main Road */}
            <section className={`p-3 rounded ${isDark ? "bg-gray-750" : "bg-gray-50"}`}>
                <h3 className="text-sm font-semibold mb-3 flex items-center text-blue-500">
                    <Map className="w-4 h-4 mr-2" />
                    Main Road
                </h3>
                <div className="grid grid-cols-2 gap-2">
                    <ControlGroup label="Width" value={settings.roadWidth} onChange={(v) => handleChange('roadWidth', v)} />
                    <ControlGroup label="Length" value={settings.roadLength} onChange={(v) => handleChange('roadLength', v)} />
                </div>
                <ControlGroup label="Rotation" value={settings.roadRotation} onChange={(v) => handleChange('roadRotation', v)} type="range" min={-180} max={180} />
            </section>

            {/* Parking */}
            <section className={`p-3 rounded ${isDark ? "bg-gray-750" : "bg-gray-50"}`}>
                <h3 className="text-sm font-semibold mb-3 flex items-center text-blue-500">
                    <Move className="w-4 h-4 mr-2" />
                    Access Road / Parking
                </h3>
                <div className="grid grid-cols-2 gap-2">
                    <ControlGroup label="Width" value={settings.parkingWidth} onChange={(v) => handleChange('parkingWidth', v)} />
                    <ControlGroup label="Length" value={settings.parkingLength} onChange={(v) => handleChange('parkingLength', v)} />
                    <ControlGroup label="Pos X" value={settings.parkingPosX} onChange={(v) => handleChange('parkingPosX', v)} />
                    <ControlGroup label="Pos Z" value={settings.parkingPosZ} onChange={(v) => handleChange('parkingPosZ', v)} />
                </div>
                <ControlGroup label="Rotation" value={settings.parkingRotation} onChange={(v) => handleChange('parkingRotation', v)} type="range" min={-180} max={180} />
            </section>

            {/* Junction */}
            <section className={`p-3 rounded ${isDark ? "bg-gray-750" : "bg-gray-50"}`}>
                <h3 className="text-sm font-semibold mb-3 flex items-center text-blue-500">
                    <Ruler className="w-4 h-4 mr-2" />
                    Bellmouth Junction
                </h3>
                <div className="grid grid-cols-2 gap-2">
                    <ControlGroup label="Radius L" value={settings.bellmouthRadius1} onChange={(v) => handleChange('bellmouthRadius1', v)} />
                    <ControlGroup label="Radius R" value={settings.bellmouthRadius2} onChange={(v) => handleChange('bellmouthRadius2', v)} />
                </div>
            </section>

            {/* Surface Type */}
            <section className={`p-3 rounded ${isDark ? "bg-gray-750" : "bg-gray-50"}`}>
                <label className="block mb-2 text-sm font-semibold">Surface Type</label>
                <select
                    value={settings.surfaceType}
                    onChange={(e) => handleChange('surfaceType', e.target.value)}
                    className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'} focus:outline-none focus:border-blue-500`}
                >
                    <option value="bitumen">Bitumen / Tar</option>
                    <option value="cabro">Cabro Blocks</option>
                </select>
            </section>

            {/* Layers */}
            <section className={`p-3 rounded ${isDark ? "bg-gray-750" : "bg-gray-50"}`}>
                <h3 className="text-sm font-semibold mb-3 flex items-center">
                    <Layers className="w-4 h-4 mr-2" />
                    Layer Visibility
                </h3>
                <div className="grid grid-cols-2 gap-2">
                    {Object.keys(settings.showLayers).map((layer) => (
                        <button
                            key={layer}
                            onClick={() => handleLayerToggle(layer)}
                            className={`px-2 py-1 text-xs rounded border transition-colors ${settings.showLayers[layer]
                                    ? 'bg-blue-100 dark:bg-blue-900 border-blue-500 text-blue-600 dark:text-blue-300'
                                    : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500'
                                }`}
                        >
                            {layer.replace(/([A-Z])/g, " $1").trim()}
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default ExternalWorksSettings;
