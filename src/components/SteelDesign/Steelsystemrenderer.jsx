import React, { useMemo } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// StructuralElement class (self-contained copy — do not import externally)
// ─────────────────────────────────────────────────────────────────────────────
class StructuralElement {
    constructor(type, id, position, properties = {}) {
        this.type = type; // 'column' or 'beam'
        this.id = id;
        // For column: position = { x, y, z }
        // For beam:   position = { start: {x,y,z}, end: {x,y,z} }
        this.position = position;
        this.properties = { width: 0.3, depth: 0.3, height: 3.5, ...properties };
        this.layer = properties.layer || 'Floor 1';
        this.selected = false;
        this.visible = true;
        this.analysisResults = null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeType
// Columns and legs → 'column'
// Everything else (rafters, chords, diagonals, bracings, purlins, ties) → 'beam'
// ─────────────────────────────────────────────────────────────────────────────
function normalizeType(rawType) {
    const t = String(rawType || '').toLowerCase();
    if (t.includes('column') || t.includes('leg')) return 'column';
    return 'beam';
}

// ─────────────────────────────────────────────────────────────────────────────
// Generator name sets used for coordinate projection decisions
// ─────────────────────────────────────────────────────────────────────────────
const BRIDGE_GENERATORS = new Set(['bridge']);

const LATTICE_GENERATORS = new Set(['lattice_tower']);

// Portal-like: X = span, Y = bay/out-of-plane, Z = height
// Includes portal_frame, portal_frame_dual, truss, north_light(_shed), plate_girder(_frame)
const PORTAL_LIKE_GENERATORS = new Set([
    'portal_frame',
    'portal_frame_dual',
    'truss',
    'north_light',
    'north_light_shed',
    'plate_girder',
    'plate_girder_frame',
]);

// ─────────────────────────────────────────────────────────────────────────────
// transformSteelResults
//
// Receives:
//   results       – raw API JSON  { success, members: [...] }
//   generatorName – string e.g. 'portal_frame', 'truss', 'lattice_tower', 'bridge'
//
// Returns:
//   { elements: StructuralElement[] }
//
// All backend coords are in MILLIMETRES → converted to metres (÷ 1000).
// Coordinate projection rules:
//   Portal frames / trusses / north light / plate girder:
//     backend X → span (canvas X)
//     backend Y → bay spacing (canvas Y)
//     backend Z → height (used in 3D and elevation; collapsed to 0 for plan)
//   Lattice tower:
//     backend X → canvas X (plan)
//     backend Y → canvas Y (plan)
//     backend Z → height (kept for 3D / elevation)
//   Bridge:
//     backend Y → canvas X  (bridge runs along its Y axis)
//     backend X → canvas Y  (across bridge width)
//     backend Z → height
// ─────────────────────────────────────────────────────────────────────────────
export function transformSteelResults(results, generatorName) {
    if (!results?.success || !Array.isArray(results.members)) return { elements: [] };

    const MM = 0.001;
    const gen = String(generatorName || '').toLowerCase();

    const elements = results.members.map((m, idx) => {
        const type = normalizeType(m.type || m.member_type);

        const cl = m.centerline || {};
        const rs = cl.start || { x: 0, y: 0, z: 0 };
        const re = cl.end || { x: 0, y: 0, z: 0 };

        // Raw coords converted from mm → m
        const sx = (rs.x || 0) * MM;
        const sy = (rs.y || 0) * MM;
        const sz = (rs.z || 0) * MM;
        const ex = (re.x || 0) * MM;
        const ey = (re.y || 0) * MM;
        const ez = (re.z || 0) * MM;

        // ── Apply coordinate projection ──────────────────────────────────────
        let start3D, end3D;

        if (BRIDGE_GENERATORS.has(gen)) {
            // Bridge runs along Y; remap so bridge length goes along canvas X
            start3D = { x: sy, y: sx, z: sz };
            end3D = { x: ey, y: ex, z: ez };

        } else if (LATTICE_GENERATORS.has(gen)) {
            // Lattice tower: legs taper upward; X/Y are plan positions, Z is height
            start3D = { x: sx, y: sy, z: sz };
            end3D = { x: ex, y: ey, z: ez };

        } else {
            // Portal frames, trusses, north light shed, plate girder frames
            // X = span direction, Y = bay (out-of-plane), Z = height
            start3D = { x: sx, y: sy, z: sz };
            end3D = { x: ex, y: ey, z: ez };
        }

        // ── 2D plan view: collapse height (Z → 0) ───────────────────────────
        // The 2D canvas uses top-down plan view, so only X and Y matter
        const start2D = { x: start3D.x, y: start3D.y, z: 0 };
        const end2D = { x: end3D.x, y: end3D.y, z: 0 };

        // Columns → single point position; beams → start/end pair
        const position2D = type === 'column'
            ? start2D
            : { start: start2D, end: end2D };

        // ── Section properties ───────────────────────────────────────────────
        const sec = m.section || {};
        const depthM = (sec.depth || 300) * MM;
        const widthM = (sec.width || sec.flange_width || 150) * MM;

        // For columns the "height" property = vertical extent; for inclined members use 3D length
        const dz = end3D.z - start3D.z;
        const dx = end3D.x - start3D.x;
        const dy = end3D.y - start3D.y;
        const memberLength3D = Math.sqrt(dx * dx + dy * dy + dz * dz) || 3.5;

        const el = new StructuralElement(
            type,
            String(m.id || m.mark || `m_${idx}`),
            position2D,
            {
                width: widthM,
                depth: depthM,
                height: type === 'column' ? Math.abs(dz) || memberLength3D : memberLength3D,
                material: m.grade || 'S275',
                section: sec.designation || 'Unknown',
                mass_per_meter: sec.mass_per_meter || 0,
                layer: 'Floor 1',
                generatorName: gen,
                // Full 3D coords for 3D canvas (@react-three/fiber) and elevation SVG
                start3D,
                end3D,
            }
        );

        return el;
    });

    return { elements };
}

// ─────────────────────────────────────────────────────────────────────────────
// SteelElevationCanvas  (default export)
//
// A standalone React component that renders the steel structure as an
// engineering elevation (side view) using SVG — no Konva, no Three.js needed.
//
// It uses el.properties.start3D and el.properties.end3D for every member.
// The view projects  X → SVG X  and  Z → SVG Y (flipped, because SVG Y
// increases downward but structural Z increases upward).
//
// Props:
//   elements  StructuralElement[]   – output of transformSteelResults
//   width     number                – SVG pixel width   (default 800)
//   height    number                – SVG pixel height  (default 450)
//   title     string                – drawing title shown at top
// ─────────────────────────────────────────────────────────────────────────────
export default function SteelElevationCanvas({
    elements = [],
    width = 800,
    height = 450,
    title = 'Steel Structure',
}) {

    // ── Bounding box and scale calculation ─────────────────────────────────
    const view = useMemo(() => {
        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        elements.forEach(el => {
            const s = el.properties?.start3D;
            const e = el.properties?.end3D;
            if (!s || !e) return;

            [s.x, e.x].forEach(v => { if (v < minX) minX = v; if (v > maxX) maxX = v; });
            [s.z, e.z].forEach(v => { if (v < minZ) minZ = v; if (v > maxZ) maxZ = v; });
        });

        // Fallback: no valid elements
        if (!isFinite(minX) || !isFinite(minZ)) {
            return {
                scale: 40, offsetX: 60, offsetY: height - 60,
                minX: 0, maxX: 10, minZ: 0, maxZ: 5,
                worldW: 10, worldH: 5,
            };
        }

        const PAD = 0.1;  // 10% padding each side
        const worldW = (maxX - minX) || 1;
        const worldH = (maxZ - minZ) || 1;

        const drawW = width * (1 - 2 * PAD);
        const drawH = height * (1 - 2 * PAD);

        const scale = Math.min(drawW / worldW, drawH / worldH);

        // Map world (minX, minZ) to SVG padding corner
        const offsetX = width * PAD - minX * scale;
        const offsetY = height * (1 - PAD) + minZ * scale; // SVG Y is flipped

        return { scale, offsetX, offsetY, minX, maxX, minZ, maxZ, worldW, worldH };
    }, [elements, width, height]);

    // Project world (x, z) to SVG pixel coords
    const toSvg = (x, z) => ({
        x: x * view.scale + view.offsetX,
        y: view.offsetY - z * view.scale,   // flip: +Z (up) → −SVG_Y (up)
    });

    // Ground line
    const gL = toSvg(view.minX, 0);
    const gR = toSvg(view.maxX, 0);

    // Axis label positions
    const axisBottom = toSvg(view.minX, view.minZ);

    return (
        <div
            style={{
                background: '#fafafa',
                border: '1px solid #ccc',
                borderRadius: 8,
                padding: '12px 16px',
                fontFamily: "'Segoe UI', Arial, sans-serif",
                display: 'inline-block',
            }}
        >
            {/* ── Drawing title ─────────────────────────────────────────────── */}
            <div
                style={{
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: 15,
                    marginBottom: 6,
                    color: '#1a1a2e',
                    letterSpacing: 0.4,
                    textTransform: 'uppercase',
                }}
            >
                {title}
            </div>

            <svg
                width={width}
                height={height}
                style={{ display: 'block' }}
                aria-label={title}
            >
                {/* ── Subtle vertical grid ───────────────────────────────────── */}
                {Array.from({ length: 7 }, (_, i) => {
                    const wx = view.minX + (view.worldW / 6) * i;
                    const pt = toSvg(wx, view.minZ);
                    const pt2 = toSvg(wx, view.maxZ);
                    return (
                        <line
                            key={`gv${i}`}
                            x1={pt.x} y1={pt.y + 6}
                            x2={pt2.x} y2={pt2.y - 6}
                            stroke="#ececec" strokeWidth={1}
                        />
                    );
                })}

                {/* ── Subtle horizontal grid ─────────────────────────────────── */}
                {Array.from({ length: 5 }, (_, i) => {
                    const wz = view.minZ + (view.worldH / 4) * i;
                    const ptL = toSvg(view.minX, wz);
                    const ptR = toSvg(view.maxX, wz);
                    return (
                        <line
                            key={`gh${i}`}
                            x1={ptL.x + 6} y1={ptL.y}
                            x2={ptR.x - 6} y2={ptR.y}
                            stroke="#ececec" strokeWidth={1}
                        />
                    );
                })}

                {/* ── Ground / datum line ─────────────────────────────────────── */}
                <line
                    x1={gL.x - 40} y1={gL.y}
                    x2={gR.x + 40} y2={gR.y}
                    stroke="#8B6914"
                    strokeWidth={2.5}
                    strokeDasharray="12,6"
                />
                <text x={gL.x - 38} y={gL.y - 5} fontSize={9} fill="#8B6914" fontStyle="italic">
                    GL ±0.000
                </text>

                {/* ── Members ─────────────────────────────────────────────────── */}
                {elements.map((el) => {
                    const s = el.properties?.start3D;
                    const e = el.properties?.end3D;
                    if (!s || !e) return null;

                    const p1 = toSvg(s.x, s.z);
                    const p2 = toSvg(e.x, e.z);
                    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

                    const isCol = el.type === 'column';
                    const stroke = isCol ? '#2c3e50' : '#4a7c99';
                    const sw = isCol ? 5 : 3;
                    const secLabel = el.properties?.section;

                    return (
                        <g key={el.id}>
                            {/* Member centreline */}
                            <line
                                x1={p1.x} y1={p1.y}
                                x2={p2.x} y2={p2.y}
                                stroke={stroke}
                                strokeWidth={sw}
                                strokeLinecap="round"
                            />

                            {/* Section designation (above midpoint) */}
                            {secLabel && secLabel !== 'Unknown' && (
                                <text
                                    x={mid.x} y={mid.y - 6}
                                    fontSize={8}
                                    fill="#7a8a9a"
                                    textAnchor="middle"
                                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                                >
                                    {secLabel}
                                </text>
                            )}

                            {/* Member ID (below midpoint) */}
                            <text
                                x={mid.x} y={mid.y + 14}
                                fontSize={8}
                                fill="#333"
                                textAnchor="middle"
                                fontWeight="600"
                                style={{ pointerEvents: 'none', userSelect: 'none' }}
                            >
                                {el.id}
                            </text>
                        </g>
                    );
                })}

                {/* ── Axis labels ─────────────────────────────────────────────── */}
                <text
                    x={width / 2}
                    y={height - 4}
                    fontSize={10}
                    fill="#666"
                    textAnchor="middle"
                >
                    ← Span / Length (m) →
                </text>
                <text
                    x={14}
                    y={height / 2}
                    fontSize={10}
                    fill="#666"
                    textAnchor="middle"
                    transform={`rotate(-90, 14, ${height / 2})`}
                >
                    Height (m)
                </text>

                {/* ── Legend ──────────────────────────────────────────────────── */}
                <g transform={`translate(${width - 160}, 14)`}>
                    <rect
                        x={0} y={0} width={148} height={60}
                        rx={5} ry={5}
                        fill="white"
                        stroke="#ddd"
                        strokeWidth={1}
                    />
                    <text x={8} y={16} fontSize={10} fontWeight="700" fill="#333">
                        Legend
                    </text>
                    {/* Column swatch */}
                    <line
                        x1={10} y1={32} x2={44} y2={32}
                        stroke="#2c3e50" strokeWidth={5} strokeLinecap="round"
                    />
                    <text x={52} y={36} fontSize={10} fill="#333">Column</text>
                    {/* Beam swatch */}
                    <line
                        x1={10} y1={50} x2={44} y2={50}
                        stroke="#4a7c99" strokeWidth={3} strokeLinecap="round"
                    />
                    <text x={52} y={54} fontSize={10} fill="#333">Beam / Rafter</text>
                </g>

            </svg>
        </div>
    );
}