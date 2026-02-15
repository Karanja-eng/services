// /ui-panels/FloorsPanel.jsx
import React, { useState } from 'react';
import NumericField from './NumericField';
import ColorPicker from './ColorPicker';
import MaterialSelector from './MaterialSelector';
import TypeSelector from './TypeSelector';

const FLOOR_TYPES = [
    { id: 'concrete', label: 'Concrete' },
    { id: 'wood', label: 'Wood' },
    { id: 'tile', label: 'Tile' },
    { id: 'stone', label: 'Stone' },
    { id: 'carpet', label: 'Carpet' }
];

const PATTERNS = ['standard', 'herringbone', 'chevron', 'basketweave', 'plank'];

export default function FloorsPanel({ isOpen, onClose, onGenerate, selectedElementId }) {
    const [floorType, setFloorType] = useState('concrete');
    const [thickness, setThickness] = useState(0.12);
    const [pattern, setPattern] = useState('standard');
    const [textureScale, setTextureScale] = useState(1.0);
    const [color, setColor] = useState('#b4b4b4');
    const [areaPoints, setAreaPoints] = useState('[[0,0],[6,0],[6,4],[0,4]]');

    const parseArea = () => {
        try {
            return JSON.parse(areaPoints);
        } catch {
            return [[0, 0], [6, 0], [6, 4], [0, 4]];
        }
    };

    const handleGenerate = () => {
        const payload = {
            category: 'floor',
            type: floorType,
            thickness,
            pattern,
            textureScale,
            color,
            area: parseArea()
        };
        onGenerate(payload);
    };

    const handleReplace = () => {
        if (!selectedElementId) return;
        const payload = {
            category: 'floor',
            type: floorType,
            thickness,
            pattern,
            textureScale,
            color,
            area: parseArea(),
            replaceId: selectedElementId
        };
        onGenerate(payload);
    };

    const handleAddPreset = (preset) => {
        switch (preset) {
            case 'rectangle':
                setAreaPoints('[[0,0],[6,0],[6,4],[0,4]]');
                break;
            case 'square':
                setAreaPoints('[[0,0],[4,0],[4,4],[0,4]]');
                break;
            case 'lshape':
                setAreaPoints('[[0,0],[6,0],[6,4],[3,4],[3,6],[0,6]]');
                break;
            default:
                break;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-16 left-4 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 max-h-[calc(100vh-5rem)] overflow-hidden flex flex-col z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-800">Floors</h2>
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
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Floor Type</h3>
                    <TypeSelector types={FLOOR_TYPES} selected={floorType} onSelect={setFloorType} />
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Properties</h3>
                    <NumericField label="Thickness" value={thickness} onChange={setThickness} min={0.05} max={0.5} unit="m" />
                    <MaterialSelector label="Pattern" value={pattern} onChange={setPattern} materials={PATTERNS} />
                    <NumericField label="Texture Scale" value={textureScale} onChange={setTextureScale} min={0.1} max={5} step={0.1} />
                    <ColorPicker label="Color" value={color} onChange={setColor} />
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700">Area Definition</h3>
                    <div className="flex gap-2 mb-2">
                        <button
                            onClick={() => handleAddPreset('rectangle')}
                            className="flex-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                        >
                            Rectangle
                        </button>
                        <button
                            onClick={() => handleAddPreset('square')}
                            className="flex-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                        >
                            Square
                        </button>
                        <button
                            onClick={() => handleAddPreset('lshape')}
                            className="flex-1 px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                        >
                            L-Shape
                        </button>
                    </div>
                    <textarea
                        value={areaPoints}
                        onChange={(e) => setAreaPoints(e.target.value)}
                        placeholder="[[x1,y1],[x2,y2],[x3,y3],...]"
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500">
                        Enter polygon coordinates as JSON array of [x, y] points
                    </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-blue-800 mb-1">Preview</h4>
                    <pre className="text-xs text-blue-700 font-mono overflow-x-auto">
                        {JSON.stringify(
                            {
                                category: 'floor',
                                type: floorType,
                                thickness,
                                pattern,
                                area: parseArea()
                            },
                            null,
                            2
                        )}
                    </pre>
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