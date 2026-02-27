import React, { useState } from 'react';
import NumericField from './NumericField';
import TypeSelector from './TypeSelector';
import ColorPicker from './ColorPicker';

const FOUNDATION_TYPES = [
    { id: 'pad', label: 'Pad Footing' },
    { id: 'strip', label: 'Strip Foundation' },
    { id: 'raft', label: 'Raft Foundation' },
    { id: 'pile', label: 'Pile Foundation' },
    { id: 'lift_shaft', label: 'Lift Shaft Raft' }
];

export default function FoundationPanel({ isOpen, onClose, onGenerate, selectedElementId }) {
    const [type, setType] = useState('pad');
    const [load, setLoad] = useState(500.0);
    const [soilCapacity, setSoilCapacity] = useState(200.0);
    const [depth, setDepth] = useState(0.6);

    // Type-specific states
    const [colWidth, setColWidth] = useState(0.4);
    const [colDepth, setColDepth] = useState(0.4);
    const [length, setLength] = useState(5.0);
    const [width, setWidth] = useState(10.0);
    const [depthDim, setDepthDim] = useState(10.0);
    const [thickness, setThickness] = useState(0.3);

    const [color, setColor] = useState('#8c8c8c');

    const handleGenerate = () => {
        const payload = {
            category: 'foundation',
            type,
            load,
            soil_capacity: soilCapacity,
            depth,
            color
        };

        if (type === 'pad') {
            payload.col_width = colWidth;
            payload.col_depth = colDepth;
        } else if (type === 'strip') {
            payload.length = length;
            payload.wall_thickness = colWidth; // reuse or add separate
        } else if (type === 'raft') {
            payload.width = width;
            payload.depth_dim = depthDim;
            payload.thickness = thickness;
        }

        onGenerate(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-16 left-4 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-[calc(100vh-5rem)] overflow-hidden flex flex-col z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-800">Foundation Editor</h2>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Foundation Type</h3>
                    <TypeSelector types={FOUNDATION_TYPES} selected={type} onSelect={setType} />
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Engineering Parameters</h3>
                    <NumericField label="Applied Load" value={load} onChange={setLoad} min={10} max={5000} unit="kN" />
                    <NumericField label="Soil Capacity" value={soilCapacity} onChange={setSoilCapacity} min={50} max={600} unit="kN/m²" />
                    <NumericField label="Foundation Depth" value={depth} onChange={setDepth} min={0.3} max={3.0} unit="m" />
                </div>

                <div className="space-y-3 pt-2 border-t text-sm">
                    <h3 className="font-semibold text-gray-700">Geometry Settings</h3>
                    {type === 'pad' && (
                        <div className="space-y-3">
                            <NumericField label="Column Width" value={colWidth} onChange={setColWidth} min={0.2} max={1.0} unit="m" />
                            <NumericField label="Column Depth" value={colDepth} onChange={setColDepth} min={0.2} max={1.0} unit="m" />
                        </div>
                    )}
                    {type === 'strip' && (
                        <div className="space-y-3">
                            <NumericField label="Wall Length" value={length} onChange={setLength} min={1} max={50} unit="m" />
                        </div>
                    )}
                    {type === 'raft' && (
                        <div className="space-y-3">
                            <NumericField label="Raft Width" value={width} onChange={setWidth} min={2} max={100} unit="m" />
                            <NumericField label="Raft Depth (Length)" value={depthDim} onChange={setDepthDim} min={2} max={100} unit="m" />
                            <NumericField label="Slab Thickness" value={thickness} onChange={setThickness} min={0.2} max={1.2} unit="m" />
                        </div>
                    )}
                </div>

                <div className="space-y-3 pt-2 border-t">
                    <ColorPicker label="Display Color" value={color} onChange={setColor} />
                </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                <button
                    onClick={handleGenerate}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                    Generate Foundation BIM
                </button>
            </div>
        </div>
    );
}
