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
    ReferenceLine
} from 'recharts';

interface StorageRecord {
    level: number;
    area: number;
    incremental_volume: number;
    cumulative_volume: number;
}

interface ReservoirCurveChartProps {
    storageTable: StorageRecord[];
    deadStorageLevel?: number;
    title?: string;
    showArea?: boolean;
    showVolume?: boolean;
}

export const ReservoirCurveChart: React.FC<ReservoirCurveChartProps> = ({
    storageTable,
    deadStorageLevel,
    title = "Reservoir Area-Capacity Curve",
    showArea = true,
    showVolume = true
}) => {
    const chartData = useMemo(() => {
        return storageTable.map(record => ({
            level: record.level,
            area: record.area,
            volume: record.cumulative_volume,
            areaKm2: record.area / 1_000_000,
            volumeMm3: record.cumulative_volume / 1_000_000
        }));
    }, [storageTable]);

    const maxLevel = Math.max(...chartData.map(d => d.level));
    const minLevel = Math.min(...chartData.map(d => d.level));
    const maxVolume = Math.max(...chartData.map(d => d.volumeMm3));
    const maxArea = Math.max(...chartData.map(d => d.areaKm2));

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <div className="flex gap-4 text-sm text-gray-600">
                    <span>Levels: {minLevel.toFixed(2)} - {maxLevel.toFixed(2)} m</span>
                    <span>Capacity: {maxVolume.toFixed(2)} Mm³</span>
                </div>
            </div>

            {/* Level vs Volume Chart */}
            {showVolume && (
                <div className="bg-white p-4 border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Water Level vs Storage Volume
                    </h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="volumeMm3"
                                label={{ value: 'Volume (Mm³)', position: 'insideBottom', offset: -5 }}
                                stroke="#6b7280"
                            />
                            <YAxis
                                label={{ value: 'Level (m)', angle: -90, position: 'insideLeft' }}
                                stroke="#6b7280"
                            />
                            <Tooltip
                                formatter={(value: number) => value.toFixed(3)}
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1d5db' }}
                            />
                            <Legend />
                            {deadStorageLevel && (
                                <ReferenceLine
                                    y={deadStorageLevel}
                                    stroke="#ef4444"
                                    strokeDasharray="5 5"
                                    label="Dead Storage Level"
                                />
                            )}
                            <Line
                                type="monotone"
                                dataKey="level"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                name="Water Level (m)"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Level vs Area Chart */}
            {showArea && (
                <div className="bg-white p-4 border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Water Level vs Surface Area
                    </h4>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey="areaKm2"
                                label={{ value: 'Area (km²)', position: 'insideBottom', offset: -5 }}
                                stroke="#6b7280"
                            />
                            <YAxis
                                label={{ value: 'Level (m)', angle: -90, position: 'insideLeft' }}
                                stroke="#6b7280"
                            />
                            <Tooltip
                                formatter={(value: number) => value.toFixed(3)}
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #d1d5db' }}
                            />
                            <Legend />
                            {deadStorageLevel && (
                                <ReferenceLine
                                    y={deadStorageLevel}
                                    stroke="#ef4444"
                                    strokeDasharray="5 5"
                                    label="Dead Storage Level"
                                />
                            )}
                            <Line
                                type="monotone"
                                dataKey="level"
                                stroke="#10b981"
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                name="Water Level (m)"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Storage Table Summary */}
            <div className="bg-gray-50 p-4 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Storage Summary</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                        <div className="text-gray-600">Total Capacity</div>
                        <div className="font-semibold text-gray-900">
                            {maxVolume.toFixed(2)} Mm³
                        </div>
                    </div>
                    <div>
                        <div className="text-gray-600">Max Surface Area</div>
                        <div className="font-semibold text-gray-900">
                            {maxArea.toFixed(2)} km²
                        </div>
                    </div>
                    <div>
                        <div className="text-gray-600">Level Range</div>
                        <div className="font-semibold text-gray-900">
                            {(maxLevel - minLevel).toFixed(2)} m
                        </div>
                    </div>
                    <div>
                        <div className="text-gray-600">Data Points</div>
                        <div className="font-semibold text-gray-900">
                            {storageTable.length}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};