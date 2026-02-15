// /ui-panels/electrical/SwitchingAndZoningPanel.jsx
import { useState } from 'react';
import SelectField from './SelectField';
import ToggleField from './ToggleField';

export default function SwitchingAndZoningPanel({ isOpen, onClose, onGenerate, selectedElementId }) {
    const [switchType, setSwitchType] = useState('single');
    const [controlledLights, setControlledLights] = useState('');
    const [room, setRoom] = useState('');
    const [circuitIntent, setCircuitIntent] = useState('lighting');
    const [wetZone, setWetZone] = useState('outside');

    const handleGenerate = () => {
        const payload = {
            category: 'electrical_switching',
            switchType,
            controls: controlledLights.split(',').map(s => s.trim()).filter(s => s),
            room: room || null,
            circuitIntent,
            wetZone
        };
        onGenerate(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-16 right-4 w-96 max-h-[calc(100vh-5rem)] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Switching & Zoning</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide border-b border-gray-800 pb-2">
                        Switching Logic
                    </h3>

                    <SelectField
                        label="Switch Type"
                        value={switchType}
                        onChange={setSwitchType}
                        options={[
                            { value: 'single', label: 'Single' },
                            { value: 'two_way', label: 'Two-way' },
                            { value: 'intermediate', label: 'Intermediate' }
                        ]}
                    />

                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 uppercase tracking-wide">Controls (IDs)</label>
                        <input
                            type="text"
                            value={controlledLights}
                            onChange={(e) => setControlledLights(e.target.value)}
                            placeholder="light_1, light_2"
                            className="bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white rounded focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-xs text-gray-500">Comma-separated fixture IDs</span>
                    </div>

                    <div className="bg-gray-800 border border-gray-700 rounded p-3">
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Door-based Placement</div>
                        <div className="text-xs text-gray-500">Logical placement handled by backend</div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide border-b border-gray-800 pb-2">
                        Room Zoning
                    </h3>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 uppercase tracking-wide">Room</label>
                        <input
                            type="text"
                            value={room}
                            onChange={(e) => setRoom(e.target.value)}
                            placeholder="bedroom_1"
                            className="bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white rounded focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <SelectField
                        label="Circuit Intent"
                        value={circuitIntent}
                        onChange={setCircuitIntent}
                        options={[
                            { value: 'lighting', label: 'Lighting' },
                            { value: 'sockets', label: 'Sockets' },
                            { value: 'dedicated', label: 'Dedicated Appliance' }
                        ]}
                    />
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide border-b border-gray-800 pb-2">
                        Wet Zone (Bathroom)
                    </h3>

                    <SelectField
                        label="Zone Classification"
                        value={wetZone}
                        onChange={setWetZone}
                        options={[
                            { value: 'zone_0', label: 'Zone 0 (Inside bath/shower)' },
                            { value: 'zone_1', label: 'Zone 1 (Above bath/shower)' },
                            { value: 'zone_2', label: 'Zone 2 (Within 0.6m)' },
                            { value: 'outside', label: 'Outside zones' }
                        ]}
                    />

                    <div className="bg-gray-800 border border-gray-700 rounded p-3">
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">Fixture Eligibility</div>
                        <div className="space-y-1 text-xs text-gray-500">
                            <div>Zone 0: IPX7+ only</div>
                            <div>Zone 1: IPX4+ rated</div>
                            <div>Zone 2: IP44+ rated</div>
                            <div>Outside: Standard fixtures allowed</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-700">
                <button
                    onClick={handleGenerate}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded transition-colors"
                >
                    Apply Configuration
                </button>
            </div>
        </div>
    );
}