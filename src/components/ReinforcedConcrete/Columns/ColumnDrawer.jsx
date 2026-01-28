import React from "react";
import { Group, Rect, Circle, Text, Stage, Layer, Line } from 'react-konva';

/**
 * ColumnKonvaDrawer (2D)
 * Renders professional cross-sections of RC columns with AutoCAD-style detailing.
 */
const ColumnKonvaGroup = ({
    width = 300,
    depth = 300,
    cover = 40,
    barDia = 16,
    numBars = 4,
    tieDia = 8,
    showLabels = true,
    scale = 0.8,
    x = 0,
    y = 0,
    textSize = 10
}) => {
    // Column Shape
    const w = width * scale;
    const d = depth * scale;
    const tlX = -w / 2;
    const tlY = -d / 2;

    // Tie (Link)
    const c = cover * scale;
    const t = tieDia * scale;
    const tieL = tlX + c + t / 2;
    const tieT = tlY + c + t / 2;
    const tieW = w - 2 * c - t;
    const tieH = d - 2 * c - t;

    // Bars
    const bDia = barDia * scale;
    const positions = [];

    // Corners
    positions.push({ x: tieL, y: tieT });
    positions.push({ x: tieL + tieW, y: tieT });
    positions.push({ x: tieL + tieW, y: tieT + tieH });
    positions.push({ x: tieL, y: tieT + tieH });

    const rem = Math.max(0, numBars - 4);
    if (rem > 0) {
        const barsX = Math.round(rem * (width / (width + depth)) / 2);
        const barsY = Math.ceil((rem - 2 * barsX) / 2);

        if (barsX > 0) {
            const gap = tieW / (barsX + 1);
            for (let i = 1; i <= barsX; i++) {
                positions.push({ x: tieL + gap * i, y: tieT });
                positions.push({ x: tieL + gap * i, y: tieT + tieH });
            }
        }

        const remainingY = (numBars - 4) - (barsX * 2);
        if (remainingY > 0) {
            const leftCount = Math.ceil(remainingY / 2);
            const rightCount = remainingY - leftCount;
            if (leftCount > 0) {
                const gap = tieH / (leftCount + 1);
                for (let i = 1; i <= leftCount; i++) positions.push({ x: tieL, y: tieT + gap * i });
            }
            if (rightCount > 0) {
                const gap = tieH / (rightCount + 1);
                for (let i = 1; i <= rightCount; i++) positions.push({ x: tieL + tieW, y: tieT + gap * i });
            }
        }
    }

    // --- Detailing Helpers ---
    const DimensionLine = ({ x1, y1, x2, y2, text, vertical = false, offset = 30 }) => {
        const lineX1 = vertical ? x1 - offset : x1;
        const lineY1 = vertical ? y1 : y1 - offset;
        const lineX2 = vertical ? x2 - offset : x2;
        const lineY2 = vertical ? y2 : y2 - offset;
        return (
            <Group>
                <Line points={[lineX1, lineY1, lineX2, lineY2]} stroke="black" strokeWidth={0.8} />
                <Line points={[x1, y1, lineX1, lineY1]} stroke="#666" strokeWidth={0.5} />
                <Line points={[x2, y2, lineX2, lineY2]} stroke="#666" strokeWidth={0.5} />
                <Line points={[lineX1 - 4, lineY1 + 4, lineX1 + 4, lineY1 - 4]} stroke="black" strokeWidth={1.2} />
                <Line points={[lineX2 - 4, lineY2 + 4, lineX2 + 4, lineY2 - 4]} stroke="black" strokeWidth={1.2} />
                <Text
                    x={vertical ? lineX1 - 22 : (lineX1 + lineX2) / 2 - 15}
                    y={vertical ? (lineY1 + lineY2) / 2 - 10 : lineY1 - 15}
                    text={text}
                    fontSize={textSize}
                    fontFamily="Arial"
                    rotation={vertical ? -90 : 0}
                    fill="#000"
                />
            </Group>
        );
    };

    const LeaderLine = ({ tx, ty, ex, ey, text }) => {
        const angle = Math.atan2(ey - ty, ex - tx);
        const arrowSize = 6;
        const arrowPoints = [
            tx, ty,
            tx + arrowSize * Math.cos(angle + 0.5), ty + arrowSize * Math.sin(angle + 0.5),
            tx + arrowSize * Math.cos(angle - 0.5), ty + arrowSize * Math.sin(angle - 0.5),
        ];
        return (
            <Group>
                <Line points={[tx, ty, ex, ey, ex + (ex > tx ? 15 : -15), ey]} stroke="#000" strokeWidth={0.8} />
                <Line points={arrowPoints} closed fill="#333" stroke="#000" strokeWidth={1} />
                <Text x={ex + (ex > tx ? 20 : -85)} y={ey - 5} text={text} fontSize={textSize} fontFamily="Arial" fill="#000" />
            </Group>
        );
    };

    return (
        <Group x={x} y={y}>
            {/* Concrete Outline */}
            <Rect
                x={tlX}
                y={tlY}
                width={w}
                height={d}
                stroke="black"
                strokeWidth={2.5}
            />
            {/* Tie */}
            <Rect
                x={tieL - t / 2}
                y={tieT - t / 2}
                width={tieW + t}
                height={tieH + t}
                stroke="#333"
                strokeWidth={1.2}
                cornerRadius={t}
            />
            {/* Bars */}
            {positions.map((p, i) => (
                <Circle
                    key={i}
                    x={p.x}
                    y={p.y}
                    radius={bDia / 2}
                    fill="black"
                />
            ))}
            {/* Detailing */}
            {showLabels && (
                <>
                    <DimensionLine x1={tlX} y1={tlY + d} x2={tlX + w} y2={tlY + d} text={`${width}`} offset={-35} />
                    <DimensionLine x1={tlX} y1={tlY} x2={tlX} y2={tlY + d} text={`${depth}`} vertical offset={35} />

                    {/* Reinforcement Labels */}
                    <LeaderLine tx={positions[0].x} ty={positions[0].y} ex={tlX - 45} ey={tlY - 25} text={`${numBars}T${barDia}`} />
                    <LeaderLine tx={tieL + tieW} ty={tieT + tieH / 2} ex={tlX + w + 45} ey={tlY + d / 2} text={`R${tieDia}-200`} />

                    <Text
                        x={tlX}
                        y={tlY + d + 50}
                        width={w}
                        text="SECTION A-A"
                        align="center"
                        fontSize={textSize * 1.3}
                        fontStyle="bold"
                        fill="#000"
                    />
                </>
            )}
        </Group>
    );
};

