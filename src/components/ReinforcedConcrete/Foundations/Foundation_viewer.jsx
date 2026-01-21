import React, { useState } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Group, Arc } from 'react-konva';

// Pad Foundation Viewer
const PadFoundationViewer = ({ params }) => {
    const {
        length = 2000,
        width = 2000,
        depth = 500,
        column_width = 400,
        column_depth = 400,
        cover = 75,
        side_cover = 75,
        main_bars_x = { count: 8, diameter: 16, spacing: 200 },
        main_bars_y = { count: 8, diameter: 16, spacing: 200 },
        steel_grade = "Grade 460",
        concrete_grade = "C30"
    } = params;

    const scale = 0.15; // Scale factor for visualization
    const offset_x = 50;
    const offset_y = 50;

    // Scaled dimensions
    const L = length * scale;
    const B = width * scale;
    const D = depth * scale;
    const col_w = column_width * scale;
    const col_d = column_depth * scale;
    const cov = cover * scale;
    const s_cov = side_cover * scale;

    const bar_prefix = steel_grade.includes("460") ? "H" : "R";

    return (
        <div style={{ padding: '20px', backgroundColor: '#f5f5f5' }}>
            <h3 style={{ marginBottom: '10px', fontFamily: 'Arial' }}>Pad Foundation Detail - BS EN 1992-1-1:2004</h3>

            <Stage width={1200} height={800}>
                <Layer>
                    {/* PLAN VIEW */}
                    <Group x={offset_x} y={offset_y}>
                        {/* Foundation outline */}
                        <Rect
                            x={0}
                            y={0}
                            width={L}
                            height={B}
                            stroke="black"
                            strokeWidth={3}
                            fill="#e0e0e0"
                        />

                        {/* Column */}
                        <Rect
                            x={(L - col_w) / 2}
                            y={(B - col_d) / 2}
                            width={col_w}
                            height={col_d}
                            fill="#666"
                            stroke="black"
                            strokeWidth={2}
                        />

                        {/* Main bars X-direction */}
                        {Array.from({ length: main_bars_x.count }).map((_, i) => {
                            const bar_y = s_cov + main_bars_y.diameter * scale + i * main_bars_x.spacing * scale;
                            if (bar_y <= B - s_cov) {
                                return (
                                    <React.Fragment key={`x-bar-${i}`}>
                                        <Line
                                            points={[s_cov, bar_y, L - s_cov, bar_y]}
                                            stroke="red"
                                            strokeWidth={2}
                                        />
                                        <Circle
                                            x={s_cov}
                                            y={bar_y}
                                            radius={main_bars_x.diameter * scale / 2}
                                            fill="red"
                                            stroke="darkred"
                                            strokeWidth={1}
                                        />
                                        <Circle
                                            x={L - s_cov}
                                            y={bar_y}
                                            radius={main_bars_x.diameter * scale / 2}
                                            fill="red"
                                            stroke="darkred"
                                            strokeWidth={1}
                                        />
                                    </React.Fragment>
                                );
                            }
                            return null;
                        })}

                        {/* Main bars Y-direction */}
                        {Array.from({ length: main_bars_y.count }).map((_, i) => {
                            const bar_x = s_cov + main_bars_x.diameter * scale + i * main_bars_y.spacing * scale;
                            if (bar_x <= L - s_cov) {
                                return (
                                    <Line
                                        key={`y-bar-${i}`}
                                        points={[bar_x, s_cov, bar_x, B - s_cov]}
                                        stroke="blue"
                                        strokeWidth={2}
                                        dash={[5, 5]}
                                    />
                                );
                            }
                            return null;
                        })}

                        {/* Labels */}
                        <Text
                            x={L / 2}
                            y={-30}
                            text="PLAN"
                            fontSize={16}
                            fontStyle="bold"
                            fill="black"
                            align="center"
                            offsetX={20}
                        />

                        {/* Dimensions */}
                        <Line
                            points={[0, B + 30, L, B + 30]}
                            stroke="green"
                            strokeWidth={1}
                        />
                        <Line
                            points={[0, B + 20, 0, B + 40]}
                            stroke="green"
                            strokeWidth={1}
                        />
                        <Line
                            points={[L, B + 20, L, B + 40]}
                            stroke="green"
                            strokeWidth={1}
                        />
                        <Text
                            x={L / 2}
                            y={B + 45}
                            text={`${length}mm`}
                            fontSize={12}
                            fill="green"
                            align="center"
                            offsetX={25}
                        />

                        {/* Section cut line */}
                        <Line
                            points={[- 20, B / 2, L + 20, B / 2]}
                            stroke="green"
                            strokeWidth={2}
                            dash={[10, 5]}
                        />
                        <Text
                            x={-30}
                            y={B / 2 - 20}
                            text="A"
                            fontSize={14}
                            fontStyle="bold"
                            fill="green"
                        />
                        <Text
                            x={L + 25}
                            y={B / 2 - 20}
                            text="A"
                            fontSize={14}
                            fontStyle="bold"
                            fill="green"
                        />
                    </Group>

                    {/* SECTION A-A */}
                    <Group x={offset_x + L + 100} y={offset_y}>
                        {/* Foundation */}
                        <Rect
                            x={0}
                            y={0}
                            width={L}
                            height={D}
                            stroke="black"
                            strokeWidth={3}
                            fill="#d0d0d0"
                        />

                        {/* Ground level */}
                        <Line
                            points={[-30, 0, L + 30, 0]}
                            stroke="brown"
                            strokeWidth={1}
                            dash={[8, 4]}
                        />

                        {/* Column */}
                        <Rect
                            x={(L - col_w) / 2}
                            y={-40}
                            width={col_w}
                            height={40}
                            fill="#666"
                            stroke="black"
                            strokeWidth={2}
                        />

                        {/* Bottom reinforcement bars */}
                        {Array.from({ length: main_bars_x.count }).map((_, i) => {
                            const bar_x = s_cov + i * main_bars_x.spacing * scale;
                            const bar_y = D - cov - main_bars_x.diameter * scale / 2;
                            if (bar_x <= L - s_cov) {
                                return (
                                    <Circle
                                        key={`section-bar-${i}`}
                                        x={bar_x}
                                        y={bar_y}
                                        radius={main_bars_x.diameter * scale / 2}
                                        fill="red"
                                        stroke="darkred"
                                        strokeWidth={1}
                                    />
                                );
                            }
                            return null;
                        })}

                        {/* Y-bars shown as crosses */}
                        {[0, 2, 4].map((idx) => {
                            const bar_x = L / 2;
                            const bar_y = D - cov - main_bars_x.diameter * scale - main_bars_y.diameter * scale / 2;
                            const cross_size = main_bars_y.diameter * scale * 0.7;

                            return (
                                <React.Fragment key={`cross-${idx}`}>
                                    <Line
                                        points={[
                                            bar_x - cross_size / 2, bar_y - cross_size / 2,
                                            bar_x + cross_size / 2, bar_y + cross_size / 2
                                        ]}
                                        stroke="blue"
                                        strokeWidth={2}
                                    />
                                    <Line
                                        points={[
                                            bar_x - cross_size / 2, bar_y + cross_size / 2,
                                            bar_x + cross_size / 2, bar_y - cross_size / 2
                                        ]}
                                        stroke="blue"
                                        strokeWidth={2}
                                    />
                                </React.Fragment>
                            );
                        })}

                        {/* Labels */}
                        <Text
                            x={L / 2}
                            y={D + 20}
                            text="SECTION A-A"
                            fontSize={16}
                            fontStyle="bold"
                            fill="black"
                            align="center"
                            offsetX={50}
                        />

                        {/* Depth dimension */}
                        <Line
                            points={[-30, 0, -30, D]}
                            stroke="green"
                            strokeWidth={1}
                        />
                        <Line
                            points={[-40, 0, -20, 0]}
                            stroke="green"
                            strokeWidth={1}
                        />
                        <Line
                            points={[-40, D, -20, D]}
                            stroke="green"
                            strokeWidth={1}
                        />
                        <Text
                            x={-50}
                            y={D / 2}
                            text={`${depth}mm`}
                            fontSize={12}
                            fill="green"
                            rotation={-90}
                            align="center"
                            offsetX={25}
                        />

                        {/* Cover annotation */}
                        <Line
                            points={[5, D, 5, D - cov]}
                            stroke="orange"
                            strokeWidth={1}
                            dash={[3, 3]}
                        />
                        <Text
                            x={10}
                            y={D - cov / 2}
                            text="75"
                            fontSize={10}
                            fill="orange"
                        />
                    </Group>

                    {/* NOTES */}
                    <Group x={offset_x} y={offset_y + B + 100}>
                        <Text
                            x={0}
                            y={0}
                            text="REINFORCEMENT SCHEDULE:"
                            fontSize={13}
                            fontStyle="bold"
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={20}
                            text={`Bottom bars (X): ${main_bars_x.count}${bar_prefix}${main_bars_x.diameter} @ ${main_bars_x.spacing}mm c/c`}
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={38}
                            text={`Bottom bars (Y): ${main_bars_y.count}${bar_prefix}${main_bars_y.diameter} @ ${main_bars_y.spacing}mm c/c`}
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={56}
                            text={`Cover: ${cover}mm bottom, ${side_cover}mm sides`}
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={74}
                            text={`Concrete: ${concrete_grade} | Steel: ${steel_grade}`}
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={92}
                            text="Ref: BS EN 1992-1-1:2004"
                            fontSize={10}
                            fill="gray"
                            fontStyle="italic"
                        />
                    </Group>
                </Layer>
            </Stage>
        </div>
    );
};

