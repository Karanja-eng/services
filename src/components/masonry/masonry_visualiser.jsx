/**
 * masonry_visualisation.jsx
 * ==========================
 * React Konva engineering drawings for BS 5628 masonry design results.
 *
 * Diagrams:
 *   1. Wall Cross-Section — brick course hatch, wall leaf(ves), N.A., dimensions
 *   2. Wall Elevation     — wall outline, load arrows, effective height, pier detail
 *   3. Panel Layout       — support condition symbols, wind arrows, panel dimensions
 *   4. Slenderness Chart  — SR vs β capacity reduction, current design point
 *   5. Bending Stress     — flexural stress distribution across panel thickness
 *
 * Style: technical ink drawing — white lines on dark, serif labels, leader lines.
 *
 * npm install react-konva konva
 * Import: <MasonryVis vertResult={...} panelResult={...} />
 */

import { useState } from "react";
import {
    Stage, Layer, Rect, Line, Text, Arrow, Group, Circle, RegularPolygon
} from "react-konva";

// ─── Palette ──────────────────────────────────────────────────────────────────
const BG = "#0b0f17";
const INK = "#ddd8cc";
const DIM = "#9a9080";
const BRICK = "#2a1f18";
const MORTAR = "#1e1c18";
const BLOCK = "#1a1e22";
const BLOCK_L = "#232830";
const AMBER = "#f5a623";
const BLUE = "#60a5fa";
const RED = "#f87171";
const GREEN = "#4ade80";
const FILL_W = "rgba(96,165,250,0.12)";
const FILL_M = "rgba(245,166,35,0.12)";
const FONT = "'DM Mono','Fira Mono','Courier New',monospace";
const SERIF = "'Georgia','Times New Roman',serif";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DimLine({ x1, y1, x2, y2, label, offset, vertical, color = DIM }) {
    const ox = vertical ? offset : 0;
    const oy = vertical ? 0 : offset;
    const mx = vertical ? x1 + ox : (x1 + x2) / 2;
    const my = vertical ? (y1 + y2) / 2 : y1 + oy;
    return (
        <Group>
            <Line points={[x1, y1, x1 + ox, y1 + oy]} stroke={color} strokeWidth={0.6} dash={[2, 2]} />
            <Line points={[x2, y2, x2 + ox, y2 + oy]} stroke={color} strokeWidth={0.6} dash={[2, 2]} />
            <Arrow
                points={vertical ? [x1 + ox, y1, x1 + ox, y2] : [x1, y1 + oy, x2, y2 + oy]}
                stroke={color} fill={color} strokeWidth={0.8}
                pointerLength={5} pointerWidth={3}
                pointerAtBeginning pointerAtEnding
            />
            <Text
                x={vertical ? mx + ox + 3 : mx - 25}
                y={vertical ? my - 6 : my - 14}
                text={label} fontSize={9} fontFamily={FONT} fill={color}
                width={vertical ? 60 : 55} align="center"
            />
        </Group>
    );
}

