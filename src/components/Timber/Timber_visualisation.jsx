import { useState, useCallback, useRef } from "react";
import Konva from "konva";
import { Stage, Layer, Rect, Line, Text, Arrow, Circle, Group } from "react-konva";

// ═══════════════════════════════════════════════════════════════════════════════
// timber_visualisation.jsx
// Engineering drawing visualiser — BS 5268 timber sections and structural diagrams
// Aesthetic: precision blueprint, black paper, white/amber ink, dimensioned leader lines
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Drawing constants ────────────────────────────────────────────────────────
const C = {
    bg: "#0f0f0f",    // background
    paper: "#111",       // canvas background
    line: "#e8e8e8",    // main structural lines
    dim: "#f0a500",    // dimension / annotation amber
    dimLight: "#7d5600",    // dim leader ticks
    hatch: "rgba(232,232,232,0.18)", // wood grain hatching
    fill: "#1a1a1a",    // section fill
    grain: "rgba(232,232,232,0.07)",
    axis: "#3a6b8a",    // centroidal axis blue
    load: "#ef4444",    // load arrows red
    reaction: "#22c55e",    // reaction arrows green
    bmd: "#60a5fa",    // bending moment diagram blue
    sfd: "#a78bfa",    // shear force diagram purple
    neutral: "#f0a500",    // neutral axis
    text: "#e8e8e8",
    muted: "#6b6b6b",
    amber: "#f0a500",
};

const FONT = "'Courier New', monospace";

// ─── Leader / dimension helpers ───────────────────────────────────────────────

/**
 * Dimension line with arrow ticks and label.
 * horizontal or vertical.
 */
function DimLine({ x1, y1, x2, y2, label, offset = 18, side = 1, fontSize = 10 }) {
    const isH = Math.abs(y2 - y1) < Math.abs(x2 - x1);
    const px = isH ? 0 : side * offset;
    const py = isH ? side * offset : 0;

    const lx1 = x1 + px, ly1 = y1 + py;
    const lx2 = x2 + px, ly2 = y2 + py;
    const mx = (lx1 + lx2) / 2, my = (ly1 + ly2) / 2;

    const tickLen = 6;
    const ticks = isH
        ? [[lx1, ly1 - tickLen, lx1, ly1 + tickLen],
        [lx2, ly2 - tickLen, lx2, ly2 + tickLen]]
        : [[lx1 - tickLen, ly1, lx1 + tickLen, ly1],
        [lx2 - tickLen, ly2, lx2 + tickLen, ly2]];

    return (
        <Group>
            {/* witness lines */}
            <Line points={[x1, y1, lx1, ly1]} stroke={C.dimLight} strokeWidth={0.5} dash={[3, 3]} />
            <Line points={[x2, y2, lx2, ly2]} stroke={C.dimLight} strokeWidth={0.5} dash={[3, 3]} />
            {/* dim line */}
            <Line points={[lx1, ly1, lx2, ly2]} stroke={C.dim} strokeWidth={0.8} />
            {/* tick marks */}
            {ticks.map((t, i) => (
                <Line key={i} points={t} stroke={C.dim} strokeWidth={1.2} />
            ))}
            {/* label */}
            <Text
                x={isH ? mx - 28 : lx1 + 4}
                y={isH ? my - 14 : my - 6}
                text={label}
                fontSize={fontSize}
                fontFamily={FONT}
                fill={C.dim}
                align="center"
                width={56}
            />
        </Group>
    );
}

/**
 * Leader line from a point to a callout text.
 */
function Leader({ x1, y1, x2, y2, label, fontSize = 10 }) {
    return (
        <Group>
            <Line
                points={[x1, y1, x2, y2]}
                stroke={C.dim}
                strokeWidth={0.7}
                dash={[4, 3]}
            />
            <Circle x={x1} y={y1} radius={2} fill={C.dim} />
            <Text
                x={x2 + (x2 > x1 ? 4 : -56)}
                y={y2 - 7}
                text={label}
                fontSize={fontSize}
                fontFamily={FONT}
                fill={C.dim}
                width={60}
            />
        </Group>
    );
}

/** Centroidal axis dash-dot line */
function CentroAxis({ x1, y1, x2, y2, label = "" }) {
    return (
        <Group>
            <Line points={[x1, y1, x2, y2]} stroke={C.axis} strokeWidth={0.7} dash={[10, 4, 2, 4]} />
            {label && <Text x={x2 + 4} y={y2 - 5} text={label} fontSize={9} fontFamily={FONT} fill={C.axis} />}
        </Group>
    );
}

/** Downward load arrow */
function LoadArrow({ x, y, length = 50, label = "" }) {
    return (
        <Group>
            <Arrow
                points={[x, y - length, x, y]}
                stroke={C.load} fill={C.load}
                strokeWidth={1.5}
                pointerLength={8} pointerWidth={5}
            />
            {label && <Text x={x + 4} y={y - length} text={label} fontSize={10} fontFamily={FONT} fill={C.load} />}
        </Group>
    );
}