// Pile Cap Viewer
const PileCapViewer = ({ params }) => {
    const {
        length = 3000,
        width = 3000,
        depth = 800,
        column_width = 450,
        pile_diameter = 450,
        pile_count = 4,
        pile_spacing = 1350,
        cover = 75,
        main_bars = { count: 8, diameter: 20 },
        link_diameter = 12,
        steel_grade = "Grade 460",
        concrete_grade = "C30"
    } = params;

    const scale = 0.12;
    const offset_x = 50;
    const offset_y = 50;

    const L = length * scale;
    const B = width * scale;
    const D = depth * scale;
    const col_w = column_width * scale;
    const pile_dia = pile_diameter * scale;
    const pile_sp = pile_spacing * scale;
    const cov = cover * scale;

    const bar_prefix = steel_grade.includes("460") ? "H" : "R";

    // Calculate pile positions
    const rows = Math.ceil(Math.sqrt(pile_count));
    const cols = rows;
    const pilePositions = [];
    const start_x = (L - (cols - 1) * pile_sp) / 2;
    const start_y = (B - (rows - 1) * pile_sp) / 2;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            if (pilePositions.length < pile_count) {
                pilePositions.push({
                    x: start_x + j * pile_sp,
                    y: start_y + i * pile_sp
                });
            }
        }
    }

    return (
        <div style={{ padding: '20px', backgroundColor: '#f5f5f5' }}>
            <h3 style={{ marginBottom: '10px', fontFamily: 'Arial' }}>Pile Cap Detail - BS EN 1992-1-1:2004</h3>

            <Stage width={1200} height={800}>
                <Layer>
                    {/* PLAN VIEW */}
                    <Group x={offset_x} y={offset_y}>
                        {/* Pile cap outline */}
                        <Rect
                            x={0}
                            y={0}
                            width={L}
                            height={B}
                            stroke="black"
                            strokeWidth={3}
                            fill="#e8e8e8"
                        />

                        {/* Column */}
                        <Rect
                            x={(L - col_w) / 2}
                            y={(B - col_w) / 2}
                            width={col_w}
                            height={col_w}
                            fill="#666"
                            stroke="black"
                            strokeWidth={2}
                        />

                        {/* Piles */}
                        {pilePositions.map((pos, idx) => (
                            <React.Fragment key={`pile-${idx}`}>
                                <Circle
                                    x={pos.x}
                                    y={pos.y}
                                    radius={pile_dia / 2}
                                    stroke="darkblue"
                                    strokeWidth={2}
                                    fill="rgba(70, 130, 180, 0.3)"
                                />
                                {/* Pile centerlines */}
                                <Line
                                    points={[pos.x - pile_dia * 0.3, pos.y, pos.x + pile_dia * 0.3, pos.y]}
                                    stroke="blue"
                                    strokeWidth={1}
                                    dash={[3, 3]}
                                />
                                <Line
                                    points={[pos.x, pos.y - pile_dia * 0.3, pos.x, pos.y + pile_dia * 0.3]}
                                    stroke="blue"
                                    strokeWidth={1}
                                    dash={[3, 3]}
                                />
                            </React.Fragment>
                        ))}

                        {/* Main reinforcement grid (simplified) */}
                        {Array.from({ length: 5 }).map((_, i) => {
                            const bar_y = cov + i * 40;
                            return (
                                <Line
                                    key={`reinf-x-${i}`}
                                    points={[cov, bar_y, L - cov, bar_y]}
                                    stroke="red"
                                    strokeWidth={1.5}
                                />
                            );
                        })}

                        {Array.from({ length: 5 }).map((_, i) => {
                            const bar_x = cov + i * 40;
                            return (
                                <Line
                                    key={`reinf-y-${i}`}
                                    points={[bar_x, cov, bar_x, B - cov]}
                                    stroke="red"
                                    strokeWidth={1.5}
                                    dash={[4, 4]}
                                />
                            );
                        })}

                        <Text
                            x={L / 2}
                            y={-25}
                            text="PLAN"
                            fontSize={16}
                            fontStyle="bold"
                            fill="black"
                            offsetX={20}
                        />
                    </Group>

                    {/* SECTION VIEW */}
                    <Group x={offset_x + L + 100} y={offset_y}>
                        {/* Pile cap */}
                        <Rect
                            x={0}
                            y={0}
                            width={L}
                            height={D}
                            stroke="black"
                            strokeWidth={3}
                            fill="#d8d8d8"
                        />

                        {/* Ground level */}
                        <Line
                            points={[-30, 0, L + 30, 0]}
                            stroke="brown"
                            strokeWidth={1}
                            dash={[8, 4]}
                        />

                        {/* Column */}
                        <Rect
                            x={(L - col_w) / 2}
                            y={-50}
                            width={col_w}
                            height={50}
                            fill="#666"
                            stroke="black"
                            strokeWidth={2}
                        />

                        {/* Piles in section (2 piles shown) */}
                        {pilePositions.slice(0, 2).map((pos, idx) => {
                            const pile_x = pos.x;
                            const pile_height = 100;
                            return (
                                <Rect
                                    key={`pile-section-${idx}`}
                                    x={pile_x - pile_dia / 2}
                                    y={D}
                                    width={pile_dia}
                                    height={pile_height}
                                    fill="rgba(70, 130, 180, 0.5)"
                                    stroke="darkblue"
                                    strokeWidth={2}
                                />
                            );
                        })}

                        {/* Bottom bars */}
                        {Array.from({ length: main_bars.count }).map((_, i) => {
                            const bar_x = cov + i * (L - 2 * cov) / (main_bars.count - 1);
                            const bar_y = D - cov - main_bars.diameter * scale / 2;
                            return (
                                <Circle
                                    key={`bot-bar-${i}`}
                                    x={bar_x}
                                    y={bar_y}
                                    radius={main_bars.diameter * scale / 2}
                                    fill="red"
                                    stroke="darkred"
                                    strokeWidth={1}
                                />
                            );
                        })}

                        {/* Links */}
                        {[L / 3, 2 * L / 3].map((link_x, idx) => (
                            <Rect
                                key={`link-${idx}`}
                                x={link_x - 5}
                                y={cov}
                                width={10}
                                height={D - 2 * cov - main_bars.diameter * scale}
                                stroke="orange"
                                strokeWidth={1.5}
                                fill="none"
                            />
                        ))}

                        <Text
                            x={L / 2}
                            y={D + 25}
                            text="SECTION"
                            fontSize={16}
                            fontStyle="bold"
                            fill="black"
                            offsetX={35}
                        />
                    </Group>

                    {/* NOTES */}
                    <Group x={offset_x} y={offset_y + B + 80}>
                        <Text
                            x={0}
                            y={0}
                            text="REINFORCEMENT SCHEDULE:"
                            fontSize={13}
                            fontStyle="bold"
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={20}
                            text={`Main bars: ${main_bars.count}${bar_prefix}${main_bars.diameter} @ 200mm each way (bottom)`}
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={38}
                            text={`Links: ${bar_prefix}${link_diameter} @ 300mm (2 layers)`}
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={56}
                            text={`Piles: ${pile_count} No. Ø${pile_diameter}mm @ ${pile_spacing}mm c/c`}
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={74}
                            text={`Cover: ${cover}mm | Concrete: ${concrete_grade} | Steel: ${steel_grade}`}
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={92}
                            text="Bars rest on pile heads - Main bars bent at ends"
                            fontSize={10}
                            fill="gray"
                        />
                        <Text
                            x={0}
                            y={108}
                            text="Ref: BS EN 1992-1-1:2004"
                            fontSize={10}
                            fill="gray"
                            fontStyle="italic"
                        />
                    </Group>
                </Layer>
            </Stage>
        </div>
    );
};

