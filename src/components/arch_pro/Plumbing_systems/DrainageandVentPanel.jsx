import React, { useState } from 'react';
import NumericField from './NumericField';
import SelectField from './SelectField';
import ToggleField from './ToggleField';

export default function DrainageAndVentPanel({ isOpen, onClose, onGenerate, selectedElementId }) {
    const [stackType, setStackType] = useState('soil');
    const [diameter, setDiameter] = useState(110);
    const [connectedFixtures, setConnectedFixtures] = useState([]);
    const [slope, setSlope] = useState(0.02);
    const [cleanoutSpacing, setCleanoutSpacing] = useState(15);
    const [ventType, setVentType] = useState('stack');
    const [ventTermination, setVentTermination] = useState('roof');
    const [fixtureInput, setFixtureInput] = useState('');

    const stackTypes = [
        { value: 'soil', label: 'Soil Stack' },
        { value: 'waste', label: 'Waste Stack' },
        { value: 'combined', label: 'Combined Stack' }
    ];

    const diameters = [
        { value: 50, label: '50mm (2")' },
        { value: 75, label: '75mm (3")' },
        { value: 110, label: '110mm (4")' },
        { value: 160, label: '160mm (6")' }
    ];

    const ventTypes = [
        { value: 'individual', label: 'Individual Vent' },
        { value: 'common', label: 'Common Vent' },
        { value: 'stack', label: 'Stack Vent' },
        { value: 'wet', label: 'Wet Vent' }
    ];

    const ventTerminations = [
        { value: 'roof', label: 'Roof Termination' },
        { value: 'wall', label: 'Wall Termination' },
        { value: 'aav', label: 'Air Admittance Valve' }
    ];

    const handleAddFixture = () => {
        if (fixtureInput.trim() && !connectedFixtures.includes(fixtureInput.trim())) {
            setConnectedFixtures([...connectedFixtures, fixtureInput.trim()]);
            setFixtureInput('');
        }
    };

    const handleRemoveFixture = (fixture) => {
        setConnectedFixtures(connectedFixtures.filter(f => f !== fixture));
    };

    const handleGenerate = () => {
        const payload = {
            category: 'plumbing_drainage',
            stackType,
            diameter,
            connectedFixtures,
            slope,
            cleanoutSpacing,
            vents: {
                type: ventType,
                termination: ventTermination
            }
        };
        onGenerate(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed top-16 right-4 w-96 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col max-h-[calc(100vh-5rem)]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Drainage & Vent System</h2>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Drainage System</h3>

                    <SelectField
                        label="Stack Type"
                        value={stackType}
                        onChange={setStackType}
                        options={stackTypes}
                    />

                    <SelectField
                        label="Stack Diameter"
                        value={diameter}
                        onChange={(val) => setDiameter(parseInt(val))}
                        options={diameters}
                    />

                    <NumericField
                        label="Minimum Slope"
                        value={slope}
                        onChange={setSlope}
                        min={0.01}
                        max={0.25}
                        step={0.01}
                        unit="%"
                        readonly={true}
                    />

                    <div className="px-3 py-2 bg-amber-50 rounded text-xs text-amber-700 border border-amber-200">
                        <div className="font-medium">Code Requirement</div>
                        <div className="mt-1">Minimum 2% slope for horizontal branches</div>
                    </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Connected Fixtures</h3>

                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={fixtureInput}
                            onChange={(e) => setFixtureInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleAddFixture()}
                            placeholder="Enter fixture ID"
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                            onClick={handleAddFixture}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                        >
                            Add
                        </button>
                    </div>

                    <div className="space-y-1 max-h-32 overflow-y-auto">
                        {connectedFixtures.map((fixture) => (
                            <div
                                key={fixture}
                                className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded text-sm border border-gray-200"
                            >
                                <span className="text-gray-700">{fixture}</span>
                                <button
                                    onClick={() => handleRemoveFixture(fixture)}
                                    className="text-red-600 hover:text-red-800"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>

                    {connectedFixtures.length === 0 && (
                        <div className="px-3 py-2 bg-gray-50 rounded text-xs text-gray-500 text-center border border-gray-200">
                            No fixtures connected
                        </div>
                    )}
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Cleanouts</h3>

                    <NumericField
                        label="Cleanout Spacing"
                        value={cleanoutSpacing}
                        onChange={setCleanoutSpacing}
                        min={5}
                        max={30}
                        step={5}
                        unit="m"
                    />

                    <div className="px-3 py-2 bg-gray-50 rounded text-xs text-gray-600 border border-gray-200">
                        Cleanouts required at:
                        <ul className="mt-1 ml-4 list-disc space-y-0.5">
                            <li>Base of each stack</li>
                            <li>Direction changes &gt;45°</li>
                            <li>Every {cleanoutSpacing}m horizontal run</li>
                        </ul>
                    </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-gray-200">
                    <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Venting</h3>

                    <SelectField
                        label="Vent Type"
                        value={ventType}
                        onChange={setVentType}
                        options={ventTypes}
                    />

                    <SelectField
                        label="Vent Termination"
                        value={ventTermination}
                        onChange={setVentTermination}
                        options={ventTerminations}
                    />

                    <div className="px-3 py-2 bg-blue-50 rounded text-xs text-blue-700 border border-blue-200">
                        <div className="font-medium">Termination Requirements</div>
                        <div className="mt-1">
                            {ventTermination === 'roof' && 'Minimum 150mm above roof surface'}
                            {ventTermination === 'wall' && 'Minimum 300mm from openings'}
                            {ventTermination === 'aav' && 'Install above fixture flood level'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200">
                <button
                    onClick={handleGenerate}
                    className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                >
                    Configure Drainage System
                </button>
            </div>
        </div>
    );
}