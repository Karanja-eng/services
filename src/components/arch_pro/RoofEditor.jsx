import React, { useState, useEffect } from 'react';

const RoofEditor = ({ roof, onRoofUpdate, onClose }) => {
    const [params, setParams] = useState({
        type: 'gable',
        pitch: 30,
        overhang: 0.5,
        eavesHeight: 3.0,
        ridgeHeight: 3.5,
        thickness: 0.25,
        components: {
            rafters: true,
            purlins: true,
            battens: false,
            fascia: true,
            gutters: true
        },
        covering: {
            type: 'asphalt_shingles',
            color: '#8B4513',
            pattern: 'standard'
        },
        rafter: {
            spacing: 0.6,
            width: 0.05,
            depth: 0.20
        },
        purlin: {
            spacing: 1.2,
            width: 0.05,
            depth: 0.10
        },
        batten: {
            spacing: 0.35,
            width: 0.04,
            depth: 0.025
        }
    });

    useEffect(() => {
        if (roof) {
            setParams(prev => ({
                ...prev,
                ...roof.parameters,
                components: { ...prev.components, ...(roof.parameters?.components || {}) },
                covering: { ...prev.covering, ...(roof.parameters?.covering || {}) },
                rafter: { ...prev.rafter, ...(roof.parameters?.rafter || {}) },
                purlin: { ...prev.purlin, ...(roof.parameters?.purlin || {}) },
                batten: { ...prev.batten, ...(roof.parameters?.batten || {}) }
            }));
        }
    }, [roof]);

    const handleParamChange = (key, value) => {
        setParams(prev => {
            const updated = { ...prev, [key]: value };
            if (onRoofUpdate && roof) {
                onRoofUpdate(roof.id, updated);
            }
            return updated;
        });
    };

    const handleComponentToggle = (component) => {
        setParams(prev => {
            const updated = {
                ...prev,
                components: { ...prev.components, [component]: !prev.components[component] }
            };
            if (onRoofUpdate && roof) {
                onRoofUpdate(roof.id, updated);
            }
            return updated;
        });
    };

    const handleCoveringChange = (key, value) => {
        setParams(prev => {
            const updated = {
                ...prev,
                covering: { ...prev.covering, [key]: value }
            };
            if (onRoofUpdate && roof) {
                onRoofUpdate(roof.id, updated);
            }
            return updated;
        });
    };

    const handleSubParamChange = (category, key, value) => {
        setParams(prev => {
            const updated = {
                ...prev,
                [category]: { ...prev[category], [key]: value }
            };
            if (onRoofUpdate && roof) {
                onRoofUpdate(roof.id, updated);
            }
            return updated;
        });
    };

    const roofTypes = [
        { value: 'gable', label: 'Gable' },
        { value: 'hip', label: 'Hip' },
        { value: 'mono', label: 'Mono-pitch' },
        { value: 'complex', label: 'Complex' }
    ];

    const coveringTypes = [
        { value: 'asphalt_shingles', label: 'Asphalt Shingles' },
        { value: 'clay_tiles', label: 'Clay Tiles' },
        { value: 'concrete_tiles', label: 'Concrete Tiles' },
        { value: 'metal_standing_seam', label: 'Metal Standing Seam' },
        { value: 'slate', label: 'Slate' },
        { value: 'wood_shakes', label: 'Wood Shakes' }
    ];

    const patterns = [
        { value: 'standard', label: 'Standard' },
        { value: 'staggered', label: 'Staggered' },
        { value: 'diamond', label: 'Diamond' },
        { value: 'herringbone', label: 'Herringbone' }
    ];

    if (!roof) {
        return null;
    }

    return (
        <div className="absolute top-20 right-5 w-80 max-h-[calc(100vh-100px)] bg-gray-800 border border-gray-700 rounded shadow-xl overflow-auto z-50">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between z-10">
                <h3 className="text-sm font-semibold text-white">Roof Editor</h3>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-white text-2xl leading-none w-6 h-6 flex items-center justify-center"
                >
                    ×
                </button>
            </div>

            <div className="p-4">
                <div className="mb-5">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Roof Type
                    </div>
                    <div className="mb-3">
                        <label className="block text-xs text-gray-300 mb-1.5">Type</label>
                        <select
                            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-xs outline-none focus:border-blue-500"
                            value={params.type}
                            onChange={(e) => handleParamChange('type', e.target.value)}
                        >
                            {roofTypes.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mb-5">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Geometry
                    </div>

                    <div className="mb-3">
                        <label className="block text-xs text-gray-300 mb-1.5">
                            Pitch
                            <span className="text-gray-500 ml-2">{params.pitch.toFixed(1)}°</span>
                        </label>
                        <input
                            type="range"
                            min="5"
                            max="60"
                            step="0.5"
                            value={params.pitch}
                            onChange={(e) => handleParamChange('pitch', parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    <div className="mb-3">
                        <label className="block text-xs text-gray-300 mb-1.5">
                            Overhang
                            <span className="text-gray-500 ml-2">{params.overhang.toFixed(2)}m</span>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.05"
                            value={params.overhang}
                            onChange={(e) => handleParamChange('overhang', parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    <div className="mb-3">
                        <label className="block text-xs text-gray-300 mb-1.5">
                            Eaves Height
                            <span className="text-gray-500 ml-2">{params.eavesHeight.toFixed(2)}m</span>
                        </label>
                        <input
                            type="range"
                            min="2"
                            max="6"
                            step="0.1"
                            value={params.eavesHeight}
                            onChange={(e) => handleParamChange('eavesHeight', parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    <div className="mb-3">
                        <label className="block text-xs text-gray-300 mb-1.5">
                            Ridge Height
                            <span className="text-gray-500 ml-2">{params.ridgeHeight.toFixed(2)}m</span>
                        </label>
                        <input
                            type="range"
                            min="2.5"
                            max="8"
                            step="0.1"
                            value={params.ridgeHeight}
                            onChange={(e) => handleParamChange('ridgeHeight', parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    <div className="mb-3">
                        <label className="block text-xs text-gray-300 mb-1.5">
                            Thickness
                            <span className="text-gray-500 ml-2">{params.thickness.toFixed(3)}m</span>
                        </label>
                        <input
                            type="range"
                            min="0.1"
                            max="0.5"
                            step="0.01"
                            value={params.thickness}
                            onChange={(e) => handleParamChange('thickness', parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                </div>

                <div className="mb-5">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Components
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(params.components).map(([key, value]) => (
                            <div
                                key={key}
                                onClick={() => handleComponentToggle(key)}
                                className={`flex items-center px-2 py-2 rounded cursor-pointer transition-all ${value
                                        ? 'bg-blue-900 border border-blue-600'
                                        : 'bg-gray-900 border border-gray-600'
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={value}
                                    onChange={() => { }}
                                    className="mr-2 cursor-pointer"
                                />
                                <span className="text-xs text-white capitalize select-none">{key}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {params.components.rafters && (
                    <div className="mb-5">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                            Rafter Details
                        </div>
                        <div className="mb-3">
                            <label className="block text-xs text-gray-300 mb-1.5">
                                Spacing
                                <span className="text-gray-500 ml-2">{params.rafter.spacing.toFixed(2)}m</span>
                            </label>
                            <input
                                type="range"
                                min="0.3"
                                max="1.2"
                                step="0.05"
                                value={params.rafter.spacing}
                                onChange={(e) => handleSubParamChange('rafter', 'spacing', parseFloat(e.target.value))}
                                className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        <div className="mb-3">
                            <label className="block text-xs text-gray-300 mb-1.5">
                                Width
                                <span className="text-gray-500 ml-2">{params.rafter.width.toFixed(3)}m</span>
                            </label>
                            <input
                                type="range"
                                min="0.03"
                                max="0.1"
                                step="0.005"
                                value={params.rafter.width}
                                onChange={(e) => handleSubParamChange('rafter', 'width', parseFloat(e.target.value))}
                                className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        <div className="mb-3">
                            <label className="block text-xs text-gray-300 mb-1.5">
                                Depth
                                <span className="text-gray-500 ml-2">{params.rafter.depth.toFixed(3)}m</span>
                            </label>
                            <input
                                type="range"
                                min="0.1"
                                max="0.3"
                                step="0.01"
                                value={params.rafter.depth}
                                onChange={(e) => handleSubParamChange('rafter', 'depth', parseFloat(e.target.value))}
                                className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    </div>
                )}

                {params.components.purlins && (
                    <div className="mb-5">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                            Purlin Details
                        </div>
                        <div className="mb-3">
                            <label className="block text-xs text-gray-300 mb-1.5">
                                Spacing
                                <span className="text-gray-500 ml-2">{params.purlin.spacing.toFixed(2)}m</span>
                            </label>
                            <input
                                type="range"
                                min="0.6"
                                max="2.0"
                                step="0.1"
                                value={params.purlin.spacing}
                                onChange={(e) => handleSubParamChange('purlin', 'spacing', parseFloat(e.target.value))}
                                className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        <div className="mb-3">
                            <label className="block text-xs text-gray-300 mb-1.5">
                                Width
                                <span className="text-gray-500 ml-2">{params.purlin.width.toFixed(3)}m</span>
                            </label>
                            <input
                                type="range"
                                min="0.03"
                                max="0.08"
                                step="0.005"
                                value={params.purlin.width}
                                onChange={(e) => handleSubParamChange('purlin', 'width', parseFloat(e.target.value))}
                                className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        <div className="mb-3">
                            <label className="block text-xs text-gray-300 mb-1.5">
                                Depth
                                <span className="text-gray-500 ml-2">{params.purlin.depth.toFixed(3)}m</span>
                            </label>
                            <input
                                type="range"
                                min="0.05"
                                max="0.15"
                                step="0.01"
                                value={params.purlin.depth}
                                onChange={(e) => handleSubParamChange('purlin', 'depth', parseFloat(e.target.value))}
                                className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    </div>
                )}

                {params.components.battens && (
                    <div className="mb-5">
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                            Batten Details
                        </div>
                        <div className="mb-3">
                            <label className="block text-xs text-gray-300 mb-1.5">
                                Spacing
                                <span className="text-gray-500 ml-2">{params.batten.spacing.toFixed(3)}m</span>
                            </label>
                            <input
                                type="range"
                                min="0.2"
                                max="0.6"
                                step="0.01"
                                value={params.batten.spacing}
                                onChange={(e) => handleSubParamChange('batten', 'spacing', parseFloat(e.target.value))}
                                className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        <div className="mb-3">
                            <label className="block text-xs text-gray-300 mb-1.5">
                                Width
                                <span className="text-gray-500 ml-2">{params.batten.width.toFixed(3)}m</span>
                            </label>
                            <input
                                type="range"
                                min="0.02"
                                max="0.06"
                                step="0.005"
                                value={params.batten.width}
                                onChange={(e) => handleSubParamChange('batten', 'width', parseFloat(e.target.value))}
                                className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        <div className="mb-3">
                            <label className="block text-xs text-gray-300 mb-1.5">
                                Depth
                                <span className="text-gray-500 ml-2">{params.batten.depth.toFixed(3)}m</span>
                            </label>
                            <input
                                type="range"
                                min="0.015"
                                max="0.04"
                                step="0.005"
                                value={params.batten.depth}
                                onChange={(e) => handleSubParamChange('batten', 'depth', parseFloat(e.target.value))}
                                className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    </div>
                )}

                <div className="mb-5">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                        Covering
                    </div>

                    <div className="mb-3">
                        <label className="block text-xs text-gray-300 mb-1.5">Type</label>
                        <select
                            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-xs outline-none focus:border-blue-500"
                            value={params.covering.type}
                            onChange={(e) => handleCoveringChange('type', e.target.value)}
                        >
                            {coveringTypes.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-3">
                        <label className="block text-xs text-gray-300 mb-1.5">Color</label>
                        <input
                            type="color"
                            value={params.covering.color}
                            onChange={(e) => handleCoveringChange('color', e.target.value)}
                            className="w-full h-8 bg-gray-900 border border-gray-600 rounded cursor-pointer"
                        />
                    </div>

                    <div className="mb-3">
                        <label className="block text-xs text-gray-300 mb-1.5">Pattern</label>
                        <select
                            className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-white text-xs outline-none focus:border-blue-500"
                            value={params.covering.pattern}
                            onChange={(e) => handleCoveringChange('pattern', e.target.value)}
                        >
                            {patterns.map(pattern => (
                                <option key={pattern.value} value={pattern.value}>{pattern.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoofEditor;