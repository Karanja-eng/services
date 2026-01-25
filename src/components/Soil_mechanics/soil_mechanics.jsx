import React, { useState, useRef, Suspense } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';
import { Calculator, Layers, Beaker, Mountain, Home, TrendingDown, Info, Download, FileText, Database, Cuboid, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Box } from '@react-three/drei';

// API Configuration
const API_BASE_URL = 'http://localhost:8000/soil';

// Main Application
export default function SoilMechanicsModule() {
    const [activeModule, setActiveModule] = useState('phase');
    const [apiStatus, setApiStatus] = useState('unknown');

    React.useEffect(() => {
        // Check API health on mount
        fetch(`${API_BASE_URL}/health`)
            .then(res => res.json())
            .then(() => setApiStatus('connected'))
            .catch(() => setApiStatus('disconnected'));
    }, []);

    const modules = [
        { id: 'phase', name: 'Phase Relations', icon: Layers },
        { id: 'atterberg', name: 'Atterberg Limits', icon: Beaker },
        { id: 'compaction', name: 'Compaction', icon: TrendingDown },
        { id: 'shear', name: 'Shear Strength', icon: Mountain },
        { id: 'bearing', name: 'Bearing Capacity', icon: Home },
        { id: 'consolidation', name: 'Consolidation', icon: TrendingDown },
        { id: 'slope', name: 'Slope Stability', icon: Mountain },
        { id: 'profile3d', name: '3D Soil Profile', icon: Cuboid },
        { id: 'database', name: 'Project Database', icon: Database },
        { id: 'export', name: 'Export & Reports', icon: Download },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Calculator className="w-8 h-8 text-gray-700" />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Soil Mechanics Module</h1>
                                <p className="text-sm text-gray-600">Professional Geotechnical Engineering Platform v2.0</p>
                            </div>
                        </div>

                        {/* API Status Indicator */}
                        <div className="flex items-center gap-2">
                            {apiStatus === 'connected' ? (
                                <>
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    <span className="text-sm text-green-600 font-medium">API Connected</span>
                                </>
                            ) : apiStatus === 'disconnected' ? (
                                <>
                                    <AlertCircle className="w-5 h-5 text-red-600" />
                                    <span className="text-sm text-red-600 font-medium">API Offline</span>
                                </>
                            ) : (
                                <>
                                    <Loader className="w-5 h-5 text-gray-400 animate-spin" />
                                    <span className="text-sm text-gray-600">Checking...</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation */}
            <nav className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-1 overflow-x-auto py-2">
                        {modules.map((mod) => {
                            const Icon = mod.icon;
                            return (
                                <button
                                    key={mod.id}
                                    onClick={() => setActiveModule(mod.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${activeModule === mod.id
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-700 hover:bg-gray-100'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {mod.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </nav>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {activeModule === 'phase' && <PhaseRelationsModule />}
                {activeModule === 'atterberg' && <AtterbergModule />}
                {activeModule === 'compaction' && <CompactionModule />}
                {activeModule === 'shear' && <ShearStrengthModule />}
                {activeModule === 'bearing' && <BearingCapacityModule />}
                {activeModule === 'consolidation' && <ConsolidationModule />}
                {activeModule === 'slope' && <SlopeStabilityModule />}
                {activeModule === 'profile3d' && <SoilProfile3D />}
                {activeModule === 'database' && <DatabaseModule />}
                {activeModule === 'export' && <ExportModule />}
            </main>
        </div>
    );
}

// ==================== PHASE RELATIONSHIPS MODULE ====================
function PhaseRelationsModule() {
    const [inputs, setInputs] = useState({ massWet: 150, massDry: 120, massTotal: 5.5, volume: 0.003, specificGravity: 2.65 });
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const calculateMoisture = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/phase/moisture`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mass_wet: inputs.massWet,
                    mass_dry: inputs.massDry
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Calculation failed');
            }

            const moistureData = await response.json();

            // Also calculate unit weights
            const weightsResponse = await fetch(`${API_BASE_URL}/phase/unit-weights`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mass_total: inputs.massTotal,
                    volume: inputs.volume,
                    moisture_content: moistureData.moisture_content,
                    specific_gravity: inputs.specificGravity
                })
            });

            const weightsData = await weightsResponse.json();

            setResults({
                moisture_content: moistureData.moisture_content,
                ...weightsData
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Phase Relationships</h2>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Mass of Wet Soil (g)" value={inputs.massWet} onChange={(v) => setInputs({ ...inputs, massWet: v })} />
                        <InputField label="Mass of Dry Soil (g)" value={inputs.massDry} onChange={(v) => setInputs({ ...inputs, massDry: v })} />
                        <InputField label="Total Mass (kg)" value={inputs.massTotal} onChange={(v) => setInputs({ ...inputs, massTotal: v })} />
                        <InputField label="Volume (m³)" value={inputs.volume} onChange={(v) => setInputs({ ...inputs, volume: v })} step={0.001} />
                        <InputField label="Specific Gravity" value={inputs.specificGravity} onChange={(v) => setInputs({ ...inputs, specificGravity: v })} step={0.01} />
                    </div>

                    <button
                        onClick={calculateMoisture}
                        disabled={loading}
                        className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                        {loading ? 'Calculating...' : 'Calculate'}
                    </button>
                </div>

                {error && <ErrorAlert message={error} />}

                {results && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <h3 className="font-semibold text-gray-900 mb-3">Results</h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <ResultRow label="Moisture Content" value={`${results.moisture_content.toFixed(1)}%`} />
                            <ResultRow label="Bulk Unit Weight" value={`${results.gamma_bulk} kN/m³`} />
                            <ResultRow label="Dry Unit Weight" value={`${results.gamma_dry} kN/m³`} />
                            <ResultRow label="Saturated Unit Weight" value={`${results.gamma_sat} kN/m³`} />
                            <ResultRow label="Submerged Unit Weight" value={`${results.gamma_submerged} kN/m³`} />
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Phase Diagram</h3>
                <PhaseDiagram />
            </div>
        </div>
    );
}

// ==================== ATTERBERG LIMITS MODULE ====================
function AtterbergModule() {
    const [inputs, setInputs] = useState({ LL: 45, PL: 22 });
    const [classification, setClassification] = useState(null);
    const [loading, setLoading] = useState(false);
    const [chartData, setChartData] = useState([]);

    React.useEffect(() => {
        // Load plasticity chart data
        fetch(`${API_BASE_URL}/index/plasticity-chart`)
            .then(res => res.json())
            .then(data => {
                setChartData(data.A_line);
            })
            .catch(console.error);
    }, []);

    const classify = async () => {
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/index/atterberg`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    liquid_limit: inputs.LL,
                    plastic_limit: inputs.PL
                })
            });

            const data = await response.json();
            setClassification(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Atterberg Limits (ASTM D4318)</h2>

                <div className="space-y-4">
                    <InputField label="Liquid Limit (%)" value={inputs.LL} onChange={(v) => setInputs({ ...inputs, LL: v })} />
                    <InputField label="Plastic Limit (%)" value={inputs.PL} onChange={(v) => setInputs({ ...inputs, PL: v })} />

                    <button onClick={classify} disabled={loading} className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 disabled:bg-gray-400">
                        {loading ? 'Classifying...' : 'Classify Soil (USCS)'}
                    </button>
                </div>

                {classification && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <ResultRow label="Plasticity Index" value={`${classification.plasticity_index}%`} />
                            <ResultRow label="USCS Classification" value={classification.classification} />
                            <p className="text-sm text-gray-700 mt-2">{classification.description}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Casagrande Plasticity Chart</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="LL" label={{ value: 'Liquid Limit (%)', position: 'insideBottom', offset: -5 }} />
                        <YAxis label={{ value: 'Plasticity Index (%)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="PI" stroke="#374151" name="A-line" strokeWidth={2} dot={false} />
                        {classification && (
                            <Scatter data={[{ LL: inputs.LL, PI: classification.plasticity_index }]} fill="#dc2626" />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ==================== COMPACTION MODULE ====================
function CompactionModule() {
    const [testData, setTestData] = useState([
        { moisture_content: 8, dry_density: 17.2 },
        { moisture_content: 10, dry_density: 18.1 },
        { moisture_content: 12, dry_density: 18.8 },
        { moisture_content: 14, dry_density: 19.2 },
        { moisture_content: 16, dry_density: 18.9 },
    ]);
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);

    const analyzeProctor = async () => {
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/compaction/proctor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data_points: testData,
                    specific_gravity: 2.65,
                    test_type: 'standard'
                })
            });

            const data = await response.json();
            setResults(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Proctor Compaction Test (ASTM D698)</h2>

                <button onClick={analyzeProctor} disabled={loading} className="mb-4 bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 disabled:bg-gray-400">
                    {loading ? 'Analyzing...' : 'Analyze Proctor Test'}
                </button>

                {results && (
                    <div className="mb-6 bg-gray-50 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4">
                            <ResultRow label="Optimum Moisture Content" value={`${results.optimum_moisture_content}%`} />
                            <ResultRow label="Maximum Dry Density" value={`${results.maximum_dry_density} kN/m³`} />
                            <ResultRow label="Curve Fit Quality (R²)" value={results.r_squared} />
                        </div>
                    </div>
                )}

                <ResponsiveContainer width="100%" height={400}>
                    <LineChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="moisture_content" type="number" domain={[5, 20]} label={{ value: 'Moisture Content (%)', position: 'insideBottom', offset: -5 }} />
                        <YAxis domain={[16, 21]} label={{ value: 'Dry Density (kN/m³)', angle: -90, position: 'insideLeft' }} />
                        <Tooltip />
                        <Legend />
                        <Line data={testData} type="monotone" dataKey="dry_density" stroke="#dc2626" strokeWidth={2} name="Test Data" dot={{ r: 6, fill: '#dc2626' }} />
                        {results && results.fitted_curve && (
                            <Line data={results.fitted_curve} type="monotone" dataKey="dry_density" stroke="#059669" strokeWidth={2} name="Fitted Curve" dot={false} />
                        )}
                        {results && results.zav_curve && (
                            <Line data={results.zav_curve} type="monotone" dataKey="dry_density" stroke="#3b82f6" strokeWidth={1} strokeDasharray="5 5" name="ZAV" dot={false} />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ==================== SHEAR STRENGTH MODULE ====================
function ShearStrengthModule() {
    const [shearData] = useState([
        { sigma: 50, tau: 45 },
        { sigma: 100, tau: 75 },
        { sigma: 150, tau: 105 },
    ]);
    const [strength, setStrength] = useState(null);
    const [loading, setLoading] = useState(false);

    const analyzeShear = async () => {
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/shear/direct-shear`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    normal_stresses: shearData.map(d => d.sigma),
                    shear_stresses: shearData.map(d => d.tau)
                })
            });

            const data = await response.json();
            setStrength(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const envelopeData = strength ? Array.from({ length: 50 }, (_, i) => {
        const sigma = i * 4;
        const tau = strength.cohesion + sigma * Math.tan(strength.friction_angle * Math.PI / 180);
        return { sigma, tau };
    }) : [];

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Direct Shear Test (ASTM D3080)</h2>

            <button onClick={analyzeShear} disabled={loading} className="mb-4 bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 disabled:bg-gray-400">
                {loading ? 'Analyzing...' : 'Analyze Shear Strength'}
            </button>

            {strength && (
                <div className="mb-6 bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-3 gap-4">
                        <ResultRow label="Cohesion (c)" value={`${strength.cohesion} kPa`} />
                        <ResultRow label="Friction Angle (φ)" value={`${strength.friction_angle}°`} />
                        <ResultRow label="R² (Fit Quality)" value={strength.r_squared.toFixed(4)} />
                    </div>
                </div>
            )}

            <ResponsiveContainer width="100%" height={400}>
                <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="sigma" type="number" label={{ value: 'Normal Stress (kPa)', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'Shear Stress (kPa)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Legend />
                    <Scatter data={shearData} fill="#dc2626" name="Test Points" />
                    {strength && <Scatter data={envelopeData} fill="none" stroke="#374151" strokeWidth={2} name="Mohr-Coulomb" line />}
                </ScatterChart>
            </ResponsiveContainer>
        </div>
    );
}

// ==================== BEARING CAPACITY MODULE ====================
function BearingCapacityModule() {
    const [params, setParams] = useState({ c: 20, phi: 30, gamma: 18, B: 2, Df: 1.5 });
    const [capacity, setCapacity] = useState(null);
    const [loading, setLoading] = useState(false);

    const calculateBearing = async () => {
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/bearing/calculate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cohesion: params.c,
                    friction_angle: params.phi,
                    unit_weight: params.gamma,
                    width: params.B,
                    depth: params.Df,
                    shape: 'strip',
                    method: 'terzaghi',
                    factor_of_safety: 3.0
                })
            });

            const data = await response.json();
            setCapacity(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bearing Capacity (Terzaghi)</h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <InputField label="Cohesion c (kPa)" value={params.c} onChange={(v) => setParams({ ...params, c: v })} />
                <InputField label="Friction Angle φ (°)" value={params.phi} onChange={(v) => setParams({ ...params, phi: v })} />
                <InputField label="Unit Weight γ (kN/m³)" value={params.gamma} onChange={(v) => setParams({ ...params, gamma: v })} />
                <InputField label="Width B (m)" value={params.B} onChange={(v) => setParams({ ...params, B: v })} />
                <InputField label="Depth Df (m)" value={params.Df} onChange={(v) => setParams({ ...params, Df: v })} />
            </div>

            <button onClick={calculateBearing} disabled={loading} className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 mb-4">
                {loading ? 'Calculating...' : 'Calculate Bearing Capacity'}
            </button>

            {capacity && (
                <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                        <ResultRow label="Ultimate qᵤ" value={`${capacity.ultimate_bearing_capacity} kPa`} />
                        <ResultRow label="Allowable qₐ (FS=3)" value={`${capacity.allowable_bearing_capacity} kPa`} />
                    </div>
                </div>
            )}
        </div>
    );
}

// ==================== CONSOLIDATION MODULE ====================
function ConsolidationModule() {
    const [params, setParams] = useState({ H0: 5, e0: 0.8, Cc: 0.3, sigma0: 100, sigmaF: 200 });
    const [settlement, setSettlement] = useState(null);
    const [loading, setLoading] = useState(false);

    const calculateSettlement = async () => {
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/consolidation/settlement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    initial_thickness: params.H0,
                    initial_void_ratio: params.e0,
                    compression_index: params.Cc,
                    initial_stress: params.sigma0,
                    final_stress: params.sigmaF
                })
            });

            const data = await response.json();
            setSettlement(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-2xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Consolidation Settlement (ASTM D2435)</h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <InputField label="Initial Thickness H₀ (m)" value={params.H0} onChange={(v) => setParams({ ...params, H0: v })} />
                <InputField label="Initial Void Ratio e₀" value={params.e0} onChange={(v) => setParams({ ...params, e0: v })} />
                <InputField label="Compression Index Cc" value={params.Cc} onChange={(v) => setParams({ ...params, Cc: v })} />
                <InputField label="Initial Stress σ'₀ (kPa)" value={params.sigma0} onChange={(v) => setParams({ ...params, sigma0: v })} />
                <InputField label="Final Stress σ'f (kPa)" value={params.sigmaF} onChange={(v) => setParams({ ...params, sigmaF: v })} />
            </div>

            <button onClick={calculateSettlement} disabled={loading} className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 mb-4">
                {loading ? 'Calculating...' : 'Calculate Settlement'}
            </button>

            {settlement && (
                <div className="bg-gray-50 rounded-lg p-4">
                    <ResultRow label="Primary Settlement" value={`${settlement.primary_settlement} mm`} />
                    <ResultRow label="Settlement Ratio" value={`${settlement.settlement_ratio}% of H₀`} />
                </div>
            )}
        </div>
    );
}

// ==================== SLOPE STABILITY MODULE ====================
function SlopeStabilityModule() {
    const [params, setParams] = useState({ H: 10, beta: 35, gamma: 18, c: 15, phi: 25 });
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [method, setMethod] = useState('compare');

    const analyzeSlope = async () => {
        setLoading(true);

        try {
            const endpoint = method === 'compare' ? '/slope/compare-methods' : `/slope/${method}`;

            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slope_height: params.H,
                    slope_angle: params.beta,
                    unit_weight: params.gamma,
                    cohesion: params.c,
                    friction_angle: params.phi
                })
            });

            const data = await response.json();
            setResults(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Slope Stability Analysis</h2>

                <div className="mb-4 flex gap-2">
                    <button onClick={() => setMethod('bishop')} className={`px-4 py-2 rounded ${method === 'bishop' ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}>Bishop</button>
                    <button onClick={() => setMethod('janbu')} className={`px-4 py-2 rounded ${method === 'janbu' ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}>Janbu</button>
                    <button onClick={() => setMethod('spencer')} className={`px-4 py-2 rounded ${method === 'spencer' ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}>Spencer</button>
                    <button onClick={() => setMethod('compare')} className={`px-4 py-2 rounded ${method === 'compare' ? 'bg-gray-900 text-white' : 'bg-gray-100'}`}>Compare All</button>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <InputField label="Slope Height H (m)" value={params.H} onChange={(v) => setParams({ ...params, H: v })} />
                    <InputField label="Slope Angle β (°)" value={params.beta} onChange={(v) => setParams({ ...params, beta: v })} />
                    <InputField label="Unit Weight γ (kN/m³)" value={params.gamma} onChange={(v) => setParams({ ...params, gamma: v })} />
                    <InputField label="Cohesion c (kPa)" value={params.c} onChange={(v) => setParams({ ...params, c: v })} />
                    <InputField label="Friction Angle φ (°)" value={params.phi} onChange={(v) => setParams({ ...params, phi: v })} />
                </div>

                <button onClick={analyzeSlope} disabled={loading} className="w-full bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 disabled:bg-gray-400 mb-4">
                    {loading ? 'Analyzing...' : `Analyze Slope (${method === 'compare' ? 'All Methods' : method.charAt(0).toUpperCase() + method.slice(1)})`}
                </button>

                {results && (
                    <div className="space-y-4">
                        {method === 'compare' ? (
                            <>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-sm mb-2">Bishop</h4>
                                        <ResultRow label="FoS" value={results.bishop.FoS} />
                                        <p className="text-xs text-gray-600 mt-2">{results.bishop.status}</p>
                                    </div>
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-sm mb-2">Janbu</h4>
                                        <ResultRow label="FoS" value={results.janbu.FoS} />
                                        <ResultRow label="f₀" value={results.janbu.correction_factor} />
                                        <p className="text-xs text-gray-600 mt-2">{results.janbu.status}</p>
                                    </div>
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-sm mb-2">Spencer</h4>
                                        <ResultRow label="FoS" value={results.spencer.FoS} />
                                        <ResultRow label="θ" value={`${results.spencer.interslice_angle}°`} />
                                        <p className="text-xs text-gray-600 mt-2">{results.spencer.status}</p>
                                    </div>
                                </div>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-sm"><strong>Average FoS:</strong> {results.average_FoS}</p>
                                    <p className="text-sm mt-2">{results.recommendation}</p>
                                </div>
                            </>
                        ) : (
                            <div className="bg-gray-50 rounded-lg p-4">
                                <ResultRow label="Factor of Safety" value={results.factor_of_safety} />
                                <ResultRow label="Status" value={results.status} />
                                {results.correction_factor && <ResultRow label="Correction Factor" value={results.correction_factor} />}
                                {results.interslice_angle && <ResultRow label="Interslice Angle" value={`${results.interslice_angle}°`} />}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ==================== 3D SOIL PROFILE ====================
function SoilProfile3D() {
    const [soilLayers] = useState([
        { name: 'Fill', depth: 2, color: '#d4a373', description: 'Brown sandy fill' },
        { name: 'Silty Clay (CL)', depth: 6, color: '#8b7355', description: 'Brown silty clay, medium stiff' },
        { name: 'Sandy Silt (ML)', depth: 5, color: '#c4a484', description: 'Gray sandy silt, dense' },
        { name: 'Clayey Sand (SC)', depth: 7, color: '#b8956a', description: 'Brown clayey sand, very dense' },
    ]);

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">3D Subsurface Profile</h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-gray-50 rounded-lg" style={{ height: '500px' }}>
                        <Canvas camera={{ position: [8, 8, 8], fov: 50 }}>
                            <Suspense fallback={null}>
                                <ambientLight intensity={0.5} />
                                <directionalLight position={[10, 10, 5]} intensity={1} />
                                <SoilLayersVisualization layers={soilLayers} />
                                <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
                                <gridHelper args={[20, 20, '#e5e7eb', '#e5e7eb']} />
                            </Suspense>
                        </Canvas>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900">Soil Layers</h3>
                        {soilLayers.map((layer, index) => {
                            const cumulativeDepth = soilLayers.slice(0, index + 1).reduce((sum, l) => sum + l.depth, 0);
                            const startDepth = cumulativeDepth - layer.depth;

                            return (
                                <div key={index} className="border border-gray-200 rounded-lg p-3">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: layer.color }} />
                                        <div>
                                            <div className="font-semibold text-sm">{layer.name}</div>
                                            <div className="text-xs text-gray-600">{startDepth}m - {cumulativeDepth}m</div>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-600">{layer.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SoilLayersVisualization({ layers }) {
    let currentY = 0;

    return (
        <group>
            {layers.map((layer, index) => {
                const thickness = layer.depth;
                const yPosition = currentY - thickness / 2;
                currentY -= thickness;

                return (
                    <group key={index}>
                        <Box args={[5, thickness, 5]} position={[0, yPosition, 0]}>
                            <meshStandardMaterial color={layer.color} />
                        </Box>
                        <Text position={[3, yPosition, 0]} rotation={[0, -Math.PI / 4, 0]} fontSize={0.3} color="#1f2937">
                            {layer.name}
                        </Text>
                        <Text position={[-3, yPosition + thickness / 2, 0]} fontSize={0.25} color="#374151">
                            {(currentY + thickness).toFixed(1)}m
                        </Text>
                    </group>
                );
            })}
            <Box args={[5.2, 0.05, 5.2]} position={[0, -8, 0]}>
                <meshStandardMaterial color="#3b82f6" opacity={0.3} transparent />
            </Box>
            <Text position={[3, -8, 0]} fontSize={0.3} color="#2563eb">Water Table</Text>
        </group>
    );
}

// ==================== DATABASE MODULE ====================
function DatabaseModule() {
    const [projects, setProjects] = useState([]);
    const [newProject, setNewProject] = useState({ number: '', name: '', client: '', location: '' });
    const [loading, setLoading] = useState(false);

    const loadProjects = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/database/projects`);
            const data = await response.json();
            setProjects(data);
        } catch (err) {
            console.error(err);
        }
    };

    React.useEffect(() => {
        loadProjects();
    }, []);

    const createProject = async () => {
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/database/project?` + new URLSearchParams({
                project_number: newProject.number,
                project_name: newProject.name,
                client_name: newProject.client,
                location: newProject.location
            }), { method: 'POST' });

            await response.json();
            setNewProject({ number: '', name: '', client: '', location: '' });
            loadProjects();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Database</h2>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <InputField label="Project Number" value={newProject.number} onChange={(v) => setNewProject({ ...newProject, number: v })} />
                    <InputField label="Project Name" value={newProject.name} onChange={(v) => setNewProject({ ...newProject, name: v })} />
                    <InputField label="Client" value={newProject.client} onChange={(v) => setNewProject({ ...newProject, client: v })} />
                    <InputField label="Location" value={newProject.location} onChange={(v) => setNewProject({ ...newProject, location: v })} />
                </div>

                <button onClick={createProject} disabled={loading} className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                    {loading ? 'Creating...' : 'Create Project'}
                </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Existing Projects</h3>
                <div className="space-y-3">
                    {projects.map((project) => (
                        <div key={project.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div><strong>Number:</strong> {project.project_number}</div>
                                <div><strong>Name:</strong> {project.project_name}</div>
                                <div><strong>Client:</strong> {project.client_name}</div>
                                <div><strong>Location:</strong> {project.location}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ==================== EXPORT MODULE ====================
function ExportModule() {
    const [exporting, setExporting] = useState(false);
    const [projectInfo] = useState({
        project_name: 'Office Building Foundation',
        project_no: 'GEO-2024-001',
        client: 'ABC Construction',
        location: 'Nairobi, Kenya',
        engineer: 'John Doe, PE'
    });

    const handleExportPDF = async () => {
        setExporting(true);

        try {
            const response = await fetch(`${API_BASE_URL}/export/pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_info: projectInfo,
                    test_results: {
                        phase: { moisture_content: 25.4, gamma_bulk: 18.5 },
                        atterberg: { liquid_limit: 45, plastic_limit: 22 }
                    }
                })
            });

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `geotechnical_report_${projectInfo.project_no}.pdf`;
            a.click();
        } catch (err) {
            console.error(err);
            alert('Export failed. Make sure the backend is running.');
        } finally {
            setExporting(false);
        }
    };

    const handleExportExcel = async () => {
        setExporting(true);

        try {
            const response = await fetch(`${API_BASE_URL}/export/excel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    project_info: projectInfo,
                    test_results: {
                        phase: { moisture_content: 25.4 },
                        atterberg: { liquid_limit: 45 }
                    }
                })
            });

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `soil_mechanics_${projectInfo.project_no}.xlsx`;
            a.click();
        } catch (err) {
            console.error(err);
            alert('Export failed. Make sure the backend is running.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Export & Reports</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <FileText className="w-8 h-8 text-red-600" />
                            <div>
                                <h3 className="font-semibold text-gray-900">PDF Report</h3>
                                <p className="text-sm text-gray-600">Professional geotechnical report</p>
                            </div>
                        </div>
                        <button onClick={handleExportPDF} disabled={exporting} className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400">
                            {exporting ? 'Generating...' : 'Generate PDF Report'}
                        </button>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Download className="w-8 h-8 text-green-600" />
                            <div>
                                <h3 className="font-semibold text-gray-900">Excel Workbook</h3>
                                <p className="text-sm text-gray-600">Calculation sheets with formulas</p>
                            </div>
                        </div>
                        <button onClick={handleExportExcel} disabled={exporting} className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                            {exporting ? 'Generating...' : 'Export to Excel'}
                        </button>
                    </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Advanced Slope Stability Methods</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="border border-gray-200 rounded-lg p-4">
                            <h4 className="font-semibold text-sm mb-2">Simplified Bishop</h4>
                            <p className="text-xs text-gray-600 mb-3">Circular slip surfaces, moment equilibrium</p>
                            <div className="text-xs text-green-600 font-semibold">✓ Available</div>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4">
                            <h4 className="font-semibold text-sm mb-2">Janbu Simplified</h4>
                            <p className="text-xs text-gray-600 mb-3">Non-circular, force equilibrium</p>
                            <div className="text-xs text-green-600 font-semibold">✓ Available</div>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4">
                            <h4 className="font-semibold text-sm mb-2">Spencer Method</h4>
                            <p className="text-xs text-gray-600 mb-3">Rigorous, force + moment</p>
                            <div className="text-xs text-green-600 font-semibold">✓ Available</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==================== UTILITY COMPONENTS ====================
function InputField({ label, value, onChange, step = 1 }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                step={step}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
        </div>
    );
}

function ResultRow({ label, value }) {
    return (
        <div className="flex justify-between items-center py-1">
            <span className="text-gray-600 text-sm">{label}:</span>
            <span className="font-semibold text-gray-900">{value}</span>
        </div>
    );
}

function ErrorAlert({ message }) {
    return (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
                <p className="text-sm font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-700">{message}</p>
            </div>
        </div>
    );
}

function PhaseDiagram() {
    return (
        <div className="flex justify-center items-center h-96">
            <svg width="300" height="400" viewBox="0 0 300 400">
                <rect x="50" y="50" width="200" height="80" fill="#e0f2fe" stroke="#0369a1" strokeWidth="2" />
                <text x="150" y="95" textAnchor="middle" className="text-sm font-medium fill-gray-700">Air (Va)</text>
                <rect x="50" y="130" width="200" height="100" fill="#dbeafe" stroke="#2563eb" strokeWidth="2" />
                <text x="150" y="185" textAnchor="middle" className="text-sm font-medium fill-gray-700">Water (Vw)</text>
                <rect x="50" y="230" width="200" height="120" fill="#d1d5db" stroke="#374151" strokeWidth="2" />
                <text x="150" y="295" textAnchor="middle" className="text-sm font-medium fill-gray-900">Solids (Vs)</text>
                <text x="270" y="160" className="text-xs fill-gray-600">Vv = Va + Vw</text>
                <text x="270" y="290" className="text-xs fill-gray-600">Vtotal = Vs + Vv</text>
            </svg>
        </div>
    );
}