// /ui-panels/WallsPanel.jsx
import React, { useState } from 'react';
import NumericField from './NumericField';
import Vector3Field from './Vector3Field';
import ColorPicker from './ColorPicker';
import MaterialSelector from './MaterialSelector';
import TypeSelector from './TypeSelector';

const WALL_TYPES = [
    { id: 'plaster', label: 'Plaster' },
    { id: 'brick', label: 'Brick' },
    { id: 'stone', label: 'Stone' },
    { id: 'concrete', label: 'Concrete' },
    { id: 'half_timbered', label: 'Half-Timbered' }
];

const MATERIALS = ['plaster_white', 'brick_red', 'stone_gray', 'concrete_gray', 'timber_brown'];

export default function WallsPanel({ isOpen, onClose, onGenerate, selectedElementId }) {
    const [wallType, setWallType] = useState('plaster');
    const [length, setLength] = useState(6.0);
    const [height, setHeight] = useState(3.0);
    const [thickness, setThickness] = useState(0.23);
    const [rotation, setRotation] = useState([0, 0, 0]);
    const [material, setMaterial] = useState('plaster_white');
    const [color, setColor] = useState('#f5f5f0');
    const [openings, setOpenings] = useState([]);
    const [newOpeningId, setNewOpeningId] = useState('');
    const [newOpeningType, setNewOpeningType] = useState('door');
    const [newOpeningX, setNewOpeningX] = useState(0);
    const [newOpeningY, setNewOpeningY] = useState(0);

    const handleAddOpening = () => {
        if (!newOpeningId.trim()) return;
        setOpenings([
            ...openings,
            {
                id: newOpeningId,
                type: newOpeningType,
                position: [newOpeningX, newOpeningY]
            }
        ]);
        setNewOpeningId('');
        setNewOpeningX(0);
        setNewOpeningY(0);
    };

    const handleRemoveOpening = (index) => {
        setOpenings(openings.filter((_, i) => i !== index));
    };

    const handleGenerate = () => {
        const payload = {
            category: 'wall',
            type: wallType,
            length,
            height,
            thickness,
            rotation,
            material,
            color,
            openings
        };
        onGenerate(payload);
    };

    const handleReplace = () => {
        if (!selectedElementId) return;
        const payload = {
            category: 'wall',
            type: wallType,
            length,
            height,
            thickness,
            rotation,
            material,
            color,
            openings,
            replaceId: selectedElementId
        };
        onGenerate(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-16 left-4 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-[calc(100vh-5rem)] overflow-hidden flex flex-col z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-800">Walls</h2>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Wall Type</h3>
                    <TypeSelector types={WALL_TYPES} selected={wallType} onSelect={setWallType} />
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Dimensions</h3>
                    <NumericField label="Length" value={length} onChange={setLength} min={1} max={20} unit="m" />
                    <NumericField label="Height" value={height} onChange={setHeight} min={2} max={6} unit="m" />
                    <NumericField label="Thickness" value={thickness} onChange={setThickness} min={0.1} max={0.5} unit="m" />
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Transform</h3>
                    <Vector3Field label="Rotation (X, Y, Z)" value={rotation} onChange={setRotation} />
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Material</h3>
                    <MaterialSelector label="Material Type" value={material} onChange={setMaterial} materials={MATERIALS} />
                    <ColorPicker label="Color" value={color} onChange={setColor} />
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Openings</h3>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                        {openings.length === 0 && (
                            <p className="text-sm text-gray-500 italic">No openings added</p>
                        )}
                        {openings.map((opening, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                                <div className="text-sm">
                                    <span className="font-medium">{opening.id}</span>
                                    <span className="text-gray-500 ml-2">({opening.type})</span>
                                    <span className="text-gray-400 ml-2 text-xs">
                                        [{opening.position[0].toFixed(2)}, {opening.position[1].toFixed(2)}]
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleRemoveOpening(index)}
                                    className="text-red-500 hover:text-red-700"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-2 border-t pt-3">
                        <input
                            type="text"
                            placeholder="Opening ID (e.g., door_1)"
                            value={newOpeningId}
                            onChange={(e) => setNewOpeningId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                            value={newOpeningType}
                            onChange={(e) => setNewOpeningType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="door">Door</option>
                            <option value="window">Window</option>
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="number"
                                placeholder="Position X"
                                value={newOpeningX}
                                onChange={(e) => setNewOpeningX(parseFloat(e.target.value) || 0)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                                type="number"
                                placeholder="Position Y"
                                value={newOpeningY}
                                onChange={(e) => setNewOpeningY(parseFloat(e.target.value) || 0)}
                                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={handleAddOpening}
                            className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                        >
                            Add Opening
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50">
                <button
                    onClick={handleGenerate}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                    Generate
                </button>
                <button
                    onClick={handleReplace}
                    disabled={!selectedElementId}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Replace
                </button>
            </div>
        </div>
    );
}