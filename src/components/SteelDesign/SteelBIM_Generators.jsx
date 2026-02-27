// ============================================================================
// STEEL BIM — Structure Generators
// 5 Trusses × 5 Portals × 5 Bridges × 5 Towers × 5 Domes = 25 structure types
// Each returns { members:SteelElement[], connections:Connection[], metadata:{} }
// ============================================================================

import { SteelElement, Connection, CONNECTION_TYPES, v3, vadd, vsub, vscale, vmid, vlen, vnorm, deg2rad } from './SteelBIM_Core.jsx';

let _id = 0;
const uid = (prefix = 'E') => `${prefix}-${++_id}`;
const cuid = (prefix = 'C') => `${prefix}-${++_id}`;

const el = (type, start, end, opts) => new SteelElement(uid(type.slice(0, 2).toUpperCase()), type, start, end, opts);
const conn = (type, pos, members, opts) => new Connection(cuid('CN'), type, pos, members, opts);

// ─── Foundation helper ───────────────────────────────────────────────────────
const makeFoundation = (x, y, size = 1.2, depth = 0.5) => {
    const base = v3(x, y, -depth);
    const c = conn(CONNECTION_TYPES.BASE_PLATE, v3(x, y, 0), [], {
        plateW: 400, plateH: 400, plateT: 30,
        boltRows: 2, boltCols: 2, boltDia: 24, boltGrade: 'Grade 8.8 Bolt',
        anchorDia: 24, anchorEmbedment: 500, groutThickness: 30,
        hasStiffeners: true, stiffenerT: 15,
        label: `BP@(${x.toFixed(1)},${y.toFixed(1)})`,
        meta: { concreteClass: 'C30/37', size: `${size * 1000}×${size * 1000}×${depth * 1000}mm` }
    });
    return c;
};

// ─── Category Metadata ──────────────────────────────────────────────────────
export const CAT_COLORS = {
    trusses: '#f97316', portals: '#22c55e', bridges: '#3b82f6', towers: '#a855f7', domes: '#ec4899', generic: '#64748b'
};
export const CAT_ICONS = {
    trusses: '🏠', portals: '🏗️', bridges: '🌉', towers: '🗼', domes: '🌐', generic: '⚙️'
};

// ═══════════════════════════════════════════════════════════════════════════
// TRUSSES (5 types)
// ═══════════════════════════════════════════════════════════════════════════

// T1 — Pratt Roof Truss (symmetric, 12m span, 6 panels)
export const genPrattTruss = (cfg = {}) => {
    const { span = 12, depth = 1.5, panels = 6, pitch = 15, yOff = 0, full = true } = cfg;
    const members = [], connections = [];
    const pw = span / panels;
    const hs = span / 2;
    const pr = deg2rad(pitch);

    const bot = [], top = [];
    for (let i = 0; i <= panels; i++) {
        const x = i * pw;
        const dFromEdge = Math.abs(x - hs);
        bot.push(v3(x, yOff, 0));
        top.push(v3(x, yOff, (hs - dFromEdge) * Math.tan(pr)));
    }

    // Bottom chord with gusset connections at internals
    for (let i = 0; i < panels; i++) {
        const m = el('member', bot[i], bot[i + 1], { section: 'UB 203x133x25', role: 'truss-bottom', label: `BC${i + 1}`, layer: 'TRUSS', frameId: 'T1' });
        members.push(m);
        if (i > 0) connections.push(conn(CONNECTION_TYPES.GUSSET_PLATE, bot[i], [m.id], { plateW: 200, plateH: 160, boltRows: 2, boltCols: 3, boltDia: 20, weldSize: 8, label: `GP-BOT-${i}` }));
    }
    // Top chord
    for (let i = 0; i < panels; i++) {
        const m = el('member', top[i], top[i + 1], { section: 'UB 203x133x25', role: 'truss-top', label: `TC${i + 1}`, layer: 'TRUSS', frameId: 'T1' });
        members.push(m);
        if (i > 0) connections.push(conn(CONNECTION_TYPES.GUSSET_PLATE, top[i], [m.id], { plateW: 200, plateH: 160, boltRows: 2, boltCols: 3, boltDia: 20, weldSize: 8, label: `GP-TOP-${i}` }));
    }
    // Verticals
    for (let i = 1; i < panels; i++) {
        members.push(el('member', bot[i], top[i], { section: 'UC 152x152x37', role: 'vertical', label: `V${i}`, layer: 'TRUSS', frameId: 'T1' }));
    }
    // End posts
    members.push(el('member', bot[0], top[0], { section: 'UC 152x152x37', role: 'vertical', label: 'EVL', layer: 'TRUSS', frameId: 'T1' }));
    members.push(el('member', bot[panels], top[panels], { section: 'UC 152x152x37', role: 'vertical', label: 'EVR', layer: 'TRUSS', frameId: 'T1' }));
    // Diagonals (Pratt — tension diagonals toward centre)
    for (let i = 0; i < panels; i++) {
        const lh = i < panels / 2;
        const ds = lh ? bot[i] : bot[i + 1];
        const de = lh ? top[i + 1] : top[i];
        members.push(el('member', ds, de, { section: 'L 100x100x10', role: 'diagonal', label: `D${i + 1}`, layer: 'TRUSS', frameId: 'T1' }));
    }
    // Ridge connection
    connections.push(conn(CONNECTION_TYPES.BOLTED_END_PLATE, top[panels / 2], [], { plateW: 200, plateH: 200, plateT: 20, boltRows: 4, boltCols: 2, boltDia: 20, hasStiffeners: true, label: 'RIDGE-CONN' }));
    // Bearing connections
    connections.push(conn(CONNECTION_TYPES.BOLTED_CLEAT, bot[0], [], { plateW: 150, plateH: 200, plateT: 15, boltRows: 2, boltCols: 2, boltDia: 20, label: 'BEARING-L' }));
    connections.push(conn(CONNECTION_TYPES.BOLTED_CLEAT, bot[panels], [], { plateW: 150, plateH: 200, plateT: 15, boltRows: 2, boltCols: 2, boltDia: 20, label: 'BEARING-R' }));

    if (full) {
        // Supporting columns
        members.push(el('member', v3(0, yOff, -6), v3(0, yOff, 0), { section: 'UC 203x203x46', role: 'column', label: 'COL-L', layer: 'SUPPORT', frameId: 'T1' }));
        members.push(el('member', v3(span, yOff, -6), v3(span, yOff, 0), { section: 'UC 203x203x46', role: 'column', label: 'COL-R', layer: 'SUPPORT', frameId: 'T1' }));
        connections.push(makeFoundation(0, yOff));
        connections.push(makeFoundation(span, yOff));
        connections.push(conn(CONNECTION_TYPES.BOLTED_END_PLATE, v3(0, yOff, 0), [], { plateW: 300, plateH: 300, plateT: 25, boltRows: 3, boltCols: 2, boltDia: 24, hasStiffeners: true, label: 'COL-TRUSS-L' }));
        connections.push(conn(CONNECTION_TYPES.BOLTED_END_PLATE, v3(span, yOff, 0), [], { plateW: 300, plateH: 300, plateT: 25, boltRows: 3, boltCols: 2, boltDia: 24, hasStiffeners: true, label: 'COL-TRUSS-R' }));
    }

    return { members, connections, metadata: { name: 'Pratt Roof Truss 12m', span, depth, panels, pitch, type: 'truss' } };
};

// T2 — Howe Truss (diagonals reversed — compression diagonals)
export const genHoweTruss = (cfg = {}) => {
    const { span = 15, depth = 1.8, panels = 6, pitch = 12, yOff = 0 } = cfg;
    const members = [], connections = [];
    const pw = span / panels;
    const hs = span / 2;
    const pr = deg2rad(pitch);
    const bot = [], top = [];
    for (let i = 0; i <= panels; i++) {
        const x = i * pw;
        bot.push(v3(x, yOff, 0));
        top.push(v3(x, yOff, (hs - Math.abs(x - hs)) * Math.tan(pr)));
    }
    for (let i = 0; i < panels; i++) {
        members.push(el('member', bot[i], bot[i + 1], { section: 'UB 254x146x37', role: 'truss-bottom', label: `BC${i + 1}`, layer: 'TRUSS', frameId: 'T2' }));
        members.push(el('member', top[i], top[i + 1], { section: 'UB 254x146x37', role: 'truss-top', label: `TC${i + 1}`, layer: 'TRUSS', frameId: 'T2' }));
        // Howe: compression diagonals from top outer to bottom inner
        const lh = i < panels / 2;
        const ds = lh ? top[i] : top[i + 1];
        const de = lh ? bot[i + 1] : bot[i];
        members.push(el('member', ds, de, { section: 'UC 152x152x37', role: 'diagonal', label: `D${i + 1}`, layer: 'TRUSS', frameId: 'T2', meta: { force: 'compression' } }));
    }
    for (let i = 0; i <= panels; i++)
        members.push(el('member', bot[i], top[i], { section: 'L 100x100x10', role: 'vertical', label: `V${i}`, layer: 'TRUSS', frameId: 'T2', meta: { force: 'tension' } }));
    // Columns
    members.push(el('member', v3(0, yOff, -5), v3(0, yOff, 0), { section: 'UC 203x203x46', role: 'column', label: 'COL-L', layer: 'SUPPORT', frameId: 'T2' }));
    members.push(el('member', v3(span, yOff, -5), v3(span, yOff, 0), { section: 'UC 203x203x46', role: 'column', label: 'COL-R', layer: 'SUPPORT', frameId: 'T2' }));
    connections.push(makeFoundation(0, yOff)); connections.push(makeFoundation(span, yOff));
    connections.push(conn(CONNECTION_TYPES.GUSSET_PLATE, bot[0], [], { plateW: 300, plateH: 250, plateT: 20, boltRows: 2, boltCols: 4, boltDia: 20, hasStiffeners: true, label: 'GUSSET-BL' }));
    connections.push(conn(CONNECTION_TYPES.GUSSET_PLATE, bot[panels], [], { plateW: 300, plateH: 250, plateT: 20, boltRows: 2, boltCols: 4, boltDia: 20, hasStiffeners: true, label: 'GUSSET-BR' }));
    return { members, connections, metadata: { name: 'Howe Truss 15m', span, depth, panels, pitch, type: 'truss' } };
};

// T3 — Warren Truss (no verticals, equilateral triangles)
export const genWarrenTruss = (cfg = {}) => {
    const { span = 18, depth = 2.0, panels = 8, yOff = 0 } = cfg;
    const members = [], connections = [];
    const pw = span / panels;
    const bot = [], top = [];
    for (let i = 0; i <= panels; i++) bot.push(v3(i * pw, yOff, 0));
    for (let i = 0; i < panels; i += 2) top.push(v3((i + 1) * pw, yOff, depth));
    // bottom chord
    for (let i = 0; i < panels; i++)
        members.push(el('member', bot[i], bot[i + 1], { section: 'UB 305x165x54', role: 'truss-bottom', label: `BC${i + 1}`, layer: 'TRUSS', frameId: 'T3' }));
    // top chord (between apex nodes)
    for (let i = 0; i < top.length - 1; i++)
        members.push(el('member', top[i], top[i + 1], { section: 'UB 305x165x54', role: 'truss-top', label: `TC${i + 1}`, layer: 'TRUSS', frameId: 'T3' }));
    // diagonals (Warren — alternating up/down)
    for (let i = 0; i < panels; i++) {
        const apex = top[Math.floor(i / 2)];
        if (!apex) continue;
        members.push(el('member', bot[i], apex, { section: 'L 150x150x12', role: 'diagonal', label: `D${i}A`, layer: 'TRUSS', frameId: 'T3' }));
        members.push(el('member', apex, bot[i + 1], { section: 'L 150x150x12', role: 'diagonal', label: `D${i}B`, layer: 'TRUSS', frameId: 'T3' }));
    }
    members.push(el('member', v3(0, yOff, -5), v3(0, yOff, 0), { section: 'UC 254x254x73', role: 'column', label: 'CL', layer: 'SUPPORT', frameId: 'T3' }));
    members.push(el('member', v3(span, yOff, -5), v3(span, yOff, 0), { section: 'UC 254x254x73', role: 'column', label: 'CR', layer: 'SUPPORT', frameId: 'T3' }));
    connections.push(makeFoundation(0, yOff)); connections.push(makeFoundation(span, yOff));
    top.forEach((t, i) => connections.push(conn(CONNECTION_TYPES.GUSSET_PLATE, t, [], { plateW: 250, plateH: 200, plateT: 18, boltRows: 2, boltCols: 3, boltDia: 22, weldSize: 10, label: `APEX-${i}` })));
    return { members, connections, metadata: { name: 'Warren Truss 18m', span, depth, panels, type: 'truss' } };
};

// T4 — Vierendeel Truss (no diagonals — moment frame action)
export const genVierendeelTruss = (cfg = {}) => {
    const { span = 10, depth = 1.5, panels = 5, yOff = 0 } = cfg;
    const members = [], connections = [];
    const pw = span / panels;
    const bot = [], top = [];
    for (let i = 0; i <= panels; i++) {
        bot.push(v3(i * pw, yOff, 0));
        top.push(v3(i * pw, yOff, depth));
    }
    for (let i = 0; i < panels; i++) {
        members.push(el('member', bot[i], bot[i + 1], { section: 'UB 305x165x54', role: 'truss-bottom', label: `BC${i + 1}`, layer: 'TRUSS', frameId: 'T4' }));
        members.push(el('member', top[i], top[i + 1], { section: 'UB 305x165x54', role: 'truss-top', label: `TC${i + 1}`, layer: 'TRUSS', frameId: 'T4' }));
    }
    for (let i = 0; i <= panels; i++) {
        members.push(el('member', bot[i], top[i], { section: 'UB 254x146x37', role: 'vertical', label: `V${i}`, layer: 'TRUSS', frameId: 'T4' }));
        connections.push(conn(CONNECTION_TYPES.WELDED_MOMENT, bot[i], [], { plateT: 20, weldSize: 12, weldType: 'butt', hasStiffeners: true, label: `VMC-BOT-${i}` }));
        connections.push(conn(CONNECTION_TYPES.WELDED_MOMENT, top[i], [], { plateT: 20, weldSize: 12, weldType: 'butt', hasStiffeners: true, label: `VMC-TOP-${i}` }));
    }
    members.push(el('member', v3(0, yOff, -4), v3(0, yOff, 0), { section: 'UC 254x254x73', role: 'column', label: 'CL', layer: 'SUPPORT', frameId: 'T4' }));
    members.push(el('member', v3(span, yOff, -4), v3(span, yOff, 0), { section: 'UC 254x254x73', role: 'column', label: 'CR', layer: 'SUPPORT', frameId: 'T4' }));
    connections.push(makeFoundation(0, yOff)); connections.push(makeFoundation(span, yOff));
    return { members, connections, metadata: { name: 'Vierendeel Truss 10m', span, depth, panels, type: 'truss' } };
};

// T5 — North Light Truss (asymmetric sawtooth)
export const genNorthLightTruss = (cfg = {}) => {
    const { bays = 4, bayW = 6, eaveH = 4, southPitch = 15, yOff = 0 } = cfg;
    const members = [], connections = [];
    const rh = bayW * Math.tan(deg2rad(southPitch));
    for (let b = 0; b < bays; b++) {
        const x0 = b * bayW, x1 = (b + 1) * bayW;
        const knee = v3(x0, yOff, eaveH);
        const ridge = v3(x1, yOff, eaveH + rh);
        const nKnee = v3(x1, yOff, eaveH);
        // Column
        members.push(el('member', v3(x0, yOff, 0), knee, { section: 'UC 203x203x46', role: 'column', label: `NC${b + 1}`, layer: 'TRUSS', frameId: 'T5' }));
        // South rafter (shallow, metal deck)
        members.push(el('member', knee, ridge, { section: 'UB 203x133x25', role: 'south-rafter', label: `SR${b + 1}`, layer: 'TRUSS', frameId: 'T5' }));
        // North rafter (steep, glazing)
        members.push(el('member', ridge, nKnee, { section: 'UB 203x133x25', role: 'north-rafter', label: `NR${b + 1}`, layer: 'TRUSS', frameId: 'T5' }));
        // Tie at bottom
        if (b < bays - 1) members.push(el('member', knee, nKnee, { section: 'L 100x100x10', role: 'truss-bottom', label: `TIE${b + 1}`, layer: 'TRUSS', frameId: 'T5' }));
        connections.push(makeFoundation(x0, yOff));
        connections.push(conn(CONNECTION_TYPES.WELDED_MOMENT, ridge, [], { plateW: 180, plateH: 180, plateT: 16, weldSize: 10, hasStiffeners: true, label: `RIDGE-${b + 1}` }));
        connections.push(conn(CONNECTION_TYPES.BOLTED_END_PLATE, knee, [], { plateW: 200, plateH: 250, plateT: 20, boltRows: 3, boltCols: 2, boltDia: 20, hasStiffeners: true, label: `KNEE-${b + 1}` }));
    }
    return { members, connections, metadata: { name: 'North Light Sawtooth', bays, bayW, eaveH, southPitch, type: 'truss' } };
};

// ═══════════════════════════════════════════════════════════════════════════
// PORTAL FRAMES (5 types)
// ═══════════════════════════════════════════════════════════════════════════

