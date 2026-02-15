// /ui-panels/shared/ToggleField.jsx
export default function ToggleField({ label, value, onChange, disabled }) {
    return (
        <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400 uppercase tracking-wide">{label}</label>
            <button
                onClick={() => onChange(!value)}
                disabled={disabled}
                className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${value ? 'translate-x-5' : 'translate-x-0'
                        }`}
                />
            </button>
        </div>
    );
}