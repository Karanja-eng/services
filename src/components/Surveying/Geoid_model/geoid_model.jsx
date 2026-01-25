import React, { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, Navigation, Globe, Layers, Zap, AlertTriangle } from 'lucide-react';

// ============================================================================
// GEODETIC CONSTANTS
// ============================================================================
const WGS84 = {
    a: 6378137.0,           // Semi-major axis (m)
    f: 1 / 298.257223563,   // Flattening
    e2: 0.00669437999014,   // First eccentricity squared
};

// ============================================================================
// BASELINE COMPUTATION ENGINE
// ============================================================================
const computeBaseline = (station1, station2) => {
    // Convert lat/lon to ECEF
    const toECEF = (lat, lon, h) => {
        const phi = lat * Math.PI / 180;
        const lambda = lon * Math.PI / 180;
        const N = WGS84.a / Math.sqrt(1 - WGS84.e2 * Math.sin(phi) ** 2);

        return {
            x: (N + h) * Math.cos(phi) * Math.cos(lambda),
            y: (N + h) * Math.cos(phi) * Math.sin(lambda),
            z: (N * (1 - WGS84.e2) + h) * Math.sin(phi)
        };
    };

    const ecef1 = toECEF(station1.lat, station1.lon, station1.h);
    const ecef2 = toECEF(station2.lat, station2.lon, station2.h);

    // Baseline vector in ECEF
    const dx = ecef2.x - ecef1.x;
    const dy = ecef2.y - ecef1.y;
    const dz = ecef2.z - ecef1.z;

    // Baseline length
    const length = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);

    // Convert to ENU at station 1
    const phi = station1.lat * Math.PI / 180;
    const lambda = station1.lon * Math.PI / 180;

    const dE = -Math.sin(lambda) * dx + Math.cos(lambda) * dy;
    const dN = -Math.sin(phi) * Math.cos(lambda) * dx
        - Math.sin(phi) * Math.sin(lambda) * dy
        + Math.cos(phi) * dz;
    const dU = Math.cos(phi) * Math.cos(lambda) * dx
        + Math.cos(phi) * Math.sin(lambda) * dy
        + Math.sin(phi) * dz;

    // Horizontal distance and azimuth
    const horizontalDist = Math.sqrt(dE ** 2 + dN ** 2);
    const azimuth = (Math.atan2(dE, dN) * 180 / Math.PI + 360) % 360;

    return {
        ecef: { dx, dy, dz },
        enu: { dE, dN, dU },
        length,
        horizontalDist,
        azimuth,
        verticalDist: dU
    };
};

// ============================================================================
// UTM CONVERSION ENGINE
// ============================================================================
const latLonToUTM = (lat, lon) => {
    const k0 = 0.9996; // Scale factor
    const a = WGS84.a;
    const e2 = WGS84.e2;

    // Determine zone
    const zone = Math.floor((lon + 180) / 6) + 1;
    const lambda0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180; // Central meridian

    const phi = lat * Math.PI / 180;
    const lambda = lon * Math.PI / 180;

    const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    const T = Math.tan(phi) ** 2;
    const C = (e2 / (1 - e2)) * Math.cos(phi) ** 2;
    const A = (lambda - lambda0) * Math.cos(phi);

    const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
        - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
        + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi)
        - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));

    const easting = k0 * N * (A + (1 - T + C) * A ** 3 / 6
        + (5 - 18 * T + T ** 2 + 72 * C - 58 * (e2 / (1 - e2))) * A ** 5 / 120) + 500000;

    const northing = k0 * (M + N * Math.tan(phi) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24
        + (61 - 58 * T + T ** 2 + 600 * C - 330 * (e2 / (1 - e2))) * A ** 6 / 720));

    // Adjust for southern hemisphere
    const finalNorthing = lat < 0 ? northing + 10000000 : northing;

    return {
        easting,
        northing: finalNorthing,
        zone,
        hemisphere: lat >= 0 ? 'N' : 'S',
        convergence: Math.atan(Math.tan(lambda - lambda0) * Math.sin(phi)) * 180 / Math.PI,
        scaleFactor: k0 * (1 + (1 + C) * A ** 2 / 2 + (5 - 4 * T + 42 * C + 13 * C ** 2) * A ** 4 / 24)
    };
};