// P1 — Standard Symmetric Portal
export const genSymmetricPortal = (cfg = {}) => {
    const { span = 18, eaveH = 6, ridgeH = 3, bays = 3, baySpacing = 6, haunchL = 1.2 } = cfg;
    const members = [], connections = [];
    const hs = span / 2, rz = eaveH + ridgeH;
    const nFrames = bays + 1;
    const rafterAngle = Math.atan2(ridgeH, hs);
    const hDx = haunchL * Math.cos(rafterAngle), hDz = haunchL * Math.sin(rafterAngle);

    for (let f = 0; f < nFrames; f++) {
        const fy = f * baySpacing;
        const colL = v3(0, fy, 0), colR = v3(span, fy, 0);
        const kneeL = v3(0, fy, eaveH), kneeR = v3(span, fy, eaveH);
        const hL = v3(hDx, fy, eaveH + hDz), hR = v3(span - hDx, fy, eaveH + hDz);
        const ridge = v3(hs, fy, rz);

        members.push(el('member', colL, kneeL, { section: 'UC 305x305x97', role: 'column', label: `CL${f + 1}`, layer: 'PORTAL', frameId: `P1-F${f}` }));
        members.push(el('member', colR, kneeR, { section: 'UC 305x305x97', role: 'column', label: `CR${f + 1}`, layer: 'PORTAL', frameId: `P1-F${f}` }));
        members.push(el('member', kneeL, hL, { section: 'UB 457x191x89', role: 'haunch', label: `HL${f + 1}`, layer: 'PORTAL', frameId: `P1-F${f}` }));
        members.push(el('member', kneeR, hR, { section: 'UB 457x191x89', role: 'haunch', label: `HR${f + 1}`, layer: 'PORTAL', frameId: `P1-F${f}` }));
        members.push(el('member', hL, ridge, { section: 'UB 356x171x67', role: 'rafter', label: `RL${f + 1}`, layer: 'PORTAL', frameId: `P1-F${f}` }));
        members.push(el('member', ridge, hR, { section: 'UB 356x171x67', role: 'rafter', label: `RR${f + 1}`, layer: 'PORTAL', frameId: `P1-F${f}` }));

        connections.push(makeFoundation(0, fy)); connections.push(makeFoundation(span, fy));
        connections.push(conn(CONNECTION_TYPES.BASE_PLATE, colL, [], { plateW: 500, plateH: 500, plateT: 30, boltRows: 2, boltCols: 2, boltDia: 24, anchorDia: 24, anchorEmbedment: 500, groutThickness: 30, hasStiffeners: true, label: `BP-L${f + 1}` }));
        connections.push(conn(CONNECTION_TYPES.BASE_PLATE, colR, [], { plateW: 500, plateH: 500, plateT: 30, boltRows: 2, boltCols: 2, boltDia: 24, anchorDia: 24, anchorEmbedment: 500, groutThickness: 30, hasStiffeners: true, label: `BP-R${f + 1}` }));
        connections.push(conn(CONNECTION_TYPES.HAUNCH, kneeL, [], { plateW: 400, plateH: 350, plateT: 25, boltRows: 4, boltCols: 2, boltDia: 24, hasStiffeners: true, label: `KNEE-L${f + 1}`, meta: { type: 'extended_end_plate' } }));
        connections.push(conn(CONNECTION_TYPES.HAUNCH, kneeR, [], { plateW: 400, plateH: 350, plateT: 25, boltRows: 4, boltCols: 2, boltDia: 24, hasStiffeners: true, label: `KNEE-R${f + 1}`, meta: { type: 'extended_end_plate' } }));
        connections.push(conn(CONNECTION_TYPES.BOLTED_END_PLATE, ridge, [], { plateW: 300, plateH: 250, plateT: 20, boltRows: 3, boltCols: 2, boltDia: 24, hasStiffeners: true, label: `RIDGE${f + 1}` }));
    }
    // Purlins
    const pSpacing = 1.8, nPurlins = Math.floor(hs / pSpacing);
    for (let p = 1; p <= nPurlins; p++) {
        const xo = p * pSpacing, pz = eaveH + xo * Math.tan(rafterAngle);
        for (let b = 0; b < bays; b++) {
            const y1 = b * baySpacing, y2 = (b + 1) * baySpacing;
            members.push(el('member', v3(xo, y1, pz), v3(xo, y2, pz), { section: 'UB 203x133x25', role: 'purlin', label: `PL${p}B${b + 1}`, layer: 'SECONDARY', frameId: 'P1' }));
            members.push(el('member', v3(span - xo, y1, pz), v3(span - xo, y2, pz), { section: 'UB 203x133x25', role: 'purlin', label: `PR${p}B${b + 1}`, layer: 'SECONDARY', frameId: 'P1' }));
        }
    }
    return { members, connections, metadata: { name: 'Symmetric Portal 18m', span, eaveH, ridgeH, bays, type: 'portal' } };
};

// P2 — Mono-slope Portal (asymmetric)
export const genMonoPortal = (cfg = {}) => {
    const { span = 15, lowH = 4, highH = 7, bays = 2, baySpacing = 6 } = cfg;
    const members = [], connections = [];
    const nFrames = bays + 1;
    for (let f = 0; f < nFrames; f++) {
        const fy = f * baySpacing;
        const bl = v3(0, fy, 0), br = v3(span, fy, 0), kl = v3(0, fy, lowH), kr = v3(span, fy, highH);
        members.push(el('member', bl, kl, { section: 'UC 254x254x73', role: 'column', label: `ML${f + 1}`, layer: 'PORTAL', frameId: `P2-F${f}` }));
        members.push(el('member', br, kr, { section: 'UC 254x254x73', role: 'column', label: `MR${f + 1}`, layer: 'PORTAL', frameId: `P2-F${f}` }));
        members.push(el('member', kl, kr, { section: 'UB 356x171x67', role: 'rafter', label: `MR-R${f + 1}`, layer: 'PORTAL', frameId: `P2-F${f}` }));
        connections.push(makeFoundation(0, fy)); connections.push(makeFoundation(span, fy));
        connections.push(conn(CONNECTION_TYPES.BASE_PLATE, bl, [], { plateW: 450, plateH: 450, plateT: 28, boltRows: 2, boltCols: 2, boltDia: 22, anchorDia: 22, anchorEmbedment: 450, groutThickness: 30, label: `BP-ML${f + 1}` }));
        connections.push(conn(CONNECTION_TYPES.BASE_PLATE, br, [], { plateW: 450, plateH: 450, plateT: 28, boltRows: 2, boltCols: 2, boltDia: 22, anchorDia: 22, anchorEmbedment: 450, groutThickness: 30, label: `BP-MR${f + 1}` }));
        connections.push(conn(CONNECTION_TYPES.BOLTED_END_PLATE, kl, [], { plateW: 300, plateH: 350, plateT: 22, boltRows: 4, boltCols: 2, boltDia: 22, hasStiffeners: true, label: `KNEE-ML${f + 1}` }));
        connections.push(conn(CONNECTION_TYPES.BOLTED_END_PLATE, kr, [], { plateW: 300, plateH: 350, plateT: 22, boltRows: 4, boltCols: 2, boltDia: 22, hasStiffeners: true, label: `KNEE-MR${f + 1}` }));
    }
    return { members, connections, metadata: { name: 'Mono-slope Portal 15m', span, lowH, highH, bays, type: 'portal' } };
};

// P3 — Tied Portal (with tie rod at eave level)
export const genTiedPortal = (cfg = {}) => {
    const { span = 24, eaveH = 8, ridgeH = 4, bays = 4, baySpacing = 7 } = cfg;
    const { members, connections } = genSymmetricPortal({ span, eaveH, ridgeH, bays, baySpacing });
    const nFrames = bays + 1;
    for (let f = 0; f < nFrames; f++) {
        const fy = f * baySpacing;
        const tieL = v3(0, fy, eaveH), tieR = v3(span, fy, eaveH);
        members.push(el('member', tieL, tieR, { section: 'L 150x150x12', role: 'bracing', label: `TIE-ROD-${f + 1}`, layer: 'SECONDARY', frameId: 'P3', meta: { type: 'tie_rod', pretension: true } }));
    }
    return { members, connections, metadata: { name: 'Tied Portal 24m', span, eaveH, ridgeH, bays, type: 'portal' } };
};

