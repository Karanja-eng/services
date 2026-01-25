import React, { useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Area,
    AreaChart
} from 'recharts';

interface ChainagePoint {
    chainage: number;
    elevation: number;
    description?: string;
}

interface GradientSegment {
    start_chainage: number;
    end_chainage: number;
    start_elevation: number;
    end_elevation: number;
    gradient: number;
    gradient_percent: number;
}

interface RiverProfileChartProps {
    profilePoints: ChainagePoint[];
    gradients?: GradientSegment[];
    waterLevel?: number;
    title?: string;
    showGradients?: boolean;
}

export const RiverProfileChart: React.FC<RiverProfileChartProps> = ({
    profilePoints,
    gradients = [],
    waterLevel,
    title = "River Longitudinal Profile",
    showGradients = true
}) => {
    const profileData = useMemo(() => {
        return profilePoints.map(pt => ({
            chainage: pt.chainage,
            bed: pt.elevation,
            water: waterLevel !== undefined ? waterLevel : undefined
        }));
    }, [profilePoints, waterLevel]);

    const gradientData = useMemo(() => {
        return gradients.map(g => ({
            chainage: (g.start_chainage + g.end_chainage) / 2,
            gradient: g.gradient_percent,
            label: `${g.gradient_percent.toFixed(2)}%`
        }));
    }, [gradients]);

    const stats = useMemo(() => {
        const chainages = profilePoints.map(p => p.chainage);
        const elevations = profilePoints.map(p => p.elevation);

        const minCh = Math.min(...chainages);
        const maxCh = Math.max(...chainages);
        const minEl = Math.min(...elevations);
        const maxEl = Math.max(...elevations);

        const totalLength = maxCh - minCh;
        const totalDrop = elevations[0] - elevations[elevations.length - 1];
        const avgGradient = totalLength > 0 ? (totalDrop / totalLength) * 100 : 0;

        return {
            length: totalLength,
            drop: totalDrop,
            avgGradient,
            minEl,
            maxEl
        };
    }, [profilePoints]);

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <div className="flex gap-4 text-sm text-gray-600">
                    <span>Length: {stats.length.toFixed(2)} m</span>
                    <span>Drop: {stats.drop.toFixed(2)} m</span>
                    <span>Avg Gradient: {stats.avgGradient.toFixed(3)}%</span>
                </div>
            </div>

            {/* Main Profile Chart */}
            <div className="bg-white p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Elevation Profile
                </h4>
                <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={profileData}>
                        <defs>
                            <linearGradient id="bedGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#78716c" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#78716c" stopOpacity={0.2} />
                            </linearGradient>
                            <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="chainage"
                            label={{ value: 'Chainage (m)', position: 'insideBottom', offset: -5 }}
                            stroke="#6b7280"
                        />
                        <YAxis
                            label={{ value: 'Elevation (m)', angle: -90, position: 'insideLeft' }}
                            stroke="#6b7280"
                            domain={[stats.minEl - 2, stats.maxEl + 2]}
                        />
                        <Tooltip
                            formatter={(value: number) => value.toFixed(3)}
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1d5db' }}
                        />
                        <Legend />

                        {/* Bed elevation */}
                        <Area
                            type="monotone"
                            dataKey="bed"
                            stroke="#78716c"
                            strokeWidth={2}
                            fill="url(#bedGradient)"
                            name="Bed Elevation (m)"
                        />

                        {/* Water level (if provided) */}
                        {waterLevel !== undefined && (
                            <Area
                                type="monotone"
                                dataKey="water"
                                stroke="#3b82f6"
                                strokeWidth={1}
                                fill="url(#waterGradient)"
                                name="Water Level (m)"
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Gradient Chart */}
            {showGradients && gradients.length > 0 && (
                <div className="bg-white p-4 border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Bed Gradients
                    </h4>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={gradientData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="chainage"
                                label={{ value: 'Chainage (m)', position: 'insideBottom', offset: -5 }}
                                stroke="#6b7280"
                            />
                            <YAxis
                                label={{ value: 'Gradient (%)', angle: -90, position: 'insideLeft' }}
                                stroke="#6b7280"
                            />
                            <Tooltip
                                formatter={(value: number) => `${value.toFixed(3)}%`}
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1d5db' }}
                            />
                            <Legend />
                            <Line
                                type="stepAfter"
                                dataKey="gradient"
                                stroke="#ef4444"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                name="Gradient (%)"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Gradient Table */}
            {showGradients && gradients.length > 0 && (
                <div className="bg-gray-50 p-4 border border-gray-200 overflow-x-auto">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Gradient Details
                    </h4>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-300">
                                <th className="text-left py-2 px-3 text-gray-700">Start Ch (m)</th>
                                <th className="text-left py-2 px-3 text-gray-700">End Ch (m)</th>
                                <th className="text-left py-2 px-3 text-gray-700">Length (m)</th>
                                <th className="text-left py-2 px-3 text-gray-700">Drop (m)</th>
                                <th className="text-left py-2 px-3 text-gray-700">Gradient</th>
                                <th className="text-left py-2 px-3 text-gray-700">Gradient (%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {gradients.map((g, i) => (
                                <tr key={i} className="border-b border-gray-200 hover:bg-gray-100">
                                    <td className="py-2 px-3">{g.start_chainage.toFixed(2)}</td>
                                    <td className="py-2 px-3">{g.end_chainage.toFixed(2)}</td>
                                    <td className="py-2 px-3">{(g.end_chainage - g.start_chainage).toFixed(2)}</td>
                                    <td className="py-2 px-3">{(g.start_elevation - g.end_elevation).toFixed(3)}</td>
                                    <td className="py-2 px-3">{g.gradient.toFixed(5)}</td>
                                    <td className={`py-2 px-3 font-medium ${g.gradient < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                        {g.gradient_percent.toFixed(3)}%
                                        {g.gradient < 0 && ' ⚠️'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Statistics Summary */}
            <div className="bg-gray-50 p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Profile Statistics</h4>
                <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>
                        <div className="text-gray-600">Total Length</div>
                        <div className="font-semibold text-gray-900">{stats.length.toFixed(2)} m</div>
                    </div>
                    <div>
                        <div className="text-gray-600">Elevation Drop</div>
                        <div className="font-semibold text-gray-900">{stats.drop.toFixed(3)} m</div>
                    </div>
                    <div>
                        <div className="text-gray-600">Avg Gradient</div>
                        <div className="font-semibold text-gray-900">{stats.avgGradient.toFixed(4)}%</div>
                    </div>
                    <div>
                        <div className="text-gray-600">Min Elevation</div>
                        <div className="font-semibold text-gray-900">{stats.minEl.toFixed(3)} m</div>
                    </div>
                    <div>
                        <div className="text-gray-600">Max Elevation</div>
                        <div className="font-semibold text-gray-900">{stats.maxEl.toFixed(3)} m</div>
                    </div>
                </div>
            </div>
        </div>
    );
};