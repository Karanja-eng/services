// /ui-panels/DoorsPanel.jsx
import React, { useState } from 'react';
import NumericField from './NumericField';
import Vector3Field from './Vector3Field';
import ColorPicker from './ColorPicker';
import MaterialSelector from './MaterialSelector';
import TypeSelector from './TypeSelector';

const DOOR_TYPES = [
    { id: 'swing', label: 'Swing' },
    { id: 'sliding', label: 'Sliding' },
    { id: 'double', label: 'Double' },
    { id: 'folding', label: 'Folding' },
    { id: 'panelled', label: 'Panelled' },
    { id: 'glass', label: 'Glass' },
    { id: 'arched', label: 'Arched' },
    { id: 'modern', label: 'Modern' },
    { id: 'classic', label: 'Classic' },
    { id: 'barn', label: 'Barn' }
];

const HANDLE_TYPES = ['lever', 'knob', 'pull', 'brass', 'modern'];
const MATERIALS = ['wood', 'glass', 'metal', 'composite'];

export default function DoorsPanel({ isOpen, onClose, onGenerate, selectedElementId }) {
    const [doorType, setDoorType] = useState('swing');
    const [width, setWidth] = useState(0.9);
    const [height, setHeight] = useState(2.1);
    const [depth, setDepth] = useState(0.05);
    const [rotation, setRotation] = useState([0, 0, 0]);
    const [handleType, setHandleType] = useState('lever');
    const [material, setMaterial] = useState('wood');
    const [color, setColor] = useState('#8b5a2b');

    const handleGenerate = () => {
        const payload = {
            category: 'door',
            type: doorType,
            width,
            height,
            depth,
            rotation,
            handle: handleType,
            material,
            color
        };
        onGenerate(payload);
    };

    const handleReplace = () => {
        if (!selectedElementId) return;
        const payload = {
            category: 'door',
            type: doorType,
            width,
            height,
            depth,
            rotation,
            handle: handleType,
            material,
            color,
            replaceId: selectedElementId
        };
        onGenerate(payload);
    };

    const handleDuplicate = () => {
        if (!selectedElementId) return;
        const payload = {
            category: 'door',
            type: doorType,
            width,
            height,
            depth,
            rotation,
            handle: handleType,
            material,
            color,
            duplicateFrom: selectedElementId
        };
        onGenerate(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-16 left-4 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-[calc(100vh-5rem)] overflow-hidden flex flex-col z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-800">Doors</h2>
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
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Door Type</h3>
                    <TypeSelector types={DOOR_TYPES} selected={doorType} onSelect={setDoorType} />
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Dimensions</h3>
                    <NumericField label="Width" value={width} onChange={setWidth} min={0.5} max={3} unit="m" />
                    <NumericField label="Height" value={height} onChange={setHeight} min={1.8} max={3} unit="m" />
                    <NumericField label="Depth" value={depth} onChange={setDepth} min={0.03} max={0.15} unit="m" />
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Transform</h3>
                    <Vector3Field label="Rotation (X, Y, Z)" value={rotation} onChange={setRotation} />
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Style</h3>
                    <MaterialSelector label="Handle Type" value={handleType} onChange={setHandleType} materials={HANDLE_TYPES} />
                    <MaterialSelector label="Material" value={material} onChange={setMaterial} materials={MATERIALS} />
                    <ColorPicker label="Color" value={color} onChange={setColor} />
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
                <button
                    onClick={handleDuplicate}
                    disabled={!selectedElementId}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Duplicate
                </button>
            </div>
        </div>
    );
}