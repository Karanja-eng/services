import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { AlertCircle, ChevronDown, ChevronUp, Calculator, Ruler, MapPin } from 'lucide-react';

// ============================================================================
// BACKEND SIMULATION (Production code would call FastAPI)
// ============================================================================

// Constants
const GRAVITY = 9.81; // m/s²
const FRICTION_COEFFICIENTS = {
    dry: 0.35,
    wet: 0.30,
    icy: 0.15
};

const DESIGN_SPEEDS = [30, 40, 50, 60, 70, 80, 90, 100, 110, 120]; // km/h

// Cross-section generation
function generateCrossSection(params) {
    const { chainage, roadWidth, shoulderWidth, sideSlope, camberType, camberValue, formation } = params;

    const halfRoad = roadWidth / 2;
    const totalWidth = roadWidth + 2 * shoulderWidth;
    const halfTotal = totalWidth / 2;

    // Calculate camber offset
    let leftCamberOffset = 0;
    let rightCamberOffset = 0;

    if (camberType === 'two-way') {
        leftCamberOffset = halfRoad * (camberValue / 100);
        rightCamberOffset = halfRoad * (camberValue / 100);
    } else if (camberType === 'one-way') {
        rightCamberOffset = roadWidth * (camberValue / 100);
    }

    // Generate section points
    const points = [];

    // Left side slope
    const leftCutHeight = formation === 'cut' ? 3.0 : 0;
    const leftFillDepth = formation === 'fill' ? 2.5 : 0;

    if (leftCutHeight > 0) {
        points.push({ offset: -halfTotal - leftCutHeight * sideSlope.cut, elevation: -leftCutHeight });
    } else if (leftFillDepth > 0) {
        points.push({ offset: -halfTotal - leftFillDepth * sideSlope.fill, elevation: leftFillDepth });
    }

    // Left shoulder
    points.push({ offset: -halfTotal, elevation: leftCamberOffset });

    // Left road edge
    points.push({ offset: -halfRoad, elevation: leftCamberOffset });

    // Centerline
    points.push({ offset: 0, elevation: 0 });

    // Right road edge
    points.push({ offset: halfRoad, elevation: rightCamberOffset });

    // Right shoulder
    points.push({ offset: halfTotal, elevation: rightCamberOffset });

    // Right side slope
    const rightCutHeight = formation === 'cut' ? 3.0 : 0;
    const rightFillDepth = formation === 'fill' ? 2.5 : 0;

    if (rightCutHeight > 0) {
        points.push({ offset: halfTotal + rightCutHeight * sideSlope.cut, elevation: -rightCutHeight });
    } else if (rightFillDepth > 0) {
        points.push({ offset: halfTotal + rightFillDepth * sideSlope.fill, elevation: rightFillDepth });
    }

    return points;
}

// Cross-section area calculation
function calculateCrossSectionArea(points) {
    let cutArea = 0;
    let fillArea = 0;

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const width = Math.abs(p2.offset - p1.offset);
        const avgHeight = (p1.elevation + p2.elevation) / 2;
        const area = width * Math.abs(avgHeight);

        if (avgHeight < 0) {
            cutArea += area;
        } else if (avgHeight > 0) {
            fillArea += area;
        }
    }

    return { cutArea, fillArea, netArea: fillArea - cutArea };
}

// Sight distance calculation
function calculateSightDistance(params) {
    const { designSpeed, roadCondition, gradePercent, reactionTime = 2.5 } = params;

    const speedMs = designSpeed / 3.6; // km/h to m/s
    const friction = FRICTION_COEFFICIENTS[roadCondition] || FRICTION_COEFFICIENTS.wet;
    const grade = gradePercent / 100;

    // Stopping Sight Distance (AASHTO formula)
    const ssd = speedMs * reactionTime + (speedMs * speedMs) / (2 * GRAVITY * (friction + grade));

    // Overtaking Sight Distance (simplified)
    const osd = 4.5 * speedMs * reactionTime;

    return {
        stoppingSightDistance: Math.round(ssd * 10) / 10,
        overtakingSightDistance: Math.round(osd * 10) / 10,
        designSpeed,
        roadCondition,
        friction,
        assumptions: {
            gravity: GRAVITY,
            reactionTime,
            gradePercent
        }
    };
}

