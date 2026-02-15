// /ui-panels/shared/NumericField.jsx
export default function NumericField({ label, value, onChange, min, max, step, unit, disabled }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 uppercase tracking-wide">{label}</label>
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    min={min}
                    max={max}
                    step={step}
                    disabled={disabled}
                    className="flex-1 bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white rounded focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {unit && <span className="text-xs text-gray-500">{unit}</span>}
            </div>
        </div>
    );
}