// Strip Foundation Viewer
const StripFoundationViewer = ({ params }) => {
    const {
        width = 900,
        depth = 450,
        wall_width = 300,
        cover = 75,
        main_bars = { count: 5, diameter: 16 },
        distribution_bars = { diameter: 12, spacing: 300 },
        steel_grade = "Grade 460",
        concrete_grade = "C30"
    } = params;

    const scale = 0.4;
    const offset_x = 100;
    const offset_y = 100;

    const W = width * scale;
    const D = depth * scale;
    const wall_w = wall_width * scale;
    const cov = cover * scale;

    const bar_prefix = steel_grade.includes("460") ? "H" : "R";

    return (
        <div style={{ padding: '20px', backgroundColor: '#f5f5f5' }}>
            <h3 style={{ marginBottom: '10px', fontFamily: 'Arial' }}>Strip Foundation Detail - BS 8004:2015</h3>

            <Stage width={800} height={600}>
                <Layer>
                    {/* SECTION VIEW */}
                    <Group x={offset_x} y={offset_y}>
                        {/* Foundation */}
                        <Rect
                            x={0}
                            y={0}
                            width={W}
                            height={D}
                            stroke="black"
                            strokeWidth={3}
                            fill="#d5d5d5"
                        />

                        {/* Wall */}
                        <Rect
                            x={(W - wall_w) / 2}
                            y={-100}
                            width={wall_w}
                            height={100}
                            fill="#888"
                            stroke="black"
                            strokeWidth={2}
                        />

                        {/* Ground level */}
                        <Line
                            points={[-50, 0, W + 50, 0]}
                            stroke="brown"
                            strokeWidth={1}
                            dash={[10, 5]}
                        />

                        {/* Main reinforcement bars */}
                        {Array.from({ length: main_bars.count }).map((_, i) => {
                            const bar_x = cov + i * (W - 2 * cov) / (main_bars.count - 1);
                            const bar_y = D - cov - main_bars.diameter * scale / 2;
                            return (
                                <Circle
                                    key={`main-bar-${i}`}
                                    x={bar_x}
                                    y={bar_y}
                                    radius={main_bars.diameter * scale / 2}
                                    fill="red"
                                    stroke="darkred"
                                    strokeWidth={1}
                                />
                            );
                        })}

                        {/* Distribution bars (shown as crosses) */}
                        {[0, 1, 2].map((idx) => {
                            const bar_x = W / 4 + idx * W / 4;
                            const bar_y = D - cov - main_bars.diameter * scale - distribution_bars.diameter * scale / 2;
                            const cross_size = distribution_bars.diameter * scale * 0.7;

                            return (
                                <React.Fragment key={`dist-${idx}`}>
                                    <Line
                                        points={[
                                            bar_x - cross_size / 2, bar_y - cross_size / 2,
                                            bar_x + cross_size / 2, bar_y + cross_size / 2
                                        ]}
                                        stroke="blue"
                                        strokeWidth={1.5}
                                    />
                                    <Line
                                        points={[
                                            bar_x - cross_size / 2, bar_y + cross_size / 2,
                                            bar_x + cross_size / 2, bar_y - cross_size / 2
                                        ]}
                                        stroke="blue"
                                        strokeWidth={1.5}
                                    />
                                </React.Fragment>
                            );
                        })}

                        {/* Labels */}
                        <Text
                            x={W / 2}
                            y={D + 30}
                            text="SECTION (per meter length)"
                            fontSize={15}
                            fontStyle="bold"
                            fill="black"
                            offsetX={90}
                        />

                        {/* Dimensions */}
                        <Line
                            points={[0, D + 60, W, D + 60]}
                            stroke="green"
                            strokeWidth={1}
                        />
                        <Line
                            points={[0, D + 50, 0, D + 70]}
                            stroke="green"
                            strokeWidth={1}
                        />
                        <Line
                            points={[W, D + 50, W, D + 70]}
                            stroke="green"
                            strokeWidth={1}
                        />
                        <Text
                            x={W / 2}
                            y={D + 80}
                            text={`${width}mm`}
                            fontSize={13}
                            fill="green"
                            offsetX={25}
                        />

                        {/* Depth dimension */}
                        <Line
                            points={[-40, 0, -40, D]}
                            stroke="green"
                            strokeWidth={1}
                        />
                        <Line
                            points={[-50, 0, -30, 0]}
                            stroke="green"
                            strokeWidth={1}
                        />
                        <Line
                            points={[-50, D, -30, D]}
                            stroke="green"
                            strokeWidth={1}
                        />
                        <Text
                            x={-60}
                            y={D / 2}
                            text={`${depth}mm`}
                            fontSize={13}
                            fill="green"
                            rotation={-90}
                            offsetX={25}
                        />

                        {/* Cover annotation */}
                        <Text
                            x={-80}
                            y={D - cov / 2}
                            text={`${cover}`}
                            fontSize={11}
                            fill="orange"
                        />
                    </Group>

                    {/* NOTES */}
                    <Group x={offset_x + W + 80} y={offset_y}>
                        <Text
                            x={0}
                            y={0}
                            text="REINFORCEMENT:"
                            fontSize={13}
                            fontStyle="bold"
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={22}
                            text={`Main bars: ${main_bars.count}${bar_prefix}${main_bars.diameter}`}
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={40}
                            text="continuous"
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={62}
                            text={`Distribution: ${bar_prefix}${distribution_bars.diameter}`}
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={80}
                            text={`@ ${distribution_bars.spacing}mm`}
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={102}
                            text={`Cover: ${cover}mm`}
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={120}
                            text={`Concrete: ${concrete_grade}`}
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={138}
                            text={`Steel: ${steel_grade}`}
                            fontSize={11}
                            fill="black"
                        />
                        <Text
                            x={0}
                            y={160}
                            text="Ref: BS 8004:2015"
                            fontSize={10}
                            fill="gray"
                            fontStyle="italic"
                        />
                    </Group>
                </Layer>
            </Stage>
        </div>
    );
};