// P4 — Multi-span Portal
export const genMultiSpanPortal = (cfg = {}) => {
    const { spanPerBay = 12, numSpans = 3, eaveH = 6, ridgeH = 2.5, bays = 2, baySpacing = 6 } = cfg;
    const members = [], connections = [];
    const nFrames = bays + 1;
    for (let s = 0; s < numSpans; s++) {
        const xOff = s * spanPerBay;
        for (let f = 0; f < nFrames; f++) {
            const fy = f * baySpacing, hs = spanPerBay / 2, rz = eaveH + ridgeH;
            const cL = v3(xOff, fy, 0), cR = v3(xOff + spanPerBay, fy, 0);
            const kL = v3(xOff, fy, eaveH), kR = v3(xOff + spanPerBay, fy, eaveH);
            const rdg = v3(xOff + hs, fy, rz);
            members.push(el('member', cL, kL, { section: 'UC 203x203x46', role: 'column', label: `MSC-L${s + 1}F${f + 1}`, layer: 'PORTAL', frameId: `P4-S${s}F${f}` }));
            if (s === numSpans - 1) members.push(el('member', cR, kR, { section: 'UC 203x203x46', role: 'column', label: `MSC-R${s + 1}F${f + 1}`, layer: 'PORTAL', frameId: `P4-S${s}F${f}` }));
            members.push(el('member', kL, rdg, { section: 'UB 254x146x37', role: 'rafter', label: `MSR-L${s + 1}F${f + 1}`, layer: 'PORTAL', frameId: `P4-S${s}F${f}` }));
            members.push(el('member', rdg, kR, { section: 'UB 254x146x37', role: 'rafter', label: `MSR-R${s + 1}F${f + 1}`, layer: 'PORTAL', frameId: `P4-S${s}F${f}` }));
            connections.push(makeFoundation(xOff, fy));
            if (s === numSpans - 1) connections.push(makeFoundation(xOff + spanPerBay, fy));
            connections.push(conn(CONNECTION_TYPES.BASE_PLATE, cL, [], { plateW: 400, plateH: 400, plateT: 25, boltRows: 2, boltCols: 2, boltDia: 20, anchorDia: 20, anchorEmbedment: 450, label: `BP-MS${s + 1}L${f + 1}` }));
            connections.push(conn(CONNECTION_TYPES.WELDED_MOMENT, rdg, [], { weldSize: 10, weldType: 'butt', hasStiffeners: true, label: `RIDGE-MS${s + 1}F${f + 1}` }));
        }
    }
    return { members, connections, metadata: { name: `Multi-span Portal ${numSpans}×${spanPerBay}m`, type: 'portal' } };
};

// P5 — Crane Portal (with crane runway beams)
export const genCranePortal = (cfg = {}) => {
    const { span = 24, eaveH = 10, ridgeH = 3, bays = 4, baySpacing = 6, craneH = 7.5 } = cfg;
    const { members, connections } = genSymmetricPortal({ span, eaveH, ridgeH, bays, baySpacing, haunchL: 1.8 });
    const nFrames = bays + 1;
    // Crane runway brackets and beams
    for (let f = 0; f < nFrames; f++) {
        const fy = f * baySpacing;
        members.push(el('member', v3(1.5, fy, craneH - 0.3), v3(1.5, fy, craneH + 0.3), { section: 'UC 254x254x73', role: 'column', label: `BRAC-L${f + 1}`, layer: 'CRANE', frameId: 'P5', meta: { type: 'crane_bracket' } }));
        members.push(el('member', v3(span - 1.5, fy, craneH - 0.3), v3(span - 1.5, fy, craneH + 0.3), { section: 'UC 254x254x73', role: 'column', label: `BRAC-R${f + 1}`, layer: 'CRANE', frameId: 'P5', meta: { type: 'crane_bracket' } }));
    }
    // Runway beams
    for (let b = 0; b < bays; b++) {
        const y1 = b * baySpacing, y2 = (b + 1) * baySpacing;
        members.push(el('member', v3(1.5, y1, craneH), v3(1.5, y2, craneH), { section: 'UB 533x210x109', role: 'beam', label: `CRB-L${b + 1}`, layer: 'CRANE', frameId: 'P5', meta: { type: 'crane_runway_beam' } }));
        members.push(el('member', v3(span - 1.5, y1, craneH), v3(span - 1.5, y2, craneH), { section: 'UB 533x210x109', role: 'beam', label: `CRB-R${b + 1}`, layer: 'CRANE', frameId: 'P5', meta: { type: 'crane_runway_beam' } }));
    }
    return { members, connections, metadata: { name: 'Crane Portal 24m', span, eaveH, craneH, bays, type: 'portal' } };
};

// ═══════════════════════════════════════════════════════════════════════════
// BRIDGES (5 types)
// ═══════════════════════════════════════════════════════════════════════════

// B1 — Pedestrian Bridge (Twin Pratt trusses)
export const genPedestrianBridge = (cfg = {}) => {
    const { span = 25, deckW = 3, trussD = 2.5, panels = 10 } = cfg;
    const members = [], connections = [];
    const pw = span / panels;
    const buildTruss = (yo, sfx) => {
        const bot = [], top = [];
        for (let i = 0; i <= panels; i++) { bot.push(v3(i * pw, yo, 0)); top.push(v3(i * pw, yo, trussD)); }
        for (let i = 0; i < panels; i++) {
            members.push(el('member', bot[i], bot[i + 1], { section: 'UB 254x146x37', role: 'truss-bottom', label: `BC${sfx}${i + 1}`, layer: 'BRIDGE', frameId: 'B1' }));
            members.push(el('member', top[i], top[i + 1], { section: 'UB 254x146x37', role: 'truss-top', label: `TC${sfx}${i + 1}`, layer: 'BRIDGE', frameId: 'B1' }));
            const lh = i < panels / 2;
            members.push(el('member', lh ? bot[i] : bot[i + 1], lh ? top[i + 1] : top[i], { section: 'L 100x100x10', role: 'diagonal', label: `D${sfx}${i + 1}`, layer: 'BRIDGE', frameId: 'B1' }));
        }
        for (let i = 0; i <= panels; i++) members.push(el('member', bot[i], top[i], { section: 'L 100x100x10', role: 'vertical', label: `V${sfx}${i}`, layer: 'BRIDGE', frameId: 'B1' }));
        return { bot, top };
    };
    const tA = buildTruss(0, 'A'), tB = buildTruss(deckW, 'B');
    for (let i = 0; i <= panels; i++) {
        members.push(el('member', tA.bot[i], tB.bot[i], { section: 'UB 254x146x37', role: 'floor-beam', label: `FB${i + 1}`, layer: 'BRIDGE', frameId: 'B1' }));
        members.push(el('member', tA.top[i], tB.top[i], { section: 'L 100x100x10', role: 'bracing', label: `TB${i + 1}`, layer: 'BRIDGE', frameId: 'B1' }));
        connections.push(conn(CONNECTION_TYPES.BOLTED_END_PLATE, tA.bot[i], [], { plateW: 220, plateH: 280, boltRows: 3, boltCols: 2, boltDia: 20, label: `FBC-A${i + 1}` }));
        connections.push(conn(CONNECTION_TYPES.BOLTED_END_PLATE, tB.bot[i], [], { plateW: 220, plateH: 280, boltRows: 3, boltCols: 2, boltDia: 20, label: `FBC-B${i + 1}` }));
    }
    for (let i = 0; i < panels; i++) {
        const mx = v3((tA.top[i].x + tA.top[i + 1].x) / 2, 0, trussD), mb = v3(mx.x, deckW, trussD);
        members.push(el('member', tA.top[i], mb, { section: 'L 100x100x10', role: 'bracing', label: `KL${i + 1}`, layer: 'BRIDGE', frameId: 'B1' }));
        members.push(el('member', tB.top[i + 1], mx, { section: 'L 100x100x10', role: 'bracing', label: `KR${i + 1}`, layer: 'BRIDGE', frameId: 'B1' }));
    }
    connections.push(conn(CONNECTION_TYPES.BOLTED_CLEAT, v3(0, 0, 0), [], { plateW: 200, plateH: 300, boltRows: 2, boltCols: 3, boltDia: 22, label: 'BEARING-A1', meta: { type: 'rocker_bearing' } }));
    connections.push(conn(CONNECTION_TYPES.BOLTED_CLEAT, v3(span, 0, 0), [], { plateW: 200, plateH: 300, boltRows: 2, boltCols: 3, boltDia: 22, label: 'BEARING-A2', meta: { type: 'sliding_bearing' } }));
    return { members, connections, metadata: { name: 'Pedestrian Bridge 25m', span, deckW, trussD, panels, type: 'bridge' } };
};

