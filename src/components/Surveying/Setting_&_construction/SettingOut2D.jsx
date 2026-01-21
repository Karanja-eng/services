import React, { useState, useRef } from 'react';
import { Stage, Layer, Line, Circle, Text, Arrow, Rect } from 'react-konva';

// UI Components replacement for Shadcn
const Card = ({ children, className = "" }) => (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
        {children}
    </div>
);

const CardHeader = ({ children }) => (
    <div className="p-6 pb-2">
        {children}
    </div>
);

const CardTitle = ({ children, className = "" }) => (
    <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
        {children}
    </h3>
);

const CardContent = ({ children, className = "" }) => (
    <div className={`p-6 pt-2 ${className}`}>
        {children}
    </div>
);

const Label = ({ children, className = "" }) => (
    <label className={`block text-sm font-medium text-gray-700 mb-1.5 ${className}`}>
        {children}
    </label>
);

const Input = ({ className = "", ...props }) => (
    <input
        className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
    />
);

const Button = ({ children, className = "", variant = "primary", ...props }) => {
    const variants = {
        primary: "bg-gray-900 text-white hover:bg-gray-800",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
        outline: "border border-gray-300 bg-white hover:bg-gray-50",
        default: "bg-gray-900 text-white hover:bg-gray-800"
    };

    return (
        <button
            className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 ${variants[variant] || variants.default} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};

const Checkbox = ({ checked, onCheckedChange, id }) => (
    <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
    />
);

const SettingOut2DPlan = () => {
    const [dimensions, setDimensions] = useState({
        width: 800,
        height: 600
    });

    const [curveParams, setCurveParams] = useState({
        radius: 100,
        intersectionAngle: 45,
        originX: 200,
        originY: 400
    });

    const [layers, setLayers] = useState({
        grid: true,
        baseline: true,
        curve: true,
        offsets: true,
        dimensions: true,
        pegs: true
    });

    const [scale] = useState(2); // pixels per meter

    // Calculate curve points
    const calculateCurvePoints = () => {
        const { radius, intersectionAngle, originX, originY } = curveParams;
        const deltaRad = (intersectionAngle * Math.PI) / 180;
        const points = [];

        const numPoints = 30;
        for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * deltaRad;
            const x = originX + radius * scale * Math.sin(angle);
            const y = originY - radius * scale * (1 - Math.cos(angle));
            points.push(x, y);
        }

        return points;
    };

    // Generate grid points
    const generateGrid = () => {
        const gridLines = [];
        const spacing = 50 * scale; // 50m grid spacing

        for (let x = 0; x <= dimensions.width; x += spacing) {
            gridLines.push({
                points: [x, 0, x, dimensions.height],
                stroke: '#e5e7eb',
                strokeWidth: 1
            });
        }

        for (let y = 0; y <= dimensions.height; y += spacing) {
            gridLines.push({
                points: [0, y, dimensions.width, y],
                stroke: '#e5e7eb',
                strokeWidth: 1
            });
        }

        return gridLines;
    };

    // Generate peg points along curve
    const generatePegs = () => {
        const { radius, intersectionAngle, originX, originY } = curveParams;
        const deltaRad = (intersectionAngle * Math.PI) / 180;
        const pegInterval = 20; // 20m spacing
        const curveLength = radius * deltaRad;
        const numPegs = Math.floor(curveLength / pegInterval) + 1;

        const pegs = [];
        for (let i = 0; i <= numPegs; i++) {
            const distance = Math.min(i * pegInterval, curveLength);
            const angle = distance / radius;
            const x = originX + radius * scale * Math.sin(angle);
            const y = originY - radius * scale * (1 - Math.cos(angle));

            pegs.push({
                x,
                y,
                label: `${(distance).toFixed(0)}m`
            });
        }

        return pegs;
    };

    // Calculate offset line
    const calculateOffsetLine = () => {
        const { radius, originX, originY, intersectionAngle } = curveParams;
        const deltaRad = (intersectionAngle * Math.PI) / 180;

        const points = [];
        const numPoints = 30;

        for (let i = 0; i <= numPoints; i++) {
            const angle = (i / numPoints) * deltaRad;
            const r = (radius + 10) * scale;
            const x = originX + r * Math.sin(angle);
            const y = originY - r * (1 - Math.cos(angle));
            points.push(x, y);
        }

        return points;
    };

    const gridLines = generateGrid();
    const curvePoints = calculateCurvePoints();
    const offsetPoints = calculateOffsetLine();
    const pegs = generatePegs();

    const toggleLayer = (layer) => {
        setLayers({ ...layers, [layer]: !layers[layer] });
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <Label className="text-xs">Radius (m)</Label>
                    <Input
                        type="number"
                        value={curveParams.radius}
                        onChange={(e) => setCurveParams({ ...curveParams, radius: parseFloat(e.target.value) })}
                        className="h-8 text-xs"
                    />
                </div>
                <div>
                    <Label className="text-xs">Deflection Angle (°)</Label>
                    <Input
                        type="number"
                        value={curveParams.intersectionAngle}
                        onChange={(e) => setCurveParams({ ...curveParams, intersectionAngle: parseFloat(e.target.value) })}
                        className="h-8 text-xs"
                    />
                </div>
                <div>
                    <Label className="text-xs">Origin X (px)</Label>
                    <Input
                        type="number"
                        value={curveParams.originX}
                        onChange={(e) => setCurveParams({ ...curveParams, originX: parseFloat(e.target.value) })}
                        className="h-8 text-xs"
                    />
                </div>
                <div>
                    <Label className="text-xs">Origin Y (px)</Label>
                    <Input
                        type="number"
                        value={curveParams.originY}
                        onChange={(e) => setCurveParams({ ...curveParams, originY: parseFloat(e.target.value) })}
                        className="h-8 text-xs"
                    />
                </div>
            </div>

            <div className="flex gap-4 flex-wrap text-xs py-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={layers.grid} onCheckedChange={() => toggleLayer('grid')} />
                    <span>Grid</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={layers.baseline} onCheckedChange={() => toggleLayer('baseline')} />
                    <span>Baseline</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={layers.curve} onCheckedChange={() => toggleLayer('curve')} />
                    <span>Centerline</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={layers.offsets} onCheckedChange={() => toggleLayer('offsets')} />
                    <span>Offset Line</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={layers.pegs} onCheckedChange={() => toggleLayer('pegs')} />
                    <span>Peg Points</span>
                </label>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-inner">
                <Stage width={dimensions.width} height={dimensions.height}>
                    <Layer>
                        <Rect
                            x={0}
                            y={0}
                            width={dimensions.width}
                            height={dimensions.height}
                            fill="#ffffff"
                        />

                        {layers.grid && gridLines.map((line, i) => (
                            <Line key={`grid-${i}`} {...line} />
                        ))}

                        {layers.baseline && (
                            <Line
                                points={[curveParams.originX, curveParams.originY, curveParams.originX + 300, curveParams.originY]}
                                stroke="#9ca3af"
                                strokeWidth={1}
                                dash={[5, 5]}
                            />
                        )}

                        {layers.curve && (
                            <Line
                                points={curvePoints}
                                stroke="#374151"
                                strokeWidth={3}
                            />
                        )}

                        {layers.offsets && (
                            <Line
                                points={offsetPoints}
                                stroke="#6b7280"
                                strokeWidth={2}
                                dash={[10, 5]}
                            />
                        )}

                        {layers.pegs && pegs.map((peg, i) => (
                            <React.Fragment key={`peg-${i}`}>
                                <Circle
                                    x={peg.x}
                                    y={peg.y}
                                    radius={4}
                                    fill="#1f2937"
                                />
                                <Text
                                    x={peg.x + 8}
                                    y={peg.y - 8}
                                    text={peg.label}
                                    fontSize={10}
                                    fill="#4b5563"
                                />
                            </React.Fragment>
                        ))}

                        <Circle
                            x={curveParams.originX}
                            y={curveParams.originY}
                            radius={5}
                            fill="#ef4444"
                        />
                        <Text
                            x={curveParams.originX + 10}
                            y={curveParams.originY - 10}
                            text="TC"
                            fontSize={12}
                            fill="#1f2937"
                            fontStyle="bold"
                        />

                        {layers.dimensions && (
                            <>
                                <Arrow
                                    points={[
                                        curveParams.originX,
                                        curveParams.originY,
                                        curveParams.originX + curveParams.radius * scale * Math.sin(curveParams.intersectionAngle * Math.PI / 360),
                                        curveParams.originY - curveParams.radius * scale * (1 - Math.cos(curveParams.intersectionAngle * Math.PI / 360))
                                    ]}
                                    stroke="#6b7280"
                                    strokeWidth={1}
                                    pointerLength={6}
                                    pointerWidth={6}
                                    dash={[3, 3]}
                                />
                                <Text
                                    x={curveParams.originX + (curveParams.radius * scale * 0.3)}
                                    y={curveParams.originY - (curveParams.radius * scale * 0.1)}
                                    text={`R=${curveParams.radius}m`}
                                    fontSize={11}
                                    fill="#374151"
                                />
                            </>
                        )}
                    </Layer>
                </Stage>
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p><strong>Scale:</strong> 1:{50 / scale}  |  <strong>Display:</strong> 2D plan view  |  <strong>Units:</strong> meters</p>
            </div>
        </div>
    );
};

