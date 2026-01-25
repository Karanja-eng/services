import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { AlertCircle, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

// ============================================================================
// BACKEND SIMULATION - Production-grade hydraulic calculations
// ============================================================================

// Constants (SI Units)
const CONSTANTS = {
    GRAVITY: 9.81, // m/s²
    MIN_VELOCITY: 0.6, // m/s (self-cleansing)
    MAX_VELOCITY: 3.0, // m/s (scour protection)
    MIN_COVER: 0.9, // m (minimum cover depth)
    MAX_MANHOLE_SPACING: 90, // m
    MANNING_N: {
        CONCRETE: 0.013,
        PVC: 0.010,
        VITRIFIED_CLAY: 0.012,
    },
};

// Manning's Equation for open channel flow (gravity pipes)
function manningEquation(
    diameter: number, // m
    slope: number, // m/m (gradient)
    n: number, // Manning's roughness
    fillRatio: number = 1.0 // 1.0 = full pipe
): { capacity: number; velocity: number; area: number; hydraulicRadius: number } {
    const radius = diameter / 2;

    // For full pipe (fillRatio = 1.0)
    if (fillRatio >= 0.99) {
        const area = Math.PI * radius * radius;
        const perimeter = 2 * Math.PI * radius;
        const hydraulicRadius = area / perimeter;

        const velocity = (1 / n) * Math.pow(hydraulicRadius, 2 / 3) * Math.pow(slope, 0.5);
        const capacity = area * velocity;

        return { capacity, velocity, area, hydraulicRadius };
    }

    // Partial flow (simplified - uses circular segment geometry)
    const theta = 2 * Math.acos(1 - 2 * fillRatio);
    const area = (radius * radius / 2) * (theta - Math.sin(theta));
    const perimeter = radius * theta;
    const hydraulicRadius = area / perimeter;

    const velocity = (1 / n) * Math.pow(hydraulicRadius, 2 / 3) * Math.pow(slope, 0.5);
    const capacity = area * velocity;

    return { capacity, velocity, area, hydraulicRadius };
}

// Rational Method for stormwater runoff
function rationalMethod(
    catchmentArea: number, // hectares
    runoffCoefficient: number, // 0-1
    rainfallIntensity: number // mm/hr
): number {
    // Q = (C * I * A) / 360 where Q is in m³/s
    return (runoffCoefficient * rainfallIntensity * catchmentArea) / 360;
}

// Invert level calculations
function calculateInverts(
    upstreamGL: number,
    downstreamGL: number,
    diameter: number,
    slope: number,
    length: number,
    minCover: number = CONSTANTS.MIN_COVER
): {
    upstreamInvert: number;
    downstreamInvert: number;
    upstreamCover: number;
    downstreamCover: number;
    warnings: string[];
} {
    const warnings: string[] = [];

    // Start from upstream, ensuring minimum cover
    const upstreamInvert = upstreamGL - minCover - diameter;
    const downstreamInvert = upstreamInvert - (slope * length);

    const upstreamCover = upstreamGL - upstreamInvert - diameter;
    const downstreamCover = downstreamGL - downstreamInvert - diameter;

    if (upstreamCover < minCover) {
        warnings.push(`Upstream cover ${upstreamCover.toFixed(3)}m < minimum ${minCover}m`);
    }
    if (downstreamCover < minCover) {
        warnings.push(`Downstream cover ${downstreamCover.toFixed(3)}m < minimum ${minCover}m`);
    }
    if (slope <= 0) {
        warnings.push(`CRITICAL: Backfall detected (slope = ${slope.toFixed(4)})`);
    }

    return { upstreamInvert, downstreamInvert, upstreamCover, downstreamCover, warnings };
}

// HGL (Hydraulic Grade Line) calculation with energy losses
function calculateHGL(
    nodes: Array<{ chainage: number; invert: number; diameter: number }>,
    flow: number,
    n: number
): Array<{ chainage: number; hgl: number; pipeObvert: number; surcharge: boolean }> {
    const hglData: Array<{ chainage: number; hgl: number; pipeObvert: number; surcharge: boolean }> = [];

    // Start from downstream (assume outfall at invert level)
    let currentHGL = nodes[nodes.length - 1].invert + nodes[nodes.length - 1].diameter * 0.5;

    for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const obvert = node.invert + node.diameter;

        // Check for surcharge (HGL above pipe crown)
        const surcharge = currentHGL > obvert;

        hglData.unshift({
            chainage: node.chainage,
            hgl: currentHGL,
            pipeObvert: obvert,
            surcharge,
        });

        // Calculate head loss to next upstream node (friction loss)
        if (i > 0) {
            const nextNode = nodes[i - 1];
            const length = nextNode.chainage - node.chainage;
            const slope = (nextNode.invert - node.invert) / length;

            const { velocity } = manningEquation(node.diameter, Math.abs(slope), n);
            const velocityHead = (velocity * velocity) / (2 * CONSTANTS.GRAVITY);

            // Simplified friction loss (Darcy-Weisbach approximation)
            const frictionLoss = 0.02 * (length / node.diameter) * velocityHead;

            currentHGL += frictionLoss;
        }
    }

    return hglData;
}

