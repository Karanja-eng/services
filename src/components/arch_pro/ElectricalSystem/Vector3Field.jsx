// /ui-panels/shared/Vector3Field.jsx
export default function Vector3Field({ label, value, onChange, disabled }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400 uppercase tracking-wide">{label}</label>
            <div className="grid grid-cols-3 gap-2">
                <input
                    type="number"
                    value={value[0]}
                    onChange={(e) => onChange([parseFloat(e.target.value), value[1], value[2]])}
                    disabled={disabled}
                    placeholder="X"
                    className="bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-white rounded focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
                <input
                    type="number"
                    value={value[1]}
                    onChange={(e) => onChange([value[0], parseFloat(e.target.value), value[2]])}
                    disabled={disabled}
                    placeholder="Y"
                    className="bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-white rounded focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
                <input
                    type="number"
                    value={value[2]}
                    onChange={(e) => onChange([value[0], value[1], parseFloat(e.target.value)])}
                    disabled={disabled}
                    placeholder="Z"
                    className="bg-gray-800 border border-gray-700 px-2 py-1.5 text-sm text-white rounded focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
            </div>
        </div>
    );
}