// Main Foundation Viewer Component
const FoundationViewer = ({ foundationType, params }) => {
    const viewers = {
        pad: PadFoundationViewer,
        pilecap: PileCapViewer,
        strip: StripFoundationViewer
    };

    const ViewerComponent = viewers[foundationType] || PadFoundationViewer;

    return <ViewerComponent params={params} />;
};

/**
 * FoundationKonvaGroup (2D)
 * Renders professional foundation details with plan and section views.
 * Used for integration with the universal CadDrawer.
 */
export const FoundationKonvaGroup = ({
    foundationType = "pad",
    params = {},
    x = 0,
    y = 0,
    scale = 0.15,
    showLabels = true
}) => {
    // Determine which viewer logic to use
    // For simplicity, we can wrap the existing viewers or refactor them.
    // However, since CadDrawer expects a Group, we provide it here.

    // For now, we'll return a Group that can be positioned
    return (
        <Group x={x} y={y}>
            {foundationType === "pad" && <PadFoundationGroup params={params} scale={scale} />}
            {foundationType === "pilecap" && <PileCapGroup params={params} scale={scale} />}
            {foundationType === "strip" && <StripFoundationGroup params={params} scale={scale} />}
            {(foundationType === "combined" || foundationType === "raft") && (
                <Group>
                    <Rect x={0} y={0} width={300 * scale} height={300 * scale} stroke="black" fill="#f0f0f0" />
                    <Text x={10} y={10} text={`${foundationType.toUpperCase()}`} fontSize={10} />
                </Group>
            )}
        </Group>
    );
};