function Leader({ x, y, dx, dy, text, color = DIM }) {
    return (
        <Group>
            <Circle x={x} y={y} radius={2} fill={color} />
            <Line points={[x, y, x + dx, y + dy]} stroke={color} strokeWidth={0.7} />
            <Text x={x + dx + (dx > 0 ? 3 : -3)} y={y + dy - 7} text={text}
                fontSize={9} fontFamily={FONT} fill={color}
                align={dx > 0 ? "left" : "right"} />
        </Group>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGRAM 1: Wall Cross-Section
// ─────────────────────────────────────────────────────────────────────────────

function BrickCourses({ x, y, w, h, brickH = 10, mortarH = 2, isBlock = false }) {
    const els = [];
    const courseH = brickH + mortarH;
    const nCourses = Math.ceil(h / courseH);
    const brickW = isBlock ? w : Math.min(w, 30);
    const nBricks = Math.max(1, Math.floor(w / (brickW + 2)));

    for (let r = 0; r < nCourses; r++) {
        const cy = y + r * courseH;
        if (cy > y + h) break;

        // Mortar bed
        els.push(
            <Rect key={`m${r}`} x={x} y={cy + brickH} width={w} height={mortarH}
                fill={MORTAR} />
        );

        // Bricks in row — offset alternate rows (Flemish bond)
        const offset = (r % 2) * (brickW / 2);
        for (let c = 0; c <= nBricks; c++) {
            const bx = x + c * (brickW + 2) - offset;
            const bw = Math.min(brickW, x + w - bx, bx < x ? brickW - (x - bx) : brickW);
            if (bx + bw < x || bx > x + w) continue;
            els.push(
                <Rect key={`b${r}_${c}`}
                    x={Math.max(x, bx)} y={cy}
                    width={bw} height={brickH}
                    fill={isBlock ? BLOCK : BRICK}
                    stroke={isBlock ? BLOCK_L : "#3a2820"}
                    strokeWidth={0.4}
                />
            );
        }
    }

    // Clip mask (visual border)
    els.push(
        <Rect key="border" x={x} y={y} width={w} height={h}
            fill="none" stroke={INK} strokeWidth={1.5} />
    );
    return <Group>{els}</Group>;
}

function CrossSectionDiagram({ t, h_wall, wall_type, t2, SR, beta, panelW, panelH, isBlock }) {
    const isCavity = wall_type === "cavity";
    const scW = Math.min((panelW - 160) / (isCavity ? (t + 50 + (t2 || t)) : t), 3.5);
    const scH = Math.min((panelH - 100) / h_wall, 1.5, scW);
    const sc = Math.min(scW, scH);

    const sw = t * sc;
    const sh = Math.min(h_wall * sc, panelH - 80);
    const sw2 = (t2 || t) * sc;
    const cav = 50; // cavity gap px

    const ox = isCavity ? (panelW - sw - cav - sw2) / 2 : (panelW - sw) / 2;
    const oy = (panelH - sh) / 2;

    return (
        <Group>
            <Text x={10} y={8} text="WALL CROSS-SECTION" fontSize={9} fontFamily={FONT}
                fill={AMBER} letterSpacing={2} />
            <Text x={10} y={20}
                text={`t = ${t} mm${isCavity ? ` + ${t2 || t} mm  (cavity)` : ""}  ·  SR = ${SR?.toFixed(2)}`}
                fontSize={8} fontFamily={FONT} fill={DIM} />

            {/* Inner leaf */}
            <BrickCourses x={ox} y={oy} w={sw} h={sh}
                brickH={isBlock ? 14 : 9} mortarH={isBlock ? 3 : 2} isBlock={isBlock} />

            {/* Cavity fill + outer leaf */}
            {isCavity && (
                <>
                    <Rect x={ox + sw} y={oy} width={cav} height={sh}
                        fill="#0d1018" stroke={DIM} strokeWidth={0.5} dash={[2, 3]} />
                    <Text x={ox + sw + cav / 2 - 12} y={oy + sh / 2 - 6}
                        text="cavity" fontSize={7} fontFamily={FONT} fill={DIM} />
                    <BrickCourses x={ox + sw + cav} y={oy} w={sw2} h={sh}
                        brickH={isBlock ? 14 : 9} mortarH={isBlock ? 3 : 2} isBlock={isBlock} />
                </>
            )}

            {/* N.A. */}
            <Line
                points={[ox - 10, oy + sh / 2, ox + sw + (isCavity ? cav + sw2 : 0) + 10, oy + sh / 2]}
                stroke={BLUE} strokeWidth={0.8} dash={[5, 3]} />
            <Text x={ox + sw + (isCavity ? cav + sw2 : 0) + 14}
                y={oy + sh / 2 - 6} text="N.A." fontSize={8} fontFamily={FONT} fill={BLUE} />

            {/* Breadth dim */}
            <DimLine x1={ox} y1={oy + sh} x2={ox + sw} y2={oy + sh}
                label={`t=${t}mm`} offset={22} color={DIM} />
            {isCavity && (
                <DimLine x1={ox + sw + cav} y1={oy + sh} x2={ox + sw + cav + sw2} y2={oy + sh}
                    label={`t₂=${t2 || t}mm`} offset={34} color={DIM} />
            )}

            {/* Height dim */}
            <DimLine x1={ox} y1={oy} x2={ox} y2={oy + sh}
                label={`h=${h_wall}mm`} offset={-30} vertical color={DIM} />

            {/* β annotation */}
            {beta !== undefined && (
                <Group>
                    <Rect x={10} y={panelH - 45} width={130} height={32}
                        fill="#0f1420" stroke={AMBER} strokeWidth={0.5} cornerRadius={3} />
                    <Text x={14} y={panelH - 41} text="β (capacity red.)" fontSize={8} fontFamily={FONT} fill={DIM} />
                    <Text x={14} y={panelH - 29} text={`${beta?.toFixed(3)}`}
                        fontSize={16} fontFamily={FONT} fill={AMBER} fontStyle="bold" />
                </Group>
            )}
        </Group>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// DIAGRAM 2: Wall Elevation
// ─────────────────────────────────────────────────────────────────────────────

function WallElevationDiagram({ t, clear_h, hef, SR, N_ult, resistance_type, panelW, panelH }) {
    const PAD = 60;
    const WH = panelH - 80;
    const WW = Math.min(100, panelW - PAD * 2);
    const wx = (panelW - WW) / 2;
    const wy = 40;
    const hef_px = WH * (hef / clear_h);

    // Support symbols
    const nArrows = 7;

    return (
        <Group>
            <Text x={10} y={8} text="WALL ELEVATION" fontSize={9} fontFamily={FONT}
                fill={AMBER} letterSpacing={2} />
            <Text x={10} y={20}
                text={`h = ${clear_h} mm  ·  hef = ${hef?.toFixed(0)} mm  ·  SR = ${SR?.toFixed(2)}`}
                fontSize={8} fontFamily={FONT} fill={DIM} />

            {/* Wall body */}
            <BrickCourses x={wx} y={wy} w={WW} h={WH}
                brickH={12} mortarH={2} isBlock={false} />

            {/* Effective height bracket */}
            <Line points={[wx + WW + 18, wy, wx + WW + 28, wy]}
                stroke={BLUE} strokeWidth={0.8} />
            <Arrow
                points={[wx + WW + 23, wy, wx + WW + 23, wy + hef_px]}
                stroke={BLUE} fill={BLUE} strokeWidth={0.8}
                pointerLength={5} pointerWidth={3}
                pointerAtBeginning pointerAtEnding />
            <Line points={[wx + WW + 18, wy + hef_px, wx + WW + 28, wy + hef_px]}
                stroke={BLUE} strokeWidth={0.8} />
            <Text x={wx + WW + 30} y={wy + hef_px / 2 - 8} text={`hef`}
                fontSize={9} fontFamily={FONT} fill={BLUE} />
            <Text x={wx + WW + 30} y={wy + hef_px / 2 + 2} text={`${hef?.toFixed(0)}mm`}
                fontSize={8} fontFamily={FONT} fill={BLUE} />

            {/* Clear height dim */}
            <DimLine x1={wx} y1={wy} x2={wx} y2={wy + WH}
                label={`h=${clear_h}mm`} offset={-32} vertical color={DIM} />

            {/* Applied load arrows (compression) */}
            {Array.from({ length: nArrows }, (_, i) => (
                <Arrow key={i}
                    points={[wx + (WW / (nArrows - 1)) * i, wy - 20, wx + (WW / (nArrows - 1)) * i, wy]}
                    stroke={RED} fill={RED} strokeWidth={1}
                    pointerLength={5} pointerWidth={3} />
            ))}
            <Text x={wx + WW / 2 - 25} y={wy - 32}
                text={`N = ${N_ult?.toFixed(1)} N/mm`}
                fontSize={8} fontFamily={FONT} fill={RED} />

            {/* Support symbols — top */}
            {resistance_type === "enhanced" && (
                <Group>
                    <Rect x={wx - 12} y={wy - 6} width={WW + 24} height={6}
                        fill="#1a2030" stroke={INK} strokeWidth={1} />
                    <Text x={wx + WW + 14} y={wy - 8} text="enhanced" fontSize={7}
                        fontFamily={FONT} fill={INK} />
                </Group>
            )}

            {/* Support at bottom — pin */}
            <Line points={[wx + WW / 2, wy + WH, wx + WW / 2 - 12, wy + WH + 16, wx + WW / 2 + 12, wy + WH + 16]}
                stroke={INK} strokeWidth={1} closed fill="none" />
            <Line points={[wx + WW / 2 - 16, wy + WH + 18, wx + WW / 2 + 16, wy + WH + 18]}
                stroke={INK} strokeWidth={1} />

            {/* Width dim */}
            <DimLine x1={wx} y1={wy + WH + 30} x2={wx + WW} y2={wy + WH + 30}
                label={`t=${t}mm`} offset={12} color={DIM} />
        </Group>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// DIAGRAM 3: Panel Layout (support edges + wind load)
// ─────────────────────────────────────────────────────────────────────────────

function PanelLayoutDiagram({ ph, pl, t, panel_type, n_sup, Wk, alpha, mu, panelW, panelH }) {
    const PAD = 50;
    const sc = Math.min((panelW - PAD * 2) / pl, (panelH - 80) / ph, 0.1);
    const pw = pl * sc;
    const pht = ph * sc;
    const ox = (panelW - pw) / 2;
    const oy = (panelH - pht) / 2;

    // Support condition per panel_type
    const supported = {
        A: { top: true, bottom: true, left: true, right: true },
        C: { top: true, bottom: true, left: true, right: false },
        E: { top: false, bottom: true, left: true, right: true },
    }[panel_type] || { top: true, bottom: true, left: true, right: true };

    const edgeStroke = (sup) => sup ? INK : "transparent";
    const edgeWidth = (sup) => sup ? 2.5 : 0;

    const nArrows = 5;

    return (
        <Group>
            <Text x={10} y={8} text="PANEL LAYOUT — SUPPORT CONDITIONS" fontSize={9}
                fontFamily={FONT} fill={AMBER} letterSpacing={2} />
            <Text x={10} y={20}
                text={`${ph}h × ${pl}L mm  ·  t=${t}mm  ·  Type ${panel_type}  ·  µ=${mu?.toFixed(3)}  ·  α=${alpha?.toFixed(4)}`}
                fontSize={8} fontFamily={FONT} fill={DIM} />

            {/* Panel fill */}
            <Rect x={ox} y={oy} width={pw} height={pht}
                fill={FILL_W} />

            {/* Wind arrows (horizontal, into page) */}
            {Array.from({ length: nArrows + 1 }, (_, i) => {
                const ay = oy + (pht / nArrows) * i;
                return (
                    <Arrow key={i}
                        points={[ox - 28, ay, ox - 4, ay]}
                        stroke={BLUE} fill={BLUE} strokeWidth={1}
                        pointerLength={5} pointerWidth={3} />
                );
            })}
            <Text x={ox - 50} y={oy + pht / 2 - 14}
                text={`Wk`} fontSize={8} fontFamily={FONT} fill={BLUE} />
            <Text x={ox - 55} y={oy + pht / 2}
                text={`${Wk?.toFixed(3)}`} fontSize={8} fontFamily={FONT} fill={BLUE} />
            <Text x={ox - 55} y={oy + pht / 2 + 12}
                text="kN/m²" fontSize={7} fontFamily={FONT} fill={BLUE} />

            {/* Support edges */}
            {supported.top && <Rect x={ox} y={oy - 4} width={pw} height={4} fill={INK} cornerRadius={1} />}
            {supported.bottom && <Rect x={ox} y={oy + pht} width={pw} height={4} fill={INK} cornerRadius={1} />}
            {supported.left && <Rect x={ox - 4} y={oy} width={4} height={pht} fill={INK} cornerRadius={1} />}
            {supported.right && <Rect x={ox + pw} y={oy} width={4} height={pht} fill={INK} cornerRadius={1} />}

            {/* Free edge dashes */}
            {!supported.top && <Line points={[ox, oy, ox + pw, oy]} stroke={RED} strokeWidth={1} dash={[4, 3]} />}
            {!supported.right && <Line points={[ox + pw, oy, ox + pw, oy + pht]} stroke={RED} strokeWidth={1} dash={[4, 3]} />}

            {/* Panel outline */}
            <Rect x={ox} y={oy} width={pw} height={pht}
                fill="none" stroke={INK} strokeWidth={1} />

            {/* Bending moment contours (schematic parabola) */}
            {alpha !== undefined && (
                <Text x={ox + pw / 2 - 20} y={oy + pht / 2 - 8}
                    text={`α = ${alpha?.toFixed(4)}`}
                    fontSize={10} fontFamily={FONT} fill={AMBER}
                    fontStyle="bold" align="center" />
            )}

            {/* Dimensions */}
            <DimLine x1={ox} y1={oy + pht} x2={ox + pw} y2={oy + pht}
                label={`L = ${pl}mm`} offset={20} color={DIM} />
            <DimLine x1={ox} y1={oy} x2={ox} y2={oy + pht}
                label={`h = ${ph}mm`} offset={-32} vertical color={DIM} />

            {/* Legend */}
            <Rect x={panelW - 120} y={panelH - 50} width={110} height={38}
                fill="#080c14" stroke={DIM} strokeWidth={0.5} cornerRadius={2} />
            <Rect x={panelW - 116} y={panelH - 44} width={12} height={5} fill={INK} />
            <Text x={panelW - 100} y={panelH - 46} text="Continuous support" fontSize={7} fontFamily={FONT} fill={DIM} />
            <Line points={[panelW - 116, panelH - 34, panelW - 104, panelH - 34]}
                stroke={RED} strokeWidth={1} dash={[3, 2]} />
            <Text x={panelW - 100} y={panelH - 38} text="Free edge" fontSize={7} fontFamily={FONT} fill={DIM} />
        </Group>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// DIAGRAM 4: Slenderness — SR vs β (with current design point)
// ─────────────────────────────────────────────────────────────────────────────

function SlendernessChart({ SR, beta, ex, panelW, panelH }) {
    const PAD = { l: 55, r: 25, t: 35, b: 40 };
    const W = panelW - PAD.l - PAD.r;
    const H = panelH - PAD.t - PAD.b;
    const ox = PAD.l;
    const oy = PAD.t;

    // Table 5.11 data points for β vs SR at several eccentricities
    const CURVES = [
        { ex: 0.05, pts: [[0, 1.0], [6, 1.0], [8, 0.97], [10, 0.93], [12, 0.87], [14, 0.80], [16, 0.72], [18, 0.63], [20, 0.53], [22, 0.43], [24, 0.31], [26, 0.17], [27, 0.0]] },
        { ex: 0.1, pts: [[0, 0.98], [6, 0.95], [8, 0.91], [10, 0.85], [12, 0.78], [14, 0.70], [16, 0.62], [18, 0.52], [20, 0.42], [22, 0.32], [24, 0.20], [26, 0.08], [27, 0.0]] },
        { ex: 0.2, pts: [[0, 0.87], [6, 0.82], [8, 0.76], [10, 0.69], [12, 0.61], [14, 0.52], [16, 0.43], [18, 0.33], [20, 0.22], [22, 0.10], [24, 0.0], [27, 0.0]] },
        { ex: 0.3, pts: [[0, 0.74], [6, 0.68], [8, 0.61], [10, 0.53], [12, 0.45], [14, 0.36], [16, 0.25], [18, 0.14], [20, 0.02], [22, 0.0], [27, 0.0]] },
    ];
    const COLORS = [GREEN, BLUE, AMBER, RED];

    const toX = (sr) => ox + (sr / 27) * W;
    const toY = (b) => oy + (1 - b) * H;

    return (
        <Group>
            <Text x={10} y={8} text="SLENDERNESS — CAPACITY REDUCTION β" fontSize={9}
                fontFamily={FONT} fill={AMBER} letterSpacing={2} />

            {/* Grid */}
            {[0, 5, 10, 15, 20, 25, 27].map(sr => (
                <Group key={sr}>
                    <Line points={[toX(sr), oy, toX(sr), oy + H]} stroke="#1a2030" strokeWidth={0.5} />
                    <Text x={toX(sr) - 8} y={oy + H + 6} text={String(sr)} fontSize={8} fontFamily={FONT} fill={DIM} />
                </Group>
            ))}
            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(b => (
                <Group key={b}>
                    <Line points={[ox, toY(b), ox + W, toY(b)]} stroke="#1a2030" strokeWidth={0.5} />
                    <Text x={ox - 28} y={toY(b) - 5} text={b.toFixed(1)} fontSize={8} fontFamily={FONT} fill={DIM} />
                </Group>
            ))}

            {/* Curves */}
            {CURVES.map((c, ci) => {
                const pts = c.pts.map(([sr, b]) => [toX(sr), toY(b)]).flat();
                return (
                    <Group key={ci}>
                        <Line points={pts} stroke={COLORS[ci]} strokeWidth={1} lineJoin="round" tension={0.3} />
                        <Text
                            x={toX(c.pts[0][0]) + 3}
                            y={toY(c.pts[0][1]) - 12}
                            text={`ex=${c.ex}t`}
                            fontSize={8} fontFamily={FONT} fill={COLORS[ci]}
                        />
                    </Group>
                );
            })}

            {/* SR limit at 27 */}
            <Line points={[toX(27), oy, toX(27), oy + H]} stroke={RED} strokeWidth={1.2} dash={[4, 2]} />
            <Text x={toX(27) - 16} y={oy - 14} text="SR limit" fontSize={8} fontFamily={FONT} fill={RED} />

            {/* Current design point */}
            {SR !== undefined && beta !== undefined && (
                <>
                    <Line points={[toX(SR), oy, toX(SR), toY(beta)]}
                        stroke={INK} strokeWidth={0.6} dash={[3, 2]} />
                    <Line points={[ox, toY(beta), toX(SR), toY(beta)]}
                        stroke={INK} strokeWidth={0.6} dash={[3, 2]} />
                    <Circle x={toX(SR)} y={toY(beta)} radius={5}
                        fill={SR <= 27 ? GREEN : RED} stroke={INK} strokeWidth={1} />
                    <Text x={toX(SR) + 8} y={toY(beta) - 14}
                        text={`SR=${SR?.toFixed(1)}  β=${beta?.toFixed(3)}`}
                        fontSize={9} fontFamily={FONT} fill={INK} fontStyle="bold" />
                </>
            )}

            {/* Axes */}
            <Arrow points={[ox, oy + H + 1, ox + W + 10, oy + H + 1]}
                stroke={INK} fill={INK} strokeWidth={1} pointerLength={6} pointerWidth={4} />
            <Arrow points={[ox - 1, oy + H, ox - 1, oy - 10]}
                stroke={INK} fill={INK} strokeWidth={1} pointerLength={6} pointerWidth={4} />
            <Text x={ox + W / 2 - 12} y={oy + H + 20} text="Slenderness Ratio SR" fontSize={9}
                fontFamily={FONT} fill={DIM} />
            <Text x={3} y={oy + H / 2 + 20} text="β" fontSize={10} fontFamily={SERIF} fill={DIM}
                rotation={-90} offsetX={0} offsetY={0} />
        </Group>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// DIAGRAM 5: Flexural stress distribution through wall thickness
// ─────────────────────────────────────────────────────────────────────────────

function StressDistDiagram({ t, fkx_perp, fkx_par, sigma_perp, sigma_par, gm, panelW, panelH }) {
    const PAD = 40;
    const WH = panelH - 80;
    const wx = panelW / 2 - 30;
    const wy = 40;
    const sc = Math.min(WH / (t || 200), 2.0);
    const sh = (t || 200) * sc;
    const wy2 = wy + (WH - sh) / 2;

    const fkxP = fkx_perp ?? 1.5;
    const fd_p = fkxP / (gm ?? 3.0);   // design strength perp
    const sigP = sigma_perp ?? fd_p * 0.8;

    const maxStress = Math.max(fd_p, sigP, 1.0);
    const BAR = 80;   // max bar width px

    return (
        <Group>
            <Text x={10} y={8} text="FLEXURAL STRESS DISTRIBUTION" fontSize={9}
                fontFamily={FONT} fill={AMBER} letterSpacing={2} />

            {/* Wall section */}
            <BrickCourses x={wx} y={wy2} w={60} h={sh} brickH={10} mortarH={2} />

            {/* Perp to bed joint — bending stress (red = tension at face) */}
            <Group>
                {/* tension face */}
                <Rect x={wx + 65} y={wy2} width={(sigP / maxStress) * BAR} height={sh / 2}
                    fill="rgba(248,113,113,0.2)" />
                <Line points={[wx + 65, wy2, wx + 65 + (sigP / maxStress) * BAR, wy2 + sh / 2, wx + 65, wy2 + sh / 2]}
                    closed fill="none" stroke={RED} strokeWidth={1} />
                {/* compression face */}
                <Rect x={wx + 65} y={wy2 + sh / 2} width={(sigP / maxStress) * BAR} height={sh / 2}
                    fill="rgba(96,165,250,0.15)" />
                <Line points={[wx + 65, wy2 + sh / 2, wx + 65 + (sigP / maxStress) * BAR, wy2 + sh, wx + 65, wy2 + sh]}
                    closed fill="none" stroke={BLUE} strokeWidth={1} />

                <Text x={wx + 65} y={wy2 - 14} text={`σ perp = ${sigP?.toFixed(3)} N/mm²`}
                    fontSize={8} fontFamily={FONT} fill={INK} />
                <Text x={wx + 65} y={wy2 - 4}
                    text={`fd = fkx,perp/γm = ${fkxP}/${gm?.toFixed(1)} = ${fd_p?.toFixed(3)}`}
                    fontSize={7} fontFamily={FONT} fill={DIM} />
            </Group>

            {/* N.A. */}
            <Line points={[wx - 10, wy2 + sh / 2, wx + 65 + (sigP / maxStress) * BAR + 5, wy2 + sh / 2]}
                stroke={BLUE} strokeWidth={0.7} dash={[4, 3]} />
            <Text x={wx - 40} y={wy2 + sh / 2 - 6} text="N.A." fontSize={8} fontFamily={FONT} fill={BLUE} />

            {/* Thickness dim */}
            <DimLine x1={wx} y1={wy2} x2={wx} y2={wy2 + sh}
                label={`t=${t}mm`} offset={-28} vertical color={DIM} />

            {/* fkx annotations */}
            <Group>
                <Rect x={10} y={panelH - 70} width={160} height={56}
                    fill="#0a0e18" stroke={DIM} strokeWidth={0.5} cornerRadius={3} />
                <Text x={14} y={panelH - 67} text="Characteristic Flexural Strengths"
                    fontSize={8} fontFamily={FONT} fill={DIM} />
                <Text x={14} y={panelH - 54}
                    text={`fkx,perp = ${fkxP?.toFixed(3)} N/mm²  →  fd,perp = ${fd_p?.toFixed(3)}`}
                    fontSize={8} fontFamily={FONT} fill={INK} />
                <Text x={14} y={panelH - 40}
                    text={`fkx,par  = ${fkx_par?.toFixed(3)} N/mm²  →  fd,par  = ${((fkx_par ?? 0.5) / (gm ?? 3.0))?.toFixed(3)}`}
                    fontSize={8} fontFamily={FONT} fill={INK} />
                <Text x={14} y={panelH - 26}
                    text={`γm = ${gm?.toFixed(1)}  (flexure, BS 5628 Table 5.10)`}
                    fontSize={7} fontFamily={FONT} fill={DIM} />
            </Group>
        </Group>
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// Root Visualisation Component
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
    { key: "section", label: "Cross-Section" },
    { key: "elevation", label: "Elevation" },
    { key: "panel", label: "Panel Layout" },
    { key: "slenderness", label: "SR Chart" },
    { key: "stress", label: "Flex. Stress" },
];

export default function MasonryVisualisation({ vertResult, panelResult }) {
    const [activeTab, setActiveTab] = useState("section");
    const W = 680;
    const H = 420;

    // Extract values with sensible defaults
    const vi = vertResult?.inputs ?? {};
    const prc = panelResult ?? {};

    const t = vi.t_mm ?? 102.5;
    const h_wall = vi.clear_height_mm ?? 2600;
    const wall_type = vi.wall_type ?? "single_leaf";
    const t2 = vi.t2_mm ?? 102.5;
    const SR = vertResult?.SR ?? 19.0;
    const beta = vertResult?.beta ?? 0.73;
    const hef = vertResult?.hef_mm ?? 1950;
    const resistance = vi.resistance_type ?? "enhanced";
    const N_ult = vi.N_ultimate_N_per_mm ?? 95;
    const ex = vi.eccentricity ?? 0.05;
    const isBlock = !(vi.is_brick_wall ?? true);

    const ph = prc.panel_height_mm ?? 2500;
    const pl = prc.panel_length_mm ?? 4500;
    const pt = prc.wall_thickness_mm ?? 102.5;
    const ptype = prc.inputs?.panel_type ?? "A";
    const nsup = prc.inputs?.num_supported_edges ?? 4;
    const Wk_kN = prc.inputs?.Wk_kN_per_m2 ?? 0.5;
    const alpha = prc.alpha ?? 0.0703;
    const mu = prc.mu ?? 0.333;
    const fkx_p = prc.fkx_perp_N_mm2 ?? 1.5;
    const fkx_a = prc.fkx_par_N_mm2 ?? 0.5;
    const gm_fl = prc.gamma_m ?? 3.0;
    const sigPerp = prc.Mperp_N_mm_per_mm_run
        ? prc.Mperp_N_mm_per_mm_run / (pt ** 2 / 6)
        : undefined;

    const renderDiagram = () => {
        switch (activeTab) {
            case "section":
                return <CrossSectionDiagram t={t} h_wall={h_wall} wall_type={wall_type}
                    t2={t2} SR={SR} beta={beta} panelW={W} panelH={H} isBlock={isBlock} />;
            case "elevation":
                return <WallElevationDiagram t={t} clear_h={h_wall} hef={hef}
                    SR={SR} N_ult={N_ult} resistance_type={resistance} panelW={W} panelH={H} />;
            case "panel":
                return <PanelLayoutDiagram ph={ph} pl={pl} t={pt}
                    panel_type={ptype} n_sup={nsup} Wk={Wk_kN}
                    alpha={alpha} mu={mu} panelW={W} panelH={H} />;
            case "slenderness":
                return <SlendernessChart SR={SR} beta={beta} ex={ex} panelW={W} panelH={H} />;
            case "stress":
                return <StressDistDiagram t={pt} fkx_perp={fkx_p} fkx_par={fkx_a}
                    sigma_perp={sigPerp} gm={gm_fl} panelW={W} panelH={H} />;
            default: return null;
        }
    };

    return (
        <div className="flex flex-col bg-slate-950 rounded-lg border border-slate-800 overflow-hidden"
            style={{ fontFamily: "'DM Mono','Fira Mono',monospace", width: W + "px" }}>

            {/* Tab bar */}
            <div className="flex border-b border-slate-800 bg-slate-900/50">
                {TABS.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`
              px-4 py-2.5 text-[10px] font-mono tracking-widest uppercase transition-colors border-b-2
              ${activeTab === tab.key
                                ? "text-amber-400 border-amber-500 bg-slate-950/50"
                                : "text-slate-600 hover:text-slate-400 border-transparent"}
            `}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Canvas */}
            <Stage width={W} height={H} style={{ background: BG }}>
                <Layer>
                    {/* Faint grid */}
                    {Array.from({ length: Math.ceil(W / 40) }, (_, i) => (
                        <Line key={`gv${i}`} points={[i * 40, 0, i * 40, H]} stroke="#111520" strokeWidth={0.4} />
                    ))}
                    {Array.from({ length: Math.ceil(H / 40) }, (_, i) => (
                        <Line key={`gh${i}`} points={[0, i * 40, W, i * 40]} stroke="#111520" strokeWidth={0.4} />
                    ))}

                    {renderDiagram()}

                    {/* Watermark */}
                    <Text x={W - 130} y={H - 16} text="BS 5628: PART 1 — MASONRY"
                        fontSize={7} fontFamily={FONT} fill="#1a1f2c" />
                </Layer>
            </Stage>

            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 bg-slate-900/40">
                <span className="text-[10px] font-mono text-slate-700">
                    {vi.t_mm ? `t=${vi.t_mm}mm  ·  h=${vi.clear_height_mm}mm  ·  SR=${SR?.toFixed(2)}` : "No vertical wall result"}
                </span>
                {vertResult && (
                    <span className={`text-[10px] font-mono font-bold
            ${vertResult.SR_pass ? "text-emerald-600" : "text-red-600"}`}>
                        fk ≥ {vertResult.required_fk_basic_N_per_mm2?.toFixed(3)} N/mm²
                        · β = {beta?.toFixed(3)}
                    </span>
                )}
            </div>
        </div>
    );
}