export { ColumnKonvaGroup };

/**
 * Returns an array of CAD objects (lines, circles, text) representing the column design.
 * Used for "exploding" members in the universal CAD drawer.
 */
export const getColumnCADPrimitives = (config, x = 0, y = 0, scale = 0.8) => {
    const {
        width = 300,
        depth = 300,
        cover = 40,
        barDia = 16,
        numBars = 4,
        tieDia = 8,
    } = config;

    const w = width * scale;
    const d = depth * scale;
    const tlX = x - w / 2;
    const tlY = y - d / 2;
    const layerId = "structural";
    const primitives = [];

    // 1. Concrete Outline (Line)
    primitives.push({
        id: Math.random().toString(),
        type: 'rectangle',
        start: { x: tlX, y: tlY },
        end: { x: tlX + w, y: tlY + d },
        color: '#000',
        layerId
    });

    // 2. Tie (Line)
    const c = cover * scale;
    const t = tieDia * scale;
    const tieL = tlX + c + t / 2;
    const tieT = tlY + c + t / 2;
    const tieW = w - 2 * c - t;
    const tieH = d - 2 * c - t;
    primitives.push({
        id: Math.random().toString(),
        type: 'rectangle',
        start: { x: tieL, y: tieT },
        end: { x: tieL + tieW, y: tieT + tieH },
        color: '#333',
        layerId
    });

    // 3. Bars (Circles) - Simple corner logic for primitives
    const bDia = barDia * scale;
    const positions = [
        { x: tieL, y: tieT },
        { x: tieL + tieW, y: tieT },
        { x: tieL + tieW, y: tieT + tieH },
        { x: tieL, y: tieT + tieH }
    ];
    positions.forEach(p => {
        primitives.push({ id: Math.random().toString(), type: 'circle', center: p, radius: bDia / 2, color: '#000', layerId });
    });

    // 4. Detailing (Dimensions)
    const addDim = (x1, y1, x2, y2, text, vertical = false, offset = 30) => {
        const lineX1 = vertical ? x1 - offset : x1;
        const lineY1 = vertical ? y1 : y1 - offset;
        const lineX2 = vertical ? x2 - offset : x2;
        const lineY2 = vertical ? y2 : y2 - offset;
        primitives.push({ id: Math.random().toString(), type: 'line', start: { x: lineX1, y: lineY1 }, end: { x: lineX2, y: lineY2 }, color: '#666', layerId });
        primitives.push({ id: Math.random().toString(), type: 'line', start: { x: x1, y: y1 }, end: { x: lineX1, y: lineY1 }, color: '#999', layerId });
        primitives.push({ id: Math.random().toString(), type: 'line', start: { x: x2, y: y2 }, end: { x: lineX2, y: lineY2 }, color: '#999', layerId });
        primitives.push({
            id: Math.random().toString(),
            type: 'text',
            position: { x: vertical ? lineX1 - 15 : (lineX1 + lineX2) / 2, y: vertical ? (lineY1 + lineY2) / 2 : lineY1 - 10 },
            text,
            size: 0.8,
            color: '#000',
            layerId
        });
    };

    addDim(tlX, tlY + d, tlX + w, tlY + d, `${width}`, false, -35);
    addDim(tlX, tlY, tlX, tlY + d, `${depth}`, true, 35);

    // 5. Leader Lines
    const addLeader = (tx, ty, ex, ey, text) => {
        primitives.push({ id: Math.random().toString(), type: 'line', start: { x: tx, y: ty }, end: { x: ex, y: ey }, color: '#333', layerId });
        primitives.push({ id: Math.random().toString(), type: 'line', start: { x: ex, y: ey }, end: { x: ex + (ex > tx ? 15 : -15), y: ey }, color: '#333', layerId });
        primitives.push({
            id: Math.random().toString(),
            type: 'text',
            position: { x: ex + (ex > tx ? 20 : -80), y: ey - 5 },
            text,
            size: 0.8,
            color: '#000',
            layerId
        });
    };

    addLeader(positions[0].x, positions[0].y, tlX - 45, tlY - 25, `${numBars}T${barDia}`);
    addLeader(tieL + tieW, tieT + tieH / 2, tlX + w + 45, tlY + d / 2, `R${tieDia}-200`);

    // 6. Section Title
    primitives.push({ id: Math.random().toString(), type: 'text', position: { x: x - 40, y: tlY + d + 80 }, text: "SECTION A-A", size: 1.2, color: '#000', layerId });

    return primitives;
};

const ColumnKonvaDrawer = (props) => {
    const width = props.canvasWidth || 300;
    const height = props.canvasHeight || 400;

    return (
        <Stage width={width} height={height}>
            <Layer>
                <ColumnKonvaGroup {...props} x={width / 2} y={height / 2} />
            </Layer>
        </Stage>
    );
};

export default ColumnKonvaDrawer;