// B2 — Highway Through Truss Bridge
export const genThroughTruss = (cfg = {}) => {
    const { span = 40, trussH = 5, panels = 10, laneW = 7 } = cfg;
    const members = [], connections = [];
    const pw = span / panels;
    const buildTruss = (yo, sfx) => {
        const bot = [], top = [];
        for (let i = 0; i <= panels; i++) { bot.push(v3(i * pw, yo, 0)); top.push(v3(i * pw, yo, trussH)); }
        for (let i = 0; i < panels; i++) {
            members.push(el('member', bot[i], bot[i + 1], { section: 'UB 406x178x74', role: 'truss-bottom', label: `TBC${sfx}${i + 1}`, layer: 'BRIDGE', frameId: 'B2' }));
            members.push(el('member', top[i], top[i + 1], { section: 'UB 406x178x74', role: 'truss-top', label: `TTC${sfx}${i + 1}`, layer: 'BRIDGE', frameId: 'B2' }));
            const lh = i < panels / 2;
            members.push(el('member', lh ? bot[i] : bot[i + 1], lh ? top[i + 1] : top[i], { section: 'UB 305x165x54', role: 'diagonal', label: `TD${sfx}${i + 1}`, layer: 'BRIDGE', frameId: 'B2' }));
        }
        for (let i = 0; i <= panels; i++) members.push(el('member', bot[i], top[i], { section: 'UB 254x146x37', role: 'vertical', label: `TV${sfx}${i}`, layer: 'BRIDGE', frameId: 'B2' }));
        return { bot, top };
    };
    const tA = buildTruss(0, 'A'), tB = buildTruss(laneW, 'B');
    for (let i = 0; i <= panels; i++) {
        members.push(el('member', tA.bot[i], tB.bot[i], { section: 'UB 457x191x89', role: 'floor-beam', label: `HFB${i + 1}`, layer: 'BRIDGE', frameId: 'B2' }));
        if (i < panels) members.push(el('member', tA.top[i], tB.top[i], { section: 'UB 254x146x37', role: 'bracing', label: `HTB${i + 1}`, layer: 'BRIDGE', frameId: 'B2' }));
        // Stringers (deck support beams)
        if (i < panels) for (let s = 1; s <= 2; s++) {
            const yo = s * (laneW / 3);
            members.push(el('member', v3(i * pw, yo, 0), v3((i + 1) * pw, yo, 0), { section: 'UB 254x146x37', role: 'stringer', label: `STR${s}-${i + 1}`, layer: 'BRIDGE', frameId: 'B2' }));
        }
    }
    return { members, connections, metadata: { name: 'Through Truss Bridge 40m', span, trussH, panels, type: 'bridge' } };
};

// B3 — Cable-stayed Bridge (simple 2D representation)
export const genCableStayed = (cfg = {}) => {
    const { span = 50, pylonH = 20, deckW = 6, cables = 6 } = cfg;
    const members = [], connections = [];
    const hs = span / 2;
    const pylon1 = v3(hs / 2, 0, 0), pylon2 = v3(span - hs / 2, 0, 0);
    const ptop1 = v3(hs / 2, 0, pylonH), ptop2 = v3(span - hs / 2, 0, pylonH);
    // Pylons
    members.push(el('member', pylon1, ptop1, { section: 'CHS 273x10', role: 'column', label: 'PYLON-L', layer: 'BRIDGE', frameId: 'B3' }));
    members.push(el('member', pylon2, ptop2, { section: 'CHS 273x10', role: 'column', label: 'PYLON-R', layer: 'BRIDGE', frameId: 'B3' }));
    // Deck
    const nDeckPts = 12;
    for (let i = 0; i < nDeckPts; i++) {
        const x1 = i * (span / nDeckPts), x2 = (i + 1) * (span / nDeckPts);
        members.push(el('member', v3(x1, 0, 0), v3(x2, 0, 0), { section: 'UB 406x178x74', role: 'truss-bottom', label: `DK${i + 1}`, layer: 'BRIDGE', frameId: 'B3' }));
    }
    // Cables from pylons
    for (let c = 0; c < cables; c++) {
        const t = (c + 1) / (cables + 1);
        const deckX1 = pylon1.x * (1 - t), deckX2 = span - pylon2.x * (1 - t) + pylon2.x;
        members.push(el('member', ptop1, v3(deckX1, 0, 0), { section: 'CHS 114.3x5', role: 'bracing', label: `CAB-L${c + 1}`, layer: 'BRIDGE', frameId: 'B3', meta: { type: 'stay_cable' } }));
        members.push(el('member', ptop2, v3(span - deckX1, 0, 0), { section: 'CHS 114.3x5', role: 'bracing', label: `CAB-R${c + 1}`, layer: 'BRIDGE', frameId: 'B3', meta: { type: 'stay_cable' } }));
    }
    connections.push(conn(CONNECTION_TYPES.BASE_PLATE, pylon1, [], { plateW: 600, plateH: 600, plateT: 40, boltRows: 3, boltCols: 3, boltDia: 30, anchorDia: 30, anchorEmbedment: 800, label: 'PYLON-BASE-L' }));
    connections.push(conn(CONNECTION_TYPES.BASE_PLATE, pylon2, [], { plateW: 600, plateH: 600, plateT: 40, boltRows: 3, boltCols: 3, boltDia: 30, anchorDia: 30, anchorEmbedment: 800, label: 'PYLON-BASE-R' }));
    return { members, connections, metadata: { name: 'Cable-stayed Bridge 50m', span, pylonH, type: 'bridge' } };
};

// B4 — Railway Warren Bridge (heavy loading)
export const genRailwayBridge = (cfg = {}) => {
    const { span = 30, trussH = 3.5, panels = 8, trackW = 1.5 } = cfg;
    const members = [], connections = [];
    const pw = span / panels;
    const bo = [], to = [];
    for (let i = 0; i <= panels; i++) { bo.push(v3(i * pw, 0, 0)); to.push(v3(i * pw, 0, trussH)); }
    // Heavy sections for railway
    for (let i = 0; i < panels; i++) {
        members.push(el('member', bo[i], bo[i + 1], { section: 'UB 533x210x109', role: 'truss-bottom', label: `RBC${i + 1}`, layer: 'BRIDGE', frameId: 'B4' }));
        members.push(el('member', to[i], to[i + 1], { section: 'UB 533x210x109', role: 'truss-top', label: `RTC${i + 1}`, layer: 'BRIDGE', frameId: 'B4' }));
        // Warren diagonals
        const apex = v3((i + 0.5) * pw, 0, i % 2 === 0 ? trussH : 0);
        if (i % 2 === 0) {
            members.push(el('member', bo[i], to[i], { section: 'UC 254x254x73', role: 'vertical', label: `RV${i}`, layer: 'BRIDGE', frameId: 'B4' }));
        }
        members.push(el('member', bo[i], to[i % 2 === 0 ? i : i + 1] || to[panels], { section: 'UB 305x165x54', role: 'diagonal', label: `RD${i + 1}`, layer: 'BRIDGE', frameId: 'B4' }));
    }
    // Sleeper beams (rail support)
    for (let i = 0; i <= panels; i++) {
        members.push(el('member', v3(i * pw, -trackW / 2, 0), v3(i * pw, trackW / 2, 0), { section: 'UB 305x165x54', role: 'floor-beam', label: `SLP${i + 1}`, layer: 'BRIDGE', frameId: 'B4', meta: { type: 'sleeper_beam' } }));
    }
    return { members, connections, metadata: { name: 'Railway Warren Bridge 30m', span, trussH, panels, type: 'bridge' } };
};

// B5 — Arch Bridge
export const genArchBridge = (cfg = {}) => {
    const { span = 35, rise = 8, archSegs = 12, deckW = 5 } = cfg;
    const members = [], connections = [];
    const hw = span / 2;
    const archPts = [];
    for (let i = 0; i <= archSegs; i++) {
        const t = i / archSegs, x = t * span;
        const z = rise * Math.sin(Math.PI * t);
        archPts.push(v3(x, 0, z));
    }
    // Arch members
    for (let i = 0; i < archSegs; i++) members.push(el('member', archPts[i], archPts[i + 1], { section: 'CHS 273x10', role: 'truss-top', label: `ARCH${i + 1}`, layer: 'BRIDGE', frameId: 'B5' }));
    // Deck (at z=0)
    const deckPts = [];
    for (let i = 0; i <= archSegs; i++) deckPts.push(v3(i * (span / archSegs), 0, 0));
    for (let i = 0; i < archSegs; i++) members.push(el('member', deckPts[i], deckPts[i + 1], { section: 'UB 406x178x74', role: 'floor-beam', label: `ADK${i + 1}`, layer: 'BRIDGE', frameId: 'B5' }));
    // Hangers
    for (let i = 1; i < archSegs; i++) members.push(el('member', archPts[i], deckPts[i], { section: 'CHS 114.3x5', role: 'bracing', label: `HANG${i}`, layer: 'BRIDGE', frameId: 'B5', meta: { type: 'arch_hanger' } }));
    connections.push(conn(CONNECTION_TYPES.PINNED, v3(0, 0, 0), [], { plateW: 400, plateH: 400, plateT: 35, boltDia: 30, label: 'ARCH-PIN-L', meta: { type: 'pin_bearing' } }));
    connections.push(conn(CONNECTION_TYPES.PINNED, v3(span, 0, 0), [], { plateW: 400, plateH: 400, plateT: 35, boltDia: 30, label: 'ARCH-PIN-R', meta: { type: 'pin_bearing' } }));
    return { members, connections, metadata: { name: 'Arch Bridge 35m', span, rise, archSegs, type: 'bridge' } };
};

// ═══════════════════════════════════════════════════════════════════════════
// LATTICE TOWERS (5 types)
// ═══════════════════════════════════════════════════════════════════════════

const towerLegs = (baseW, topW, totalH, panels) => {
    const ph = totalH / panels;
    const hw = (z) => { const t = z / totalH; return ((1 - t) * baseW + t * topW) / 2; };
    return { hw, ph };
};

