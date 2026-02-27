import React from 'react';
import { getRoleColor, SECTIONS } from './SteelBIM_Core.jsx';

const SteelBIMInspector = ({ item, onChange, isDark = false }) => {
    if (!item) return (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-xs text-center p-6 space-y-2">
            <div className="text-2xl opacity-20 font-mono">◈</div>
            <p className="font-mono uppercase tracking-wider">Select a member or connection to inspect</p>
        </div>
    );

    const isMember = !!item.start;
    const rc = (role) => getRoleColor(role);

    const SECTIONS_LIST = Object.keys(SECTIONS);

    const fieldStyle = "block w-full px-2 py-1.5 text-[10px] font-mono rounded border transition-colors";
    const labelStyle = "block text-[9px] font-bold uppercase tracking-wider text-gray-500 mb-1";
    const inputBg = isDark ? "bg-gray-900/50 border-gray-700 text-gray-200 focus:border-blue-500" : "bg-gray-50 border-gray-200 text-gray-800 focus:border-blue-500";

    const Field = ({ label, keyPath, type = 'text', options }) => {
        // Handle nested keys like 'start.x'
        const getValue = () => {
            const parts = keyPath.split('.');
            let val = item;
            for (const p of parts) val = val?.[p];
            return val;
        };

        const handleChange = (e) => {
            const val = type === 'number' ? parseFloat(e.target.value) : e.target.checked !== undefined && type === 'checkbox' ? e.target.checked : e.target.value;
            onChange(item.id, keyPath, val);
        };

        return (
            <div className="mb-4">
                <label className={labelStyle}>{label}</label>
                {type === 'select' ? (
                    <select value={getValue() || ''} onChange={handleChange} className={`${fieldStyle} ${inputBg}`}>
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                ) : type === 'checkbox' ? (
                    <div className="flex items-center gap-2 mt-1">
                        <input type="checkbox" checked={!!getValue()} onChange={handleChange} className="w-3.5 h-3.5 accent-blue-600 rounded" />
                        <span className="text-[10px] text-gray-500 font-mono italic">Enabled</span>
                    </div>
                ) : (
                    <input
                        type={type}
                        value={getValue() ?? ''}
                        onChange={handleChange}
                        className={`${fieldStyle} ${inputBg}`}
                        step={type === 'number' ? '0.1' : undefined}
                    />
                )}
            </div>
        );
    };

    const colorBar = (color) => (
        <div className="w-2.5 h-2.5 rounded-sm inline-block align-middle mr-1.5" style={{ backgroundColor: color }} />
    );

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 font-mono custom-scrollbar">
            {/* Header / Summary */}
            <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 overflow-hidden">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{item.id}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full uppercase font-bold ${isMember ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                        {isMember ? 'Member' : 'Connection'}
                    </span>
                </div>
                <div className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{item.label}</div>
                {isMember && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-500/10">
                        <div className="text-[10px] text-gray-500">
                            {colorBar(rc(item.role))}
                            {item.role.replace('-', ' ').toUpperCase()}
                        </div>
                        <div className="ml-auto text-[10px] text-gray-400 italic">
                            L: {item.length?.toFixed(3)}m
                        </div>
                    </div>
                )}
            </div>

            {/* Editing Fields */}
            <div>
                {isMember ? (
                    <>
                        <Field label="Section Profile" keyPath="section" type="select" options={SECTIONS_LIST} />
                        <Field label="Display Label" keyPath="label" />
                        <Field label="Layer Group" keyPath="layer" type="select" options={['STRUCTURE', 'TRUSS', 'PORTAL', 'BRIDGE', 'TOWER', 'DOME', 'SECONDARY', 'SUPPORT', 'CRANE']} />

                        <div className="pt-2">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 dark:border-gray-800 pb-1">3D Geometry (m)</div>
                            <div className="grid grid-cols-2 gap-x-4">
                                <Field label="Start X" keyPath="start.x" type="number" />
                                <Field label="End X" keyPath="end.x" type="number" />
                                <Field label="Start Y" keyPath="start.y" type="number" />
                                <Field label="End Y" keyPath="end.y" type="number" />
                                <Field label="Start Z" keyPath="start.z" type="number" />
                                <Field label="End Z" keyPath="end.z" type="number" />
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 dark:border-gray-800 pb-1">Connection Details</div>
                        <Field label="Custom Label" keyPath="label" />
                        <div className="grid grid-cols-2 gap-x-4">
                            <Field label="Plate Width (mm)" keyPath="plateW" type="number" />
                            <Field label="Plate Height (mm)" keyPath="plateH" type="number" />
                            <Field label="Plate Thick. (mm)" keyPath="plateT" type="number" />
                            <Field label="Weld Size (mm)" keyPath="weldSize" type="number" />
                        </div>
                        <div className="grid grid-cols-2 gap-x-4">
                            <Field label="Bolt Rows" keyPath="boltRows" type="number" />
                            <Field label="Bolt Columns" keyPath="boltCols" type="number" />
                            <Field label="Bolt Dia (mm)" keyPath="boltDia" type="number" />
                        </div>
                        <div className="pt-2">
                            <Field label="Reinforcement Stiffeners" keyPath="hasStiffeners" type="checkbox" />
                        </div>

                        {item.type === 'base_plate' && (
                            <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Anchor Logic</div>
                                <div className="grid grid-cols-2 gap-x-4">
                                    <Field label="Anchor Dia" keyPath="anchorDia" type="number" />
                                    <Field label="Embedment" keyPath="anchorEmbedment" type="number" />
                                    <Field label="Grout Thick" keyPath="groutThickness" type="number" />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default SteelBIMInspector;
