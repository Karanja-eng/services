// /ui-panels/shared/NumericField.jsx
import React from 'react';

export default function NumericField({ label, value, onChange, min, max, step = 0.01, unit = '' }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">{label}</label>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                    min={min}
                    max={max}
                    step={step}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {unit && <span className="text-sm text-gray-500">{unit}</span>}
            </div>
        </div>
    );
}