// LT1 — 4-leg square lattice tower
export const genSquareTower = (cfg = {}) => {
    const { totalH = 30, baseW = 6, topW = 1.5, panels = 8 } = cfg;
    const members = [], connections = [];
    const { hw, ph } = towerLegs(baseW, topW, totalH, panels);
    const legNames = ['SW', 'SE', 'NE', 'NW'];
    for (let p = 0; p < panels; p++) {
        const z0 = p * ph, z1 = (p + 1) * ph;
        const h0 = hw(z0), h1 = hw(z1);
        const bot = [v3(-h0, -h0, z0), v3(h0, -h0, z0), v3(h0, h0, z0), v3(-h0, h0, z0)];
        const top = [v3(-h1, -h1, z1), v3(h1, -h1, z1), v3(h1, h1, z1), v3(-h1, h1, z1)];
        // Legs
        for (let l = 0; l < 4; l++) {
            members.push(el('member', bot[l], top[l], { section: 'SHS 150x150x8', role: 'leg', label: `L-${legNames[l]}-P${p + 1}`, layer: 'TOWER', frameId: 'LT1' }));
        }
        // Horizontal ties
        for (let t = 0; t < 4; t++) members.push(el('member', top[t], top[(t + 1) % 4], { section: 'SHS 100x100x6', role: 'ring', label: `TIE-${legNames[t]}-P${p + 1}`, layer: 'TOWER', frameId: 'LT1' }));
        // X-bracing
        for (let f = 0; f < 4; f++) {
            const n = (f + 1) % 4;
            members.push(el('member', bot[f], top[n], { section: 'L 100x100x10', role: 'x-brace', label: `XA${f}-P${p + 1}`, layer: 'TOWER', frameId: 'LT1' }));
            members.push(el('member', bot[n], top[f], { section: 'L 100x100x10', role: 'x-brace', label: `XB${f}-P${p + 1}`, layer: 'TOWER', frameId: 'LT1' }));
        }
        if (p === 0) {
            for (let l = 0; l < 4; l++) connections.push(makeFoundation(bot[l].x, bot[l].y));
            connections.push(conn(CONNECTION_TYPES.BASE_PLATE, bot[0], [], { plateW: 400, plateH: 400, plateT: 30, boltRows: 2, boltCols: 2, boltDia: 24, anchorDia: 24, anchorEmbedment: 600, label: `TOWER-BASE-${legNames[0]}` }));
        }
        connections.push(conn(CONNECTION_TYPES.GUSSET_PLATE, top[0], [], { plateW: 200, plateH: 200, plateT: 16, boltRows: 2, boltCols: 3, boltDia: 20, label: `GP-P${p + 1}` }));
    }
    return { members, connections, metadata: { name: 'Square Lattice Tower 30m', totalH, baseW, topW, panels, type: 'tower' } };
};

// LT2 — Triangular lattice tower
export const genTriangularTower = (cfg = {}) => {
    const { totalH = 25, baseW = 5, topW = 1, panels = 8 } = cfg;
    const members = [], connections = [];
    const { hw, ph } = towerLegs(baseW, topW, totalH, panels);
    const triPts = (h) => [v3(0, h * 2 / Math.sqrt(3), 0), v3(-h, -h / Math.sqrt(3), 0), v3(h, -h / Math.sqrt(3), 0)];
    for (let p = 0; p < panels; p++) {
        const z0 = p * ph, z1 = (p + 1) * ph;
        const b0 = triPts(hw(z0)).map(pt => v3(pt.x, pt.y, z0));
        const b1 = triPts(hw(z1)).map(pt => v3(pt.x, pt.y, z1));
        for (let l = 0; l < 3; l++) {
            members.push(el('member', b0[l], b1[l], { section: 'SHS 150x150x8', role: 'leg', label: `TL-${l + 1}-P${p + 1}`, layer: 'TOWER', frameId: 'LT2' }));
        }
        for (let t = 0; t < 3; t++) members.push(el('member', b1[t], b1[(t + 1) % 3], { section: 'SHS 100x100x6', role: 'ring', label: `TT-${t + 1}-P${p + 1}`, layer: 'TOWER', frameId: 'LT2' }));
        for (let f = 0; f < 3; f++) {
            const n = (f + 1) % 3;
            members.push(el('member', b0[f], b1[n], { section: 'L 100x100x10', role: 'x-brace', label: `TB${f}-P${p + 1}`, layer: 'TOWER', frameId: 'LT2' }));
            members.push(el('member', b0[n], b1[f], { section: 'L 100x100x10', role: 'x-brace', label: `TBB${f}-P${p + 1}`, layer: 'TOWER', frameId: 'LT2' }));
        }
        if (p === 0) for (let l = 0; l < 3; l++) connections.push(makeFoundation(b0[l].x, b0[l].y));
    }
    return { members, connections, metadata: { name: 'Triangular Tower 25m', totalH, baseW, panels, type: 'tower' } };
};

// LT3 — K-braced tower
export const genKBracedTower = (cfg = {}) => {
    const { totalH = 35, baseW = 7, topW = 2, panels = 10 } = cfg;
    const members = [], connections = [];
    const { hw, ph } = towerLegs(baseW, topW, totalH, panels);
    for (let p = 0; p < panels; p++) {
        const z0 = p * ph, z1 = (p + 1) * ph, zm = (z0 + z1) / 2;
        const h0 = hw(z0), h1 = hw(z1), hm = hw(zm);
        const bot = [v3(-h0, -h0, z0), v3(h0, -h0, z0), v3(h0, h0, z0), v3(-h0, h0, z0)];
        const mid = [v3(-hm, -hm, zm), v3(hm, -hm, zm), v3(hm, hm, zm), v3(-hm, hm, zm)];
        const top = [v3(-h1, -h1, z1), v3(h1, -h1, z1), v3(h1, h1, z1), v3(-h1, h1, z1)];
        for (let l = 0; l < 4; l++) members.push(el('member', bot[l], top[l], { section: 'SHS 200x200x10', role: 'leg', label: `KL${l + 1}-P${p + 1}`, layer: 'TOWER', frameId: 'LT3' }));
        for (let t = 0; t < 4; t++) members.push(el('member', top[t], top[(t + 1) % 4], { section: 'SHS 100x100x6', role: 'ring', label: `KR-${t + 1}-P${p + 1}`, layer: 'TOWER', frameId: 'LT3' }));
        // K-braces (from mid-leg to mid-face at mid height)
        for (let f = 0; f < 4; f++) {
            const n = (f + 1) % 4;
            const faceMid = v3((mid[f].x + mid[n].x) / 2, (mid[f].y + mid[n].y) / 2, zm);
            members.push(el('member', mid[f], faceMid, { section: 'L 100x100x10', role: 'x-brace', label: `KB${f}A-P${p + 1}`, layer: 'TOWER', frameId: 'LT3' }));
            members.push(el('member', mid[n], faceMid, { section: 'L 100x100x10', role: 'x-brace', label: `KB${f}B-P${p + 1}`, layer: 'TOWER', frameId: 'LT3' }));
        }
        if (p === 0) for (let l = 0; l < 4; l++) connections.push(makeFoundation(bot[l].x, bot[l].y));
    }
    return { members, connections, metadata: { name: 'K-braced Tower 35m', totalH, baseW, panels, type: 'tower' } };
};

// LT4 — Tapered monopole-style tower
export const genMonopoleTower = (cfg = {}) => {
    const { totalH = 20, baseR = 0.8, topR = 0.3, segs = 16 } = cfg;
    const members = [], connections = [];
    const panels = segs;
    const ph = totalH / panels;
    const botRing = [], topRing = [];
    const nSides = 8;
    for (let p = 0; p < panels; p++) {
        const z0 = p * ph, z1 = (p + 1) * ph;
        const r0 = baseR + (topR - baseR) * (z0 / totalH);
        const r1 = baseR + (topR - baseR) * (z1 / totalH);
        const b = [], t = [];
        for (let s = 0; s < nSides; s++) {
            const a = deg2rad(s * 360 / nSides);
            b.push(v3(r0 * Math.cos(a), r0 * Math.sin(a), z0));
            t.push(v3(r1 * Math.cos(a), r1 * Math.sin(a), z1));
        }
        for (let s = 0; s < nSides; s++) {
            members.push(el('member', b[s], t[s], { section: 'CHS 168.3x6.3', role: 'leg', label: `MP-${s + 1}-P${p + 1}`, layer: 'TOWER', frameId: 'LT4' }));
            members.push(el('member', t[s], t[(s + 1) % nSides], { section: 'CHS 114.3x5', role: 'ring', label: `MPR-${s + 1}-P${p + 1}`, layer: 'TOWER', frameId: 'LT4' }));
            members.push(el('member', b[s], t[(s + 1) % nSides], { section: 'CHS 114.3x5', role: 'x-brace', label: `MPB-${s + 1}-P${p + 1}`, layer: 'TOWER', frameId: 'LT4' }));
        }
        if (p === 0) connections.push(conn(CONNECTION_TYPES.BASE_PLATE, v3(0, 0, 0), [], { plateW: 1200, plateH: 1200, plateT: 40, boltRows: 3, boltCols: 8, boltDia: 30, anchorDia: 30, anchorEmbedment: 800, label: 'MONOPOLE-BASE' }));
    }
    return { members, connections, metadata: { name: 'Monopole Tower 20m', totalH, baseR, topR, segs, type: 'tower' } };
};

