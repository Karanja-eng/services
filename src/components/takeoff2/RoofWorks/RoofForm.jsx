import React from "react";
import { Settings, Save, Download, Upload } from "lucide-react";

export default function RoofForm({ config, onChange, onCalculate }) {
    const updateConfig = (key, value) => {
        onChange(key, value);
    };

    return (
        <div className="space-y-6">
            <div className="bg-blue-600 text-white p-4 rounded-t-lg -m-6 mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Settings className="w-6 h-6" />
                    Configuration
                </h2>
                <p className="text-sm opacity-90">Adjust roof parameters</p>
            </div>

            <div className="space-y-4">
                {/* Roof Type */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Roof Type
                    </label>
                    <select
                        value={config.roofType}
                        onChange={(e) => updateConfig("roofType", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="gable">Gable Roof</option>
                        <option value="hipped">Hipped Roof</option>
                        <option value="gambrel">Gambrel Roof</option>
                        <option value="lean-to">Lean-to Roof</option>
                        <option value="mansard">Mansard Roof</option>
                    </select>
                </div>

                {/* Basic Dimensions */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Building Length (m)
                        </label>
                        <input
                            type="number"
                            value={config.buildingLength}
                            onChange={(e) => updateConfig("buildingLength", parseFloat(e.target.value))}
                            step="0.1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Building Width (m)
                        </label>
                        <input
                            type="number"
                            value={config.buildingWidth}
                            onChange={(e) => updateConfig("buildingWidth", parseFloat(e.target.value))}
                            step="0.1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                </div>

                {/* Structural Specs */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Wall Thickness (m)
                        </label>
                        <input
                            type="number"
                            value={config.wallThickness}
                            onChange={(e) => updateConfig("wallThickness", parseFloat(e.target.value))}
                            step="0.05"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Overhang (m)
                        </label>
                        <input
                            type="number"
                            value={config.overhang}
                            onChange={(e) => updateConfig("overhang", parseFloat(e.target.value))}
                            step="0.1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                </div>

                {/* Pitch Angles */}
                <div className="space-y-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-md">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Lower Pitch Angle: {config.pitchAngle}°
                        </label>
                        <input
                            type="range"
                            min="5"
                            max="80"
                            value={config.pitchAngle}
                            onChange={(e) => updateConfig("pitchAngle", parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>

                    {(config.roofType === "gambrel" || config.roofType === "mansard") && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Upper Pitch Angle: {config.pitchAngle2}°
                                </label>
                                <input
                                    type="range"
                                    min="5"
                                    max="45"
                                    value={config.pitchAngle2}
                                    onChange={(e) => updateConfig("pitchAngle2", parseInt(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                                    Break Ratio: {config.breakRatio}
                                </label>
                                <input
                                    type="range"
                                    min="0.2"
                                    max="0.8"
                                    step="0.05"
                                    value={config.breakRatio}
                                    onChange={(e) => updateConfig("breakRatio", parseFloat(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Spacing */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Truss Spacing (m)
                        </label>
                        <input
                            type="number"
                            value={config.trussSpacing}
                            onChange={(e) => updateConfig("trussSpacing", parseFloat(e.target.value))}
                            step="0.1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Rafter Spacing (m)
                        </label>
                        <input
                            type="number"
                            value={config.rafterSpacing}
                            onChange={(e) => updateConfig("rafterSpacing", parseFloat(e.target.value))}
                            step="0.1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                    </div>
                </div>

                {/* Materials */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Material
                        </label>
                        <select
                            value={config.material}
                            onChange={(e) => updateConfig("material", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                            <option value="timber">Timber</option>
                            <option value="steel">Steel</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Covering
                        </label>
                        <select
                            value={config.covering}
                            onChange={(e) => updateConfig("covering", e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                            <option value="none">None</option>
                            <option value="tiles">Clay Tiles</option>
                            <option value="acSheets">A.C. Sheets</option>
                            <option value="giSheets">G.I. Sheets</option>
                            <option value="slate">Slate</option>
                            <option value="thatch">Thatch</option>
                        </select>
                    </div>
                </div>

                {/* Rainwater Goods */}
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-slate-900 rounded-md border border-blue-100 dark:border-slate-700">
                    <label className="text-sm font-semibold text-blue-800 dark:text-blue-400 font-sans">
                        Include Rainwater Goods
                    </label>
                    <div
                        onClick={() => updateConfig("includeRainwaterGoods", !config.includeRainwaterGoods)}
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${config.includeRainwaterGoods ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${config.includeRainwaterGoods ? 'translate-x-7' : 'translate-x-1'}`} />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-6 space-y-3">
                    <button
                        onClick={onCalculate}
                        className="w-full bg-blue-600 text-white py-3 rounded-md font-semibold hover:bg-blue-700 shadow-md transition-all active:scale-95"
                    >
                        Calculate Takeoff
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                        <button className="flex items-center justify-center gap-2 py-2 border border-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700">
                            <Download className="w-4 h-4" /> Save
                        </button>
                        <button className="flex items-center justify-center gap-2 py-2 border border-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700">
                            <Upload className="w-4 h-4" /> Import
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
