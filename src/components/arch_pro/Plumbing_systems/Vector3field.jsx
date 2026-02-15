import React from 'react';

export default function Vector3Field({ label, value, onChange, labels = ['X', 'Y', 'Z'], step = 1, unit }) {
    const handleChange = (index, val) => {
        const newValue = [...value];
        newValue[index] = parseFloat(val);
        onChange(newValue);
    };

    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">{label}</label>
            <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="flex-1 flex items-center gap-1">
                        <span className="text-xs text-gray-500 w-4">{labels[i]}</span>
                        <input
                            type="number"
                            value={value[i]}
                            onChange={(e) => handleChange(i, e.target.value)}
                            step={step}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                ))}
                {unit && <span className="text-xs text-gray-500 self-center">{unit}</span>}
            </div>
        </div>
    );
}