// LT5 — Guyed lattice tower
export const genGuyedTower = (cfg = {}) => {
    const { totalH = 40, baseW = 3, topW = 1.5, panels = 12, guyLevels = 3, guyRadius = 20 } = cfg;
    const members = [], connections = [];
    const { hw, ph } = towerLegs(baseW, topW, totalH, panels);
    for (let p = 0; p < panels; p++) {
        const z0 = p * ph, z1 = (p + 1) * ph;
        const h0 = hw(z0), h1 = hw(z1);
        const bot = [v3(-h0, -h0, z0), v3(h0, -h0, z0), v3(h0, h0, z0), v3(-h0, h0, z0)];
        const top = [v3(-h1, -h1, z1), v3(h1, -h1, z1), v3(h1, h1, z1), v3(-h1, h1, z1)];
        for (let l = 0; l < 4; l++) members.push(el('member', bot[l], top[l], { section: 'SHS 100x100x6', role: 'leg', label: `GL${l + 1}-P${p + 1}`, layer: 'TOWER', frameId: 'LT5' }));
        for (let t = 0; t < 4; t++) members.push(el('member', top[t], top[(t + 1) % 4], { section: 'SHS 100x100x6', role: 'ring', label: `GR-${t + 1}-P${p + 1}`, layer: 'TOWER', frameId: 'LT5' }));
        const nx = (n) => (n + 1) % 4;
        members.push(el('member', bot[0], top[nx(0)], { section: 'L 100x100x10', role: 'x-brace', label: `GX0A-P${p + 1}`, layer: 'TOWER', frameId: 'LT5' }));
        members.push(el('member', bot[nx(0)], top[0], { section: 'L 100x100x10', role: 'x-brace', label: `GX0B-P${p + 1}`, layer: 'TOWER', frameId: 'LT5' }));
        if (p === 0) for (let l = 0; l < 4; l++) connections.push(makeFoundation(bot[l].x, bot[l].y));
    }
    // Guy wires
    for (let g = 0; g < guyLevels; g++) {
        const gz = totalH * ((g + 1) / (guyLevels + 1));
        const hw2 = hw(gz);
        const anchorPts = [v3(guyRadius, 0, 0), v3(-guyRadius, 0, 0), v3(0, guyRadius, 0), v3(0, -guyRadius, 0)];
        anchorPts.forEach((anc, ai) => {
            const mast = v3(0, 0, gz);
            members.push(el('member', mast, anc, { section: 'CHS 114.3x5', role: 'bracing', label: `GUY-L${g + 1}-${ai + 1}`, layer: 'TOWER', frameId: 'LT5', meta: { type: 'guy_wire' } }));
        });
    }
    return { members, connections, metadata: { name: 'Guyed Tower 40m', totalH, baseW, panels, guyLevels, type: 'tower' } };
};

// ═══════════════════════════════════════════════════════════════════════════
// DOMES (5 types)
// ═══════════════════════════════════════════════════════════════════════════

// D1 — Schwedler Dome (meridional + ring + diagonal)
export const genSchwedlerDome = (cfg = {}) => {
    const { radius = 15, rings = 5, segs = 12, rise = 0.5 } = cfg;
    const members = [], connections = [];
    const pts = [];
    for (let r = 0; r <= rings; r++) {
        const phi = deg2rad(r * (90 / rings));
        const row = [];
        for (let s = 0; s < segs; s++) {
            const theta = deg2rad(s * (360 / segs));
            const x = radius * Math.cos(phi) * Math.cos(theta);
            const y = radius * Math.cos(phi) * Math.sin(theta);
            const z = radius * Math.sin(phi) * rise * 2;
            row.push(v3(x, y, z));
        }
        pts.push(row);
    }
    const apex = v3(0, 0, radius * rise * 2);
    for (let r = 0; r < rings; r++) {
        for (let s = 0; s < segs; s++) {
            const ns = (s + 1) % segs;
            members.push(el('member', pts[r][s], pts[r + 1][s], { section: 'CHS 114.3x5', role: 'dome-rib', label: `MER-R${r + 1}S${s + 1}`, layer: 'DOME', frameId: 'D1' }));
            members.push(el('member', pts[r][s], pts[r][ns], { section: 'CHS 114.3x5', role: 'dome-ring', label: `RING-R${r + 1}S${s + 1}`, layer: 'DOME', frameId: 'D1' }));
            if (r < rings - 1) members.push(el('member', pts[r][s], pts[r + 1][ns], { section: 'L 100x100x10', role: 'diagonal', label: `DIAG-R${r + 1}S${s + 1}`, layer: 'DOME', frameId: 'D1' }));
        }
    }
    for (let s = 0; s < segs; s++) members.push(el('member', pts[rings][s], apex, { section: 'CHS 114.3x5', role: 'dome-rib', label: `CAP-S${s + 1}`, layer: 'DOME', frameId: 'D1' }));
    pts[0].forEach((p, i) => connections.push(conn(CONNECTION_TYPES.BOLTED_END_PLATE, p, [], { plateW: 200, plateH: 200, boltRows: 2, boltCols: 2, boltDia: 20, label: `DOME-BASE-${i + 1}` })));
    return { members, connections, metadata: { name: 'Schwedler Dome 30m', radius, rings, segs, type: 'dome' } };
};

