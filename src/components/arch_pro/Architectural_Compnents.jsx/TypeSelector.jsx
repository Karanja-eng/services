// /ui-panels/shared/MaterialSelector.jsx
import React from 'react';

export default function MaterialSelector({ label, value, onChange, materials }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                {materials.map((material) => (
                    <option key={material} value={material}>
                        {material.charAt(0).toUpperCase() + material.slice(1)}
                    </option>
                ))}
            </select>
        </div>
    );
}