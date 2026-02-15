// /ui-panels/electrical/ElectricalFixturesPanel.jsx
import { useState } from 'react';
import NumericField from './NumericField';
import SelectField from './SelectField';
import Vector3Field from './Vector3Field';

export default function ElectricalFixturesPanel({ isOpen, onClose, onGenerate, selectedElementId }) {
    const [activeCategory, setActiveCategory] = useState('lights');
    const [fixtureType, setFixtureType] = useState('recessed_light');
    const [mountingHeight, setMountingHeight] = useState(2.7);
    const [rotation, setRotation] = useState([0, 0, 0]);
    const [load, setLoad] = useState(12);
    const [ipRating, setIpRating] = useState('IP20');
    const [wetZoneAllowed, setWetZoneAllowed] = useState(false);
    const [clearance, setClearance] = useState(0.2);
    const [switchGroup, setSwitchGroup] = useState('');

    const fixtureLibrary = {
        lights: [
            { value: 'recessed_light', label: 'Recessed', defaultLoad: 12, defaultHeight: 2.4, ip: 'IP20', wetZone: false, clearance: 0.2 },
            { value: 'surface_light', label: 'Surface-mounted', defaultLoad: 18, defaultHeight: 2.4, ip: 'IP20', wetZone: false, clearance: 0.15 },
            { value: 'pendant_light', label: 'Pendant', defaultLoad: 25, defaultHeight: 2.2, ip: 'IP20', wetZone: false, clearance: 0.3 },
            { value: 'wall_light', label: 'Wall-mounted', defaultLoad: 15, defaultHeight: 1.8, ip: 'IP44', wetZone: true, clearance: 0.1 }
        ],
        switches: [
            { value: 'single_switch', label: 'Single', defaultLoad: 0, defaultHeight: 1.2, ip: 'IP20', wetZone: false, clearance: 0.1 },
            { value: 'two_way_switch', label: 'Two-way', defaultLoad: 0, defaultHeight: 1.2, ip: 'IP20', wetZone: false, clearance: 0.1 },
            { value: 'intermediate_switch', label: 'Intermediate', defaultLoad: 0, defaultHeight: 1.2, ip: 'IP20', wetZone: false, clearance: 0.1 }
        ],
        sockets: [
            { value: 'standard_socket', label: 'Standard', defaultLoad: 3000, defaultHeight: 0.45, ip: 'IP20', wetZone: false, clearance: 0.1 },
            { value: 'kitchen_socket', label: 'Kitchen Heavy-duty', defaultLoad: 3680, defaultHeight: 1.1, ip: 'IP20', wetZone: false, clearance: 0.1 },
            { value: 'outdoor_socket', label: 'Outdoor Weatherproof', defaultLoad: 3000, defaultHeight: 1.0, ip: 'IP66', wetZone: true, clearance: 0.15 }
        ],
        appliances: [
            { value: 'cooker', label: 'Cooker', defaultLoad: 7200, defaultHeight: 0.0, ip: 'IP20', wetZone: false, clearance: 0.5 },
            { value: 'oven', label: 'Oven', defaultLoad: 3000, defaultHeight: 0.9, ip: 'IP20', wetZone: false, clearance: 0.3 },
            { value: 'water_heater', label: 'Water Heater', defaultLoad: 3000, defaultHeight: 1.8, ip: 'IPX4', wetZone: true, clearance: 0.3 },
            { value: 'ac_unit', label: 'AC Unit', defaultLoad: 2000, defaultHeight: 2.5, ip: 'IP24', wetZone: false, clearance: 0.5 }
        ]
    };

    const handleFixtureTypeChange = (type) => {
        setFixtureType(type);
        const allFixtures = [...fixtureLibrary.lights, ...fixtureLibrary.switches, ...fixtureLibrary.sockets, ...fixtureLibrary.appliances];
        const selected = allFixtures.find(f => f.value === type);
        if (selected) {
            setMountingHeight(selected.defaultHeight);
            setLoad(selected.defaultLoad);
            setIpRating(selected.ip);
            setWetZoneAllowed(selected.wetZone);
            setClearance(selected.clearance);
        }
    };

    const handleGenerate = () => {
        const payload = {
            category: 'electrical_fixture',
            fixtureType,
            mountingHeight,
            rotation,
            load,
            ipRating,
            switchGroup: switchGroup || null
        };
        onGenerate(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-16 right-4 w-96 max-h-[calc(100vh-5rem)] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Electrical Fixtures</h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="space-y-2">
                    <label className="text-xs text-gray-400 uppercase tracking-wide">Fixture Category</label>
                    <div className="grid grid-cols-2 gap-2">
                        {['lights', 'switches', 'sockets', 'appliances'].map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-3 py-2 text-xs uppercase tracking-wide rounded transition-colors ${activeCategory === cat
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="border-t border-gray-800 pt-4 space-y-3">
                    <SelectField
                        label="Fixture Type"
                        value={fixtureType}
                        onChange={handleFixtureTypeChange}
                        options={fixtureLibrary[activeCategory].map(f => ({ value: f.value, label: f.label }))}
                    />

                    <NumericField
                        label="Mounting Height"
                        value={mountingHeight}
                        onChange={setMountingHeight}
                        min={0}
                        max={10}
                        step={0.1}
                        unit="m"
                    />

                    <Vector3Field
                        label="Rotation (deg)"
                        value={rotation}
                        onChange={setRotation}
                    />

                    <NumericField
                        label="Load Rating"
                        value={load}
                        onChange={setLoad}
                        min={0}
                        max={10000}
                        step={1}
                        unit="W"
                    />

                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 uppercase tracking-wide">IP Rating</label>
                        <div className="bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-500 rounded">
                            {ipRating}
                        </div>
                    </div>

                    <div className="flex items-center justify-between py-2 px-3 bg-gray-800 rounded">
                        <span className="text-xs text-gray-400 uppercase tracking-wide">Wet-zone Allowed</span>
                        <span className={`text-xs font-semibold ${wetZoneAllowed ? 'text-green-500' : 'text-red-500'}`}>
                            {wetZoneAllowed ? 'YES' : 'NO'}
                        </span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-400 uppercase tracking-wide">Clearance Envelope</label>
                        <div className="bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-500 rounded">
                            {clearance} m
                        </div>
                    </div>

                    {activeCategory === 'lights' && (
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-400 uppercase tracking-wide">Switch Association</label>
                            <input
                                type="text"
                                value={switchGroup}
                                onChange={(e) => setSwitchGroup(e.target.value)}
                                placeholder="switch_1"
                                className="bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-white rounded focus:outline-none focus:border-blue-500"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-700">
                <button
                    onClick={handleGenerate}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded transition-colors"
                >
                    Place Fixture
                </button>
            </div>
        </div>
    );
}