/**
 * Returns an array of CAD objects (lines, circles, text) representing the foundation.
 * Used for "exploding" members in the universal CAD drawer.
 */
export const getFoundationCADPrimitives = (foundationType, params, x = 0, y = 0, scale = 0.15) => {
    const primitives = [];
    const layerId = "structural";

    // Basic implementation for Pad Foundation as a starting point
    if (foundationType === "pad") {
        const { length = 2000, width = 2000, depth = 500, side_cover = 75, cover = 75, main_bars_x = { count: 8, diameter: 16, spacing: 200 } } = params;
        const L = length * scale;
        const B = width * scale;
        const D = depth * scale;
        const s_cov = side_cover * scale;
        const cov = cover * scale;

        // --- 1. Plan View ---
        // Outline
        primitives.push({ id: `pad-plan-outline-${Math.random()}`, type: 'rectangle', start: { x: x, y: y }, end: { x: x + L, y: y + B }, color: '#000', layerId });

        // Bars in Plan (Partial representation)
        for (let i = 0; i < (main_bars_x.count || 0); i++) {
            const bar_y = y + s_cov + i * (main_bars_x.spacing || 200) * scale;
            if (bar_y <= y + B - s_cov) {
                primitives.push({ id: `pad-plan-bar-${i}-${Math.random()}`, type: 'line', start: { x: x + s_cov, y: bar_y }, end: { x: x + L - s_cov, y: bar_y }, color: '#ff0000', layerId });
            }
        }
        primitives.push({ id: `pad-plan-label-${Math.random()}`, type: 'text', position: { x: x + L / 2 - 20, y: y - 20 }, text: "PLAN", size: 0.8, color: '#000', layerId });

        // --- 2. Section View ---
        const secX = x + L + 100;
        // Outline
        primitives.push({ id: `pad-sec-outline-${Math.random()}`, type: 'rectangle', start: { x: secX, y: y }, end: { x: secX + L, y: y + D }, color: '#000', layerId });

        // Bars in Section (Dots)
        for (let i = 0; i < (main_bars_x.count || 0); i++) {
            const bar_x = secX + s_cov + i * (main_bars_x.spacing || 200) * scale;
            if (bar_x <= secX + L - s_cov) {
                primitives.push({ id: `pad-sec-bar-${i}-${Math.random()}`, type: 'circle', center: { x: bar_x, y: y + D - cov }, radius: 2, color: '#ff0000', layerId });
            }
        }
        primitives.push({ id: `pad-sec-label-${Math.random()}`, type: 'text', position: { x: secX + L / 2 - 40, y: y + D + 20 }, text: "SECTION A-A", size: 0.8, color: '#000', layerId });

        // Add dimensions
        const addDim = (x1, y1, x2, y2, text, vertical = false, offset = 30) => {
            const lineX1 = vertical ? x1 - offset : x1;
            const lineY1 = vertical ? y1 : y1 - offset;
            const lineX2 = vertical ? x2 - offset : x2;
            const lineY2 = vertical ? y2 : y2 - offset;
            primitives.push({ id: Math.random().toString(), type: 'line', start: { x: lineX1, y: lineY1 }, end: { x: lineX2, y: lineY2 }, color: '#666', layerId });
            primitives.push({ id: Math.random().toString(), type: 'text', position: { x: vertical ? lineX1 - 10 : (lineX1 + lineX2) / 2, y: vertical ? (lineY1 + lineY2) / 2 : lineY1 - 10 }, text, size: 0.6, color: '#000', layerId });
        };

        addDim(x, y + B, x + L, y + B, `${length}`, false, -25);
        addDim(secX + L, y, secX + L, y + D, `${depth}`, true, -25);
    }

    return primitives;
};