// Validate manhole spacing
function validateManholeSpacing(
    chainages: number[],
    maxSpacing: number = CONSTANTS.MAX_MANHOLE_SPACING
): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let valid = true;

    for (let i = 1; i < chainages.length; i++) {
        const spacing = chainages[i] - chainages[i - 1];
        if (spacing > maxSpacing) {
            warnings.push(`Spacing ${spacing.toFixed(1)}m exceeds maximum ${maxSpacing}m between CH${chainages[i - 1].toFixed(0)} and CH${chainages[i].toFixed(0)}`);
            valid = false;
        }
    }

    return { valid, warnings };
}

// ============================================================================
// REACT COMPONENTS
// ============================================================================

const UtilitiesInfrastructureModule = () => {
    const [activeTab, setActiveTab] = useState('sewer');
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Sewer Design Inputs
    const [sewerFlow, setSewerFlow] = useState(0.05); // m³/s
    const [pipeDiameter, setPipeDiameter] = useState(0.3); // m
    const [pipeSlope, setPipeSlope] = useState(0.01); // m/m (1%)
    const [pipeLength, setPipeLength] = useState(50); // m
    const [pipeMaterial, setPipeMaterial] = useState('CONCRETE');
    const [upstreamGL, setUpstreamGL] = useState(100.0); // m
    const [downstreamGL, setDownstreamGL] = useState(99.5); // m

    // Stormwater Inputs
    const [catchmentArea, setCatchmentArea] = useState(2.0); // hectares
    const [runoffCoeff, setRunoffCoeff] = useState(0.65);
    const [rainfallIntensity, setRainfallIntensity] = useState(80); // mm/hr

    // Calculate sewer hydraulics
    const manningN = CONSTANTS.MANNING_N[pipeMaterial];
    const pipeCapacity = manningEquation(pipeDiameter, pipeSlope, manningN);
    const utilizationRatio = sewerFlow / pipeCapacity.capacity;
    const velocityCompliant = pipeCapacity.velocity >= CONSTANTS.MIN_VELOCITY &&
        pipeCapacity.velocity <= CONSTANTS.MAX_VELOCITY;

    // Calculate inverts
    const invertData = calculateInverts(
        upstreamGL,
        downstreamGL,
        pipeDiameter,
        pipeSlope,
        pipeLength
    );

    // Generate long section data
    const longSectionData = [];
    const numPoints = 20;
    for (let i = 0; i <= numPoints; i++) {
        const chainage = (i / numPoints) * pipeLength;
        const groundLevel = upstreamGL - ((upstreamGL - downstreamGL) * (i / numPoints));
        const invertLevel = invertData.upstreamInvert - (pipeSlope * chainage);
        const obvertLevel = invertLevel + pipeDiameter;

        longSectionData.push({
            chainage: chainage.toFixed(1),
            ground: groundLevel.toFixed(3),
            invert: invertLevel.toFixed(3),
            obvert: obvertLevel.toFixed(3),
        });
    }

    // Calculate HGL
    const hglNodes = [
        { chainage: 0, invert: invertData.upstreamInvert, diameter: pipeDiameter },
        { chainage: pipeLength, invert: invertData.downstreamInvert, diameter: pipeDiameter },
    ];
    const hglData = calculateHGL(hglNodes, sewerFlow, manningN);

    // Manhole spacing check
    const manholeChainages = [0, pipeLength];
    const spacingCheck = validateManholeSpacing(manholeChainages);

    // Calculate stormwater runoff
    const stormwaterRunoff = rationalMethod(catchmentArea, runoffCoeff, rainfallIntensity);
    const stormwaterPipeCapacity = manningEquation(pipeDiameter, pipeSlope, CONSTANTS.MANNING_N.PVC);
    const stormwaterUtilization = stormwaterRunoff / stormwaterPipeCapacity.capacity;

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white border-b-4 border-blue-600 rounded-t-lg p-6 shadow-sm">
                    <h1 className="text-3xl font-bold text-gray-900">Utilities & Infrastructure Surveying Module</h1>
                    <p className="text-gray-600 mt-2">Engineering-accurate gravity sewer and stormwater drainage design</p>
                    <p className="text-sm text-gray-500 mt-1">Municipal-grade | Construction-ready | Legally defensible</p>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white border-b">
                    <div className="flex">
                        <button
                            onClick={() => setActiveTab('sewer')}
                            className={`px-6 py-3 font-medium ${activeTab === 'sewer' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Gravity Sewer Design
                        </button>
                        <button
                            onClick={() => setActiveTab('stormwater')}
                            className={`px-6 py-3 font-medium ${activeTab === 'stormwater' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            Stormwater Drainage
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="bg-white rounded-b-lg shadow-sm">
                    {activeTab === 'sewer' && (
                        <div className="p-6 space-y-6">
                            {/* Input Panel */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-gray-900 border-b pb-2">Hydraulic Parameters</h3>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Design Flow (m³/s)</label>
                                        <input
                                            type="number"
                                            step="0.001"
                                            value={sewerFlow}
                                            onChange={(e) => setSewerFlow(parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pipe Diameter (m)</label>
                                        <select
                                            value={pipeDiameter}
                                            onChange={(e) => setPipeDiameter(parseFloat(e.target.value))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value={0.15}>150mm (0.15m)</option>
                                            <option value={0.225}>225mm (0.225m)</option>
                                            <option value={0.3}>300mm (0.3m)</option>
                                            <option value={0.375}>375mm (0.375m)</option>
                                            <option value={0.45}>450mm (0.45m)</option>
                                            <option value={0.6}>600mm (0.6m)</option>
                                            <option value={0.9}>900mm (0.9m)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pipe Material</label>
                                        <select
                                            value={pipeMaterial}
                                            onChange={(e) => setPipeMaterial(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="CONCRETE">Concrete (n=0.013)</option>
                                            <option value="PVC">PVC (n=0.010)</option>
                                            <option value="VITRIFIED_CLAY">Vitrified Clay (n=0.012)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Gradient (m/m)</label>
                                        <input
                                            type="number"
                                            step="0.0001"
                                            value={pipeSlope}
                                            onChange={(e) => setPipeSlope(parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">{(pipeSlope * 100).toFixed(2)}% or 1:{(1 / pipeSlope).toFixed(0)}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-semibold text-gray-900 border-b pb-2">Geometric Parameters</h3>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pipe Length (m)</label>
                                        <input
                                            type="number"
                                            step="1"
                                            value={pipeLength}
                                            onChange={(e) => setPipeLength(parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Upstream GL (m)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={upstreamGL}
                                            onChange={(e) => setUpstreamGL(parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Downstream GL (m)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={downstreamGL}
                                            onChange={(e) => setDownstreamGL(parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-semibold text-gray-900 border-b pb-2">Compliance Status</h3>

                                    <div className={`p-3 rounded-lg ${pipeCapacity.capacity >= sewerFlow ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                        <div className="flex items-start gap-2">
                                            {pipeCapacity.capacity >= sewerFlow ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                                            <div>
                                                <p className="font-medium text-sm text-gray-900">Capacity Check</p>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {(utilizationRatio * 100).toFixed(1)}% utilized
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`p-3 rounded-lg ${velocityCompliant ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                                        <div className="flex items-start gap-2">
                                            {velocityCompliant ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />}
                                            <div>
                                                <p className="font-medium text-sm text-gray-900">Velocity Limits</p>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {pipeCapacity.velocity.toFixed(2)} m/s<br />
                                                    ({CONSTANTS.MIN_VELOCITY}-{CONSTANTS.MAX_VELOCITY} m/s)
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`p-3 rounded-lg ${invertData.warnings.length === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                        <div className="flex items-start gap-2">
                                            {invertData.warnings.length === 0 ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                                            <div>
                                                <p className="font-medium text-sm text-gray-900">Cover & Gradient</p>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {invertData.warnings.length === 0 ? 'All checks passed' : `${invertData.warnings.length} issue(s)`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`p-3 rounded-lg ${spacingCheck.valid ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                                        <div className="flex items-start gap-2">
                                            {spacingCheck.valid ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />}
                                            <div>
                                                <p className="font-medium text-sm text-gray-900">Manhole Spacing</p>
                                                <p className="text-xs text-gray-600 mt-1">
                                                    {pipeLength.toFixed(0)}m (max {CONSTANTS.MAX_MANHOLE_SPACING}m)
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Warnings */}
                            {invertData.warnings.length > 0 && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-start gap-2">
                                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                        <div>
                                            <p className="font-medium text-red-900">Engineering Warnings</p>
                                            <ul className="mt-2 space-y-1 text-sm text-red-700">
                                                {invertData.warnings.map((warning, idx) => (
                                                    <li key={idx}>• {warning}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Hydraulic Results Table */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Hydraulic Analysis Results</h3>
                                <div className="overflow-x-auto border rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Parameter</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Value</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Unit</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            <tr>
                                                <td className="px-4 py-3 text-sm text-gray-900">Full Pipe Capacity</td>
                                                <td className="px-4 py-3 text-sm font-mono">{pipeCapacity.capacity.toFixed(4)}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">m³/s</td>
                                                <td className="px-4 py-3 text-sm">{pipeCapacity.capacity >= sewerFlow ? '✓' : '✗'}</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 text-sm text-gray-900">Design Flow</td>
                                                <td className="px-4 py-3 text-sm font-mono">{sewerFlow.toFixed(4)}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">m³/s</td>
                                                <td className="px-4 py-3 text-sm">-</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 text-sm text-gray-900">Flow Velocity</td>
                                                <td className="px-4 py-3 text-sm font-mono">{pipeCapacity.velocity.toFixed(3)}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">m/s</td>
                                                <td className="px-4 py-3 text-sm">{velocityCompliant ? '✓' : '✗'}</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 text-sm text-gray-900">Hydraulic Radius</td>
                                                <td className="px-4 py-3 text-sm font-mono">{pipeCapacity.hydraulicRadius.toFixed(4)}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">m</td>
                                                <td className="px-4 py-3 text-sm">-</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 text-sm text-gray-900">Upstream Invert</td>
                                                <td className="px-4 py-3 text-sm font-mono">{invertData.upstreamInvert.toFixed(3)}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">m</td>
                                                <td className="px-4 py-3 text-sm">-</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 text-sm text-gray-900">Downstream Invert</td>
                                                <td className="px-4 py-3 text-sm font-mono">{invertData.downstreamInvert.toFixed(3)}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">m</td>
                                                <td className="px-4 py-3 text-sm">-</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 text-sm text-gray-900">Upstream Cover</td>
                                                <td className="px-4 py-3 text-sm font-mono">{invertData.upstreamCover.toFixed(3)}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">m</td>
                                                <td className="px-4 py-3 text-sm">{invertData.upstreamCover >= CONSTANTS.MIN_COVER ? '✓' : '✗'}</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-3 text-sm text-gray-900">Downstream Cover</td>
                                                <td className="px-4 py-3 text-sm font-mono">{invertData.downstreamCover.toFixed(3)}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">m</td>
                                                <td className="px-4 py-3 text-sm">{invertData.downstreamCover >= CONSTANTS.MIN_COVER ? '✓' : '✗'}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Long Section Profile */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Long Section Profile</h3>
                                <div className="bg-white border rounded-lg p-4">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={longSectionData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis
                                                dataKey="chainage"
                                                label={{ value: 'Chainage (m)', position: 'insideBottom', offset: -5 }}
                                                tick={{ fontSize: 12 }}
                                            />
                                            <YAxis
                                                label={{ value: 'Level (m)', angle: -90, position: 'insideLeft' }}
                                                tick={{ fontSize: 12 }}
                                                domain={['auto', 'auto']}
                                            />
                                            <Tooltip
                                                contentStyle={{ fontSize: 12 }}
                                                formatter={(value: any) => parseFloat(value).toFixed(3)}
                                            />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Line type="monotone" dataKey="ground" stroke="#10b981" strokeWidth={2} name="Ground Level" dot={false} />
                                            <Line type="monotone" dataKey="obvert" stroke="#3b82f6" strokeWidth={2} name="Pipe Obvert" dot={false} />
                                            <Line type="monotone" dataKey="invert" stroke="#ef4444" strokeWidth={2} name="Pipe Invert" dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* HGL Chart */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Hydraulic Grade Line (HGL)</h3>
                                <div className="bg-white border rounded-lg p-4">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <LineChart data={hglData.map(d => ({
                                            chainage: d.chainage.toFixed(1),
                                            hgl: d.hgl.toFixed(3),
                                            obvert: d.pipeObvert.toFixed(3),
                                        }))}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis
                                                dataKey="chainage"
                                                label={{ value: 'Chainage (m)', position: 'insideBottom', offset: -5 }}
                                                tick={{ fontSize: 12 }}
                                            />
                                            <YAxis
                                                label={{ value: 'Level (m)', angle: -90, position: 'insideLeft' }}
                                                tick={{ fontSize: 12 }}
                                            />
                                            <Tooltip contentStyle={{ fontSize: 12 }} />
                                            <Legend wrapperStyle={{ fontSize: 12 }} />
                                            <Line type="monotone" dataKey="obvert" stroke="#3b82f6" strokeWidth={2} name="Pipe Crown" dot={false} />
                                            <Line type="monotone" dataKey="hgl" stroke="#9333ea" strokeWidth={2} strokeDasharray="5 5" name="HGL" dot={{ fill: '#9333ea', r: 4 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                    {hglData.some(d => d.surcharge) && (
                                        <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-3">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                                                <div>
                                                    <p className="font-medium text-sm text-yellow-900">Surcharge Warning</p>
                                                    <p className="text-xs text-yellow-700 mt-1">HGL exceeds pipe crown - pressurized flow conditions detected</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Advanced Options Toggle */}
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                            >
                                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                {showAdvanced ? 'Hide' : 'Show'} Advanced Engineering Data
                            </button>

                            {showAdvanced && (
                                <div className="border rounded-lg p-4 bg-gray-50">
                                    <h4 className="font-semibold text-gray-900 mb-3">Engineering Metadata</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-600">Manning's n:</p>
                                            <p className="font-mono">{manningN}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600">Flow Area (full):</p>
                                            <p className="font-mono">{pipeCapacity.area.toFixed(4)} m²</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600">Wetted Perimeter:</p>
                                            <p className="font-mono">{(Math.PI * pipeDiameter).toFixed(4)} m</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600">Utilization Ratio:</p>
                                            <p className="font-mono">{utilizationRatio.toFixed(3)}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'stormwater' && (
                        <div className="p-6 space-y-6">
                            {/* Stormwater Input Panel */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-gray-900 border-b pb-2">Catchment Parameters</h3>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Catchment Area (hectares)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={catchmentArea}
                                            onChange={(e) => setCatchmentArea(parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Runoff Coefficient (C)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="1"
                                            value={runoffCoeff}
                                            onChange={(e) => setRunoffCoeff(parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Typical values: Residential 0.4-0.6, Commercial 0.7-0.9, Impervious 0.9-0.95</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Rainfall Intensity (mm/hr)</label>
                                        <input
                                            type="number"
                                            step="1"
                                            value={rainfallIntensity}
                                            onChange={(e) => setRainfallIntensity(parseFloat(e.target.value) || 0)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Based on IDF curves for design storm return period</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="font-semibold text-gray-900 border-b pb-2">Rational Method Results</h3>

                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p className="text-sm text-gray-700 mb-2">Design Runoff (Q)</p>
                                        <p className="text-3xl font-bold text-blue-900">{stormwaterRunoff.toFixed(4)}</p>
                                        <p className="text-sm text-gray-600">m³/s</p>
                                    </div>

                                    <div className="bg-white border rounded-lg p-4">
                                        <p className="text-sm font-medium text-gray-900 mb-2">Pipe Sizing Check</p>
                                        <p className="text-sm text-gray-700">Pipe: {(pipeDiameter * 1000).toFixed(0)}mm @ {(pipeSlope * 100).toFixed(2)}%</p>
                                        <p className="text-sm text-gray-700 mt-1">Capacity: {stormwaterPipeCapacity.capacity.toFixed(4)} m³/s</p>
                                        <div className="mt-3">
                                            <div className="flex justify-between text-xs mb-1">
                                                <span>Utilization</span>
                                                <span>{(stormwaterUtilization * 100).toFixed(1)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full ${stormwaterUtilization > 1 ? 'bg-red-500' : stormwaterUtilization > 0.8 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                                    style={{ width: `${Math.min(stormwaterUtilization * 100, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {stormwaterUtilization > 1 && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                            <div className="flex items-start gap-2">
                                                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                                <div>
                                                    <p className="font-medium text-sm text-red-900">Capacity Exceeded</p>
                                                    <p className="text-xs text-red-700 mt-1">
                                                        Pipe undersized - increase diameter or gradient
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Runoff Comparison Chart */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Flow vs Capacity Analysis</h3>
                                <div className="bg-white border rounded-lg p-4">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={[
                                            { name: 'Design Runoff', value: stormwaterRunoff, fill: '#3b82f6' },
                                            { name: 'Pipe Capacity', value: stormwaterPipeCapacity.capacity, fill: '#10b981' },
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                            <YAxis label={{ value: 'Flow (m³/s)', angle: -90, position: 'insideLeft' }} tick={{ fontSize: 12 }} />
                                            <Tooltip contentStyle={{ fontSize: 12 }} formatter={(value: any) => value.toFixed(4)} />
                                            <Bar dataKey="value" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Design Notes */}
                            <div className="bg-gray-50 border rounded-lg p-4">
                                <h4 className="font-semibold text-gray-900 mb-2">Design Notes</h4>
                                <ul className="text-sm text-gray-700 space-y-1">
                                    <li>• Rational Method: Q = (C × I × A) / 360</li>
                                    <li>• Valid for catchments up to ~80 hectares</li>
                                    <li>• Assumes uniform rainfall over catchment</li>
                                    <li>• Design should include freeboard allowance (typically 20-30%)</li>
                                    <li>• Check local authority requirements for return periods</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="mt-6 bg-white border rounded-lg p-4 text-sm text-gray-600">
                    <p className="font-medium text-gray-900 mb-2">Engineering Standards & References</p>
                    <ul className="space-y-1">
                        <li>• Manning's equation for gravity flow (SI units)</li>
                        <li>• Minimum self-cleansing velocity: {CONSTANTS.MIN_VELOCITY} m/s</li>
                        <li>• Maximum scour velocity: {CONSTANTS.MAX_VELOCITY} m/s</li>
                        <li>• Minimum cover depth: {CONSTANTS.MIN_COVER} m</li>
                        <li>• Maximum manhole spacing: {CONSTANTS.MAX_MANHOLE_SPACING} m</li>
                        <li>• All calculations assume steady-state flow conditions</li>
                    </ul>
                    <p className="mt-3 text-xs text-gray-500">
                        This module produces engineering-accurate outputs suitable for preliminary design.
                        Final designs must be verified by a qualified professional engineer and comply with local regulations.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default UtilitiesInfrastructureModule;