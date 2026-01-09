import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Rect, Text, Circle, Arrow, Group } from 'react-konva';
import { Download, ZoomIn, ZoomOut, Grid3x3 } from 'lucide-react';

export default function Pool2DDrawing({ poolData = {} }) {
    const stageRef = useRef(null);
    const [scale, setScale] = useState(1);
    const [showGrid, setShowGrid] = useState(true);
    const [showDimensions, setShowDimensions] = useState(true);

    const {
        int_l = 12,
        int_w = 8,
        shallow_depth = 1.5,
        deep_depth = 2.8,
        wall_thick = 0.1,
        tanking_thick = 0.02,
        working_space = 0.335,
        bed_thick = 0.15,
        pool_shape = 'rectangular'
    } = poolData;

    const PIXELS_PER_METER = 40;
    const MARGIN = 100;

    const ext_add = wall_thick + tanking_thick + working_space;
    const ext_l = int_l + 2 * ext_add;
    const ext_w = int_w + 2 * ext_add;

    const stageWidth = Math.max(800, (ext_l + 4) * PIXELS_PER_METER);
    const stageHeight = Math.max(600, (ext_w + 4) * PIXELS_PER_METER);

    const toPixel = (meters) => meters * PIXELS_PER_METER * scale;
    const originX = MARGIN;
    const originY = MARGIN;

    const handleExport = () => {
        const uri = stageRef.current.toDataURL();
        const link = document.createElement('a');
        link.download = '2d-pool-plan.png';
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderGrid = () => {
        const lines = [];
        const gridSpacing = 1;
        const maxDim = Math.max(ext_l, ext_w) + 2;

        for (let i = 0; i <= maxDim; i += gridSpacing) {
            lines.push(
                <Line
                    key={`v-${i}`}
                    points={[originX + toPixel(i), originY, originX + toPixel(i), originY + toPixel(maxDim)]}
                    stroke="#e0e0e0"
                    strokeWidth={0.5}
                />
            );
            lines.push(
                <Line
                    key={`h-${i}`}
                    points={[originX, originY + toPixel(i), originX + toPixel(maxDim), originY + toPixel(i)]}
                    stroke="#e0e0e0"
                    strokeWidth={0.5}
                />
            );
        }
        return lines;
    };

    const renderDimensionLine = (x1, y1, x2, y2, label, offset = 30) => {
        const isVertical = Math.abs(x2 - x1) < 1;

        return (
            <Group>
                <Line
                    points={isVertical
                        ? [x1 - offset, y1, x1 - offset, y2]
                        : [x1, y1 + offset, x2, y1 + offset]
                    }
                    stroke="#0066cc"
                    strokeWidth={1.5}
                />
                <Arrow
                    points={isVertical
                        ? [x1 - offset, y1, x1 - offset, y1 + 15]
                        : [x1, y1 + offset, x1 + 15, y1 + offset]
                    }
                    stroke="#0066cc"
                    fill="#0066cc"
                    strokeWidth={1.5}
                    pointerLength={8}
                    pointerWidth={8}
                />
                <Arrow
                    points={isVertical
                        ? [x1 - offset, y2, x1 - offset, y2 - 15]
                        : [x2, y1 + offset, x2 - 15, y1 + offset]
                    }
                    stroke="#0066cc"
                    fill="#0066cc"
                    strokeWidth={1.5}
                    pointerLength={8}
                    pointerWidth={8}
                />
                <Text
                    x={isVertical ? x1 - offset - 30 : (x1 + x2) / 2 - 20}
                    y={isVertical ? (y1 + y2) / 2 - 10 : y1 + offset + 10}
                    text={label}
                    fontSize={12}
                    fill="#0066cc"
                    fontStyle="bold"
                />
            </Group>
        );
    };

    const renderPlanView = () => {
        const baseX = originX + toPixel(1);
        const baseY = originY + toPixel(1);

        return (
            <Group>
                <Rect
                    x={baseX}
                    y={baseY}
                    width={toPixel(ext_l)}
                    height={toPixel(ext_w)}
                    fill="#d4a373"
                    stroke="#8b6f47"
                    strokeWidth={2}
                    opacity={0.3}
                />
                <Text
                    x={baseX + toPixel(ext_l / 2) - 50}
                    y={baseY + toPixel(ext_w / 2) - 10}
                    text="EXCAVATION AREA"
                    fontSize={11}
                    fill="#666"
                    fontStyle="italic"
                />

                <Rect
                    x={baseX + toPixel(ext_add)}
                    y={baseY + toPixel(ext_add)}
                    width={toPixel(int_l)}
                    height={toPixel(int_w)}
                    fill="#4da6ff"
                    stroke="#0066cc"
                    strokeWidth={3}
                    opacity={0.6}
                />
                <Text
                    x={baseX + toPixel(ext_add + int_l / 2) - 30}
                    y={baseY + toPixel(ext_add + int_w / 2) - 8}
                    text="WATER"
                    fontSize={14}
                    fill="#003d7a"
                    fontStyle="bold"
                />

                <Rect
                    x={baseX + toPixel(ext_add)}
                    y={baseY + toPixel(ext_add)}
                    width={toPixel(int_l)}
                    height={toPixel(int_w)}
                    fill="transparent"
                    stroke="#ff6b35"
                    strokeWidth={toPixel(wall_thick)}
                    opacity={0.8}
                />

                {pool_shape === 'rectangular' && (
                    <>
                        <Line
                            points={[
                                baseX + toPixel(ext_add + int_l * 0.6),
                                baseY + toPixel(ext_add),
                                baseX + toPixel(ext_add + int_l * 0.6),
                                baseY + toPixel(ext_add + int_w)
                            ]}
                            stroke="#003d7a"
                            strokeWidth={1.5}
                            dash={[5, 5]}
                        />
                        <Text
                            x={baseX + toPixel(ext_add + int_l * 0.3) - 25}
                            y={baseY + toPixel(ext_add + int_w / 2)}
                            text={`${shallow_depth}m`}
                            fontSize={12}
                            fill="#003d7a"
                            fontStyle="bold"
                        />
                        <Text
                            x={baseX + toPixel(ext_add + int_l * 0.8) - 25}
                            y={baseY + toPixel(ext_add + int_w / 2)}
                            text={`${deep_depth}m`}
                            fontSize={12}
                            fill="#003d7a"
                            fontStyle="bold"
                        />
                    </>
                )}

                {Array.from({ length: 5 }, (_, i) => (
                    <Circle
                        key={i}
                        x={baseX + toPixel(ext_add + int_l * 0.2 * (i + 1))}
                        y={baseY + toPixel(ext_add + int_w / 2)}
                        radius={3}
                        fill="#fff"
                        opacity={0.5}
                    />
                ))}

                {showDimensions && (
                    <>
                        {renderDimensionLine(
                            baseX,
                            baseY,
                            baseX + toPixel(ext_l),
                            baseY,
                            `${ext_l.toFixed(2)}m`,
                            -20
                        )}
                        {renderDimensionLine(
                            baseX,
                            baseY,
                            baseX,
                            baseY + toPixel(ext_w),
                            `${ext_w.toFixed(2)}m`,
                            -20
                        )}
                        {renderDimensionLine(
                            baseX + toPixel(ext_add),
                            baseY + toPixel(ext_w) + 50,
                            baseX + toPixel(ext_add + int_l),
                            baseY + toPixel(ext_w) + 50,
                            `${int_l.toFixed(2)}m`,
                            0
                        )}
                    </>
                )}
            </Group>
        );
    };

    const renderSectionView = () => {
        const sectionX = originX + toPixel(ext_l + 3);
        const sectionY = originY + toPixel(1);
        const sectionScale = 50;

        const avgDepth = (shallow_depth + deep_depth) / 2;

        return (
            <Group>
                <Text
                    x={sectionX}
                    y={sectionY - 30}
                    text="SECTION A-A"
                    fontSize={14}
                    fill="#000"
                    fontStyle="bold"
                />

                <Line
                    points={[
                        sectionX,
                        sectionY,
                        sectionX + int_l * sectionScale,
                        sectionY
                    ]}
                    stroke="#8b6f47"
                    strokeWidth={2}
                />

                <Rect
                    x={sectionX + wall_thick * sectionScale}
                    y={sectionY}
                    width={(int_l - 2 * wall_thick) * sectionScale}
                    height={avgDepth * sectionScale}
                    fill="#4da6ff"
                    opacity={0.5}
                    stroke="#0066cc"
                    strokeWidth={1.5}
                />

                <Line
                    points={[
                        sectionX + wall_thick * sectionScale,
                        sectionY + shallow_depth * sectionScale,
                        sectionX + int_l * 0.6 * sectionScale,
                        sectionY + deep_depth * sectionScale,
                        sectionX + (int_l - wall_thick) * sectionScale,
                        sectionY + deep_depth * sectionScale
                    ]}
                    stroke="#003d7a"
                    strokeWidth={2}
                    fill="transparent"
                />

                <Rect
                    x={sectionX}
                    y={sectionY}
                    width={wall_thick * sectionScale}
                    height={(avgDepth + bed_thick) * sectionScale}
                    fill="#ff6b35"
                    opacity={0.7}
                />
                <Rect
                    x={sectionX + (int_l - wall_thick) * sectionScale}
                    y={sectionY}
                    width={wall_thick * sectionScale}
                    height={(avgDepth + bed_thick) * sectionScale}
                    fill="#ff6b35"
                    opacity={0.7}
                />

                <Rect
                    x={sectionX}
                    y={sectionY + (avgDepth + bed_thick) * sectionScale}
                    width={int_l * sectionScale}
                    height={bed_thick * sectionScale}
                    fill="#ff6b35"
                    opacity={0.7}
                />

                <Arrow
                    points={[
                        sectionX - 20,
                        sectionY,
                        sectionX - 20,
                        sectionY + shallow_depth * sectionScale
                    ]}
                    stroke="#0066cc"
                    fill="#0066cc"
                    strokeWidth={1.5}
                    pointerLength={8}
                    pointerWidth={8}
                />
                <Text
                    x={sectionX - 70}
                    y={sectionY + shallow_depth * sectionScale / 2 - 8}
                    text={`${shallow_depth}m`}
                    fontSize={11}
                    fill="#0066cc"
                    fontStyle="bold"
                />

                <Arrow
                    points={[
                        sectionX + int_l * sectionScale + 20,
                        sectionY,
                        sectionX + int_l * sectionScale + 20,
                        sectionY + deep_depth * sectionScale
                    ]}
                    stroke="#0066cc"
                    fill="#0066cc"
                    strokeWidth={1.5}
                    pointerLength={8}
                    pointerWidth={8}
                />
                <Text
                    x={sectionX + int_l * sectionScale + 30}
                    y={sectionY + deep_depth * sectionScale / 2 - 8}
                    text={`${deep_depth}m`}
                    fontSize={11}
                    fill="#0066cc"
                    fontStyle="bold"
                />
            </Group>
        );
    };

    return (
        <div className="w-full h-full bg-gray-50 flex flex-col">
            <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-900">2D CAD Drawing - Plan & Section</h2>
                    <span className="text-sm text-gray-600">Scale: 1:{Math.round(1 / scale)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowGrid(!showGrid)}
                        className={`px-3 py-2 rounded text-sm font-medium transition-colors ${showGrid ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                            }`}
                    >
                        <Grid3x3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowDimensions(!showDimensions)}
                        className={`px-3 py-2 rounded text-sm font-medium transition-colors ${showDimensions ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                            }`}
                    >
                        Dims
                    </button>
                    <button
                        onClick={() => setScale(Math.min(scale + 0.1, 2))}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setScale(Math.max(scale - 0.1, 0.5))}
                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleExport}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                <Stage ref={stageRef} width={stageWidth} height={stageHeight}>
                    <Layer>
                        {showGrid && renderGrid()}
                        {renderPlanView()}
                        {renderSectionView()}

                        <Text
                            x={originX}
                            y={originY + toPixel(ext_w + 2)}
                            text={`Pool Type: ${pool_shape.toUpperCase()} | Internal: ${int_l}m × ${int_w}m | Depth: ${shallow_depth}m - ${deep_depth}m`}
                            fontSize={13}
                            fill="#333"
                            fontStyle="bold"
                        />

                        <Rect
                            x={originX + toPixel(ext_l + 3)}
                            y={originY + toPixel(ext_w / 2 + 1)}
                            width={120}
                            height={140}
                            fill="#fff"
                            stroke="#ccc"
                            strokeWidth={1}
                            cornerRadius={4}
                        />
                        <Text
                            x={originX + toPixel(ext_l + 3) + 10}
                            y={originY + toPixel(ext_w / 2 + 1) + 10}
                            text="LEGEND"
                            fontSize={12}
                            fill="#000"
                            fontStyle="bold"
                        />
                        <Rect
                            x={originX + toPixel(ext_l + 3) + 10}
                            y={originY + toPixel(ext_w / 2 + 1) + 30}
                            width={15}
                            height={15}
                            fill="#4da6ff"
                            opacity={0.6}
                        />
                        <Text
                            x={originX + toPixel(ext_l + 3) + 30}
                            y={originY + toPixel(ext_w / 2 + 1) + 32}
                            text="Water"
                            fontSize={10}
                            fill="#000"
                        />
                        <Rect
                            x={originX + toPixel(ext_l + 3) + 10}
                            y={originY + toPixel(ext_w / 2 + 1) + 55}
                            width={15}
                            height={15}
                            fill="#ff6b35"
                            opacity={0.7}
                        />
                        <Text
                            x={originX + toPixel(ext_l + 3) + 30}
                            y={originY + toPixel(ext_w / 2 + 1) + 57}
                            text="Concrete"
                            fontSize={10}
                            fill="#000"
                        />
                        <Rect
                            x={originX + toPixel(ext_l + 3) + 10}
                            y={originY + toPixel(ext_w / 2 + 1) + 80}
                            width={15}
                            height={15}
                            fill="#d4a373"
                            opacity={0.3}
                        />
                        <Text
                            x={originX + toPixel(ext_l + 3) + 30}
                            y={originY + toPixel(ext_w / 2 + 1) + 82}
                            text="Excavation"
                            fontSize={10}
                            fill="#000"
                        />
                        <Line
                            points={[
                                originX + toPixel(ext_l + 3) + 10,
                                originY + toPixel(ext_w / 2 + 1) + 112,
                                originX + toPixel(ext_l + 3) + 25,
                                originY + toPixel(ext_w / 2 + 1) + 112
                            ]}
                            stroke="#0066cc"
                            strokeWidth={1.5}
                        />
                        <Text
                            x={originX + toPixel(ext_l + 3) + 30}
                            y={originY + toPixel(ext_w / 2 + 1) + 107}
                            text="Dimension"
                            fontSize={10}
                            fill="#000"
                        />
                    </Layer>
                </Stage>
            </div>
        </div>
    );
}