// --- Reusable Group Components extracted from Viewers ---

const PadFoundationGroup = ({ params, scale }) => {
    const {
        length = 2000, width = 2000, depth = 500, column_width = 400, column_depth = 400,
        cover = 75, side_cover = 75, main_bars_x = { count: 8, diameter: 16, spacing: 200 },
        main_bars_y = { count: 8, diameter: 16, spacing: 200 }, steel_grade = "Grade 460", concrete_grade = "C30"
    } = params;

    const L = length * scale;
    const B = width * scale;
    const D = depth * scale;
    const col_w = column_width * scale;
    const col_d = column_depth * scale;
    const cov = cover * scale;
    const s_cov = side_cover * scale;
    const bar_prefix = steel_grade.includes("460") ? "H" : "R";

    return (
        <Group>
            {/* Plan View */}
            <Group>
                <Rect x={0} y={0} width={L} height={B} stroke="black" strokeWidth={2} fill="#f0f0f0" />
                <Rect x={(L - col_w) / 2} y={(B - col_d) / 2} width={col_w} height={col_d} fill="#666" stroke="black" />
                {Array.from({ length: main_bars_x.count || 0 }).map((_, i) => {
                    const bar_y = s_cov + i * (main_bars_x.spacing || 200) * scale;
                    return bar_y <= B - s_cov ? <Line key={i} points={[s_cov, bar_y, L - s_cov, bar_y]} stroke="red" strokeWidth={1} /> : null;
                })}
                <Text x={L / 2 - 20} y={-20} text="PLAN" fontSize={12} fontStyle="bold" />
            </Group>
            {/* Section A-A */}
            <Group x={L + 100}>
                <Rect x={0} y={0} width={L} height={D} stroke="black" strokeWidth={2} fill="#e0e0e0" />
                <Rect x={(L - col_w) / 2} y={-30} width={col_w} height={30} fill="#666" stroke="black" />
                {Array.from({ length: main_bars_x.count || 0 }).map((_, i) => {
                    const bar_x = s_cov + i * (main_bars_x.spacing || 200) * scale;
                    return bar_x <= L - s_cov ? <Circle key={i} x={bar_x} y={D - cov} radius={2} fill="red" /> : null;
                })}
                <Text x={L / 2 - 40} y={D + 10} text="SECTION A-A" fontSize={12} fontStyle="bold" />
            </Group>
        </Group>
    );
};

