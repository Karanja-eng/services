import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ReferenceLine } from 'recharts';
import { AlertTriangle, TrendingDown, TrendingUp, Activity, Maximize2 } from 'lucide-react';

// ==============================================================================
// DEFORMATION & MONITORING SURVEY MODULE - FRONTEND COMPONENTS
// ==============================================================================

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Real API client
const monitoringAPI = {
    async calculateSettlement(data) {
        try {
            const response = await fetch(`${API_URL}/monitoring_router/settlement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('API Error');
            return await response.json();
        } catch (error) {
            console.error('Settlement API Error:', error);
            throw error;
        }
    },

    async calculateDisplacement(data) {
        try {
            const response = await fetch(`${API_URL}/monitoring_router/displacement`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('API Error');
            return await response.json();
        } catch (error) {
            console.error('Displacement API Error:', error);
            throw error;
        }
    }
};

// ==============================================================================
// COMPONENT 1: EPOCH SELECTOR
// ==============================================================================

const EpochSelector = ({ epochs, onSelect, isDark }) => {
    const [reference, setReference] = useState(epochs[0]?.id || '');
    const [current, setCurrent] = useState(epochs[1]?.id || '');

    const handleApply = () => {
        if (reference && current && reference !== current) {
            onSelect(reference, current);
        }
    };

    return (
        <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border rounded p-4 shadow-sm`}>
            <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Epoch Selection</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                        Reference Epoch
                    </label>
                    <select
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        className={`w-full ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded px-3 py-2 text-sm outline-none focus:ring-1 ring-blue-500`}
                    >
                        {epochs.map(epoch => (
                            <option key={epoch.id} value={epoch.id}>
                                {epoch.id} - {new Date(epoch.timestamp).toLocaleDateString()}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'} mb-1`}>
                        Current Epoch
                    </label>
                    <select
                        value={current}
                        onChange={(e) => setCurrent(e.target.value)}
                        className={`w-full ${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} border rounded px-3 py-2 text-sm outline-none focus:ring-1 ring-blue-500`}
                    >
                        {epochs.map(epoch => (
                            <option key={epoch.id} value={epoch.id}>
                                {epoch.id} - {new Date(epoch.timestamp).toLocaleDateString()}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {reference && current && (
                <div className={`${isDark ? 'bg-gray-900/50' : 'bg-gray-50'} p-3 rounded text-sm mb-3 border ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                    <div className="grid grid-cols-2 gap-2 text-gray-500 dark:text-gray-400">
                        <div>
                            <span className="font-medium">Time Interval:</span>{' '}
                            <span className={isDark ? 'text-white' : 'text-gray-900'}>
                                {Math.round(
                                    (new Date(epochs.find(e => e.id === current)?.timestamp || '').getTime() -
                                        new Date(epochs.find(e => e.id === reference)?.timestamp || '').getTime()) /
                                    (1000 * 60 * 60 * 24)
                                )} days
                            </span>
                        </div>
                        <div>
                            <span className="font-medium">Points:</span>{' '}
                            <span className={isDark ? 'text-white' : 'text-gray-900'}>
                                {epochs.find(e => e.id === current)?.pointCount || 0}
                            </span>
                        </div>
                    </div>
                </div>
            )}
            <button
                onClick={handleApply}
                disabled={!reference || !current || reference === current}
                className={`w-full ${isDark ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-900 hover:bg-gray-800'} text-white px-4 py-2 rounded disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-all font-medium shadow-sm`}
            >
                Compare Epochs
            </button>
        </div>
    );
};

const SettlementChart = ({ data, pointId, warningThreshold = -10, criticalThreshold = -25, isDark }) => {
    return (
        <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border rounded p-4 shadow-sm transition-all`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Settlement Time-Series: {pointId}</h3>
                <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    <Activity className="w-4 h-4" />
                    <span className="font-mono">{data.length} epochs</span>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
                    <XAxis
                        dataKey="date"
                        stroke={isDark ? "#9ca3af" : "#6b7280"}
                        style={{ fontSize: '11px' }}
                    />
                    <YAxis
                        stroke={isDark ? "#9ca3af" : "#6b7280"}
                        style={{ fontSize: '11px' }}
                        label={{ value: 'Settlement (mm)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: '11px', fill: isDark ? '#9ca3af' : '#6b7280' } }}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: isDark ? '#1f2937' : '#f9fafb', border: `1px solid ${isDark ? '#374151' : '#d1d5db'}`, color: isDark ? '#fff' : '#000' }}
                        labelStyle={{ fontWeight: 'bold' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />

                    {/* Tolerance thresholds */}
                    <ReferenceLine y={warningThreshold} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Warning', position: 'right', style: { fontSize: '10px', fill: '#f59e0b' } }} />
                    <ReferenceLine y={criticalThreshold} stroke="#dc2626" strokeDasharray="5 5" label={{ value: 'Critical', position: 'right', style: { fontSize: '10px', fill: '#dc2626' } }} />

                    {/* Error band */}
                    <Area
                        type="monotone"
                        dataKey={(d) => d.settlement_mm + d.error_mm}
                        stroke="none"
                        fill={isDark ? "#4b5563" : "#d1d5db"}
                        fillOpacity={0.3}
                    />
                    <Area
                        type="monotone"
                        dataKey={(d) => d.settlement_mm - d.error_mm}
                        stroke="none"
                        fill={isDark ? "#111827" : "#ffffff"}
                        fillOpacity={1}
                    />

                    {/* Settlement line */}
                    <Line
                        type="monotone"
                        dataKey="settlement_mm"
                        stroke={isDark ? "#60a5fa" : "#1f2937"}
                        strokeWidth={2.5}
                        dot={{ fill: isDark ? "#60a5fa" : "#1f2937", r: 4 }}
                        name="Settlement"
                    />
                </AreaChart>
            </ResponsiveContainer>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className={`${isDark ? 'bg-gray-700/50' : 'bg-gray-50'} p-2 rounded transition-colors`}>
                    <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>Latest</div>
                    <div className={`font-mono font-semibold ${isDark ? 'text-blue-400' : 'text-gray-900'}`}>
                        {data[data.length - 1]?.settlement_mm.toFixed(2)} mm
                    </div>
                </div>
                <div className={`${isDark ? 'bg-gray-700/50' : 'bg-gray-50'} p-2 rounded transition-colors`}>
                    <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>Total Change</div>
                    <div className={`font-mono font-semibold ${isDark ? 'text-blue-400' : 'text-gray-900'}`}>
                        {(data[data.length - 1]?.settlement_mm - data[0]?.settlement_mm).toFixed(2)} mm
                    </div>
                </div>
                <div className={`${isDark ? 'bg-gray-700/50' : 'bg-gray-50'} p-2 rounded transition-colors`}>
                    <div className={isDark ? 'text-gray-400' : 'text-gray-600'}>Rate (last 30d)</div>
                    <div className={`font-mono font-semibold ${isDark ? 'text-blue-400' : 'text-gray-900'}`}>
                        -0.84 mm/day
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==============================================================================
// COMPONENT 3: TOLERANCE STATUS PANEL
// ==============================================================================

const ToleranceStatusPanel = ({ points, warningThreshold, criticalThreshold, isDark }) => {
    const criticalCount = points.filter(p => p.status === 'CRITICAL').length;
    const warningCount = points.filter(p => p.status === 'WARNING').length;
    const safeCount = points.filter(p => p.status === 'SAFE').length;

    const getStatusColor = (status) => {
        if (isDark) {
            switch (status) {
                case 'CRITICAL': return 'bg-red-900/30 border-red-500 text-red-100';
                case 'WARNING': return 'bg-yellow-900/30 border-yellow-500 text-yellow-100';
                case 'SAFE': return 'bg-green-900/30 border-green-500 text-green-100';
                default: return 'bg-gray-900/30 border-gray-500 text-gray-100';
            }
        }
        switch (status) {
            case 'CRITICAL': return 'bg-red-50 border-red-500 text-red-900';
            case 'WARNING': return 'bg-yellow-50 border-yellow-500 text-yellow-900';
            case 'SAFE': return 'bg-green-50 border-green-500 text-green-900';
            default: return 'bg-gray-50 border-gray-500 text-gray-900';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'CRITICAL': return <AlertTriangle className={`w-4 h-4 ${isDark ? 'text-red-400' : 'text-red-600'}`} />;
            case 'WARNING': return <TrendingDown className={`w-4 h-4 ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`} />;
            case 'SAFE': return <Activity className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} />;
            default: return null;
        }
    };

    return (
        <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border rounded p-4 shadow-sm h-full`}>
            <h3 className={`font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Tolerance Status</h3>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className={`${isDark ? 'bg-red-900/20 border-red-900/50' : 'bg-red-50 border-red-200'} border rounded p-2 text-center shadow-sm`}>
                    <div className={`text-2xl font-bold ${isDark ? 'text-red-400' : 'text-red-900'}`}>{criticalCount}</div>
                    <div className={`text-xs ${isDark ? 'text-red-500' : 'text-red-700'}`}>Critical</div>
                </div>
                <div className={`${isDark ? 'bg-yellow-900/20 border-yellow-900/50' : 'bg-yellow-50 border-yellow-200'} border rounded p-2 text-center shadow-sm`}>
                    <div className={`text-2xl font-bold ${isDark ? 'text-yellow-400' : 'text-yellow-900'}`}>{warningCount}</div>
                    <div className={`text-xs ${isDark ? 'text-yellow-500' : 'text-yellow-700'}`}>Warning</div>
                </div>
                <div className={`${isDark ? 'bg-green-900/20 border-green-900/50' : 'bg-green-50 border-green-200'} border rounded p-2 text-center shadow-sm`}>
                    <div className={`text-2xl font-bold ${isDark ? 'text-green-400' : 'text-green-900'}`}>{safeCount}</div>
                    <div className={`text-xs ${isDark ? 'text-green-500' : 'text-green-700'}`}>Safe</div>
                </div>
            </div>

            {/* Threshold Reference */}
            <div className={`${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-100'} border p-2 rounded mb-3 text-xs`}>
                <div className={`grid grid-cols-2 gap-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    <div><span className="font-medium">Warning:</span> <span className={isDark ? 'text-yellow-400' : 'text-yellow-600'}>{warningThreshold} mm</span></div>
                    <div><span className="font-medium">Critical:</span> <span className={isDark ? 'text-red-400' : 'text-red-600'}>{criticalThreshold} mm</span></div>
                </div>
            </div>

            {/* Point List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {points
                    .sort((a, b) => Math.abs(b.displacement_mm) - Math.abs(a.displacement_mm))
                    .map(point => (
                        <div
                            key={point.point_id}
                            className={`border-l-4 p-2 rounded shadow-sm transition-all hover:translate-x-1 ${getStatusColor(point.status)}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {getStatusIcon(point.status)}
                                    <span className="font-mono font-semibold text-sm">{point.point_id}</span>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono text-sm font-bold">
                                        {point.displacement_mm.toFixed(1)} mm
                                    </div>
                                    <div className="text-[10px] opacity-75 uppercase tracking-wider font-bold">
                                        {(point.threshold_ratio * 100).toFixed(0)}% limit
                                    </div>
                                </div>
                            </div>
                            {!point.is_significant && (
                                <div className="text-[10px] mt-1 opacity-75 italic">
                                    ⓘ Insignificant movement
                                </div>
                            )}
                        </div>
                    ))}
            </div>
        </div>
    );
};

// ==============================================================================
// COMPONENT 4: DISPLACEMENT VECTORS 2D (Simplified Canvas Demo)
// ==============================================================================

const DisplacementVectors2D = ({ points, scale, isDark }) => {
    const width = 600;
    const height = 400;
    const [exaggeration, setExaggeration] = useState(100);

    // Find bounds
    const xCoords = points.map(p => p.x);
    const yCoords = points.map(p => p.y);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const padding = 50;

    const toScreenX = (x) => padding + ((x - minX) / rangeX) * (width - 2 * padding);
    const toScreenY = (y) => height - padding - ((y - minY) / rangeY) * (height - 2 * padding);

    const getArrowColor = (status) => {
        switch (status) {
            case 'CRITICAL': return '#dc2626';
            case 'WARNING': return '#f59e0b';
            case 'SAFE': return '#10b981';
            default: return '#6b7280';
        }
    };

    return (
        <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border rounded p-4 shadow-sm h-full`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>2D Displacement Vectors</h3>
                <div className="flex items-center gap-3">
                    <label className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} flex items-center gap-2`}>
                        <Maximize2 className="w-3 h-3" />
                        Exaggeration: {exaggeration}×
                    </label>
                    <input
                        type="range"
                        min="1"
                        max="500"
                        value={exaggeration}
                        onChange={(e) => setExaggeration(Number(e.target.value))}
                        className={`w-32 accent-blue-600 h-1.5 rounded-lg appearance-none cursor-pointer ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
                    />
                </div>
            </div>

            <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'} border rounded shadow-inner`}>
                {/* Grid */}
                <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke={isDark ? "#1f2937" : "#e5e7eb"} strokeWidth="0.5" />
                    </pattern>
                </defs>
                <rect width={width} height={height} fill="url(#grid)" />

                {/* Points and vectors */}
                {points.map(point => {
                    const sx = toScreenX(point.x);
                    const sy = toScreenY(point.y);
                    const dx = (point.dx / scale) * exaggeration;
                    const dy = -(point.dy / scale) * exaggeration; // Flip Y for screen coords
                    const ex = sx + dx;
                    const ey = sy + dy;

                    // Arrow head
                    const angle = Math.atan2(dy, dx);
                    const arrowSize = 8;
                    const arrowAngle = Math.PI / 6;

                    return (
                        <g key={point.id}>
                            {/* Point */}
                            <circle
                                cx={sx}
                                cy={sy}
                                r={4}
                                fill={isDark ? "#60a5fa" : "#1f2937"}
                                stroke={isDark ? "#1f2937" : "#fff"}
                                strokeWidth={2}
                            />

                            {/* Vector arrow */}
                            {point.magnitude > 0.1 && (
                                <>
                                    <line
                                        x1={sx}
                                        y1={sy}
                                        x2={ex}
                                        y2={ey}
                                        stroke={getArrowColor(point.status)}
                                        strokeWidth={2}
                                        markerEnd="url(#arrowhead)"
                                    />
                                    {/* Arrow head */}
                                    <polygon
                                        points={`
                      ${ex},${ey}
                      ${ex - arrowSize * Math.cos(angle - arrowAngle)},${ey - arrowSize * Math.sin(angle - arrowAngle)}
                      ${ex - arrowSize * Math.cos(angle + arrowAngle)},${ey - arrowSize * Math.sin(angle + arrowAngle)}
                    `}
                                        fill={getArrowColor(point.status)}
                                    />
                                </>
                            )}

                            {/* Label */}
                            <text
                                x={sx}
                                y={sy - 12}
                                fontSize="10"
                                fontWeight="bold"
                                fontFamily="monospace"
                                fill={isDark ? "#9ca3af" : "#1f2937"}
                                textAnchor="middle"
                            >
                                {point.id}
                            </text>
                        </g>
                    );
                })}

                {/* Scale reference */}
                <g transform={`translate(${width - 100}, ${height - 30})`}>
                    <line x1={0} y1={0} x2={50} y2={0} stroke={isDark ? "#6b7280" : "#1f2937"} strokeWidth={2} />
                    <line x1={0} y1={-3} x2={0} y2={3} stroke={isDark ? "#6b7280" : "#1f2937"} strokeWidth={2} />
                    <line x1={50} y1={-3} x2={50} y2={3} stroke={isDark ? "#6b7280" : "#1f2937"} strokeWidth={2} />
                    <text x={25} y={15} fontSize="10" textAnchor="middle" fill={isDark ? "#9ca3af" : "#1f2937"}>
                        10 mm
                    </text>
                </g>
            </svg>

            <div className={`mt-3 flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                    <span>Safe</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                    <span>Warning</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    <span>Critical</span>
                </div>
            </div>
        </div>
    );
};

// ==============================================================================
// MAIN DEMO COMPONENT
// ==============================================================================

const MonitoringDashboard = ({ isDark }) => {
    const [activeView, setActiveView] = useState('settlement');

    // Mock data
    const epochs = [
        { id: 'E001', timestamp: '2024-01-15T10:00:00Z', pointCount: 24, surveyor: 'Team A' },
        { id: 'E002', timestamp: '2024-02-15T10:00:00Z', pointCount: 24, surveyor: 'Team A' },
        { id: 'E003', timestamp: '2024-03-15T10:00:00Z', pointCount: 24, surveyor: 'Team B' },
        { id: 'E004', timestamp: '2024-04-15T10:00:00Z', pointCount: 24, surveyor: 'Team A' },
    ];

    const settlementData = [
        { epoch: 'E001', date: '2024-01-15', settlement_mm: 0, error_mm: 2.5 },
        { epoch: 'E002', date: '2024-02-15', settlement_mm: -5.2, error_mm: 2.8 },
        { epoch: 'E003', date: '2024-03-15', settlement_mm: -12.8, error_mm: 2.9 },
        { epoch: 'E004', date: '2024-04-15', settlement_mm: -25.3, error_mm: 3.1 },
    ];

    const tolerancePoints = [
        { point_id: 'BM101', displacement_mm: 28.5, status: 'CRITICAL', threshold_ratio: 1.14, is_significant: true },
        { point_id: 'BM102', displacement_mm: 15.2, status: 'WARNING', threshold_ratio: 0.61, is_significant: true },
        { point_id: 'BM103', displacement_mm: 12.8, status: 'WARNING', threshold_ratio: 0.51, is_significant: true },
        { point_id: 'BM104', displacement_mm: 6.3, status: 'SAFE', threshold_ratio: 0.25, is_significant: true },
        { point_id: 'BM105', displacement_mm: 3.2, status: 'SAFE', threshold_ratio: 0.13, is_significant: false },
    ];

    const displacementPoints = [
        { id: 'BM101', x: 100, y: 200, dx: -8.5, dy: 12.2, magnitude: 14.9, status: 'WARNING' },
        { id: 'BM102', x: 150, y: 200, dx: -12.3, dy: 8.1, magnitude: 14.7, status: 'WARNING' },
        { id: 'BM103', x: 200, y: 200, dx: -15.2, dy: -6.4, magnitude: 16.5, status: 'CRITICAL' },
        { id: 'BM104', x: 100, y: 250, dx: -3.2, dy: 5.1, magnitude: 6.0, status: 'SAFE' },
        { id: 'BM105', x: 150, y: 250, dx: -5.8, dy: 7.2, magnitude: 9.3, status: 'SAFE' },
        { id: 'BM106', x: 200, y: 250, dx: -11.1, dy: -4.3, magnitude: 11.9, status: 'WARNING' },
    ];

    return (
        <div className={`min-h-screen ${isDark ? 'bg-gray-901 text-white' : 'bg-gray-50 text-gray-900'} p-6 transition-colors duration-200`}>
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className={`${isDark ? 'bg-gray-800 border-b border-gray-700' : 'bg-gray-900'} text-white rounded-t-lg p-6`}>
                    <h1 className="text-2xl font-bold mb-2">Deformation Monitoring Dashboard</h1>
                    <p className={`${isDark ? 'text-gray-400' : 'text-gray-300'} text-sm`}>Real-time structural movement analysis</p>
                </div>

                {/* Navigation */}
                <div className={`${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-300'} border-x border-b flex gap-2 p-3 shadow-inner`}>
                    {['settlement', 'displacement', 'tolerance'].map(view => (
                        <button
                            key={view}
                            onClick={() => setActiveView(view)}
                            className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all duration-200 outline-none ${activeView === view
                                ? (isDark ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-900 text-white')
                                : (isDark ? 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                                }`}
                        >
                            {view}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className={`${isDark ? 'bg-gray-900 border-gray-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]' : 'bg-white border-gray-300'} border rounded-b-lg p-6`}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1">
                            <EpochSelector
                                epochs={epochs}
                                onSelect={(ref, curr) => console.log('Compare:', ref, curr)}
                                isDark={isDark}
                            />
                        </div>

                        <div className="lg:col-span-2">
                            {activeView === 'settlement' && (
                                <SettlementChart
                                    data={settlementData}
                                    pointId="BM101"
                                    warningThreshold={-10}
                                    criticalThreshold={-25}
                                    isDark={isDark}
                                />
                            )}

                            {activeView === 'displacement' && (
                                <DisplacementVectors2D
                                    points={displacementPoints}
                                    scale={1.0}
                                    isDark={isDark}
                                />
                            )}

                            {activeView === 'tolerance' && (
                                <ToleranceStatusPanel
                                    points={tolerancePoints}
                                    warningThreshold={25}
                                    criticalThreshold={50}
                                    isDark={isDark}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className={`mt-4 ${isDark ? 'bg-gray-800/30 border-gray-700/50 text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-600'} border rounded p-4 text-[10px] font-mono`}>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                            <span className="font-bold uppercase opacity-50">Confidence:</span>
                            <span className={isDark ? 'text-blue-400' : 'text-gray-900'}>95% (k=1.96)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold uppercase opacity-50">MDM:</span>
                            <span className={isDark ? 'text-blue-400' : 'text-gray-900'}>5.54 mm</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold uppercase opacity-50">Units:</span>
                            <span className={isDark ? 'text-blue-400' : 'text-gray-900'}>Millimeters (mm)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonitoringDashboard;