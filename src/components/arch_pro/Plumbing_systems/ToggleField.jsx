import React from 'react';

export default function ToggleField({ label, value, onChange, readonly = false }) {
    return (
        <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">{label}</label>
            <button
                onClick={() => !readonly && onChange(!value)}
                disabled={readonly}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${value ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                />
            </button>
        </div>
    );
}