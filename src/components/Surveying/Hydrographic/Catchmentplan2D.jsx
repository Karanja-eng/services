import React, { useMemo } from 'react';
import { Stage, Layer, Line, Circle, Text } from 'react-konva';

interface Point2D {
    x: number;
    y: number;
}

interface CatchmentPlan2DProps {
    boundaryPoints: Point2D[];
    subCatchments?: Point2D[][];
    width?: number;
    height?: number;
    showLabels?: boolean;
    title?: string;
}

export const CatchmentPlan2D: React.FC<CatchmentPlan2DProps> = ({
    boundaryPoints,
    subCatchments = [],
    width = 800,
    height = 600,
    showLabels = true,
    title = "Catchment Boundary Plan"
}) => {
    const { viewBox, scale, offsetX, offsetY } = useMemo(() => {
        // Calculate bounding box
        const allPoints = [
            ...boundaryPoints,
            ...subCatchments.flat()
        ];

        if (allPoints.length === 0) {
            return { viewBox: { minX: 0, maxX: 100, minY: 0, maxY: 100 }, scale: 1, offsetX: 0, offsetY: 0 };
        }

        const xs = allPoints.map(p => p.x);
        const ys = allPoints.map(p => p.y);

        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;

        // Add 10% padding
        const padding = 0.1;
        const paddedMinX = minX - rangeX * padding;
        const paddedMaxX = maxX + rangeX * padding;
        const paddedMinY = minY - rangeY * padding;
        const paddedMaxY = maxY + rangeY * padding;

        const paddedRangeX = paddedMaxX - paddedMinX;
        const paddedRangeY = paddedMaxY - paddedMinY;

        // Calculate scale to fit canvas
        const scaleX = width / paddedRangeX;
        const scaleY = height / paddedRangeY;
        const calculatedScale = Math.min(scaleX, scaleY);

        return {
            viewBox: {
                minX: paddedMinX,
                maxX: paddedMaxX,
                minY: paddedMinY,
                maxY: paddedMaxY
            },
            scale: calculatedScale,
            offsetX: paddedMinX,
            offsetY: paddedMinY
        };
    }, [boundaryPoints, subCatchments, width, height]);

    const transformPoint = (p: Point2D): number[] => {
        // Transform from world coordinates to canvas coordinates
        // Note: Y-axis is flipped in canvas (origin top-left vs bottom-left)
        const canvasX = (p.x - offsetX) * scale;
        const canvasY = height - (p.y - offsetY) * scale;
        return [canvasX, canvasY];
    };

    const mainBoundaryPoints = useMemo(() => {
        return boundaryPoints.flatMap(p => transformPoint(p));
    }, [boundaryPoints, scale, offsetX, offsetY]);

    const subCatchmentLines = useMemo(() => {
        return subCatchments.map(boundary =>
            boundary.flatMap(p => transformPoint(p))
        );
    }, [subCatchments, scale, offsetX, offsetY]);

    // Calculate centroid for area label
    const centroid = useMemo(() => {
        if (boundaryPoints.length === 0) return null;

        const sumX = boundaryPoints.reduce((sum, p) => sum + p.x, 0);
        const sumY = boundaryPoints.reduce((sum, p) => sum + p.y, 0);

        return transformPoint({
            x: sumX / boundaryPoints.length,
            y: sumY / boundaryPoints.length
        });
    }, [boundaryPoints, scale, offsetX, offsetY]);

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <div className="text-sm text-gray-600">
                    {boundaryPoints.length} boundary points
                    {subCatchments.length > 0 && `, ${subCatchments.length} sub-catchments`}
                </div>
            </div>

            <div className="bg-white p-4 border border-gray-200">
                <Stage width={width} height={height}>
                    <Layer>
                        {/* Grid background */}
                        <Line
                            points={[0, 0, width, 0, width, height, 0, height, 0, 0]}
                            stroke="#f3f4f6"
                            strokeWidth={1}
                        />

                        {/* Main catchment boundary */}
                        <Line
                            points={mainBoundaryPoints}
                            stroke="#3b82f6"
                            strokeWidth={2}
                            closed={true}
                            fill="#3b82f620"
                        />

                        {/* Main boundary vertices */}
                        {boundaryPoints.map((p, i) => {
                            const [canvasX, canvasY] = transformPoint(p);
                            return (
                                <Circle
                                    key={`main-${i}`}
                                    x={canvasX}
                                    y={canvasY}
                                    radius={4}
                                    fill="#3b82f6"
                                    stroke="#1e40af"
                                    strokeWidth={1}
                                />
                            );
                        })}

                        {/* Sub-catchments */}
                        {subCatchmentLines.map((points, i) => (
                            <React.Fragment key={`sub-${i}`}>
                                <Line
                                    points={points}
                                    stroke="#10b981"
                                    strokeWidth={1.5}
                                    closed={true}
                                    fill="#10b98110"
                                    dash={[5, 3]}
                                />
                                {subCatchments[i].map((p, j) => {
                                    const [canvasX, canvasY] = transformPoint(p);
                                    return (
                                        <Circle
                                            key={`sub-${i}-${j}`}
                                            x={canvasX}
                                            y={canvasY}
                                            radius={3}
                                            fill="#10b981"
                                            stroke="#059669"
                                            strokeWidth={1}
                                        />
                                    );
                                })}
                            </React.Fragment>
                        ))}

                        {/* Centroid label */}
                        {showLabels && centroid && (
                            <Text
                                x={centroid[0] - 30}
                                y={centroid[1] - 10}
                                text="Catchment"
                                fontSize={12}
                                fill="#1f2937"
                                fontStyle="bold"
                            />
                        )}

                        {/* North arrow */}
                        <Line
                            points={[width - 40, 40, width - 40, 20]}
                            stroke="#374151"
                            strokeWidth={2}
                            lineCap="round"
                        />
                        <Line
                            points={[width - 45, 25, width - 40, 20, width - 35, 25]}
                            stroke="#374151"
                            strokeWidth={2}
                            lineCap="round"
                            lineJoin="round"
                            closed={false}
                        />
                        <Text
                            x={width - 45}
                            y={45}
                            text="N"
                            fontSize={12}
                            fill="#374151"
                            fontStyle="bold"
                        />
                    </Layer>
                </Stage>
            </div>

            {/* Legend */}
            <div className="bg-gray-50 p-3 border border-gray-200">
                <div className="flex gap-6 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-3 bg-blue-500 border border-blue-700"></div>
                        <span className="text-gray-700">Main Catchment</span>
                    </div>
                    {subCatchments.length > 0 && (
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-3 bg-green-500 border border-green-700 border-dashed"></div>
                            <span className="text-gray-700">Sub-catchments</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        <span className="text-gray-700">Boundary Points</span>
                    </div>
                </div>
            </div>
        </div>
    );
};