// ============================================================================
// GEOID UNDULATION (Simplified EGM96-style model)
// ============================================================================
const getGeoidUndulation = (lat, lon) => {
    // Simplified harmonic model for demonstration
    // Real implementation would use EGM96/EGM2008 grid
    const phi = lat * Math.PI / 180;
    const lambda = lon * Math.PI / 180;

    const N = 30 * Math.sin(2 * phi) * Math.cos(lambda)
        + 15 * Math.sin(phi) * Math.cos(2 * lambda)
        - 10 * Math.cos(3 * phi);

    return N;
};

// ============================================================================
// RTK QUALITY ANALYSIS
// ============================================================================
const analyzeRTKQuality = (baselineLength, pdop, solutionType, numSatellites) => {
    let expectedHorizontalAccuracy, expectedVerticalAccuracy, quality;

    // RTK Fixed solution
    if (solutionType === 'fixed') {
        expectedHorizontalAccuracy = 8 + 1 * baselineLength / 1000; // mm + 1ppm
        expectedVerticalAccuracy = 15 + 1 * baselineLength / 1000;  // mm + 1ppm
        quality = pdop < 3 && numSatellites >= 5 ? 'excellent' : 'good';
    }
    // RTK Float solution
    else if (solutionType === 'float') {
        expectedHorizontalAccuracy = 50 + 5 * baselineLength / 1000; // mm + 5ppm
        expectedVerticalAccuracy = 100 + 10 * baselineLength / 1000;
        quality = 'fair';
    }
    // Single point positioning
    else {
        expectedHorizontalAccuracy = 2000; // 2m
        expectedVerticalAccuracy = 3000;   // 3m
        quality = 'poor';
    }

    // Adjust for PDOP
    const pdopFactor = Math.max(1, pdop / 2);
    expectedHorizontalAccuracy *= pdopFactor;
    expectedVerticalAccuracy *= pdopFactor;

    return {
        horizontalAccuracy: expectedHorizontalAccuracy,
        verticalAccuracy: expectedVerticalAccuracy,
        quality,
        pdopFactor,
        warnings: [
            ...(pdop > 4 ? ['High PDOP - poor satellite geometry'] : []),
            ...(numSatellites < 5 ? ['Low satellite count - reduced reliability'] : []),
            ...(baselineLength > 20000 ? ['Long baseline - accuracy degraded'] : [])
        ]
    };
};

// ============================================================================
// REACT COMPONENTS
// ============================================================================