/** Upward reaction arrow */
function ReactionArrow({ x, y, length = 50, label = "" }) {
    return (
        <Group>
            <Arrow
                points={[x, y + length, x, y]}
                stroke={C.reaction} fill={C.reaction}
                strokeWidth={1.5}
                pointerLength={8} pointerWidth={5}
            />
            {label && <Text x={x + 4} y={y + length - 4} text={label} fontSize={10} fontFamily={FONT} fill={C.reaction} />}
        </Group>
    );
}

/** Hatch pattern lines (wood grain look) inside a rect */
function WoodHatch({ x, y, w, h, spacing = 8 }) {
    const lines = [];
    for (let i = 0; i < (w + h) / spacing; i++) {
        const ox = i * spacing;
        const x1 = x + ox, y1 = y;
        const x2 = x, y2 = y + ox;
        lines.push(
            <Line key={i}
                points={[Math.min(x1, x + w), Math.max(y1, y), Math.max(x2, x), Math.min(y2, y + h)]}
                stroke={C.grain} strokeWidth={0.5} lineCap="round"
            />
        );
    }
    return <Group>{lines}</Group>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGRAM 1 — Rectangular cross-section
// ═══════════════════════════════════════════════════════════════════════════════

function CrossSectionDiagram({ b = 75, h = 250, cx = 200, cy = 200 }) {
    const SCALE = Math.min(260 / Math.max(b, h), 2.5);
    const W = b * SCALE, H = h * SCALE;
    const x0 = cx - W / 2, y0 = cy - H / 2;

    return (
        <Group>
            {/* fill + hatch */}
            <Rect x={x0} y={y0} width={W} height={H} fill={C.fill} stroke={C.line} strokeWidth={1.5} />
            <WoodHatch x={x0} y={y0} w={W} h={H} spacing={10} />

            {/* centroidal axes */}
            <CentroAxis x1={x0 - 20} y1={cy} x2={x0 + W + 20} y2={cy} label="x" />
            <CentroAxis x1={cx} y1={y0 - 20} x2={cx} y2={y0 + H + 20} label="y" />

            {/* dimension — width */}
            <DimLine x1={x0} y1={y0 + H} x2={x0 + W} y2={y0 + H}
                label={`b=${b}`} offset={24} side={1} />
            {/* dimension — depth */}
            <DimLine x1={x0} y1={y0} x2={x0} y2={y0 + H}
                label={`h=${h}`} offset={-30} side={1} />

            {/* corner labels */}
            <Text x={x0 + 3} y={y0 + 3} text="▼ x-x" fontSize={8} fontFamily={FONT} fill={C.axis} />

            {/* section label */}
            <Text x={cx - 35} y={cy - 8} text={`${b}×${h}`} fontSize={11}
                fontFamily={FONT} fill="rgba(240,165,0,0.5)" align="center" width={70} />

            {/* title */}
            <Text x={cx - 80} y={y0 - 36} text="CROSS-SECTION" fontSize={10}
                fontFamily={FONT} fill={C.dim} letterSpacing={2} />
        </Group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGRAM 2 — Simply-supported beam elevation with UDL + SFD + BMD
// ═══════════════════════════════════════════════════════════════════════════════

function BeamDiagram({ span = 3000, W = 10000, b = 75, h = 250, bearingLen = 150, cx = 310, cy = 80 }) {
    const BL = 340;  // beam draw length px
    const BH = Math.max(18, Math.min(50, (h / span) * BL * 4));
    const bx = cx - BL / 2;
    const by = cy + 30;

    const wPerUx = W / span;  // N/mm — for labelling
    const udlH = 28;          // px height of UDL block

    // SFD / BMD panel offsets
    const sfdY = by + BH + 60;
    const bmdY = sfdY + 90;

    // SFD peak px (scaled)
    const sfdPeak = 55;
    // BMD peak px
    const bmdPeak = 65;

    const midX = cx;
    const leftX = bx, rightX = bx + BL;

    return (
        <Group>
            {/* ── UDL arrows above beam ── */}
            {Array.from({ length: 12 }, (_, i) => {
                const ax = bx + (i + 0.5) * (BL / 12);
                return (
                    <Arrow key={i}
                        points={[ax, by - udlH, ax, by - 2]}
                        stroke={C.load} fill={C.load}
                        strokeWidth={1} pointerLength={5} pointerWidth={3}
                    />
                );
            })}
            {/* UDL cap line */}
            <Line points={[bx, by - udlH, bx + BL, by - udlH]} stroke={C.load} strokeWidth={1} />
            <Text x={cx - 20} y={by - udlH - 14} text={`w = ${(wPerUx).toFixed(2)} N/mm`}
                fontSize={9} fontFamily={FONT} fill={C.load} />

            {/* ── Beam rectangle ── */}
            <Rect x={bx} y={by} width={BL} height={BH} fill={C.fill} stroke={C.line} strokeWidth={1.5} />
            <WoodHatch x={bx} y={by} w={BL} h={BH} spacing={12} />

            {/* ── Bearing plates ── */}
            {[bx, bx + BL - 16].map((bpx, i) => (
                <Rect key={i} x={bpx} y={by + BH} width={16} height={8}
                    fill="#2a2a2a" stroke={C.line} strokeWidth={1} />
            ))}

            {/* ── Support triangles ── */}
            {[bx + 8, bx + BL - 8].map((sx, i) => (
                <Group key={i}>
                    <Line points={[sx, by + BH + 8, sx - 14, by + BH + 30, sx + 14, by + BH + 30]}
                        closed fill="#222" stroke={C.line} strokeWidth={1} />
                    <Line points={[sx - 18, by + BH + 30, sx + 18, by + BH + 30]}
                        stroke={C.line} strokeWidth={2} />
                </Group>
            ))}

            {/* ── Reaction arrows ── */}
            <ReactionArrow x={bx + 8} y={by + BH + 8} length={36} label={`R=${(W / 2 / 1000).toFixed(1)}kN`} />
            <ReactionArrow x={bx + BL - 8} y={by + BH + 8} length={36} />

            {/* ── Span dimension ── */}
            <DimLine x1={bx} y1={by + BH + 58} x2={bx + BL} y2={by + BH + 58}
                label={`L=${(span / 1000).toFixed(2)}m`} offset={0} side={0} />

            {/* ── Centroidal axis ── */}
            <CentroAxis x1={bx - 20} y1={by + BH / 2} x2={bx + BL + 20} y2={by + BH / 2} label="N.A." />

            {/* ── SFD ── */}
            <Text x={bx - 10} y={sfdY - 14} text="SFD" fontSize={9} fontFamily={FONT} fill={C.sfd} letterSpacing={2} />
            <Line points={[bx, sfdY, bx + BL, sfdY]} stroke={C.muted} strokeWidth={0.5} dash={[4, 4]} />
            <Line
                points={[
                    bx, sfdY - sfdPeak,   // left start (positive)
                    midX, sfdY - sfdPeak,   // flat to mid (then jumps)
                    midX, sfdY + sfdPeak,
                    bx + BL, sfdY + sfdPeak,
                    bx + BL, sfdY,
                ]}
                stroke={C.sfd} strokeWidth={1.5} lineJoin="round"
            />
            {/* SFD fill */}
            <Line
                points={[bx, sfdY - sfdPeak, midX, sfdY - sfdPeak, midX, sfdY, bx, sfdY]}
                closed fill="rgba(167,139,250,0.08)" stroke="transparent"
            />
            <Line
                points={[midX, sfdY + sfdPeak, bx + BL, sfdY + sfdPeak, bx + BL, sfdY, midX, sfdY]}
                closed fill="rgba(167,139,250,0.08)" stroke="transparent"
            />
            <Text x={bx + 4} y={sfdY - sfdPeak - 12} text={`+${(W / 2 / 1000).toFixed(1)}kN`} fontSize={8} fontFamily={FONT} fill={C.sfd} />
            <Text x={bx + BL / 2} y={sfdY + sfdPeak + 2} text={`−${(W / 2 / 1000).toFixed(1)}kN`} fontSize={8} fontFamily={FONT} fill={C.sfd} />

            {/* ── BMD ── */}
            <Text x={bx - 10} y={bmdY - 14} text="BMD" fontSize={9} fontFamily={FONT} fill={C.bmd} letterSpacing={2} />
            <Line points={[bx, bmdY, bx + BL, bmdY]} stroke={C.muted} strokeWidth={0.5} dash={[4, 4]} />
            {/* Parabola approx with many points */}
            {(() => {
                const pts = [];
                const n = 40;
                for (let i = 0; i <= n; i++) {
                    const t = i / n;
                    const x = bx + t * BL;
                    const m = 4 * bmdPeak * t * (1 - t);  // parabola max at mid
                    pts.push(x, bmdY - m);
                }
                return (
                    <>
                        <Line points={pts} stroke={C.bmd} strokeWidth={1.5} tension={0.3} />
                        <Line points={[...pts, bx + BL, bmdY, bx, bmdY]} closed
                            fill="rgba(96,165,250,0.07)" stroke="transparent" />
                    </>
                );
            })()}
            <Line points={[midX, bmdY, midX, bmdY - bmdPeak]} stroke={C.dim} strokeWidth={0.5} dash={[3, 3]} />
            <Text x={midX + 4} y={bmdY - bmdPeak - 2}
                text={`M=${(W * span / 8 / 1e6).toFixed(2)}kN·m`}
                fontSize={8} fontFamily={FONT} fill={C.bmd} />

            {/* ── Title ── */}
            <Text x={cx - 90} y={by - udlH - 34} text="BEAM ELEVATION + SFD + BMD"
                fontSize={10} fontFamily={FONT} fill={C.dim} letterSpacing={2} />
        </Group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGRAM 3 — Notched beam detail
// ═══════════════════════════════════════════════════════════════════════════════

function NotchDiagram({ h = 200, h_e = 125, notchType = "bottom", cx = 200, cy = 180 }) {
    const SCALE = 180 / h;
    const BW = 280, BH = h * SCALE;
    const bx = cx - BW / 2, by = cy - BH / 2;

    const notchD = (h - h_e) * SCALE;
    const notchW = 60;

    // Bottom notch polygon
    const bottomPoints = [
        bx, by,
        bx + BW, by,
        bx + BW, by + BH,
        bx + notchW, by + BH,
        bx + notchW, by + BH - notchD,
        bx, by + BH - notchD,
    ];

    const topPoints = [
        bx, by + notchD,
        bx + notchW, by + notchD,
        bx + notchW, by,
        bx + BW, by,
        bx + BW, by + BH,
        bx, by + BH,
    ];

    const points = notchType === "bottom" ? bottomPoints : topPoints;
    const notchBaseY = notchType === "bottom" ? by + BH : by;
    const heStartY = notchType === "bottom" ? by : by + notchD;
    const heEndY = notchType === "bottom" ? by + BH - notchD : by + BH;

    return (
        <Group>
            {/* Section */}
            <Line points={points} closed fill={C.fill} stroke={C.line} strokeWidth={1.5} />
            <WoodHatch x={bx} y={by} w={BW} h={BH} spacing={10} />

            {/* h dimension */}
            <DimLine x1={bx} y1={by} x2={bx} y2={by + BH}
                label={`h=${h}`} offset={-32} side={1} />

            {/* h_e dimension */}
            <DimLine x1={bx + BW + 10} y1={heStartY} x2={bx + BW + 10} y2={heEndY}
                label={`h_e=${h_e}`} offset={20} side={1} />

            {/* notch depth */}
            <DimLine x1={bx + notchW + 4} y1={notchType === "bottom" ? by + BH - notchD : by}
                x2={bx + notchW + 4} y2={notchType === "bottom" ? by + BH : by + notchD}
                label={`${h - h_e}`} offset={20} side={1} />

            {/* a dimension (notch width) */}
            <DimLine x1={bx} y1={notchType === "bottom" ? by + BH + 16 : by - 16}
                x2={bx + notchW} y2={notchType === "bottom" ? by + BH + 16 : by - 16}
                label="a" offset={0} side={0} />

            {/* Neutral axis */}
            <CentroAxis x1={bx - 20} y1={by + BH / 2} x2={bx + BW + 50} y2={by + BH / 2} label="N.A." />

            {/* Shear stress arrow */}
            <Arrow points={[bx + BW + 60, by + BH / 2, bx + BW + 80, by + BH / 2]}
                stroke={C.load} fill={C.load} strokeWidth={1.5}
                pointerLength={6} pointerWidth={4} />
            <Text x={bx + BW + 84} y={by + BH / 2 - 6} text="Fv" fontSize={9} fontFamily={FONT} fill={C.load} />

            {/* K5 leader */}
            <Leader x1={bx + notchW} y1={notchType === "bottom" ? by + BH - notchD : by + notchD}
                x2={bx + BW + 100} y2={cy - 20}
                label={`K5=h_e/h`} />

            {/* Title */}
            <Text x={cx - 100} y={by - 40} text={`NOTCHED END DETAIL — ${notchType.toUpperCase()} NOTCH`}
                fontSize={10} fontFamily={FONT} fill={C.dim} letterSpacing={2} />
        </Group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGRAM 4 — Compression member end conditions
// ═══════════════════════════════════════════════════════════════════════════════

function EndConditionsDiagram({ cx = 300, cy = 200 }) {
    const cols = [
        { key: "a", coeff: "0.7L", label: "(a)\nFixed–Fixed" },
        { key: "b", coeff: "0.85L", label: "(b)\nFixed–Pin" },
        { key: "c", coeff: "1.0L", label: "(c)\nPin–Pin" },
        { key: "d", coeff: "1.5L", label: "(d)\nFixed–Guided" },
        { key: "e", coeff: "2.0L", label: "(e)\nFixed–Free" },
    ];

    const spacing = 80;
    const totalW = spacing * (cols.length - 1);
    const sx0 = cx - totalW / 2;

    const colH = 100;  // drawn column height px
    const bucklePts = (n, x, y, h, coeff) => {
        // approximate buckled shape
        const pts = [];
        const steps = 20;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            let off;
            if (coeff === "0.7L") off = 14 * Math.sin(Math.PI * t);
            else if (coeff === "0.85L") off = 14 * Math.sin(Math.PI * t * 0.9);
            else if (coeff === "1.0L") off = 16 * Math.sin(Math.PI * t);
            else if (coeff === "1.5L") off = 16 * t * Math.sin(Math.PI * t * 0.7);
            else off = 18 * t * t;
            pts.push(x + off, y + t * h);
        }
        return pts;
    };

    return (
        <Group>
            <Text x={cx - 160} y={cy - colH / 2 - 40} text="EFFECTIVE LENGTH CONDITIONS (TABLE 6.11)"
                fontSize={10} fontFamily={FONT} fill={C.dim} letterSpacing={2} />

            {cols.map((c, i) => {
                const sx = sx0 + i * spacing;
                const sy = cy - colH / 2;
                const pts = bucklePts(i, sx, sy, colH, c.coeff);

                // pin / fixed symbol
                const topFixed = c.key === "a" || c.key === "b" || c.key === "d" || c.key === "e";
                const botFixed = c.key === "a" || c.key === "b" || c.key === "c" || c.key === "d";
                const topGuided = c.key === "d";
                const botPin = c.key === "c";

                return (
                    <Group key={c.key}>
                        {/* straight axis */}
                        <Line points={[sx, sy, sx, sy + colH]} stroke={C.muted} strokeWidth={0.5} dash={[4, 3]} />
                        {/* buckled shape */}
                        <Line points={pts} stroke={C.line} strokeWidth={1.8} tension={0.4} />

                        {/* bottom support */}
                        {botFixed
                            ? <><Line points={[sx - 14, sy + colH + 2, sx + 14, sy + colH + 2]} stroke={C.line} strokeWidth={2} />
                                {[...Array(4)].map((_, j) => <Line key={j} points={[sx - 12 + j * 8, sy + colH + 2, sx - 16 + j * 8, sy + colH + 10]} stroke={C.line} strokeWidth={1} />)}
                            </>
                            : <><Circle x={sx} y={sy + colH} radius={5} stroke={C.line} strokeWidth={1.2} fill={C.fill} />
                                <Line points={[sx - 10, sy + colH + 5, sx + 10, sy + colH + 5]} stroke={C.line} strokeWidth={1.5} />
                            </>
                        }

                        {/* top support */}
                        {topFixed && !topGuided
                            ? <><Line points={[sx - 14, sy - 2, sx + 14, sy - 2]} stroke={C.line} strokeWidth={2} />
                                {[...Array(4)].map((_, j) => <Line key={j} points={[sx - 12 + j * 8, sy - 2, sx - 8 + j * 8, sy - 10]} stroke={C.line} strokeWidth={1} />)}
                            </>
                            : topGuided
                                ? <><Line points={[sx - 14, sy, sx + 14, sy]} stroke={C.line} strokeWidth={2} dash={[4, 2]} />
                                    <Circle x={sx} y={sy} radius={4} stroke={C.line} strokeWidth={1} fill={C.fill} />
                                </>
                                : <Circle x={sx} y={sy} radius={5} stroke={C.line} strokeWidth={1.2} fill={C.fill} />
                        }

                        {/* Le annotation */}
                        <Text x={sx + 16} y={cy - 10} text={`Le=${c.coeff}`} fontSize={8} fontFamily={FONT} fill={C.amber} />

                        {/* label */}
                        <Text x={sx - 20} y={sy + colH + 28} text={c.label} fontSize={8} fontFamily={FONT} fill={C.text} align="center" width={40} />
                    </Group>
                );
            })}
        </Group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGRAM 5 — Stud wall plan and elevation
// ═══════════════════════════════════════════════════════════════════════════════

function StudWallDiagram({ b = 44, d = 100, spacing = 600, height = 3750, cx = 300, cy = 200 }) {
    const HSCALE = 180 / height;
    const hPx = height * HSCALE;
    const sPx = Math.min(spacing / height * hPx * 3, 80);  // stud spacing px

    const numStuds = 4;
    const totalW = sPx * (numStuds - 1);
    const ex0 = cx - totalW / 2;
    const ey0 = cy - hPx / 2;

    // Section scale
    const CSCALE = 60 / Math.max(b, d);
    const cW = d * CSCALE;
    const cH = b * CSCALE;
    const sectionY = ey0 + hPx + 50;

    return (
        <Group>
            <Text x={cx - 120} y={ey0 - 30} text="STUD WALL ELEVATION + CROSS-SECTION"
                fontSize={10} fontFamily={FONT} fill={C.dim} letterSpacing={2} />

            {/* ── Elevation ── */}
            {/* Top plate */}
            <Rect x={ex0 - 12} y={ey0 - 8} width={totalW + 24} height={8}
                fill={C.fill} stroke={C.line} strokeWidth={1.5} />
            {/* Bottom plate */}
            <Rect x={ex0 - 12} y={ey0 + hPx} width={totalW + 24} height={8}
                fill={C.fill} stroke={C.line} strokeWidth={1.5} />

            {/* Studs */}
            {Array.from({ length: numStuds }, (_, i) => {
                const sx = ex0 + i * sPx;
                return (
                    <Group key={i}>
                        <Rect x={sx - 4} y={ey0} width={8} height={hPx}
                            fill={C.fill} stroke={C.line} strokeWidth={1.2} />
                    </Group>
                );
            })}

            {/* Nogging (mid height) */}
            <Rect x={ex0 - 12} y={ey0 + hPx / 2 - 4} width={totalW + 24} height={8}
                fill={C.fill} stroke={C.line} strokeWidth={1.2} dash={[6, 3]} />
            <Leader x1={ex0 - 14} y1={ey0 + hPx / 2}
                x2={ex0 - 70} y2={ey0 + hPx / 2 - 20}
                label="Nogging" />

            {/* Load arrows on top plate */}
            {Array.from({ length: numStuds }, (_, i) => (
                <Arrow key={i}
                    points={[ex0 + i * sPx, ey0 - 40, ex0 + i * sPx, ey0 - 10]}
                    stroke={C.load} fill={C.load}
                    strokeWidth={1.5} pointerLength={6} pointerWidth={4}
                />
            ))}
            <Line points={[ex0 - 12, ey0 - 40, ex0 + totalW + 12, ey0 - 40]}
                stroke={C.load} strokeWidth={1} />

            {/* Dimension — height */}
            <DimLine x1={ex0 + totalW + 20} y1={ey0} x2={ex0 + totalW + 20} y2={ey0 + hPx}
                label={`H=${height}mm`} offset={20} side={1} />

            {/* Dimension — spacing */}
            <DimLine x1={ex0} y1={ey0 + hPx + 24} x2={ex0 + sPx} y2={ey0 + hPx + 24}
                label={`${spacing}mm`} offset={0} side={0} />

            {/* Effective length arrows */}
            <Arrow points={[ex0 + totalW + 48, ey0, ex0 + totalW + 48, ey0 + hPx / 2 - 4]}
                stroke={C.axis} fill={C.axis} strokeWidth={1} pointerLength={5} pointerWidth={3} />
            <Arrow points={[ex0 + totalW + 48, ey0 + hPx, ex0 + totalW + 48, ey0 + hPx / 2 + 4]}
                stroke={C.axis} fill={C.axis} strokeWidth={1} pointerLength={5} pointerWidth={3} />
            <Text x={ex0 + totalW + 52} y={ey0 + hPx / 4 - 5} text="L_ey" fontSize={8} fontFamily={FONT} fill={C.axis} />

            {/* ── Cross section ── */}
            <Text x={cx - 35} y={sectionY - 18} text="STUD SECTION" fontSize={9}
                fontFamily={FONT} fill={C.dim} letterSpacing={2} />
            <Rect x={cx - cW / 2} y={sectionY} width={cW} height={cH}
                fill={C.fill} stroke={C.line} strokeWidth={1.5} />
            <WoodHatch x={cx - cW / 2} y={sectionY} w={cW} h={cH} spacing={8} />
            <CentroAxis x1={cx - cW / 2 - 12} y1={sectionY + cH / 2} x2={cx + cW / 2 + 12} y2={sectionY + cH / 2} label="x" />
            <CentroAxis x1={cx} y1={sectionY - 12} x2={cx} y2={sectionY + cH + 12} label="y" />
            <DimLine x1={cx - cW / 2} y1={sectionY + cH} x2={cx + cW / 2} y2={sectionY + cH}
                label={`d=${d}`} offset={16} side={1} />
            <DimLine x1={cx - cW / 2} y1={sectionY} x2={cx - cW / 2} y2={sectionY + cH}
                label={`b=${b}`} offset={-22} side={1} />
        </Group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIAGRAM 6 — Bending stress distribution diagram
// ═══════════════════════════════════════════════════════════════════════════════

function StressDistributionDiagram({ sigma_m = 5.0, cx = 200, cy = 200 }) {
    const BW = 50, BH = 160;
    const bx = cx - BW / 2, by = cy - BH / 2;
    const peakX = 70; // px

    const arrowCount = 7;
    const step = BH / (arrowCount - 1);

    const stressAt = (iy) => {
        // linear stress: max at top (compression) and bottom (tension)
        const normalised = (iy / (arrowCount - 1)) * 2 - 1;  // -1 to +1
        return normalised;   // -1 = top compression, +1 = bottom tension
    };

    return (
        <Group>
            <Text x={cx - 90} y={by - 30} text="BENDING STRESS DISTRIBUTION"
                fontSize={10} fontFamily={FONT} fill={C.dim} letterSpacing={2} />

            {/* Section */}
            <Rect x={bx} y={by} width={BW} height={BH} fill={C.fill} stroke={C.line} strokeWidth={1.5} />
            <WoodHatch x={bx} y={by} w={BW} h={BH} spacing={8} />

            {/* Neutral axis */}
            <CentroAxis x1={bx - 10} y1={cy} x2={bx + BW + peakX + 40} y2={cy} label="N.A." />

            {/* Stress arrows */}
            {Array.from({ length: arrowCount }, (_, i) => {
                const ay = by + i * step;
                const norm = stressAt(i);
                const aPx = Math.abs(norm) * peakX;
                const isComp = norm < 0;
                const color = isComp ? C.sfd : C.bmd;

                if (aPx < 2) return null;

                return (
                    <Group key={i}>
                        {isComp
                            ? <Arrow points={[bx + BW + aPx, ay, bx + BW + 2, ay]}
                                stroke={color} fill={color} strokeWidth={1.2}
                                pointerLength={6} pointerWidth={4} />
                            : <Arrow points={[bx + BW + 2, ay, bx + BW + aPx, ay]}
                                stroke={color} fill={color} strokeWidth={1.2}
                                pointerLength={6} pointerWidth={4} />
                        }
                    </Group>
                );
            })}

            {/* Stress diagram outline */}
            <Line
                points={[
                    bx + BW, by, bx + BW + peakX, by,
                    bx + BW, cy,
                    bx + BW, cy, bx + BW + peakX, by + BH,
                    bx + BW, by + BH,
                ]}
                stroke={C.line} strokeWidth={0.8} dash={[4, 3]}
            />

            {/* Labels */}
            <Text x={bx + BW + peakX + 4} y={by - 2} text={`σ_comp`} fontSize={9} fontFamily={FONT} fill={C.sfd} />
            <Text x={bx + BW + peakX + 4} y={by + BH - 8} text={`σ_tens`} fontSize={9} fontFamily={FONT} fill={C.bmd} />
            <Leader x1={bx + BW} y1={cy} x2={bx + BW + peakX + 20} y2={cy}
                label="σ=0 (N.A.)" />

            {/* σ_m,adm label */}
            <Text x={bx + BW + peakX + 4} y={by + 22}
                text={`σ_m,adm=${sigma_m}N/mm²`}
                fontSize={8} fontFamily={FONT} fill={C.amber} />

            {/* Dimension lines */}
            <DimLine x1={bx} y1={by} x2={bx} y2={by + BH}
                label="h" offset={-24} side={1} />
        </Group>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Visualisation Component
// ═══════════════════════════════════════════════════════════════════════════════

const DIAGRAMS = [
    { id: "section", label: "Cross Section" },
    { id: "beam", label: "Beam + SFD/BMD" },
    { id: "notch", label: "Notched End" },
    { id: "columns", label: "End Conditions" },
    { id: "stud", label: "Stud Wall" },
    { id: "stress", label: "Stress Dist." },
];

export default function TimberVisualisation() {
    const [activeDiagram, setActiveDiagram] = useState("section");

    // Controllable parameters per diagram
    const [params, setParams] = useState({
        b: 75, h: 250,
        span: 3000, W: 10000, bearingLen: 150,
        h_e: 125, notchType: "bottom",
        studB: 44, studD: 100, studSpacing: 600, studHeight: 3750,
        sigma_m: 5.3,
    });

    const set = (k, v) => setParams(p => ({ ...p, [k]: v }));

    // Canvas size
    const W_CVS = 700, H_CVS = 520;

    const renderDiagram = () => {
        switch (activeDiagram) {
            case "section": return <CrossSectionDiagram b={params.b} h={params.h} cx={W_CVS / 2} cy={H_CVS / 2} />;
            case "beam": return <BeamDiagram span={params.span} W={params.W} b={params.b} h={params.h} bearingLen={params.bearingLen} cx={W_CVS / 2} cy={100} />;
            case "notch": return <NotchDiagram h={params.h} h_e={params.h_e} notchType={params.notchType} cx={W_CVS / 2} cy={H_CVS / 2} />;
            case "columns": return <EndConditionsDiagram cx={W_CVS / 2} cy={H_CVS / 2} />;
            case "stud": return <StudWallDiagram b={params.studB} d={params.studD} spacing={params.studSpacing} height={params.studHeight} cx={W_CVS / 2} cy={H_CVS / 2 - 30} />;
            case "stress": return <StressDistributionDiagram sigma_m={params.sigma_m} cx={W_CVS / 2 - 40} cy={H_CVS / 2} />;
            default: return null;
        }
    };

    const controlSets = {
        section: (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <VizField label="b (mm)" min={22} max={300} value={params.b} onChange={v => set("b", v)} />
                <VizField label="h (mm)" min={50} max={500} value={params.h} onChange={v => set("h", v)} />
            </div>
        ),
        beam: (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <VizField label="span (mm)" min={500} max={8000} value={params.span} step={100} onChange={v => set("span", v)} />
                <VizField label="W total (N)" min={100} max={100000} value={params.W} step={500} onChange={v => set("W", v)} />
                <VizField label="h (mm)" min={50} max={400} value={params.h} onChange={v => set("h", v)} />
            </div>
        ),
        notch: (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <VizField label="h (mm)" min={100} max={400} value={params.h} onChange={v => set("h", v)} />
                <VizField label="h_e (mm)" min={params.h * 0.5} max={params.h - 10} value={params.h_e} onChange={v => set("h_e", v)} />
                <div>
                    <div style={{ fontSize: 10, color: "#6b6b6b", marginBottom: 4, fontFamily: "'Courier New', monospace" }}>Type</div>
                    <select value={params.notchType} onChange={e => set("notchType", e.target.value)}
                        style={{
                            background: "#1c1c1c", border: "1px solid #2a2a2a", color: "#e8e8e8",
                            fontFamily: "'Courier New', monospace", fontSize: 12, padding: "5px 8px", width: "100%"
                        }}>
                        <option value="bottom">Bottom</option>
                        <option value="top">Top</option>
                    </select>
                </div>
            </div>
        ),
        columns: <div style={{ color: "#6b6b6b", fontSize: 11, fontFamily: "'Courier New', monospace" }}>No parameters — fixed reference diagram.</div>,
        stud: (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                <VizField label="b stud (mm)" min={35} max={100} value={params.studB} onChange={v => set("studB", v)} />
                <VizField label="d stud (mm)" min={75} max={200} value={params.studD} onChange={v => set("studD", v)} />
                <VizField label="spacing (mm)" min={200} max={800} step={50} value={params.studSpacing} onChange={v => set("studSpacing", v)} />
                <VizField label="height (mm)" min={1000} max={6000} step={100} value={params.studHeight} onChange={v => set("studHeight", v)} />
            </div>
        ),
        stress: (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, maxWidth: 200 }}>
                <VizField label="σ_m,adm (N/mm²)" min={1} max={25} step={0.1} value={params.sigma_m} onChange={v => set("sigma_m", v)} />
            </div>
        ),
    };

    return (
        <div style={{
            minHeight: "100vh", background: "#0f0f0f", color: "#e8e8e8",
            fontFamily: "'Courier New', monospace",
            backgroundImage: `linear-gradient(rgba(240,165,0,0.015) 1px, transparent 1px),linear-gradient(90deg, rgba(240,165,0,0.015) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
        }}>
            {/* Header */}
            <div style={{ borderBottom: "1px solid #2a2a2a", padding: "18px 40px", display: "flex", alignItems: "baseline", gap: 20 }}>
                <div style={{ fontSize: 11, color: "#f0a500", letterSpacing: "0.2em" }}>▐ BS 5268 : PART 2</div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.05em" }}>Engineering Drawing Visualiser</div>
                <div style={{ marginLeft: "auto", fontSize: 10, color: "#6b6b6b" }}>KONVA · PARAMETRIC · DIMENSIONED</div>
            </div>

            {/* Diagram tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #2a2a2a", padding: "0 40px" }}>
                {DIAGRAMS.map(d => (
                    <button key={d.id} onClick={() => setActiveDiagram(d.id)} style={{
                        background: "none", border: "none", cursor: "pointer",
                        padding: "12px 18px", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: activeDiagram === d.id ? "#f0a500" : "#6b6b6b",
                        borderBottom: activeDiagram === d.id ? "2px solid #f0a500" : "2px solid transparent",
                    }}>
                        {d.label}
                    </button>
                ))}
            </div>

            {/* Canvas */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 40px 0" }}>
                <div style={{
                    border: "1px solid #2a2a2a", borderRadius: 2,
                    background: "#0a0a0a",
                    boxShadow: "0 0 60px rgba(0,0,0,0.8)",
                }}>
                    <Stage width={W_CVS} height={H_CVS}>
                        <Layer>
                            {/* Blueprint grid */}
                            {Array.from({ length: Math.ceil(H_CVS / 30) }, (_, i) => (
                                <Line key={`h${i}`} points={[0, i * 30, W_CVS, i * 30]}
                                    stroke="rgba(240,165,0,0.04)" strokeWidth={1} />
                            ))}
                            {Array.from({ length: Math.ceil(W_CVS / 30) }, (_, i) => (
                                <Line key={`v${i}`} points={[i * 30, 0, i * 30, H_CVS]}
                                    stroke="rgba(240,165,0,0.04)" strokeWidth={1} />
                            ))}
                            {renderDiagram()}
                        </Layer>
                    </Stage>
                </div>

                {/* Legend */}
                <div style={{ display: "flex", gap: 24, marginTop: 12, fontSize: 10, color: "#6b6b6b" }}>
                    {[
                        { color: C.line, label: "Section" },
                        { color: C.dim, label: "Dimension / Annotation" },
                        { color: C.axis, label: "Centroidal Axis" },
                        { color: C.load, label: "Load / Compression Stress" },
                        { color: C.reaction, label: "Reaction / Tension Stress" },
                        { color: C.bmd, label: "Bending Moment" },
                        { color: C.sfd, label: "Shear Force" },
                    ].map(l => (
                        <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 20, height: 2, background: l.color, borderRadius: 1 }} />
                            <span>{l.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Controls */}
            <div style={{ padding: "20px 40px 40px", maxWidth: W_CVS, margin: "0 auto" }}>
                <div style={{
                    fontSize: 10, color: "#6b6b6b", letterSpacing: "0.12em", textTransform: "uppercase",
                    borderBottom: "1px solid #2a2a2a", paddingBottom: 8, marginBottom: 16
                }}>
                    Diagram Parameters
                </div>
                {controlSets[activeDiagram]}
            </div>
        </div>
    );
}

// ─── Slider control for visualisation ────────────────────────────────────────
function VizField({ label, min, max, step = 1, value, onChange }) {
    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#9a9a9a", fontFamily: "'Courier New', monospace", letterSpacing: "0.08em" }}>{label}</span>
                <span style={{ fontSize: 11, color: "#f0a500", fontFamily: "'Courier New', monospace" }}>{value}</span>
            </div>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
                style={{
                    width: "100%", accentColor: "#f0a500", cursor: "pointer",
                    background: "transparent",
                }}
            />
        </div>
    );
}