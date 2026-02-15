// /ui-panels/shared/Vector3Field.jsx
import React from 'react';

export default function Vector3Field({ label, value, onChange }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{label}</label>
            <div className="grid grid-cols-3 gap-2">
                <input
                    type="number"
                    placeholder="X"
                    value={value[0]}
                    onChange={(e) => onChange([parseFloat(e.target.value) || 0, value[1], value[2]])}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                    type="number"
                    placeholder="Y"
                    value={value[1]}
                    onChange={(e) => onChange([value[0], parseFloat(e.target.value) || 0, value[2]])}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                    type="number"
                    placeholder="Z"
                    value={value[2]}
                    onChange={(e) => onChange([value[0], value[1], parseFloat(e.target.value) || 0])}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
    );
}