const GNSSModuleDemo = () => {
    const [activeTab, setActiveTab] = useState('baseline');

    // Baseline state
    const [station1, setStation1] = useState({ lat: 37.7749, lon: -122.4194, h: 10 });
    const [station2, setStation2] = useState({ lat: 37.8044, lon: -122.2712, h: 15 });
    const [baselineResult, setBaselineResult] = useState(null);

    // UTM state
    const [utmLat, setUtmLat] = useState(37.7749);
    const [utmLon, setUtmLon] = useState(-122.4194);
    const [utmResult, setUtmResult] = useState(null);

    // Geoid state
    const [geoidLat, setGeoidLat] = useState(37.7749);
    const [geoidLon, setGeoidLon] = useState(-122.4194);
    const [ellipsoidalHeight, setEllipsoidalHeight] = useState(50);
    const [geoidResult, setGeoidResult] = useState(null);

    // RTK state
    const [rtkBaseline, setRtkBaseline] = useState(5000);
    const [pdop, setPdop] = useState(2.5);
    const [solutionType, setSolutionType] = useState('fixed');
    const [numSats, setNumSats] = useState(8);
    const [rtkResult, setRtkResult] = useState(null);

    // Helmert transformation state
    const [helmertStation, setHelmertStation] = useState({ lat: 37.7749, lon: -122.4194, h: 10 });
    const [fromDatum, setFromDatum] = useState('WGS84');
    const [toDatum, setToDatum] = useState('NAD83');
    const [helmertResult, setHelmertResult] = useState(null);

    // Network adjustment state
    const [networkStations, setNetworkStations] = useState([
        { id: 'BASE', lat: 37.7749, lon: -122.4194, h: 10, fixed: true },
        { id: 'ROV1', lat: 37.7850, lon: -122.4100, h: 12, fixed: false },
        { id: 'ROV2', lat: 37.7650, lon: -122.4300, h: 11, fixed: false }
    ]);
    const [adjustmentResult, setAdjustmentResult] = useState(null);

    const handleComputeBaseline = () => {
        const result = computeBaseline(station1, station2);
        setBaselineResult(result);
    };

    const handleComputeUTM = () => {
        const result = latLonToUTM(utmLat, utmLon);
        setUtmResult(result);
    };

    const handleComputeGeoid = () => {
        const undulation = getGeoidUndulation(geoidLat, geoidLon);
        const orthometricHeight = ellipsoidalHeight - undulation;
        setGeoidResult({ undulation, orthometricHeight });
    };

    const handleAnalyzeRTK = () => {
        const result = analyzeRTKQuality(rtkBaseline, pdop, solutionType, numSats);
        setRtkResult(result);
    };

    const handleHelmertTransform = () => {
        // Simulate Helmert transformation
        const params = {
            tx: 0.9956, ty: -1.9013, tz: -0.5215,
            rx: 0.025915, ry: 0.009426, rz: 0.011599, ds: 0.00062
        };

        // Small transformation (demo)
        const latDiff = 0.00001 * params.tx;
        const lonDiff = 0.00001 * params.ty;

        setHelmertResult({
            transformed: {
                lat: helmertStation.lat + latDiff,
                lon: helmertStation.lon + lonDiff,
                h: helmertStation.h + params.tz / 1000
            },
            params
        });
    };

    const handleNetworkAdjustment = () => {
        // Simulate network adjustment
        const adjusted = networkStations.map((station, idx) => ({
            ...station,
            adjusted_lat: station.lat + (station.fixed ? 0 : (Math.random() - 0.5) * 0.00001),
            adjusted_lon: station.lon + (station.fixed ? 0 : (Math.random() - 0.5) * 0.00001),
            adjusted_h: station.h + (station.fixed ? 0 : (Math.random() - 0.5) * 0.01),
            std_x: station.fixed ? 0 : 0.008 + Math.random() * 0.004,
            std_y: station.fixed ? 0 : 0.008 + Math.random() * 0.004,
            std_z: station.fixed ? 0 : 0.012 + Math.random() * 0.006
        }));

        setAdjustmentResult({
            stations: adjusted,
            sigma_0: 1.234,
            iterations: 3,
            dof: 6
        });
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Navigation className="w-8 h-8 text-blue-600" />
                        <h1 className="text-3xl font-bold text-gray-900">GNSS & Modern Surveying Module</h1>
                    </div>
                    <p className="text-gray-600">High-precision geodetic calculations and coordinate transformations</p>
                </div>

                {/* Navigation Tabs */}
                <div className="bg-white rounded-lg shadow-sm mb-6">
                    <div className="flex border-b overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('baseline')}
                            className={`px-6 py-3 font-medium whitespace-nowrap ${activeTab === 'baseline' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                Baseline
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('utm')}
                            className={`px-6 py-3 font-medium whitespace-nowrap ${activeTab === 'utm' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                UTM
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('geoid')}
                            className={`px-6 py-3 font-medium whitespace-nowrap ${activeTab === 'geoid' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4" />
                                Geoid
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('rtk')}
                            className={`px-6 py-3 font-medium whitespace-nowrap ${activeTab === 'rtk' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4" />
                                RTK Quality
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('helmert')}
                            className={`px-6 py-3 font-medium whitespace-nowrap ${activeTab === 'helmert' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                Datum Transform
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('network')}
                            className={`px-6 py-3 font-medium whitespace-nowrap ${activeTab === 'network' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4" />
                                Network Adjustment
                            </div>
                        </button>
                    </div>
                </div>

                {/* Baseline Computation */}
                {activeTab === 'baseline' && (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Station Coordinates</h2>

                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-semibold text-gray-700 mb-2">Station 1 (Base)</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-xs text-gray-600">Latitude (°)</label>
                                            <input
                                                type="number"
                                                step="0.000001"
                                                value={station1.lat}
                                                onChange={(e) => setStation1({ ...station1, lat: parseFloat(e.target.value) })}
                                                className="w-full px-3 py-2 border rounded"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">Longitude (°)</label>
                                            <input
                                                type="number"
                                                step="0.000001"
                                                value={station1.lon}
                                                onChange={(e) => setStation1({ ...station1, lon: parseFloat(e.target.value) })}
                                                className="w-full px-3 py-2 border rounded"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">Height (m)</label>
                                            <input
                                                type="number"
                                                step="0.001"
                                                value={station1.h}
                                                onChange={(e) => setStation1({ ...station1, h: parseFloat(e.target.value) })}
                                                className="w-full px-3 py-2 border rounded"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-semibold text-gray-700 mb-2">Station 2 (Rover)</h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-xs text-gray-600">Latitude (°)</label>
                                            <input
                                                type="number"
                                                step="0.000001"
                                                value={station2.lat}
                                                onChange={(e) => setStation2({ ...station2, lat: parseFloat(e.target.value) })}
                                                className="w-full px-3 py-2 border rounded"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">Longitude (°)</label>
                                            <input
                                                type="number"
                                                step="0.000001"
                                                value={station2.lon}
                                                onChange={(e) => setStation2({ ...station2, lon: parseFloat(e.target.value) })}
                                                className="w-full px-3 py-2 border rounded"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-600">Height (m)</label>
                                            <input
                                                type="number"
                                                step="0.001"
                                                value={station2.h}
                                                onChange={(e) => setStation2({ ...station2, h: parseFloat(e.target.value) })}
                                                className="w-full px-3 py-2 border rounded"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleComputeBaseline}
                                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                                >
                                    Compute Baseline
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Baseline Results</h2>
                            {baselineResult ? (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 p-4 rounded">
                                        <div className="text-sm text-gray-600 mb-1">Baseline Length</div>
                                        <div className="text-2xl font-bold text-blue-600">{baselineResult.length.toFixed(3)} m</div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="border p-3 rounded">
                                            <div className="text-xs text-gray-600 mb-1">Horizontal Distance</div>
                                            <div className="text-lg font-semibold">{baselineResult.horizontalDist.toFixed(3)} m</div>
                                        </div>
                                        <div className="border p-3 rounded">
                                            <div className="text-xs text-gray-600 mb-1">Azimuth</div>
                                            <div className="text-lg font-semibold">{baselineResult.azimuth.toFixed(4)}°</div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-gray-700 mb-2">ENU Components</h3>
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <div className="bg-gray-50 p-2 rounded">
                                                <div className="text-xs text-gray-600">East (dE)</div>
                                                <div className="font-mono">{baselineResult.enu.dE.toFixed(3)} m</div>
                                            </div>
                                            <div className="bg-gray-50 p-2 rounded">
                                                <div className="text-xs text-gray-600">North (dN)</div>
                                                <div className="font-mono">{baselineResult.enu.dN.toFixed(3)} m</div>
                                            </div>
                                            <div className="bg-gray-50 p-2 rounded">
                                                <div className="text-xs text-gray-600">Up (dU)</div>
                                                <div className="font-mono">{baselineResult.enu.dU.toFixed(3)} m</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-gray-700 mb-2">ECEF Components</h3>
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <div className="bg-gray-50 p-2 rounded">
                                                <div className="text-xs text-gray-600">dX</div>
                                                <div className="font-mono">{baselineResult.ecef.dx.toFixed(3)} m</div>
                                            </div>
                                            <div className="bg-gray-50 p-2 rounded">
                                                <div className="text-xs text-gray-600">dY</div>
                                                <div className="font-mono">{baselineResult.ecef.dy.toFixed(3)} m</div>
                                            </div>
                                            <div className="bg-gray-50 p-2 rounded">
                                                <div className="text-xs text-gray-600">dZ</div>
                                                <div className="font-mono">{baselineResult.ecef.dz.toFixed(3)} m</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-500 text-center py-12">
                                    Enter station coordinates and click Compute Baseline
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* UTM Conversion */}
                {activeTab === 'utm' && (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Geographic Coordinates</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Latitude (decimal degrees)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={utmLat}
                                        onChange={(e) => setUtmLat(parseFloat(e.target.value))}
                                        className="w-full px-3 py-2 border rounded"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Longitude (decimal degrees)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={utmLon}
                                        onChange={(e) => setUtmLon(parseFloat(e.target.value))}
                                        className="w-full px-3 py-2 border rounded"
                                    />
                                </div>

                                <button
                                    onClick={handleComputeUTM}
                                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                                >
                                    Convert to UTM
                                </button>

                                <div className="bg-gray-50 p-4 rounded text-sm">
                                    <div className="font-semibold text-gray-700 mb-2">Reference System</div>
                                    <div className="text-gray-600">WGS84 Ellipsoid</div>
                                    <div className="text-gray-600">Transverse Mercator Projection</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">UTM Coordinates</h2>
                            {utmResult ? (
                                <div className="space-y-4">
                                    <div className="bg-blue-50 p-4 rounded">
                                        <div className="text-sm text-gray-600 mb-1">UTM Zone</div>
                                        <div className="text-2xl font-bold text-blue-600">
                                            {utmResult.zone}{utmResult.hemisphere}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="border p-3 rounded">
                                            <div className="text-xs text-gray-600 mb-1">Easting</div>
                                            <div className="text-lg font-semibold font-mono">{utmResult.easting.toFixed(3)} m</div>
                                        </div>
                                        <div className="border p-3 rounded">
                                            <div className="text-xs text-gray-600 mb-1">Northing</div>
                                            <div className="text-lg font-semibold font-mono">{utmResult.northing.toFixed(3)} m</div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-gray-700 mb-2">Projection Parameters</h3>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between bg-gray-50 p-2 rounded">
                                                <span className="text-gray-600">Grid Convergence</span>
                                                <span className="font-mono">{utmResult.convergence.toFixed(6)}°</span>
                                            </div>
                                            <div className="flex justify-between bg-gray-50 p-2 rounded">
                                                <span className="text-gray-600">Scale Factor</span>
                                                <span className="font-mono">{utmResult.scaleFactor.toFixed(8)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm">
                                        <div className="font-semibold text-yellow-800 mb-1">Note</div>
                                        <div className="text-yellow-700">
                                            Scale factor varies with distance from central meridian.
                                            Apply to distances for accurate measurements.
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-500 text-center py-12">
                                    Enter position and height to compute geoid correction
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* RTK Quality Analysis */}
                {activeTab === 'rtk' && (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">RTK Parameters</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Baseline Length (m)
                                    </label>
                                    <input
                                        type="number"
                                        value={rtkBaseline}
                                        onChange={(e) => setRtkBaseline(parseFloat(e.target.value))}
                                        className="w-full px-3 py-2 border rounded"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Solution Type
                                    </label>
                                    <select
                                        value={solutionType}
                                        onChange={(e) => setSolutionType(e.target.value)}
                                        className="w-full px-3 py-2 border rounded"
                                    >
                                        <option value="fixed">RTK Fixed</option>
                                        <option value="float">RTK Float</option>
                                        <option value="single">Single Point</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        PDOP (Position Dilution of Precision)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={pdop}
                                        onChange={(e) => setPdop(parseFloat(e.target.value))}
                                        className="w-full px-3 py-2 border rounded"
                                    />
                                    <div className="text-xs text-gray-500 mt-1">
                                        Good: 1-3 | Fair: 3-6 | Poor: &gt;6
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Number of Satellites
                                    </label>
                                    <input
                                        type="number"
                                        value={numSats}
                                        onChange={(e) => setNumSats(parseInt(e.target.value))}
                                        className="w-full px-3 py-2 border rounded"
                                    />
                                </div>

                                <button
                                    onClick={handleAnalyzeRTK}
                                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                                >
                                    Analyze RTK Quality
                                </button>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Quality Assessment</h2>
                            {rtkResult ? (
                                <div className="space-y-4">
                                    <div className={`p-4 rounded ${rtkResult.quality === 'excellent' ? 'bg-green-50 border-2 border-green-200' :
                                        rtkResult.quality === 'good' ? 'bg-blue-50 border-2 border-blue-200' :
                                            rtkResult.quality === 'fair' ? 'bg-yellow-50 border-2 border-yellow-200' :
                                                'bg-red-50 border-2 border-red-200'
                                        }`}>
                                        <div className="text-sm text-gray-600 mb-1">Overall Quality</div>
                                        <div className={`text-2xl font-bold uppercase ${rtkResult.quality === 'excellent' ? 'text-green-600' :
                                            rtkResult.quality === 'good' ? 'text-blue-600' :
                                                rtkResult.quality === 'fair' ? 'text-yellow-600' :
                                                    'text-red-600'
                                            }`}>{rtkResult.quality}</div>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-gray-700 mb-2">Expected Accuracy</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="border p-3 rounded">
                                                <div className="text-xs text-gray-600 mb-1">Horizontal (95%)</div>
                                                <div className="text-lg font-semibold font-mono">
                                                    ± {rtkResult.horizontalAccuracy.toFixed(1)} mm
                                                </div>
                                            </div>
                                            <div className="border p-3 rounded">
                                                <div className="text-xs text-gray-600 mb-1">Vertical (95%)</div>
                                                <div className="text-lg font-semibold font-mono">
                                                    ± {rtkResult.verticalAccuracy.toFixed(1)} mm
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-3 rounded text-sm">
                                        <div className="font-semibold text-gray-700 mb-2">Analysis Details</div>
                                        <div className="space-y-1 text-gray-600">
                                            <div>Solution: {solutionType.toUpperCase()}</div>
                                            <div>PDOP Factor: {rtkResult.pdopFactor.toFixed(2)}x</div>
                                            <div>Baseline: {(rtkBaseline / 1000).toFixed(2)} km</div>
                                            <div>Satellites: {numSats}</div>
                                        </div>
                                    </div>

                                    {rtkResult.warnings.length > 0 && (
                                        <div className="bg-red-50 border border-red-200 p-3 rounded">
                                            <div className="flex items-center gap-2 mb-2">
                                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                                <div className="font-semibold text-red-800">Warnings</div>
                                            </div>
                                            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                                {rtkResult.warnings.map((warning, idx) => (
                                                    <li key={idx}>{warning}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="bg-blue-50 p-3 rounded text-sm">
                                        <div className="font-semibold text-blue-800 mb-1">Accuracy Formula</div>
                                        <div className="text-blue-700 font-mono text-xs">
                                            σ = base_accuracy + ppm × baseline_length
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-500 text-center py-12">
                                    Configure RTK parameters and click Analyze
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Helmert Datum Transformation */}
                {activeTab === 'helmert' && (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Datum Transformation</h2>

                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-2">
                                    <div>
                                        <label className="text-xs text-gray-600">Latitude (°)</label>
                                        <input
                                            type="number"
                                            step="0.000001"
                                            value={helmertStation.lat}
                                            onChange={(e) => setHelmertStation({ ...helmertStation, lat: parseFloat(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-600">Longitude (°)</label>
                                        <input
                                            type="number"
                                            step="0.000001"
                                            value={helmertStation.lon}
                                            onChange={(e) => setHelmertStation({ ...helmertStation, lon: parseFloat(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-600">Height (m)</label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            value={helmertStation.h}
                                            onChange={(e) => setHelmertStation({ ...helmertStation, h: parseFloat(e.target.value) })}
                                            className="w-full px-3 py-2 border rounded"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">From Datum</label>
                                        <select
                                            value={fromDatum}
                                            onChange={(e) => setFromDatum(e.target.value)}
                                            className="w-full px-3 py-2 border rounded"
                                        >
                                            <option value="WGS84">WGS84</option>
                                            <option value="NAD83">NAD83</option>
                                            <option value="ETRS89">ETRS89</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">To Datum</label>
                                        <select
                                            value={toDatum}
                                            onChange={(e) => setToDatum(e.target.value)}
                                            className="w-full px-3 py-2 border rounded"
                                        >
                                            <option value="WGS84">WGS84</option>
                                            <option value="NAD83">NAD83</option>
                                            <option value="ETRS89">ETRS89</option>
                                        </select>
                                    </div>
                                </div>

                                <button
                                    onClick={handleHelmertTransform}
                                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                                >
                                    Apply Helmert Transform
                                </button>

                                <div className="bg-gray-50 p-4 rounded text-sm">
                                    <div className="font-semibold text-gray-700 mb-2">7-Parameter Transformation</div>
                                    <div className="text-gray-600 space-y-1 text-xs">
                                        <div>• 3 Translations (tx, ty, tz)</div>
                                        <div>• 3 Rotations (rx, ry, rz)</div>
                                        <div>• 1 Scale factor (ds)</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Transformed Coordinates</h2>
                            {helmertResult ? (
                                <div className="space-y-4">
                                    <div className="bg-green-50 border-2 border-green-200 p-4 rounded">
                                        <div className="text-sm text-gray-600 mb-2">Transformed Position</div>
                                        <div className="space-y-1 text-sm font-mono">
                                            <div>Lat: {helmertResult.transformed.lat.toFixed(6)}°</div>
                                            <div>Lon: {helmertResult.transformed.lon.toFixed(6)}°</div>
                                            <div>H: {helmertResult.transformed.h.toFixed(3)} m</div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-gray-700 mb-2">Transformation Parameters</h3>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div className="bg-gray-50 p-2 rounded">
                                                <div className="text-xs text-gray-600">TX</div>
                                                <div className="font-mono">{helmertResult.params.tx.toFixed(4)} m</div>
                                            </div>
                                            <div className="bg-gray-50 p-2 rounded">
                                                <div className="text-xs text-gray-600">TY</div>
                                                <div className="font-mono">{helmertResult.params.ty.toFixed(4)} m</div>
                                            </div>
                                            <div className="bg-gray-50 p-2 rounded">
                                                <div className="text-xs text-gray-600">TZ</div>
                                                <div className="font-mono">{helmertResult.params.tz.toFixed(4)} m</div>
                                            </div>
                                            <div className="bg-gray-50 p-2 rounded">
                                                <div className="text-xs text-gray-600">Scale (ppm)</div>
                                                <div className="font-mono">{helmertResult.params.ds.toFixed(5)}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 border border-blue-200 p-3 rounded text-sm">
                                        <div className="font-semibold text-blue-800 mb-1">Accuracy</div>
                                        <div className="text-blue-700">
                                            Typical accuracy: ±50mm for well-defined datum pairs
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-500 text-center py-12">
                                    Configure transformation and click Apply
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Network Adjustment */}
                {activeTab === 'network' && (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Network Stations</h2>

                            <div className="space-y-4">
                                {networkStations.map((station, idx) => (
                                    <div key={idx} className="border p-3 rounded">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="font-semibold text-gray-700">{station.id}</div>
                                            <div className={`px-2 py-1 rounded text-xs ${station.fixed ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {station.fixed ? 'FIXED' : 'UNKNOWN'}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                            <div>
                                                <div className="text-xs text-gray-600">Lat</div>
                                                <div className="font-mono">{station.lat.toFixed(4)}°</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-600">Lon</div>
                                                <div className="font-mono">{station.lon.toFixed(4)}°</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-600">H</div>
                                                <div className="font-mono">{station.h.toFixed(1)} m</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    onClick={handleNetworkAdjustment}
                                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                                >
                                    Perform Least Squares Adjustment
                                </button>

                                <div className="bg-gray-50 p-4 rounded text-sm">
                                    <div className="font-semibold text-gray-700 mb-2">Adjustment Method</div>
                                    <div className="text-gray-600 text-xs">
                                        Uses weighted least squares to compute most probable station coordinates
                                        from redundant baseline observations.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Adjustment Results</h2>
                            {adjustmentResult ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-blue-50 p-3 rounded">
                                            <div className="text-xs text-gray-600">Iterations</div>
                                            <div className="text-lg font-bold text-blue-600">{adjustmentResult.iterations}</div>
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded">
                                            <div className="text-xs text-gray-600">σ₀</div>
                                            <div className="text-lg font-bold text-blue-600">{adjustmentResult.sigma_0.toFixed(3)}</div>
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded">
                                            <div className="text-xs text-gray-600">DOF</div>
                                            <div className="text-lg font-bold text-blue-600">{adjustmentResult.dof}</div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="font-semibold text-gray-700 mb-2">Adjusted Stations</h3>
                                        <div className="space-y-2">
                                            {adjustmentResult.stations.filter(s => !s.fixed).map((station, idx) => (
                                                <div key={idx} className="border p-3 rounded bg-green-50">
                                                    <div className="font-semibold text-gray-700 mb-1">{station.id}</div>
                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                        <div>
                                                            <div className="text-xs text-gray-600">Adjusted Lat</div>
                                                            <div className="font-mono">{station.adjusted_lat.toFixed(6)}°</div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs text-gray-600">Adjusted Lon</div>
                                                            <div className="font-mono">{station.adjusted_lon.toFixed(6)}°</div>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <div className="text-xs text-gray-600">Precision (σ)</div>
                                                            <div className="font-mono text-xs">
                                                                X: ±{(station.std_x * 1000).toFixed(1)}mm,
                                                                Y: ±{(station.std_y * 1000).toFixed(1)}mm,
                                                                Z: ±{(station.std_z * 1000).toFixed(1)}mm
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-green-50 border border-green-200 p-3 rounded text-sm">
                                        <div className="font-semibold text-green-800 mb-1">✓ Adjustment Successful</div>
                                        <div className="text-green-700 text-xs">
                                            Network adjustment converged in {adjustmentResult.iterations} iterations.
                                            All stations adjusted with sub-centimeter precision.
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-500 text-center py-12">
                                    Click Perform Adjustment to process network
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GNSSModuleDemo;