// Grid Setting-Out Component
const GridSettingOut = () => {
    const [dimensions] = useState({ width: 700, height: 500 });
    const [gridParams, setGridParams] = useState({
        spacingX: 50,
        spacingY: 50,
        numX: 5,
        numY: 4,
        originX: 100,
        originY: 100,
        rotation: 0
    });

    const scale = 3; // pixels per meter

    const generateGridPoints = () => {
        const points = [];
        const { spacingX, spacingY, numX, numY, originX, originY, rotation } = gridParams;
        const rotRad = (rotation * Math.PI) / 180;
        const cosR = Math.cos(rotRad);
        const sinR = Math.sin(rotRad);

        const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

        for (let j = 0; j < numY; j++) {
            for (let i = 0; i < numX; i++) {
                const localX = i * spacingX * scale;
                const localY = j * spacingY * scale;

                const rotX = localX * cosR - localY * sinR;
                const rotY = localX * sinR + localY * cosR;

                const x = originX + rotX;
                const y = originY + rotY;

                points.push({
                    x,
                    y,
                    label: `${rowLabels[j]}${i + 1}`
                });
            }
        }

        return points;
    };

    const points = generateGridPoints();

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                    <Label className="text-xs">X Spacing (m)</Label>
                    <Input
                        type="number"
                        value={gridParams.spacingX}
                        onChange={(e) => setGridParams({ ...gridParams, spacingX: parseFloat(e.target.value) })}
                        className="h-8 text-xs"
                    />
                </div>
                <div>
                    <Label className="text-xs">Y Spacing (m)</Label>
                    <Input
                        type="number"
                        value={gridParams.spacingY}
                        onChange={(e) => setGridParams({ ...gridParams, spacingY: parseFloat(e.target.value) })}
                        className="h-8 text-xs"
                    />
                </div>
                <div>
                    <Label className="text-xs">Columns</Label>
                    <Input
                        type="number"
                        value={gridParams.numX}
                        onChange={(e) => setGridParams({ ...gridParams, numX: parseInt(e.target.value) })}
                        className="h-8 text-xs"
                    />
                </div>
                <div>
                    <Label className="text-xs">Rows</Label>
                    <Input
                        type="number"
                        value={gridParams.numY}
                        onChange={(e) => setGridParams({ ...gridParams, numY: parseInt(e.target.value) })}
                        className="h-8 text-xs"
                    />
                </div>
                <div>
                    <Label className="text-xs">Rotation (°)</Label>
                    <Input
                        type="number"
                        value={gridParams.rotation}
                        onChange={(e) => setGridParams({ ...gridParams, rotation: parseFloat(e.target.value) })}
                        className="h-8 text-xs"
                    />
                </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-inner">
                <Stage width={dimensions.width} height={dimensions.height}>
                    <Layer>
                        <Rect x={0} y={0} width={dimensions.width} height={dimensions.height} fill="#ffffff" />

                        {points.map((pt, i) => {
                            const nextRight = points[i + 1];
                            const nextDown = points[i + gridParams.numX];

                            return (
                                <React.Fragment key={`grid-${i}`}>
                                    {nextRight && nextRight.y === pt.y && (
                                        <Line
                                            points={[pt.x, pt.y, nextRight.x, nextRight.y]}
                                            stroke="#d1d5db"
                                            strokeWidth={1}
                                        />
                                    )}
                                    {nextDown && (
                                        <Line
                                            points={[pt.x, pt.y, nextDown.x, nextDown.y]}
                                            stroke="#d1d5db"
                                            strokeWidth={1}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}

                        {points.map((pt, i) => (
                            <React.Fragment key={`point-${i}`}>
                                <Circle
                                    x={pt.x}
                                    y={pt.y}
                                    radius={5}
                                    fill="#374151"
                                />
                                <Text
                                    x={pt.x + 8}
                                    y={pt.y - 15}
                                    text={pt.label}
                                    fontSize={11}
                                    fill="#1f2937"
                                    fontStyle="bold"
                                />
                            </React.Fragment>
                        ))}

                        <Circle
                            x={gridParams.originX}
                            y={gridParams.originY}
                            radius={7}
                            fill="#ef4444"
                        />
                        <Text
                            x={gridParams.originX + 12}
                            y={gridParams.originY - 5}
                            text="ORIGIN"
                            fontSize={10}
                            fill="#ef4444"
                            fontStyle="bold"
                        />
                    </Layer>
                </Stage>
            </div>

            <div className="max-h-48 overflow-auto border border-gray-200 rounded-lg">
                <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                            <th className="px-3 py-2 text-left border-b border-gray-200 font-semibold">Grid ID</th>
                            <th className="px-3 py-2 text-right border-b border-gray-200 font-semibold">X (m)</th>
                            <th className="px-3 py-2 text-right border-b border-gray-200 font-semibold">Y (m)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {points.map((pt, i) => (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                                <td className="px-3 py-2 font-mono">{pt.label}</td>
                                <td className="px-3 py-2 text-right font-mono">
                                    {((pt.x - gridParams.originX) / scale).toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono">
                                    {((pt.y - gridParams.originY) / scale).toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Main component wrapper
export default function Surveying2DVisualizer() {
    const [activeTab, setActiveTab] = useState('curve');

    return (
        <div className="w-full max-w-6xl mx-auto p-4 bg-white">
            <h1 className="text-2xl font-semibold text-gray-900 mb-6">2D Setting-Out Plans</h1>

            <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg w-fit">
                <Button
                    variant={activeTab === 'curve' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('curve')}
                    className={`text-sm h-8 px-4 ${activeTab === 'curve' ? 'bg-white text-gray-900 shadow-sm border-transparent' : 'bg-transparent border-transparent text-gray-500'}`}
                >
                    Curve Layout
                </Button>
                <Button
                    variant={activeTab === 'grid' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('grid')}
                    className={`text-sm h-8 px-4 ${activeTab === 'grid' ? 'bg-white text-gray-900 shadow-sm border-transparent' : 'bg-transparent border-transparent text-gray-500'}`}
                >
                    Grid Layout
                </Button>
            </div>

            <Card className="animate-in fade-in duration-300">
                <CardHeader>
                    <CardTitle className="text-lg">
                        {activeTab === 'curve' ? 'Horizontal Curve Setting-Out' : 'Building Grid Setting-Out'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {activeTab === 'curve' ? <SettingOut2DPlan /> : <GridSettingOut />}
                </CardContent>
            </Card>
        </div>
    );
}