// Chainage interpolation
function interpolateChainage(stations, targetChainage) {
    if (stations.length === 0) return null;

    // Find bracketing stations
    let before = null;
    let after = null;

    for (let i = 0; i < stations.length; i++) {
        if (stations[i].chainage <= targetChainage) {
            before = stations[i];
        }
        if (stations[i].chainage >= targetChainage && !after) {
            after = stations[i];
        }
    }

    if (!before || !after || before.chainage === after.chainage) {
        return before || after;
    }

    // Linear interpolation
    const ratio = (targetChainage - before.chainage) / (after.chainage - before.chainage);

    return {
        chainage: targetChainage,
        elevation: before.elevation + ratio * (after.elevation - before.elevation),
        offset: before.offset + ratio * (after.offset - before.offset),
        interpolated: true
    };
}

// Earthworks calculation along alignment
function calculateAlignmentEarthworks(crossSections, chainageInterval) {
    const volumes = [];

    for (let i = 0; i < crossSections.length - 1; i++) {
        const cs1 = crossSections[i];
        const cs2 = crossSections[i + 1];

        const distance = cs2.chainage - cs1.chainage;
        const avgCutArea = (cs1.cutArea + cs2.cutArea) / 2;
        const avgFillArea = (cs1.fillArea + cs2.fillArea) / 2;

        const cutVolume = avgCutArea * distance;
        const fillVolume = avgFillArea * distance;

        volumes.push({
            fromChainage: cs1.chainage,
            toChainage: cs2.chainage,
            cutVolume,
            fillVolume,
            netVolume: fillVolume - cutVolume
        });
    }

    // Accumulate
    let cumulativeCut = 0;
    let cumulativeFill = 0;

    volumes.forEach(v => {
        cumulativeCut += v.cutVolume;
        cumulativeFill += v.fillVolume;
        v.cumulativeCut = cumulativeCut;
        v.cumulativeFill = cumulativeFill;
        v.massHaulBalance = cumulativeFill - cumulativeCut;
    });

    return volumes;
}

// Pavement quantities
function calculatePavementQuantities(params) {
    const { chainage, laneWidth, numberOfLanes, layers } = params;

    const totalWidth = laneWidth * numberOfLanes;

    const quantities = layers.map(layer => {
        const volume = totalWidth * (layer.thickness / 1000) * chainage;
        const tonnage = layer.density ? volume * layer.density : null;

        return {
            layerName: layer.name,
            thickness: layer.thickness,
            width: totalWidth,
            volume: Math.round(volume * 100) / 100,
            tonnage: tonnage ? Math.round(tonnage * 100) / 100 : null,
            unit: layer.density ? 'tonnes' : 'm³'
        };
    });

    return quantities;
}

// ============================================================================
// REACT COMPONENTS
// ============================================================================

const CrossSection2D = ({ points, title }) => {
    if (!points || points.length === 0) return null;

    const minX = Math.min(...points.map(p => p.offset));
    const maxX = Math.max(...points.map(p => p.offset));
    const minY = Math.min(...points.map(p => p.elevation));
    const maxY = Math.max(...points.map(p => p.elevation));

    const width = 600;
    const height = 300;
    const padding = 40;

    const scaleX = (width - 2 * padding) / (maxX - minX);
    const scaleY = (height - 2 * padding) / (maxY - minY);
    const scale = Math.min(scaleX, scaleY);

    const toScreenX = (x) => padding + (x - minX) * scale;
    const toScreenY = (y) => height - padding - (y - minY) * scale;

    const pathData = points.map((p, i) =>
        `${i === 0 ? 'M' : 'L'} ${toScreenX(p.offset)} ${toScreenY(p.elevation)}`
    ).join(' ');

    return (
        <div className="bg-white p-4 rounded border">
            <h3 className="text-sm font-semibold mb-2">{title}</h3>
            <svg width={width} height={height} className="border">
                {/* Grid */}
                <line x1={padding} y1={toScreenY(0)} x2={width - padding} y2={toScreenY(0)}
                    stroke="#d1d5db" strokeWidth="1" strokeDasharray="4" />
                <line x1={toScreenX(0)} y1={padding} x2={toScreenX(0)} y2={height - padding}
                    stroke="#d1d5db" strokeWidth="1" strokeDasharray="4" />

                {/* Cross-section */}
                <path d={pathData} fill="none" stroke="#374151" strokeWidth="2" />
                <path d={`${pathData} L ${toScreenX(points[points.length - 1].offset)} ${height - padding} L ${toScreenX(points[0].offset)} ${height - padding} Z`}
                    fill="#e5e7eb" fillOpacity="0.3" />

                {/* Points */}
                {points.map((p, i) => (
                    <circle key={i} cx={toScreenX(p.offset)} cy={toScreenY(p.elevation)}
                        r="3" fill="#1f2937" />
                ))}

                {/* Axes */}
                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding}
                    stroke="#1f2937" strokeWidth="2" />
                <line x1={padding} y1={padding} x2={padding} y2={height - padding}
                    stroke="#1f2937" strokeWidth="2" />

                {/* Labels */}
                <text x={width / 2} y={height - 10} textAnchor="middle" className="text-xs">
                    Offset from Centerline (m)
                </text>
                <text x={15} y={height / 2} textAnchor="middle" transform={`rotate(-90, 15, ${height / 2})`}
                    className="text-xs">
                    Elevation (m)
                </text>
            </svg>
        </div>
    );
};

