// /ui-panels/shared/SelectField.jsx
export default function SelectField({ label, value, onChange, options, disabled }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 uppercase tracking-wide">{label}</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white rounded focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}