// D2 — Geodesic Dome (frequency 2)
export const genGeodesicDome = (cfg = {}) => {
    const { radius = 12, freq = 2, hemiOnly = true } = cfg;
    const members = [], connections = [];
    // Simplified geodesic based on icosahedron subdivision
    const phi = (1 + Math.sqrt(5)) / 2;
    const icoVerts = [
        [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
        [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
        [phi, 0, 1], [phi, 0, -1], [-phi, 0, 1], [-phi, 0, -1]
    ].map(([x, y, z]) => { const l = Math.sqrt(x * x + y * y + z * z); return v3(x / l * radius, y / l * radius, z / l * radius); });
    const faces = [[0, 1, 8], [0, 4, 5], [0, 5, 10], [0, 10, 1], [0, 8, 4], [1, 6, 8], [1, 10, 7], [2, 4, 9], [2, 5, 4], [2, 9, 3]];
    const addedEdges = new Set();
    const addEdge = (a, b) => {
        const key = [a, b].sort().join('-');
        if (!addedEdges.has(key)) {
            addedEdges.add(key);
            const av = icoVerts[a], bv = icoVerts[b];
            if (!hemiOnly || av.z >= 0 || bv.z >= 0)
                members.push(el('member', av, bv, { section: 'CHS 114.3x5', role: 'dome-rib', label: `GEO-${key}`, layer: 'DOME', frameId: 'D2' }));
        }
    };
    faces.forEach(([a, b, c]) => { addEdge(a, b); addEdge(b, c); addEdge(a, c); });
    icoVerts.filter(v => v.z <= 0.1 && v.z >= -0.5).forEach((v, i) => connections.push(conn(CONNECTION_TYPES.BOLTED_END_PLATE, v, [], { plateW: 200, plateH: 200, boltRows: 2, boltCols: 2, boltDia: 20, label: `GEO-BASE-${i + 1}` })));
    return { members, connections, metadata: { name: 'Geodesic Dome 24m', radius, freq, type: 'dome' } };
};

// D3 — Ribbed Dome
export const genRibbedDome = (cfg = {}) => {
    const { radius = 10, ribs = 16, rings = 4 } = cfg;
    const members = [], connections = [];
    const apex = v3(0, 0, radius);
    for (let r = 0; r < ribs; r++) {
        const theta = deg2rad(r * (360 / ribs));
        const ribPts = [];
        for (let rg = 0; rg <= rings; rg++) {
            const phi = deg2rad(90 * rg / rings);
            const x = radius * Math.cos(phi) * Math.cos(theta);
            const y = radius * Math.cos(phi) * Math.sin(theta);
            const z = radius * Math.sin(phi);
            ribPts.push(v3(x, y, z));
        }
        ribPts.push(apex);
        for (let i = 0; i < ribPts.length - 1; i++)
            members.push(el('member', ribPts[i], ribPts[i + 1], { section: 'CHS 168.3x6.3', role: 'dome-rib', label: `RIB-${r + 1}-${i + 1}`, layer: 'DOME', frameId: 'D3' }));
        // Ring beams
        if (r < ribs - 1) {
            const nr = (r + 1) % ribs;
            for (let rg = 0; rg <= rings; rg++) {
                const phi = deg2rad(90 * rg / rings);
                const pA = v3(radius * Math.cos(phi) * Math.cos(theta), radius * Math.cos(phi) * Math.sin(theta), radius * Math.sin(phi));
                const pB = v3(radius * Math.cos(phi) * Math.cos(deg2rad(nr * 360 / ribs)), radius * Math.cos(phi) * Math.sin(deg2rad(nr * 360 / ribs)), radius * Math.sin(phi));
                members.push(el('member', pA, pB, { section: 'CHS 114.3x5', role: 'dome-ring', label: `RING-${rg + 1}-${r + 1}`, layer: 'DOME', frameId: 'D3' }));
            }
        }
        connections.push(makeFoundation(ribPts[0].x, ribPts[0].y));
    }
    return { members, connections, metadata: { name: 'Ribbed Dome 20m', radius, ribs, rings, type: 'dome' } };
};

// D4 — Lamella Dome
export const genLamellaDome = (cfg = {}) => {
    const { radius = 14, rings = 5, segs = 12 } = cfg;
    const members = [], connections = [];
    const getPt = (r, s) => {
        const phi = deg2rad(r * (90 / rings));
        const theta = deg2rad(s * (360 / segs));
        return v3(radius * Math.cos(phi) * Math.cos(theta), radius * Math.cos(phi) * Math.sin(theta), radius * Math.sin(phi) * 0.6);
    };
    for (let r = 0; r < rings; r++) {
        for (let s = 0; s < segs; s++) {
            const ns = (s + 1) % segs;
            const p00 = getPt(r, s), p01 = getPt(r, ns), p10 = getPt(r + 1, s), p11 = getPt(r + 1, ns);
            members.push(el('member', p00, p11, { section: 'CHS 114.3x5', role: 'dome-rib', label: `LAM-A-R${r}S${s}`, layer: 'DOME', frameId: 'D4' }));
            members.push(el('member', p01, p10, { section: 'CHS 114.3x5', role: 'dome-rib', label: `LAM-B-R${r}S${s}`, layer: 'DOME', frameId: 'D4' }));
            members.push(el('member', p00, p01, { section: 'CHS 114.3x5', role: 'dome-ring', label: `LAM-R-R${r}S${s}`, layer: 'DOME', frameId: 'D4' }));
        }
    }
    return { members, connections, metadata: { name: 'Lamella Dome 28m', radius, rings, segs, type: 'dome' } };
};

// D5 — Kiewitt Dome (subdivided)
export const genKiewittDome = (cfg = {}) => {
    const { radius = 18, rings = 6, segs = 12 } = cfg;
    const members = [], connections = [];
    const getPt = (r, s, offset = 0) => {
        const phi = deg2rad(r * (85 / rings));
        const theta = deg2rad((s + offset) * (360 / segs));
        return v3(radius * Math.cos(phi) * Math.cos(theta), radius * Math.cos(phi) * Math.sin(theta), radius * Math.sin(phi) * 0.7);
    };
    const apex = v3(0, 0, radius * 0.7);
    for (let r = 0; r < rings; r++) {
        for (let s = 0; s < segs; s++) {
            const ns = (s + 1) % segs;
            const p0 = getPt(r, s), p1 = getPt(r, ns), p2 = getPt(r + 1, s), p3 = getPt(r + 1, ns);
            members.push(el('member', p0, p1, { section: 'CHS 168.3x6.3', role: 'dome-ring', label: `KW-RING-R${r}S${s}`, layer: 'DOME', frameId: 'D5' }));
            members.push(el('member', p0, p2, { section: 'CHS 168.3x6.3', role: 'dome-rib', label: `KW-MER-R${r}S${s}`, layer: 'DOME', frameId: 'D5' }));
            // Sub-diagonal
            members.push(el('member', p0, p3, { section: 'CHS 114.3x5', role: 'diagonal', label: `KW-DIAG-R${r}S${s}`, layer: 'DOME', frameId: 'D5' }));
            if (r === 0) connections.push(conn(CONNECTION_TYPES.BASE_PLATE, p0, [], { plateW: 300, plateH: 300, plateT: 25, boltRows: 2, boltCols: 2, boltDia: 22, anchorDia: 22, anchorEmbedment: 500, label: `KW-BASE-S${s}` }));
        }
    }
    for (let s = 0; s < segs; s++) members.push(el('member', getPt(rings, s), apex, { section: 'CHS 168.3x6.3', role: 'dome-rib', label: `KW-CAP-S${s}`, layer: 'DOME', frameId: 'D5' }));
    return { members, connections, metadata: { name: 'Kiewitt Dome 36m', radius, rings, segs, type: 'dome' } };
};

// ─── Master structure registry ───────────────────────────────────────────────
export const STRUCTURE_REGISTRY = {
    trusses: [
        { id: 'pratt', label: 'Pratt Roof Truss', gen: genPrattTruss, cfg: { span: 12, depth: 1.5, panels: 6, pitch: 15 } },
        { id: 'howe', label: 'Howe Truss', gen: genHoweTruss, cfg: { span: 15, depth: 1.8, panels: 6, pitch: 12 } },
        { id: 'warren', label: 'Warren Truss', gen: genWarrenTruss, cfg: { span: 18, depth: 2, panels: 8 } },
        { id: 'vierendeel', label: 'Vierendeel Truss', gen: genVierendeelTruss, cfg: { span: 10, depth: 1.5, panels: 5 } },
        { id: 'northlight', label: 'North Light Truss', gen: genNorthLightTruss, cfg: { bays: 4, bayW: 6, eaveH: 4, southPitch: 15 } },
    ],
    portals: [
        { id: 'symmetric', label: 'Symmetric Portal', gen: genSymmetricPortal, cfg: { span: 18, eaveH: 6, ridgeH: 3, bays: 3 } },
        { id: 'monoslope', label: 'Mono-slope Portal', gen: genMonoPortal, cfg: { span: 15, lowH: 4, highH: 7, bays: 2 } },
        { id: 'tied', label: 'Tied Portal', gen: genTiedPortal, cfg: { span: 24, eaveH: 8, ridgeH: 4, bays: 4 } },
        { id: 'multispan', label: 'Multi-span Portal', gen: genMultiSpanPortal, cfg: { spanPerBay: 12, numSpans: 3, eaveH: 6, bays: 2 } },
        { id: 'crane', label: 'Crane Portal', gen: genCranePortal, cfg: { span: 24, eaveH: 10, ridgeH: 3, bays: 4, craneH: 7.5 } },
    ],
    bridges: [
        { id: 'pedestrian', label: 'Pedestrian Bridge', gen: genPedestrianBridge, cfg: { span: 25, deckW: 3, trussD: 2.5, panels: 10 } },
        { id: 'through', label: 'Through Truss Bridge', gen: genThroughTruss, cfg: { span: 40, trussH: 5, panels: 10 } },
        { id: 'cablestayed', label: 'Cable-stayed Bridge', gen: genCableStayed, cfg: { span: 50, pylonH: 20 } },
        { id: 'railway', label: 'Railway Warren Bridge', gen: genRailwayBridge, cfg: { span: 30, trussH: 3.5, panels: 8 } },
        { id: 'arch', label: 'Arch Bridge', gen: genArchBridge, cfg: { span: 35, rise: 8, archSegs: 12 } },
    ],
    towers: [
        { id: 'square', label: 'Square Lattice Tower', gen: genSquareTower, cfg: { totalH: 30, baseW: 6, topW: 1.5, panels: 8 } },
        { id: 'triangular', label: 'Triangular Tower', gen: genTriangularTower, cfg: { totalH: 25, baseW: 5, topW: 1, panels: 8 } },
        { id: 'kbraced', label: 'K-braced Tower', gen: genKBracedTower, cfg: { totalH: 35, baseW: 7, topW: 2, panels: 10 } },
        { id: 'monopole', label: 'Monopole Tower', gen: genMonopoleTower, cfg: { totalH: 20, baseR: 0.8, topR: 0.3, segs: 16 } },
        { id: 'guyed', label: 'Guyed Tower', gen: genGuyedTower, cfg: { totalH: 40, baseW: 3, topW: 1.5, panels: 12, guyLevels: 3 } },
    ],
    domes: [
        { id: 'schwedler', label: 'Schwedler Dome', gen: genSchwedlerDome, cfg: { radius: 15, rings: 5, segs: 12 } },
        { id: 'geodesic', label: 'Geodesic Dome', gen: genGeodesicDome, cfg: { radius: 12 } },
        { id: 'ribbed', label: 'Ribbed Dome', gen: genRibbedDome, cfg: { radius: 10, ribs: 16, rings: 4 } },
        { id: 'lamella', label: 'Lamella Dome', gen: genLamellaDome, cfg: { radius: 14, rings: 5, segs: 12 } },
        { id: 'kiewitt', label: 'Kiewitt Dome', gen: genKiewittDome, cfg: { radius: 18, rings: 6, segs: 12 } },
    ],
};