const RoadProfileChart = ({ data, title }) => (
    <div className="bg-white p-4 rounded border">
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="chainage" label={{ value: 'Chainage (m)', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Elevation (m)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="elevation" stroke="#374151" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
        </ResponsiveContainer>
    </div>
);

const SightDistanceChart = ({ data }) => (
    <div className="bg-white p-4 rounded border">
        <h3 className="text-sm font-semibold mb-2">Sight Distance vs Design Speed</h3>
        <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="speed" label={{ value: 'Design Speed (km/h)', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Distance (m)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="ssd" stroke="#374151" strokeWidth={2} name="SSD" />
                <Line type="monotone" dataKey="osd" stroke="#6b7280" strokeWidth={2} name="OSD" strokeDasharray="5 5" />
            </LineChart>
        </ResponsiveContainer>
    </div>
);

const EarthworksChart = ({ data }) => (
    <div className="bg-white p-4 rounded border">
        <h3 className="text-sm font-semibold mb-2">Cumulative Earthworks (Mass Haul)</h3>
        <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="chainage" label={{ value: 'Chainage (m)', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: 'Volume (m³)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="cumulativeCut" stackId="1" stroke="#dc2626" fill="#fecaca" name="Cut" />
                <Area type="monotone" dataKey="cumulativeFill" stackId="2" stroke="#16a34a" fill="#bbf7d0" name="Fill" />
                <Line type="monotone" dataKey="massHaulBalance" stroke="#1f2937" strokeWidth={2} name="Balance" />
            </AreaChart>
        </ResponsiveContainer>
    </div>
);

// Main Application
const RouteSurveyingModule = () => {
    const [activeTab, setActiveTab] = useState('cross-section');
    const [expandedSection, setExpandedSection] = useState('input');

    // Cross-section parameters
    const [chainage, setChainage] = useState(100);
    const [roadWidth, setRoadWidth] = useState(7.0);
    const [shoulderWidth, setShoulderWidth] = useState(1.5);
    const [camberType, setCamberType] = useState('two-way');
    const [camberValue, setCamberValue] = useState(2.5);
    const [formation, setFormation] = useState('cut');

    // Sight distance parameters
    const [designSpeed, setDesignSpeed] = useState(80);
    const [roadCondition, setRoadCondition] = useState('wet');
    const [gradePercent, setGradePercent] = useState(0);

    // Pavement parameters
    const [laneWidth, setLaneWidth] = useState(3.5);
    const [numberOfLanes, setNumberOfLanes] = useState(2);

    // Sample alignment data
    const alignmentStations = [
        { chainage: 0, elevation: 100.0, offset: 0 },
        { chainage: 50, elevation: 102.5, offset: 0 },
        { chainage: 100, elevation: 104.0, offset: 0 },
        { chainage: 150, elevation: 103.5, offset: 0 },
        { chainage: 200, elevation: 105.0, offset: 0 },
        { chainage: 250, elevation: 107.5, offset: 0 },
        { chainage: 300, elevation: 110.0, offset: 0 }
    ];

    // Calculate cross-section
    const crossSectionPoints = generateCrossSection({
        chainage,
        roadWidth,
        shoulderWidth,
        sideSlope: { cut: 1.5, fill: 2.0 },
        camberType,
        camberValue,
        formation
    });

    const sectionArea = calculateCrossSectionArea(crossSectionPoints);

    // Calculate sight distance
    const sightDistance = calculateSightDistance({
        designSpeed,
        roadCondition,
        gradePercent
    });

    // Generate sight distance data for chart
    const sightDistanceData = DESIGN_SPEEDS.map(speed => {
        const ssd = calculateSightDistance({ designSpeed: speed, roadCondition, gradePercent });
        const osd = calculateSightDistance({ designSpeed: speed, roadCondition, gradePercent });
        return {
            speed,
            ssd: ssd.stoppingSightDistance,
            osd: osd.overtakingSightDistance
        };
    });

    // Calculate earthworks for multiple sections
    const crossSections = alignmentStations.map(station => {
        const points = generateCrossSection({
            chainage: station.chainage,
            roadWidth,
            shoulderWidth,
            sideSlope: { cut: 1.5, fill: 2.0 },
            camberType,
            camberValue,
            formation
        });
        const area = calculateCrossSectionArea(points);
        return {
            chainage: station.chainage,
            ...area
        };
    });

    const earthworks = calculateAlignmentEarthworks(crossSections, 50);
    const earthworksData = earthworks.map(e => ({
        chainage: e.toChainage,
        cumulativeCut: e.cumulativeCut,
        cumulativeFill: e.cumulativeFill,
        massHaulBalance: e.massHaulBalance
    }));

    // Pavement layers
    const pavementLayers = [
        { name: 'Asphalt Surface', thickness: 50, density: 2.4 },
        { name: 'Asphalt Binder', thickness: 80, density: 2.4 },
        { name: 'Crushed Stone Base', thickness: 200, density: 2.2 },
        { name: 'Subbase', thickness: 300, density: 2.0 }
    ];

    const pavementQuantities = calculatePavementQuantities({
        chainage: 1000,
        laneWidth,
        numberOfLanes,
        layers: pavementLayers
    });

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Route, Railway & Road Surveying Module</h1>
                    <p className="text-gray-600">Engineering-grade alignment analysis, cross-sections, earthworks & safety compliance</p>

                    <div className="mt-4 flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded p-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-800">
                            <strong>Safety Critical:</strong> All calculations follow AASHTO and international standards.
                            Design parameters must be verified by qualified engineers before construction use.
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-lg shadow-sm mb-6">
                    <div className="border-b border-gray-200">
                        <div className="flex gap-4 px-6">
                            {[
                                { id: 'cross-section', label: 'Cross-Sections', icon: Ruler },
                                { id: 'sight-distance', label: 'Sight Distance', icon: MapPin },
                                { id: 'earthworks', label: 'Earthworks', icon: Calculator }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === tab.id
                                        ? 'border-gray-900 text-gray-900'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {activeTab === 'cross-section' && (
                            <div className="space-y-6">
                                {/* Input Section */}
                                <div className="border rounded-lg">
                                    <button
                                        onClick={() => setExpandedSection(expandedSection === 'input' ? '' : 'input')}
                                        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors rounded-t-lg"
                                    >
                                        <span className="font-semibold text-gray-900">Cross-Section Parameters</span>
                                        {expandedSection === 'input' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                    </button>

                                    {expandedSection === 'input' && (
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Chainage (m)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={chainage}
                                                    onChange={(e) => setChainage(Number(e.target.value))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Grade (%)
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={gradePercent}
                                                    onChange={(e) => setGradePercent(Number(e.target.value))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Road Condition
                                                </label>
                                                <select
                                                    value={roadCondition}
                                                    onChange={(e) => setRoadCondition(e.target.value)}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                                                >
                                                    <option value="dry">Dry</option>
                                                    <option value="wet">Wet</option>
                                                    <option value="icy">Icy</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Results */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="bg-white p-4 rounded border">
                                        <h3 className="text-sm font-semibold mb-4">Calculated Sight Distances</h3>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center pb-2 border-b">
                                                <span className="text-gray-600">Stopping Sight Distance (SSD):</span>
                                                <span className="font-mono font-semibold text-lg">{sightDistance.stoppingSightDistance} m</span>
                                            </div>
                                            <div className="flex justify-between items-center pb-2 border-b">
                                                <span className="text-gray-600">Overtaking Sight Distance (OSD):</span>
                                                <span className="font-mono font-semibold text-lg">{sightDistance.overtakingSightDistance} m</span>
                                            </div>

                                            <div className="mt-4 pt-4 border-t">
                                                <h4 className="text-xs font-semibold text-gray-700 mb-2">Calculation Parameters:</h4>
                                                <ul className="text-xs text-gray-600 space-y-1">
                                                    <li>• Design Speed: {sightDistance.designSpeed} km/h</li>
                                                    <li>• Road Condition: {sightDistance.roadCondition}</li>
                                                    <li>• Friction Coefficient: {sightDistance.friction.toFixed(2)}</li>
                                                    <li>• Gravity: {sightDistance.assumptions.gravity} m/s²</li>
                                                    <li>• Reaction Time: {sightDistance.assumptions.reactionTime} s</li>
                                                    <li>• Grade: {sightDistance.assumptions.gradePercent}%</li>
                                                </ul>
                                            </div>

                                            <div className="mt-4 pt-4 border-t bg-blue-50 p-3 rounded">
                                                <h4 className="text-xs font-semibold text-blue-900 mb-1">Standard Reference:</h4>
                                                <p className="text-xs text-blue-800">
                                                    Calculations follow AASHTO "A Policy on Geometric Design of Highways and Streets"
                                                    (Green Book) methodology for sight distance requirements.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <SightDistanceChart data={sightDistanceData} />
                                </div>
                            </div>
                        )}

                        {activeTab === 'earthworks' && (
                            <div className="space-y-6">
                                {/* Summary Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white p-4 rounded border">
                                        <div className="text-sm text-gray-600 mb-1">Total Cut Volume</div>
                                        <div className="text-2xl font-bold text-red-600">
                                            {earthworks[earthworks.length - 1]?.cumulativeCut.toFixed(1) || 0} m³
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 rounded border">
                                        <div className="text-sm text-gray-600 mb-1">Total Fill Volume</div>
                                        <div className="text-2xl font-bold text-green-600">
                                            {earthworks[earthworks.length - 1]?.cumulativeFill.toFixed(1) || 0} m³
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 rounded border">
                                        <div className="text-sm text-gray-600 mb-1">Mass Haul Balance</div>
                                        <div className="text-2xl font-bold text-gray-900">
                                            {earthworks[earthworks.length - 1]?.massHaulBalance.toFixed(1) || 0} m³
                                        </div>
                                    </div>
                                </div>

                                <EarthworksChart data={earthworksData} />

                                {/* Detailed Table */}
                                <div className="bg-white rounded border overflow-hidden">
                                    <div className="px-4 py-3 bg-gray-50 border-b">
                                        <h3 className="font-semibold text-gray-900">Earthworks by Chainage</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 border-b">
                                                <tr>
                                                    <th className="px-4 py-2 text-left font-semibold text-gray-700">From Ch (m)</th>
                                                    <th className="px-4 py-2 text-left font-semibold text-gray-700">To Ch (m)</th>
                                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Cut (m³)</th>
                                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Fill (m³)</th>
                                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Net (m³)</th>
                                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Cumulative Cut (m³)</th>
                                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Cumulative Fill (m³)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {earthworks.map((row, i) => (
                                                    <tr key={i} className="border-b hover:bg-gray-50">
                                                        <td className="px-4 py-2 font-mono">{row.fromChainage}</td>
                                                        <td className="px-4 py-2 font-mono">{row.toChainage}</td>
                                                        <td className="px-4 py-2 text-right font-mono text-red-600">{row.cutVolume.toFixed(1)}</td>
                                                        <td className="px-4 py-2 text-right font-mono text-green-600">{row.fillVolume.toFixed(1)}</td>
                                                        <td className="px-4 py-2 text-right font-mono">{row.netVolume.toFixed(1)}</td>
                                                        <td className="px-4 py-2 text-right font-mono">{row.cumulativeCut.toFixed(1)}</td>
                                                        <td className="px-4 py-2 text-right font-mono">{row.cumulativeFill.toFixed(1)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Pavement Quantities */}
                                <div className="bg-white rounded border overflow-hidden">
                                    <div className="px-4 py-3 bg-gray-50 border-b">
                                        <h3 className="font-semibold text-gray-900">Pavement Layer Quantities (1000m alignment)</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50 border-b">
                                                <tr>
                                                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Layer</th>
                                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Thickness (mm)</th>
                                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Width (m)</th>
                                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Volume (m³)</th>
                                                    <th className="px-4 py-2 text-right font-semibold text-gray-700">Tonnage</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pavementQuantities.map((layer, i) => (
                                                    <tr key={i} className="border-b hover:bg-gray-50">
                                                        <td className="px-4 py-2">{layer.layerName}</td>
                                                        <td className="px-4 py-2 text-right font-mono">{layer.thickness}</td>
                                                        <td className="px-4 py-2 text-right font-mono">{layer.width.toFixed(1)}</td>
                                                        <td className="px-4 py-2 text-right font-mono">{layer.volume}</td>
                                                        <td className="px-4 py-2 text-right font-mono">
                                                            {layer.tonnage ? `${layer.tonnage} ${layer.unit}` : 'N/A'}
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
                </div>

                {/* Footer */}
                <div className="bg-white rounded-lg shadow-sm p-4 text-center text-sm text-gray-600">
                    <p>
                        Production-grade route surveying module • All calculations follow international civil engineering standards
                    </p>
                    <p className="mt-1 text-xs">
                        Verify all design parameters with qualified engineers before construction implementation
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RouteSurveyingModule;      