const PileCapGroup = ({ params, scale }) => {
    const { length = 3000, width = 3000, depth = 800 } = params;
    const L = length * scale;
    const B = width * scale;
    return (
        <Group>
            <Rect x={0} y={0} width={L} height={B} stroke="black" strokeWidth={2} fill="#f0f0f0" />
            <Text x={L / 2 - 30} y={B / 2} text="PILE CAP" fontSize={10} />
            <Text x={L / 2 - 20} y={-20} text="PLAN" fontSize={12} fontStyle="bold" />
        </Group>
    );
};

const StripFoundationGroup = ({ params, scale }) => {
    const { width = 900, depth = 450 } = params;
    const W = width * scale;
    const D = depth * scale;
    return (
        <Group>
            <Rect x={0} y={0} width={W} height={D} stroke="black" strokeWidth={2} fill="#f0f0f0" />
            <Text x={W / 2 - 40} y={D / 2} text="STRIP FOOTING" fontSize={10} />
            <Text x={W / 2 - 20} y={-20} text="SECTION" fontSize={12} fontStyle="bold" />
        </Group>
    );
};

// Demo component showing all types
const FoundationDetailingDemo = () => {
    const [selectedType, setSelectedType] = useState('pad');

    const demoParams = {
        pad: {
            length: 2000,
            width: 2000,
            depth: 500,
            column_width: 400,
            column_depth: 400,
            cover: 75,
            side_cover: 75,
            main_bars_x: { count: 8, diameter: 16, spacing: 200 },
            main_bars_y: { count: 8, diameter: 16, spacing: 200 },
            steel_grade: "Grade 460",
            concrete_grade: "C30"
        },
        pilecap: {
            length: 3000,
            width: 3000,
            depth: 800,
            column_width: 450,
            pile_diameter: 450,
            pile_count: 4,
            pile_spacing: 1350,
            cover: 75,
            main_bars: { count: 8, diameter: 20 },
            link_diameter: 12,
            steel_grade: "Grade 460",
            concrete_grade: "C30"
        },
        strip: {
            width: 900,
            depth: 450,
            wall_width: 300,
            cover: 75,
            main_bars: { count: 5, diameter: 16 },
            distribution_bars: { diameter: 12, spacing: 300 },
            steel_grade: "Grade 460",
            concrete_grade: "C30"
        }
    };

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px' }}>
            <h2>Foundation Detailing Viewer - BS/EC Standards</h2>

            <div style={{ marginBottom: '20px' }}>
                <button
                    onClick={() => setSelectedType('pad')}
                    style={{
                        padding: '10px 20px',
                        marginRight: '10px',
                        backgroundColor: selectedType === 'pad' ? '#4CAF50' : '#ddd',
                        color: selectedType === 'pad' ? 'white' : 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Pad Foundation
                </button>
                <button
                    onClick={() => setSelectedType('pilecap')}
                    style={{
                        padding: '10px 20px',
                        marginRight: '10px',
                        backgroundColor: selectedType === 'pilecap' ? '#4CAF50' : '#ddd',
                        color: selectedType === 'pilecap' ? 'white' : 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Pile Cap
                </button>
                <button
                    onClick={() => setSelectedType('strip')}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: selectedType === 'strip' ? '#4CAF50' : '#ddd',
                        color: selectedType === 'strip' ? 'white' : 'black',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Strip Foundation
                </button>
            </div>

            <FoundationViewer
                foundationType={selectedType}
                params={demoParams[selectedType]}
            />

            <div style={{
                marginTop: '30px',
                padding: '15px',
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '4px'
            }}>
                <h4 style={{ marginTop: 0 }}>Usage Instructions:</h4>
                <p style={{ fontSize: '14px', lineHeight: '1.6' }}>
                    Import this component into your React application and pass the foundation parameters
                    from your design calculations. The viewer will automatically render the foundation
                    detail with plan and section views, reinforcement layout, and BS/EC compliant annotations.
                </p>
                <pre style={{
                    backgroundColor: '#f5f5f5',
                    padding: '10px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto'
                }}>
                    {`import FoundationViewer from './FoundationViewer';

// In your component:
<FoundationViewer 
  foundationType="pad"  // or "pilecap", "strip", "raft"
  params={designResults}
/>`}
                </pre>
            </div>
        </div>
    );
};

export default FoundationDetailingDemo;