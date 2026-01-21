import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';
import axios from 'axios';

// API Configuration
const API_BASE = 'http://localhost:8000/earthworks';

// ============================================================================
// FRONTEND COMPONENTS
// ============================================================================

const Tab = ({ active, onClick, children }) => (
    <button
        onClick={onClick}
        className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${active
            ? 'border-gray-900 text-gray-900'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
    >
        {children}
    </button>
);

const EarthworksQSModule = () => {
    const [activeTab, setActiveTab] = useState('area');

    // Area calculation states
    const [coordinates, setCoordinates] = useState('0,0\n10,0\n10,10\n0,10');
    const [areaResult, setAreaResult] = useState(null);

    // Volume calculation states
    const [chainages, setChainages] = useState('0\n50\n100\n150\n200');
    const [areas, setAreas] = useState('25\n30\n28\n32\n26');
    const [volumeResult, setVolumeResult] = useState(null);

    // Cut/Fill states
    const [existingLevels, setExistingLevels] = useState('100\n101\n102\n101.5\n100.5');
    const [formationLevels, setFormationLevels] = useState('102\n102\n102\n102\n102');
    const [cutFillResult, setCutFillResult] = useState(null);

    // Mass haul states
    const [cutVolumes, setCutVolumes] = useState('0\n50\n100\n75\n25');
    const [fillVolumes, setFillVolumes] = useState('100\n50\n25\n50\n75');
    const [massHaulResult, setMassHaulResult] = useState(null);

    const parseCoordinates = (text) => {
        return text.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [x, y] = line.split(',').map(v => parseFloat(v.trim()));
                return { x, y };
            });
    };

    const parseNumbers = (text) => {
        return text.split('\n')
            .filter(line => line.trim())
            .map(v => parseFloat(v.trim()));
    };

    const calculateArea = async (method) => {
        try {
            const coords = parseCoordinates(coordinates);
            let response;

            switch (method) {
                case 'coordinate':
                    response = await axios.post(`${API_BASE}/calculate/area/coordinate`, { coordinates: coords });
                    break;
                case 'triangulation':
                    response = await axios.post(`${API_BASE}/calculate/area/triangulation`, { coordinates: coords });
                    break;
                default:
                    return;
            }

            setAreaResult(response.data);
        } catch (error) {
            alert('Error: ' + (error.response?.data?.detail || error.message));
        }
    };

    const calculateVolume = async () => {
        try {
            const chainageValues = parseNumbers(chainages);
            const areaValues = parseNumbers(areas);

            const response = await axios.post(`${API_BASE}/calculate/volume/end_area`, {
                areas: areaValues,
                chainages: chainageValues,
                use_prismoidal_correction: false
            });
            setVolumeResult(response.data);
        } catch (error) {
            alert('Error: ' + (error.response?.data?.detail || error.message));
        }
    };

    const calculateCutFill = async () => {
        try {
            const chainageValues = parseNumbers(chainages);
            const existingValues = parseNumbers(existingLevels);
            const formationValues = parseNumbers(formationLevels);
            const areaValues = parseNumbers(areas);

            const response = await axios.post(`${API_BASE}/calculate/volume/cut_fill`, {
                existing_levels: existingValues,
                formation_levels: formationValues,
                areas: areaValues,
                chainages: chainageValues
            });

            const borrowRes = await axios.post(`${API_BASE}/calculate/volume/borrow_spoil`, {
                cut_volume: response.data.total_cut,
                fill_volume: response.data.total_fill
            });

            setCutFillResult({ ...response.data, borrowSpoil: borrowRes.data });
        } catch (error) {
            alert('Error: ' + (error.response?.data?.detail || error.message));
        }
    };

    const calculateMassHaul = async () => {
        try {
            const chainageValues = parseNumbers(chainages);
            const cutValues = parseNumbers(cutVolumes);
            const fillValues = parseNumbers(fillVolumes);

            const response = await axios.post(`${API_BASE}/calculate/mass_haul`, {
                chainages: chainageValues,
                cut_volumes: cutValues,
                fill_volumes: fillValues,
                free_haul_distance: 100
            });
            setMassHaulResult(response.data);
        } catch (error) {
            alert('Error: ' + (error.response?.data?.detail || error.message));
        }
    };

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Earthworks & Quantity Survey Module
                    </h1>
                    <p className="text-gray-600">
                        Contract-grade earthworks calculations for civil engineering projects
                    </p>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 mb-6">
                    <div className="flex space-x-1">
                        <Tab active={activeTab === 'area'} onClick={() => setActiveTab('area')}>
                            Area Calculations
                        </Tab>
                        <Tab active={activeTab === 'volume'} onClick={() => setActiveTab('volume')}>
                            Volume (End-Area)
                        </Tab>
                        <Tab active={activeTab === 'cutfill'} onClick={() => setActiveTab('cutfill')}>
                            Cut & Fill
                        </Tab>
                        <Tab active={activeTab === 'masshaul'} onClick={() => setActiveTab('masshaul')}>
                            Mass Haul
                        </Tab>
                    </div>
                </div>

                {/* Area Calculations Tab */}
                {activeTab === 'area' && (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Coordinates (x,y per line)
                                </label>
                                <textarea
                                    value={coordinates}
                                    onChange={(e) => setCoordinates(e.target.value)}
                                    className="w-full h-48 p-3 border border-gray-300 rounded font-mono text-sm"
                                    placeholder="0,0&#10;10,0&#10;10,10&#10;0,10"
                                />
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => calculateArea('coordinate')}
                                    className="flex-1 px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800"
                                >
                                    Coordinate Method
                                </button>
                                <button
                                    onClick={() => calculateArea('triangulation')}
                                    className="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                                >
                                    Triangulation
                                </button>
                            </div>
                        </div>

                        <div>
                            {areaResult && (
                                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                    <h3 className="font-semibold text-gray-900 mb-3">Results</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Method:</span>
                                            <span className="font-mono">{areaResult.method}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Area:</span>
                                            <span className="font-mono font-semibold">
                                                {areaResult.area.toFixed(3)} {areaResult.units}
                                            </span>
                                        </div>
                                        {areaResult.orientation && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Orientation:</span>
                                                <span className="font-mono">{areaResult.orientation}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Volume (End-Area) Tab */}
                {activeTab === 'volume' && (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Chainages (m)
                                </label>
                                <textarea
                                    value={chainages}
                                    onChange={(e) => setChainages(e.target.value)}
                                    className="w-full h-32 p-3 border border-gray-300 rounded font-mono text-sm"
                                    placeholder="0&#10;50&#10;100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Areas (m²)
                                </label>
                                <textarea
                                    value={areas}
                                    onChange={(e) => setAreas(e.target.value)}
                                    className="w-full h-32 p-3 border border-gray-300 rounded font-mono text-sm"
                                    placeholder="25&#10;30&#10;28"
                                />
                            </div>
                            <button
                                onClick={calculateVolume}
                                className="w-full px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800"
                            >
                                Calculate Volume
                            </button>
                        </div>

                        <div>
                            {volumeResult && (
                                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                    <h3 className="font-semibold text-gray-900 mb-3">Volume Results</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Total Volume:</span>
                                            <span className="font-mono font-semibold">
                                                {volumeResult.total_volume.toFixed(2)} m³
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Method:</span>
                                            <span className="font-mono">{volumeResult.method}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Cut & Fill Tab */}
                {activeTab === 'cutfill' && (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Levels (Existing / Formation)
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <textarea
                                        value={existingLevels}
                                        onChange={(e) => setExistingLevels(e.target.value)}
                                        className="h-32 p-3 border border-gray-300 rounded font-mono text-sm"
                                        placeholder="Existing"
                                    />
                                    <textarea
                                        value={formationLevels}
                                        onChange={(e) => setFormationLevels(e.target.value)}
                                        className="h-32 p-3 border border-gray-300 rounded font-mono text-sm"
                                        placeholder="Formation"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Chainages & Areas
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <textarea
                                        value={chainages}
                                        onChange={(e) => setChainages(e.target.value)}
                                        className="h-32 p-3 border border-gray-300 rounded font-mono text-sm"
                                    />
                                    <textarea
                                        value={areas}
                                        onChange={(e) => setAreas(e.target.value)}
                                        className="h-32 p-3 border border-gray-300 rounded font-mono text-sm"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={calculateCutFill}
                                className="w-full px-4 py-2 bg-gray-900 text-white rounded hover:bg-gray-800"
                            >
                                Calculate Cut & Fill
                            </button>
                        </div>

                        <div className="space-y-4">
                            {cutFillResult && (
                                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                    <h3 className="font-semibold text-gray-900 mb-3">Cut/Fill Results</h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Total Cut:</span>
                                            <span className="font-mono font-semibold text-red-600">
                                                {cutFillResult.total_cut.toFixed(2)} m³
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Total Fill:</span>
                                            <span className="font-mono font-semibold text-blue-600">
                                                {cutFillResult.total_fill.toFixed(2)} m³
                                            </span>
                                        </div>
                                        <div className="flex justify-between border-t pt-1 mt-1">
                                            <span className="text-gray-600">Net Volume:</span>
                                            <span className="font-mono font-semibold">
                                                {cutFillResult.net_volume.toFixed(2)} m³
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {cutFillResult?.borrowSpoil && (
                                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                    <h3 className="font-semibold text-gray-900 mb-3">Borrow & Spoil</h3>
                                    <div className="space-y-2 text-sm">
                                        {cutFillResult.borrowSpoil.borrow_required > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Borrow Required (in-situ):</span>
                                                <span className="font-mono font-semibold">
                                                    {cutFillResult.borrowSpoil.borrow_required.toFixed(2)} m³
                                                </span>
                                            </div>
                                        )}
                                        {cutFillResult.borrowSpoil.spoil_generated > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Spoil Generated (loose):</span>
                                                <span className="font-mono font-semibold">
                                                    {cutFillResult.borrowSpoil.spoil_generated.toFixed(2)} m³
                                                </span>
                                            </div>
                                        )}
                                        <div className="text-xs text-gray-500 mt-2">
                                            Shrinkage: {cutFillResult.borrowSpoil.shrinkage_factor} |
                                            Swell: {cutFillResult.borrowSpoil.swell_factor}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Mass Haul Tab */}
                {activeTab === 'masshaul' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Chainages (m)
                                </label>
                                <textarea
                                    value={chainages}
                                    onChange={(e) => setChainages(e.target.value)}
                                    className="w-full h-32 p-3 border border-gray-300 rounded font-mono text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Cut Volumes (m³)
                                </label>
                                <textarea
                                    value={cutVolumes}
                                    onChange={(e) => setCutVolumes(e.target.value)}
                                    className="w-full h-32 p-3 border border-gray-300 rounded font-mono text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Fill Volumes (m³)
                                </label>
                                <textarea
                                    value={fillVolumes}
                                    onChange={(e) => setFillVolumes(e.target.value)}
                                    className="w-full h-32 p-3 border border-gray-300 rounded font-mono text-sm"
                                />
                            </div>
                        </div>

                        <button
                            onClick={calculateMassHaul}
                            className="px-6 py-2 bg-gray-900 text-white rounded hover:bg-gray-800"
                        >
                            Generate Mass Haul Diagram
                        </button>

                        {massHaulResult && (
                            <div className="space-y-6">
                                {/* Summary Stats */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                        <div className="text-xs text-gray-600 mb-1">Final Balance</div>
                                        <div className="text-2xl font-mono font-semibold text-gray-900">
                                            {massHaulResult.final_balance.toFixed(2)} m³
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                        <div className="text-xs text-gray-600 mb-1">Balance Points</div>
                                        <div className="text-2xl font-mono font-semibold text-gray-900">
                                            {massHaulResult.balance_points.length}
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-4 rounded border border-gray-200">
                                        <div className="text-xs text-gray-600 mb-1">Free Haul Limit</div>
                                        <div className="text-2xl font-mono font-semibold text-gray-900">
                                            {massHaulResult.free_haul_distance} m
                                        </div>
                                    </div>
                                </div>

                                {/* Mass Haul Diagram */}
                                <div className="bg-white p-6 rounded border border-gray-200">
                                    <h3 className="font-semibold text-gray-900 mb-4">Mass Haul Diagram</h3>
                                    <ResponsiveContainer width="100%" height={400}>
                                        <LineChart data={massHaulResult.diagram}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis
                                                dataKey="chainage"
                                                label={{ value: 'Chainage (m)', position: 'insideBottom', offset: -5 }}
                                                stroke="#6b7280"
                                            />
                                            <YAxis
                                                label={{ value: 'Cumulative Volume (m³)', angle: -90, position: 'insideLeft' }}
                                                stroke="#6b7280"
                                            />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #d1d5db' }}
                                                formatter={(value) => `${parseFloat(value).toFixed(2)} m³`}
                                            />
                                            <ReferenceLine y={0} stroke="#374151" strokeWidth={2} />
                                            <Line
                                                type="monotone"
                                                dataKey="cumulative_volume"
                                                stroke="#111827"
                                                strokeWidth={2}
                                                dot={{ fill: '#111827', r: 3 }}
                                                name="Cumulative Volume"
                                            />
                                            {massHaulResult.balance_points.map((ch, idx) => (
                                                <ReferenceLine
                                                    key={idx}
                                                    x={ch}
                                                    stroke="#6b7280"
                                                    strokeDasharray="5 5"
                                                    label={{ value: 'Balance', position: 'top', fill: '#6b7280' }}
                                                />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Haul Zones Table */}
                                <div className="bg-white p-6 rounded border border-gray-200">
                                    <h3 className="font-semibold text-gray-900 mb-4">Haul Analysis</h3>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-300">
                                                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Chainage</th>
                                                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Cut (m³)</th>
                                                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Fill (m³)</th>
                                                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Net (m³)</th>
                                                    <th className="text-right py-2 px-3 font-semibold text-gray-700">Cumulative (m³)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="font-mono text-xs">
                                                {massHaulResult.diagram.map((row, idx) => (
                                                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                                                        <td className="py-2 px-3">{row.chainage.toFixed(0)}</td>
                                                        <td className="text-right py-2 px-3 text-red-900">
                                                            {row.cut_volume.toFixed(2)}
                                                        </td>
                                                        <td className="text-right py-2 px-3 text-blue-900">
                                                            {row.fill_volume.toFixed(2)}
                                                        </td>
                                                        <td className="text-right py-2 px-3">
                                                            {row.net_volume.toFixed(2)}
                                                        </td>
                                                        <td className="text-right py-2 px-3 font-semibold">
                                                            {row.cumulative_volume.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="text-xs text-gray-500 space-y-1">
                        <p>
                            <strong>Engineering Standards:</strong> All calculations follow civil engineering best practices
                            for earthworks quantity surveying and BOQ preparation.
                        </p>
                        <p>
                            <strong>Accuracy:</strong> Intermediate precision preserved throughout calculations.
                            Final rounding applied at output stage only.
                        </p>
                        <p>
                            <strong>Units:</strong> All inputs and outputs in SI units (meters, square meters, cubic meters).
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EarthworksQSModule;