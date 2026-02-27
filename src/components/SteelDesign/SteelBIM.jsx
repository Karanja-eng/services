import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";

// ============================================================================
// EMBEDDED CORE (condensed for single-file JSX)
// ============================================================================

const deg2rad = d => d * Math.PI / 180;
const v3 = (x, y, z) => ({ x, y, z });
const vadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const vscale = (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const vmid = (a, b) => vscale(vadd(a, b), 0.5);
const vlen = v => Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
const vnorm = v => { const l = vlen(v) || 1; return vscale(v, 1 / l); };

const ROLE_COLORS = {
    'column': '#4a9eff', 'rafter': '#ff8c42', 'beam': '#ffcc44', 'truss-top': '#ff6b6b',
    'truss-bottom': '#ffa552', 'vertical': '#94a3b8', 'diagonal': '#64748b', 'purlin': '#4fd1c7',
    'bracing': '#a78bfa', 'leg': '#c084fc', 'x-brace': '#7c3aed', 'ring': '#e879f9',
    'floor-beam': '#4ade80', 'stringer': '#86efac', 'dome-rib': '#38bdf8', 'dome-ring': '#0ea5e9',
    'north-rafter': '#60a5fa', 'south-rafter': '#f59e0b', 'haunch': '#ef4444',
    'plate': '#cbd5e1', 'bolt': '#9ca3af', 'weld': '#fde68a', 'foundation': '#b45309',
    'anchor': '#92400e', 'generic': '#94a3b8',
};
const rc = role => ROLE_COLORS[role] || '#94a3b8';

let _id = 1;
const uid = p => `${p}${_id++}`;

class SE {
    constructor(id, type, start, end, opts = {}) {
        this.id = id; this.type = type; this.start = start; this.end = end;
        this.section = opts.section || 'UB 254x146x37'; this.material = opts.material || 'S355';
        this.role = opts.role || 'beam'; this.label = opts.label || id; this.layer = opts.layer || 'STRUCTURE';
        this.selected = false; this.visible = true; this.frameId = opts.frameId || null;
        this.panelIdx = opts.panelIdx || 0; this.meta = opts.meta || {};
        this.length = vlen(vsub(end, start)); this.midpoint = vmid(start, end);
    }
}

class Conn {
    constructor(id, type, position, opts = {}) {
        this.id = id; this.type = type; this.position = position; this.selected = false;
        this.plateW = opts.plateW || 200; this.plateH = opts.plateH || 300; this.plateT = opts.plateT || 20;
        this.boltRows = opts.boltRows || 2; this.boltCols = opts.boltCols || 2;
        this.boltDia = opts.boltDia || 20; this.boltGrade = opts.boltGrade || '8.8';
        this.weldSize = opts.weldSize || 8; this.weldType = opts.weldType || 'fillet';
        this.label = opts.label || id; this.hasStiffeners = opts.hasStiffeners || false;
        this.anchorDia = opts.anchorDia || 24; this.anchorEmbedment = opts.anchorEmbedment || 500;
        this.groutThickness = opts.groutThickness || 30; this.meta = opts.meta || {};
    }
}

const el = (type, start, end, opts) => new SE(uid(type.slice(0, 1).toUpperCase()), type, start, end, opts);
const mkConn = (type, pos, opts) => new Conn(uid('C'), type, pos, opts);
const mkFoundation = (x, y) => mkConn('base_plate', v3(x, y, 0), { plateW: 450, plateH: 450, plateT: 30, boltRows: 2, boltCols: 2, boltDia: 24, anchorDia: 24, anchorEmbedment: 500, groutThickness: 30, hasStiffeners: true, label: `BP@${x.toFixed(1)},${y.toFixed(1)}` });

// ============================================================================
// ALL STRUCTURE GENERATORS
// ============================================================================

// ─── TRUSSES ────────────────────────────────────────────────────────────────

const genPrattTruss = (cfg = {}) => {
    const { span = 12, depth = 1.5, panels = 6, pitch = 15, yOff = 0 } = cfg;
    const m = [], c = []; const pw = span / panels; const hs = span / 2; const pr = deg2rad(pitch);
    const bot = [], top = [];
    for (let i = 0; i <= panels; i++) { const x = i * pw, d = Math.abs(x - hs); bot.push(v3(x, yOff, 0)); top.push(v3(x, yOff, (hs - d) * Math.tan(pr))); }
    for (let i = 0; i < panels; i++) {
        m.push(el('member', bot[i], bot[i + 1], { section: 'UB 254x146x37', role: 'truss-bottom', label: `BC${i + 1}`, layer: 'TRUSS', frameId: 'T1' }));
        m.push(el('member', top[i], top[i + 1], { section: 'UB 254x146x37', role: 'truss-top', label: `TC${i + 1}`, layer: 'TRUSS', frameId: 'T1' }));
        const lh = i < panels / 2;
        m.push(el('member', lh ? bot[i] : bot[i + 1], lh ? top[i + 1] : top[i], { section: 'L 100x100x10', role: 'diagonal', label: `D${i + 1}`, layer: 'TRUSS', frameId: 'T1' }));
    }
    for (let i = 1; i < panels; i++) m.push(el('member', bot[i], top[i], { section: 'L 100x100x10', role: 'vertical', label: `V${i}`, layer: 'TRUSS' }));
    m.push(el('member', bot[0], top[0], { section: 'L 100x100x10', role: 'vertical', label: 'EVL', layer: 'TRUSS' }));
    m.push(el('member', bot[panels], top[panels], { section: 'L 100x100x10', role: 'vertical', label: 'EVR', layer: 'TRUSS' }));
    m.push(el('member', v3(0, yOff, -6), v3(0, yOff, 0), { section: 'UC 203x203x46', role: 'column', label: 'COL-L', layer: 'SUPPORT' }));
    m.push(el('member', v3(span, yOff, -6), v3(span, yOff, 0), { section: 'UC 203x203x46', role: 'column', label: 'COL-R', layer: 'SUPPORT' }));
    c.push(mkFoundation(0, yOff)); c.push(mkFoundation(span, yOff));
    c.push(mkConn('bolted_end_plate', top[panels / 2], { plateW: 200, plateH: 200, plateT: 20, boltRows: 4, boltCols: 2, boltDia: 20, hasStiffeners: true, label: 'RIDGE' }));
    c.push(mkConn('welded_moment', v3(0, yOff, 0), { weldSize: 12, weldType: 'butt', hasStiffeners: true, label: 'COL-TRUSS-L' }));
    c.push(mkConn('welded_moment', v3(span, yOff, 0), { weldSize: 12, weldType: 'butt', hasStiffeners: true, label: 'COL-TRUSS-R' }));
    return { members: m, connections: c, metadata: { name: 'Pratt Roof Truss 12m', span, depth, panels, pitch, type: 'truss' } };
};

const genHoweTruss = (cfg = {}) => {
    const { span = 15, depth = 1.8, panels = 6, pitch = 12, yOff = 0 } = cfg;
    const m = [], c = []; const pw = span / panels; const hs = span / 2; const pr = deg2rad(pitch);
    const bot = [], top = [];
    for (let i = 0; i <= panels; i++) { const x = i * pw; bot.push(v3(x, yOff, 0)); top.push(v3(x, yOff, (hs - Math.abs(x - hs)) * Math.tan(pr))); }
    for (let i = 0; i < panels; i++) {
        m.push(el('member', bot[i], bot[i + 1], { section: 'UB 305x165x54', role: 'truss-bottom', label: `BC${i + 1}`, layer: 'TRUSS' }));
        m.push(el('member', top[i], top[i + 1], { section: 'UB 305x165x54', role: 'truss-top', label: `TC${i + 1}`, layer: 'TRUSS' }));
        const lh = i < panels / 2;
        m.push(el('member', lh ? top[i] : top[i + 1], lh ? bot[i + 1] : bot[i], { section: 'UC 152x152x37', role: 'diagonal', label: `D${i + 1}`, layer: 'TRUSS', meta: { force: 'compression' } }));
    }
    for (let i = 0; i <= panels; i++) m.push(el('member', bot[i], top[i], { section: 'L 100x100x10', role: 'vertical', label: `V${i}`, layer: 'TRUSS', meta: { force: 'tension' } }));
    m.push(el('member', v3(0, yOff, -5), v3(0, yOff, 0), { section: 'UC 203x203x46', role: 'column', label: 'CL', layer: 'SUPPORT' }));
    m.push(el('member', v3(span, yOff, -5), v3(span, yOff, 0), { section: 'UC 203x203x46', role: 'column', label: 'CR', layer: 'SUPPORT' }));
    c.push(mkFoundation(0, yOff)); c.push(mkFoundation(span, yOff));
    for (let i = 1; i < panels; i++) c.push(mkConn('gusset_plate', bot[i], { plateW: 250, plateH: 200, plateT: 18, boltRows: 2, boltCols: 3, boltDia: 22, weldSize: 10, label: `GP-${i}` }));
    return { members: m, connections: c, metadata: { name: 'Howe Truss 15m', span, depth, panels, type: 'truss' } };
};

const genWarrenTruss = (cfg = {}) => {
    const { span = 18, depth = 2, panels = 8, yOff = 0 } = cfg;
    const m = [], c = []; const pw = span / panels;
    const bot = [];
    for (let i = 0; i <= panels; i++) bot.push(v3(i * pw, yOff, 0));
    const top = [];
    for (let i = 0; i < panels; i += 2) top.push(v3((i + 0.5) * pw, yOff, depth));
    for (let i = 0; i < panels; i++) m.push(el('member', bot[i], bot[i + 1], { section: 'UB 305x165x54', role: 'truss-bottom', label: `BC${i + 1}`, layer: 'TRUSS' }));
    for (let i = 0; i < top.length - 1; i++) m.push(el('member', top[i], top[i + 1], { section: 'UB 305x165x54', role: 'truss-top', label: `TC${i + 1}`, layer: 'TRUSS' }));
    for (let i = 0; i < panels && top.length > 0; i++) {
        const apex = top[Math.min(Math.floor(i / 2), top.length - 1)];
        if (apex) { m.push(el('member', bot[i], apex, { section: 'L 150x150x12', role: 'diagonal', label: `DA${i}`, layer: 'TRUSS' })); m.push(el('member', apex, bot[i + 1], { section: 'L 150x150x12', role: 'diagonal', label: `DB${i}`, layer: 'TRUSS' })); }
    }
    m.push(el('member', v3(0, yOff, -5), v3(0, yOff, 0), { section: 'UC 254x254x73', role: 'column', label: 'CL', layer: 'SUPPORT' }));
    m.push(el('member', v3(span, yOff, -5), v3(span, yOff, 0), { section: 'UC 254x254x73', role: 'column', label: 'CR', layer: 'SUPPORT' }));
    c.push(mkFoundation(0, yOff)); c.push(mkFoundation(span, yOff));
    top.forEach((t, i) => c.push(mkConn('gusset_plate', t, { plateW: 280, plateH: 220, plateT: 20, boltRows: 2, boltCols: 4, boltDia: 22, weldSize: 10, label: `APEX-${i}` })));
    return { members: m, connections: c, metadata: { name: 'Warren Truss 18m', span, depth, panels, type: 'truss' } };
};

const genVierendeel = (cfg = {}) => {
    const { span = 10, depth = 1.5, panels = 5, yOff = 0 } = cfg;
    const m = [], c = []; const pw = span / panels;
    const bot = [], top = [];
    for (let i = 0; i <= panels; i++) { bot.push(v3(i * pw, yOff, 0)); top.push(v3(i * pw, yOff, depth)); }
    for (let i = 0; i < panels; i++) {
        m.push(el('member', bot[i], bot[i + 1], { section: 'UB 305x165x54', role: 'truss-bottom', label: `BC${i + 1}`, layer: 'TRUSS' }));
        m.push(el('member', top[i], top[i + 1], { section: 'UB 305x165x54', role: 'truss-top', label: `TC${i + 1}`, layer: 'TRUSS' }));
    }
    for (let i = 0; i <= panels; i++) {
        m.push(el('member', bot[i], top[i], { section: 'UB 254x146x37', role: 'vertical', label: `V${i}`, layer: 'TRUSS' }));
        c.push(mkConn('welded_moment', bot[i], { plateT: 20, weldSize: 12, weldType: 'butt', hasStiffeners: true, label: `VMC-B${i}` }));
        c.push(mkConn('welded_moment', top[i], { plateT: 20, weldSize: 12, weldType: 'butt', hasStiffeners: true, label: `VMC-T${i}` }));
    }
    m.push(el('member', v3(0, yOff, -4), v3(0, yOff, 0), { section: 'UC 254x254x73', role: 'column', label: 'CL', layer: 'SUPPORT' }));
    m.push(el('member', v3(span, yOff, -4), v3(span, yOff, 0), { section: 'UC 254x254x73', role: 'column', label: 'CR', layer: 'SUPPORT' }));
    c.push(mkFoundation(0, yOff)); c.push(mkFoundation(span, yOff));
    return { members: m, connections: c, metadata: { name: 'Vierendeel Truss 10m', span, depth, panels, type: 'truss' } };
};

const genNorthLightTruss = (cfg = {}) => {
    const { bays = 4, bayW = 6, eaveH = 4, southPitch = 15, yOff = 0 } = cfg;
    const m = [], c = []; const rh = bayW * Math.tan(deg2rad(southPitch));
    for (let b = 0; b < bays; b++) {
        const x0 = b * bayW, x1 = (b + 1) * bayW;
        const knee = v3(x0, yOff, eaveH), ridge = v3(x1, yOff, eaveH + rh), nk = v3(x1, yOff, eaveH);
        m.push(el('member', v3(x0, yOff, 0), knee, { section: 'UC 203x203x46', role: 'column', label: `NC${b + 1}`, layer: 'TRUSS' }));
        m.push(el('member', knee, ridge, { section: 'UB 203x133x25', role: 'south-rafter', label: `SR${b + 1}`, layer: 'TRUSS' }));
        m.push(el('member', ridge, nk, { section: 'UB 203x133x25', role: 'north-rafter', label: `NR${b + 1}`, layer: 'TRUSS' }));
        if (b < bays - 1) m.push(el('member', knee, nk, { section: 'L 100x100x10', role: 'truss-bottom', label: `TIE${b + 1}`, layer: 'TRUSS' }));
        c.push(mkFoundation(x0, yOff));
        c.push(mkConn('welded_moment', ridge, { plateW: 180, plateH: 180, plateT: 16, weldSize: 10, hasStiffeners: true, label: `RIDGE-${b + 1}` }));
        c.push(mkConn('bolted_end_plate', knee, { plateW: 200, plateH: 250, plateT: 20, boltRows: 3, boltCols: 2, boltDia: 20, hasStiffeners: true, label: `KNEE-${b + 1}` }));
    }
    return { members: m, connections: c, metadata: { name: 'North Light Truss', bays, bayW, eaveH, type: 'truss' } };
};

// ─── PORTALS ────────────────────────────────────────────────────────────────

const genSymmetricPortal = (cfg = {}) => {
    const { span = 18, eaveH = 6, ridgeH = 3, bays = 3, baySpacing = 6, haunchL = 1.2 } = cfg;
    const m = [], c = []; const nf = bays + 1, hs = span / 2, rz = eaveH + ridgeH;
    const ra = Math.atan2(ridgeH, hs), hdx = haunchL * Math.cos(ra), hdz = haunchL * Math.sin(ra);
    for (let f = 0; f < nf; f++) {
        const fy = f * baySpacing;
        const kL = v3(0, fy, eaveH), kR = v3(span, fy, eaveH), hL = v3(hdx, fy, eaveH + hdz), hR = v3(span - hdx, fy, eaveH + hdz), rdg = v3(hs, fy, rz);
        m.push(el('member', v3(0, fy, 0), kL, { section: 'UC 305x305x97', role: 'column', label: `CL${f + 1}`, layer: 'PORTAL', frameId: `PF${f}` }));
        m.push(el('member', v3(span, fy, 0), kR, { section: 'UC 305x305x97', role: 'column', label: `CR${f + 1}`, layer: 'PORTAL', frameId: `PF${f}` }));
        m.push(el('member', kL, hL, { section: 'UB 457x191x89', role: 'haunch', label: `HL${f + 1}`, layer: 'PORTAL', frameId: `PF${f}` }));
        m.push(el('member', kR, hR, { section: 'UB 457x191x89', role: 'haunch', label: `HR${f + 1}`, layer: 'PORTAL', frameId: `PF${f}` }));
        m.push(el('member', hL, rdg, { section: 'UB 356x171x67', role: 'rafter', label: `RL${f + 1}`, layer: 'PORTAL', frameId: `PF${f}` }));
        m.push(el('member', rdg, hR, { section: 'UB 356x171x67', role: 'rafter', label: `RR${f + 1}`, layer: 'PORTAL', frameId: `PF${f}` }));
        c.push(mkFoundation(0, fy)); c.push(mkFoundation(span, fy));
        c.push(mkConn('base_plate', v3(0, fy, 0), { plateW: 500, plateH: 500, plateT: 30, boltRows: 2, boltCols: 2, boltDia: 24, anchorDia: 24, anchorEmbedment: 500, groutThickness: 30, hasStiffeners: true, label: `BP-L${f + 1}` }));
        c.push(mkConn('base_plate', v3(span, fy, 0), { plateW: 500, plateH: 500, plateT: 30, boltRows: 2, boltCols: 2, boltDia: 24, anchorDia: 24, anchorEmbedment: 500, groutThickness: 30, hasStiffeners: true, label: `BP-R${f + 1}` }));
        c.push(mkConn('haunch', kL, { plateW: 400, plateH: 350, plateT: 25, boltRows: 4, boltCols: 2, boltDia: 24, hasStiffeners: true, label: `KNEE-L${f + 1}`, meta: { type: 'extended_end_plate' } }));
        c.push(mkConn('haunch', kR, { plateW: 400, plateH: 350, plateT: 25, boltRows: 4, boltCols: 2, boltDia: 24, hasStiffeners: true, label: `KNEE-R${f + 1}`, meta: { type: 'extended_end_plate' } }));
        c.push(mkConn('bolted_end_plate', rdg, { plateW: 300, plateH: 250, plateT: 20, boltRows: 3, boltCols: 2, boltDia: 24, hasStiffeners: true, label: `RIDGE${f + 1}` }));
    }
    const ps = 1.8, np = Math.floor(hs / ps);
    for (let p = 1; p <= np; p++) {
        const xo = p * ps, pz = eaveH + xo * Math.tan(ra);
        for (let b = 0; b < bays; b++) {
            const y1 = b * baySpacing, y2 = (b + 1) * baySpacing;
            m.push(el('member', v3(xo, y1, pz), v3(xo, y2, pz), { section: 'UB 203x133x25', role: 'purlin', label: `PL${p}B${b + 1}`, layer: 'SECONDARY' }));
            m.push(el('member', v3(span - xo, y1, pz), v3(span - xo, y2, pz), { section: 'UB 203x133x25', role: 'purlin', label: `PR${p}B${b + 1}`, layer: 'SECONDARY' }));
        }
    }
    return { members: m, connections: c, metadata: { name: 'Symmetric Portal 18m', span, eaveH, ridgeH, bays, type: 'portal' } };
};

const genMonoPortal = (cfg = {}) => {
    const { span = 15, lowH = 4, highH = 7, bays = 2, baySpacing = 6 } = cfg;
    const m = [], c = []; const nf = bays + 1;
    for (let f = 0; f < nf; f++) {
        const fy = f * baySpacing;
        const kl = v3(0, fy, lowH), kr = v3(span, fy, highH);
        m.push(el('member', v3(0, fy, 0), kl, { section: 'UC 254x254x73', role: 'column', label: `ML${f + 1}`, layer: 'PORTAL' }));
        m.push(el('member', v3(span, fy, 0), kr, { section: 'UC 254x254x73', role: 'column', label: `MR${f + 1}`, layer: 'PORTAL' }));
        m.push(el('member', kl, kr, { section: 'UB 356x171x67', role: 'rafter', label: `MRF${f + 1}`, layer: 'PORTAL' }));
        c.push(mkFoundation(0, fy)); c.push(mkFoundation(span, fy));
        c.push(mkConn('base_plate', v3(0, fy, 0), { plateW: 450, plateH: 450, plateT: 28, boltRows: 2, boltCols: 2, boltDia: 22, anchorDia: 22, anchorEmbedment: 450, label: `BP-ML${f + 1}` }));
        c.push(mkConn('base_plate', v3(span, fy, 0), { plateW: 450, plateH: 450, plateT: 28, boltRows: 2, boltCols: 2, boltDia: 22, anchorDia: 22, anchorEmbedment: 450, label: `BP-MR${f + 1}` }));
        c.push(mkConn('bolted_end_plate', kl, { plateW: 300, plateH: 350, plateT: 22, boltRows: 4, boltCols: 2, boltDia: 22, hasStiffeners: true, label: `KNEE-ML${f + 1}` }));
        c.push(mkConn('bolted_end_plate', kr, { plateW: 300, plateH: 350, plateT: 22, boltRows: 4, boltCols: 2, boltDia: 22, hasStiffeners: true, label: `KNEE-MR${f + 1}` }));
    }
    return { members: m, connections: c, metadata: { name: 'Mono-slope Portal 15m', span, lowH, highH, bays, type: 'portal' } };
};

const genTiedPortal = (cfg = {}) => {
    const { span = 24, eaveH = 8, ridgeH = 4, bays = 4, baySpacing = 7 } = cfg;
    const res = genSymmetricPortal({ span, eaveH, ridgeH, bays, baySpacing });
    const nf = bays + 1;
    for (let f = 0; f < nf; f++) res.members.push(el('member', v3(0, f * baySpacing, eaveH), v3(span, f * baySpacing, eaveH), { section: 'L 150x150x12', role: 'bracing', label: `TIE-ROD-${f + 1}`, layer: 'SECONDARY', meta: { type: 'tie_rod' } }));
    return { ...res, metadata: { ...res.metadata, name: 'Tied Portal 24m', type: 'portal' } };
};

const genMultiSpanPortal = (cfg = {}) => {
    const { spanPerBay = 12, numSpans = 3, eaveH = 6, ridgeH = 2.5, bays = 2, baySpacing = 6 } = cfg;
    const m = [], c = []; const nf = bays + 1;
    for (let s = 0; s < numSpans; s++) {
        const xO = s * spanPerBay, hs = spanPerBay / 2, rz = eaveH + ridgeH;
        for (let f = 0; f < nf; f++) {
            const fy = f * baySpacing;
            const cL = v3(xO, fy, 0), cR = v3(xO + spanPerBay, fy, 0);
            const kL = v3(xO, fy, eaveH), kR = v3(xO + spanPerBay, fy, eaveH), rdg = v3(xO + hs, fy, rz);
            m.push(el('member', cL, kL, { section: 'UC 203x203x46', role: 'column', label: `MSC${s + 1}L${f + 1}`, layer: 'PORTAL' }));
            if (s === numSpans - 1) m.push(el('member', cR, kR, { section: 'UC 203x203x46', role: 'column', label: `MSC${s + 1}R${f + 1}`, layer: 'PORTAL' }));
            m.push(el('member', kL, rdg, { section: 'UB 254x146x37', role: 'rafter', label: `MSR${s + 1}L${f + 1}`, layer: 'PORTAL' }));
            m.push(el('member', rdg, kR, { section: 'UB 254x146x37', role: 'rafter', label: `MSR${s + 1}R${f + 1}`, layer: 'PORTAL' }));
            c.push(mkFoundation(xO, fy));
            if (s === numSpans - 1) c.push(mkFoundation(xO + spanPerBay, fy));
            c.push(mkConn('base_plate', cL, { plateW: 400, plateH: 400, plateT: 25, boltRows: 2, boltCols: 2, boltDia: 20, anchorDia: 20, anchorEmbedment: 450, label: `BP${s + 1}L${f + 1}` }));
            c.push(mkConn('welded_moment', rdg, { weldSize: 10, weldType: 'butt', hasStiffeners: true, label: `RIDGE-MS${s + 1}F${f + 1}` }));
        }
    }
    return { members: m, connections: c, metadata: { name: `Multi-span Portal ${numSpans}×${spanPerBay}m`, type: 'portal' } };
};

const genCranePortal = (cfg = {}) => {
    const { span = 24, eaveH = 10, ridgeH = 3, bays = 4, baySpacing = 6, craneH = 7.5 } = cfg;
    const res = genSymmetricPortal({ span, eaveH, ridgeH, bays, baySpacing, haunchL: 1.8 });
    const nf = bays + 1;
    for (let f = 0; f < nf; f++) { res.members.push(el('member', v3(1.5, f * baySpacing, craneH - 0.3), v3(1.5, f * baySpacing, craneH + 0.3), { section: 'UC 254x254x73', role: 'beam', label: `BRAC-L${f + 1}`, layer: 'CRANE', meta: { type: 'crane_bracket' } })); }
    for (let b = 0; b < bays; b++) {
        const y1 = b * baySpacing, y2 = (b + 1) * baySpacing;
        res.members.push(el('member', v3(1.5, y1, craneH), v3(1.5, y2, craneH), { section: 'UB 406x178x74', role: 'beam', label: `CRB-L${b + 1}`, layer: 'CRANE', meta: { type: 'crane_runway' } }));
        res.members.push(el('member', v3(span - 1.5, y1, craneH), v3(span - 1.5, y2, craneH), { section: 'UB 406x178x74', role: 'beam', label: `CRB-R${b + 1}`, layer: 'CRANE', meta: { type: 'crane_runway' } }));
    }
    return { ...res, metadata: { ...res.metadata, name: 'Crane Portal 24m', craneH, type: 'portal' } };
};

// ─── BRIDGES ────────────────────────────────────────────────────────────────

const genPedestrianBridge = (cfg = {}) => {
    const { span = 25, deckW = 3, trussD = 2.5, panels = 10 } = cfg;
    const m = [], c = []; const pw = span / panels;
    const bt = (yo, sfx) => {
        const bot = [], top = [];
        for (let i = 0; i <= panels; i++) { bot.push(v3(i * pw, yo, 0)); top.push(v3(i * pw, yo, trussD)); }
        for (let i = 0; i < panels; i++) {
            m.push(el('member', bot[i], bot[i + 1], { section: 'UB 254x146x37', role: 'truss-bottom', label: `BC${sfx}${i + 1}`, layer: 'BRIDGE' }));
            m.push(el('member', top[i], top[i + 1], { section: 'UB 254x146x37', role: 'truss-top', label: `TC${sfx}${i + 1}`, layer: 'BRIDGE' }));
            const lh = i < panels / 2;
            m.push(el('member', lh ? bot[i] : bot[i + 1], lh ? top[i + 1] : top[i], { section: 'L 100x100x10', role: 'diagonal', label: `D${sfx}${i + 1}`, layer: 'BRIDGE' }));
        }
        for (let i = 0; i <= panels; i++) m.push(el('member', bot[i], top[i], { section: 'L 100x100x10', role: 'vertical', label: `V${sfx}${i}`, layer: 'BRIDGE' }));
        return { bot, top };
    };
    const tA = bt(0, 'A'), tB = bt(deckW, 'B');
    for (let i = 0; i <= panels; i++) {
        m.push(el('member', tA.bot[i], tB.bot[i], { section: 'UB 254x146x37', role: 'floor-beam', label: `FB${i + 1}`, layer: 'BRIDGE' }));
        m.push(el('member', tA.top[i], tB.top[i], { section: 'L 100x100x10', role: 'bracing', label: `TB${i + 1}`, layer: 'BRIDGE' }));
        c.push(mkConn('bolted_end_plate', tA.bot[i], { plateW: 220, plateH: 280, boltRows: 3, boltCols: 2, boltDia: 20, label: `FBC${i + 1}` }));
    }
    c.push(mkConn('pinned', v3(0, 0, 0), { plateW: 200, plateH: 300, plateT: 30, boltDia: 25, label: 'BEARING-L', meta: { type: 'rocker_bearing' } }));
    c.push(mkConn('pinned', v3(span, 0, 0), { plateW: 200, plateH: 300, plateT: 30, boltDia: 25, label: 'BEARING-R', meta: { type: 'sliding_bearing' } }));
    return { members: m, connections: c, metadata: { name: 'Pedestrian Bridge 25m', span, deckW, trussD, panels, type: 'bridge' } };
};

const genThroughTruss = (cfg = {}) => {
    const { span = 40, trussH = 5, panels = 10, laneW = 7 } = cfg;
    const m = [], c = []; const pw = span / panels;
    const bt = (yo, sfx) => {
        const bot = [], top = [];
        for (let i = 0; i <= panels; i++) { bot.push(v3(i * pw, yo, 0)); top.push(v3(i * pw, yo, trussH)); }
        for (let i = 0; i < panels; i++) {
            m.push(el('member', bot[i], bot[i + 1], { section: 'UB 406x178x74', role: 'truss-bottom', label: `TBC${sfx}${i + 1}`, layer: 'BRIDGE' }));
            m.push(el('member', top[i], top[i + 1], { section: 'UB 406x178x74', role: 'truss-top', label: `TTC${sfx}${i + 1}`, layer: 'BRIDGE' }));
            const lh = i < panels / 2;
            m.push(el('member', lh ? bot[i] : bot[i + 1], lh ? top[i + 1] : top[i], { section: 'UB 305x165x54', role: 'diagonal', label: `TD${sfx}${i + 1}`, layer: 'BRIDGE' }));
        }
        for (let i = 0; i <= panels; i++) m.push(el('member', bot[i], top[i], { section: 'UB 254x146x37', role: 'vertical', label: `TV${sfx}${i}`, layer: 'BRIDGE' }));
        return { bot, top };
    };
    const tA = bt(0, 'A'), tB = bt(laneW, 'B');
    for (let i = 0; i <= panels; i++) {
        m.push(el('member', tA.bot[i], tB.bot[i], { section: 'UB 457x191x89', role: 'floor-beam', label: `HFB${i + 1}`, layer: 'BRIDGE' }));
        if (i < panels) m.push(el('member', tA.top[i], tB.top[i], { section: 'UB 254x146x37', role: 'bracing', label: `HTB${i + 1}`, layer: 'BRIDGE' }));
        if (i < panels) for (let s = 1; s <= 2; s++) m.push(el('member', v3(i * pw, s * (laneW / 3), 0), v3((i + 1) * pw, s * (laneW / 3), 0), { section: 'UB 254x146x37', role: 'stringer', label: `STR${s}-${i + 1}`, layer: 'BRIDGE' }));
    }
    c.push(mkConn('pinned', v3(0, 0, 0), { plateW: 300, plateH: 400, plateT: 35, boltDia: 30, label: 'BEARING-L', meta: { type: 'rocker_bearing' } }));
    c.push(mkConn('pinned', v3(span, 0, 0), { plateW: 300, plateH: 400, plateT: 35, boltDia: 30, label: 'BEARING-R', meta: { type: 'roller_bearing' } }));
    return { members: m, connections: c, metadata: { name: 'Through Truss Bridge 40m', span, trussH, panels, type: 'bridge' } };
};

const genCableStayed = (cfg = {}) => {
    const { span = 50, pylonH = 20, cables = 6 } = cfg;
    const m = [], c = []; const hs = span / 2;
    const pylon1 = v3(hs / 2, 0, 0), pylon2 = v3(span - hs / 2, 0, 0);
    const ptop1 = v3(hs / 2, 0, pylonH), ptop2 = v3(span - hs / 2, 0, pylonH);
    m.push(el('member', pylon1, ptop1, { section: 'UC 356x368x129', role: 'column', label: 'PYLON-L', layer: 'BRIDGE' }));
    m.push(el('member', pylon2, ptop2, { section: 'UC 356x368x129', role: 'column', label: 'PYLON-R', layer: 'BRIDGE' }));
    const nDk = 14;
    for (let i = 0; i < nDk; i++) m.push(el('member', v3(i * (span / nDk), 0, 0), v3((i + 1) * (span / nDk), 0, 0), { section: 'UB 406x178x74', role: 'truss-bottom', label: `DK${i + 1}`, layer: 'BRIDGE' }));
    for (let c2 = 0; c2 < cables; c2++) {
        const t = (c2 + 1) / (cables + 1);
        const deckX1 = t * (hs / 2), deckX2 = span - t * (hs / 2);
        m.push(el('member', ptop1, v3(deckX1, 0, 0), { section: 'L 100x100x10', role: 'bracing', label: `CAB-L${c2 + 1}`, layer: 'BRIDGE', meta: { type: 'stay_cable' } }));
        m.push(el('member', ptop2, v3(deckX2, 0, 0), { section: 'L 100x100x10', role: 'bracing', label: `CAB-R${c2 + 1}`, layer: 'BRIDGE', meta: { type: 'stay_cable' } }));
    }
    c.push(mkFoundation(hs / 2, 0)); c.push(mkFoundation(span - hs / 2, 0));
    c.push(mkConn('base_plate', pylon1, { plateW: 700, plateH: 700, plateT: 45, boltRows: 3, boltCols: 3, boltDia: 32, anchorDia: 32, anchorEmbedment: 800, label: 'PYLON-BASE-L' }));
    c.push(mkConn('base_plate', pylon2, { plateW: 700, plateH: 700, plateT: 45, boltRows: 3, boltCols: 3, boltDia: 32, anchorDia: 32, anchorEmbedment: 800, label: 'PYLON-BASE-R' }));
    return { members: m, connections: c, metadata: { name: 'Cable-stayed Bridge 50m', span, pylonH, type: 'bridge' } };
};

const genArchBridge = (cfg = {}) => {
    const { span = 35, rise = 8, archSegs = 12 } = cfg;
    const m = [], c = []; const archPts = [], deckPts = [];
    for (let i = 0; i <= archSegs; i++) { const t = i / archSegs, x = t * span; archPts.push(v3(x, 0, rise * Math.sin(Math.PI * t))); deckPts.push(v3(x, 0, 0)); }
    for (let i = 0; i < archSegs; i++) {
        m.push(el('member', archPts[i], archPts[i + 1], { section: 'CHS 219.1x8', role: 'truss-top', label: `ARCH${i + 1}`, layer: 'BRIDGE' }));
        m.push(el('member', deckPts[i], deckPts[i + 1], { section: 'UB 406x178x74', role: 'floor-beam', label: `ADK${i + 1}`, layer: 'BRIDGE' }));
        if (i > 0 && i < archSegs) m.push(el('member', archPts[i], deckPts[i], { section: 'L 100x100x10', role: 'bracing', label: `HANG${i}`, layer: 'BRIDGE', meta: { type: 'arch_hanger' } }));
    }
    c.push(mkConn('pinned', v3(0, 0, 0), { plateW: 400, plateH: 400, plateT: 35, boltDia: 30, label: 'ARCH-PIN-L', meta: { type: 'pin_bearing' } }));
    c.push(mkConn('pinned', v3(span, 0, 0), { plateW: 400, plateH: 400, plateT: 35, boltDia: 30, label: 'ARCH-PIN-R', meta: { type: 'pin_bearing' } }));
    return { members: m, connections: c, metadata: { name: 'Arch Bridge 35m', span, rise, archSegs, type: 'bridge' } };
};

// ─── TOWERS ─────────────────────────────────────────────────────────────────

const genSquareTower = (cfg = {}) => {
    const { totalH = 30, baseW = 6, topW = 1.5, panels = 8 } = cfg;
    const m = [], c = []; const ph = totalH / panels;
    const hw = (z) => ((1 - z / totalH) * baseW + (z / totalH) * topW) / 2;
    for (let p = 0; p < panels; p++) {
        const z0 = p * ph, z1 = (p + 1) * ph, h0 = hw(z0), h1 = hw(z1);
        const bot = [v3(-h0, -h0, z0), v3(h0, -h0, z0), v3(h0, h0, z0), v3(-h0, h0, z0)];
        const top = [v3(-h1, -h1, z1), v3(h1, -h1, z1), v3(h1, h1, z1), v3(-h1, h1, z1)];
        for (let l = 0; l < 4; l++) m.push(el('member', bot[l], top[l], { section: 'SHS 150x150x8', role: 'leg', label: `L${l + 1}-P${p + 1}`, layer: 'TOWER' }));
        for (let t = 0; t < 4; t++) m.push(el('member', top[t], top[(t + 1) % 4], { section: 'SHS 100x100x6', role: 'ring', label: `R${t + 1}-P${p + 1}`, layer: 'TOWER' }));
        for (let f = 0; f < 4; f++) {
            const n = (f + 1) % 4;
            m.push(el('member', bot[f], top[n], { section: 'L 100x100x10', role: 'x-brace', label: `XA${f}-P${p + 1}`, layer: 'TOWER' }));
            m.push(el('member', bot[n], top[f], { section: 'L 100x100x10', role: 'x-brace', label: `XB${f}-P${p + 1}`, layer: 'TOWER' }));
        }
        if (p === 0) for (let l = 0; l < 4; l++) { c.push(mkFoundation(bot[l].x, bot[l].y)); c.push(mkConn('base_plate', bot[l], { plateW: 400, plateH: 400, plateT: 30, boltRows: 2, boltCols: 2, boltDia: 24, anchorDia: 24, anchorEmbedment: 600, label: `TB${l + 1}` })); }
        c.push(mkConn('gusset_plate', top[0], { plateW: 200, plateH: 200, plateT: 16, boltRows: 2, boltCols: 3, boltDia: 20, label: `GP-P${p + 1}` }));
    }
    return { members: m, connections: c, metadata: { name: 'Square Lattice Tower 30m', totalH, baseW, topW, panels, type: 'tower' } };
};

const genTriangularTower = (cfg = {}) => {
    const { totalH = 25, baseW = 5, topW = 1, panels = 8 } = cfg;
    const m = [], c = []; const ph = totalH / panels;
    const hw = (z) => ((1 - z / totalH) * baseW + (z / totalH) * topW) / 2;
    const triPts = (h, z) => [v3(0, h * 2 / Math.sqrt(3), z), v3(-h, -h / Math.sqrt(3), z), v3(h, -h / Math.sqrt(3), z)];
    for (let p = 0; p < panels; p++) {
        const z0 = p * ph, z1 = (p + 1) * ph;
        const b0 = triPts(hw(z0), z0), b1 = triPts(hw(z1), z1);
        for (let l = 0; l < 3; l++) m.push(el('member', b0[l], b1[l], { section: 'SHS 150x150x8', role: 'leg', label: `TL${l + 1}-P${p + 1}`, layer: 'TOWER' }));
        for (let t = 0; t < 3; t++) m.push(el('member', b1[t], b1[(t + 1) % 3], { section: 'SHS 100x100x6', role: 'ring', label: `TR${t + 1}-P${p + 1}`, layer: 'TOWER' }));
        for (let f = 0; f < 3; f++) {
            const n = (f + 1) % 3;
            m.push(el('member', b0[f], b1[n], { section: 'L 100x100x10', role: 'x-brace', label: `TX${f}A-P${p + 1}`, layer: 'TOWER' }));
            m.push(el('member', b0[n], b1[f], { section: 'L 100x100x10', role: 'x-brace', label: `TX${f}B-P${p + 1}`, layer: 'TOWER' }));
        }
        if (p === 0) for (let l = 0; l < 3; l++) c.push(mkFoundation(b0[l].x, b0[l].y));
    }
    return { members: m, connections: c, metadata: { name: 'Triangular Tower 25m', totalH, baseW, panels, type: 'tower' } };
};

const genKBracedTower = (cfg = {}) => {
    const { totalH = 35, baseW = 7, topW = 2, panels = 10 } = cfg;
    const m = [], c = []; const ph = totalH / panels;
    const hw = (z) => ((1 - z / totalH) * baseW + (z / totalH) * topW) / 2;
    for (let p = 0; p < panels; p++) {
        const z0 = p * ph, z1 = (p + 1) * ph, zm = (z0 + z1) / 2;
        const h0 = hw(z0), h1 = hw(z1), hm = hw(zm);
        const bot = [v3(-h0, -h0, z0), v3(h0, -h0, z0), v3(h0, h0, z0), v3(-h0, h0, z0)];
        const mid = [v3(-hm, -hm, zm), v3(hm, -hm, zm), v3(hm, hm, zm), v3(-hm, hm, zm)];
        const top = [v3(-h1, -h1, z1), v3(h1, -h1, z1), v3(h1, h1, z1), v3(-h1, h1, z1)];
        for (let l = 0; l < 4; l++) m.push(el('member', bot[l], top[l], { section: 'SHS 200x200x10', role: 'leg', label: `KL${l + 1}-P${p + 1}`, layer: 'TOWER' }));
        for (let t = 0; t < 4; t++) m.push(el('member', top[t], top[(t + 1) % 4], { section: 'SHS 100x100x6', role: 'ring', label: `KR${t + 1}-P${p + 1}`, layer: 'TOWER' }));
        for (let f = 0; f < 4; f++) {
            const n = (f + 1) % 4;
            const fm = v3((mid[f].x + mid[n].x) / 2, (mid[f].y + mid[n].y) / 2, zm);
            m.push(el('member', mid[f], fm, { section: 'L 100x100x10', role: 'x-brace', label: `KB${f}A-P${p + 1}`, layer: 'TOWER' }));
            m.push(el('member', mid[n], fm, { section: 'L 100x100x10', role: 'x-brace', label: `KB${f}B-P${p + 1}`, layer: 'TOWER' }));
        }
        if (p === 0) for (let l = 0; l < 4; l++) c.push(mkFoundation(bot[l].x, bot[l].y));
    }
    return { members: m, connections: c, metadata: { name: 'K-braced Tower 35m', totalH, baseW, panels, type: 'tower' } };
};

const genGuyedTower = (cfg = {}) => {
    const { totalH = 40, baseW = 3, topW = 1.5, panels = 12, guyLevels = 3, guyRadius = 20 } = cfg;
    const m = [], c = []; const ph = totalH / panels;
    const hw = (z) => ((1 - z / totalH) * baseW + (z / totalH) * topW) / 2;
    for (let p = 0; p < panels; p++) {
        const z0 = p * ph, z1 = (p + 1) * ph, h0 = hw(z0), h1 = hw(z1);
        const bot = [v3(-h0, -h0, z0), v3(h0, -h0, z0), v3(h0, h0, z0), v3(-h0, h0, z0)];
        const top = [v3(-h1, -h1, z1), v3(h1, -h1, z1), v3(h1, h1, z1), v3(-h1, h1, z1)];
        for (let l = 0; l < 4; l++) m.push(el('member', bot[l], top[l], { section: 'SHS 100x100x6', role: 'leg', label: `GL${l + 1}-P${p + 1}`, layer: 'TOWER' }));
        for (let t = 0; t < 4; t++) m.push(el('member', top[t], top[(t + 1) % 4], { section: 'SHS 100x100x6', role: 'ring', label: `GR${t + 1}-P${p + 1}`, layer: 'TOWER' }));
        m.push(el('member', bot[0], top[1], { section: 'L 100x100x10', role: 'x-brace', label: `GX0-P${p + 1}`, layer: 'TOWER' }));
        m.push(el('member', bot[1], top[0], { section: 'L 100x100x10', role: 'x-brace', label: `GX1-P${p + 1}`, layer: 'TOWER' }));
        if (p === 0) for (let l = 0; l < 4; l++) c.push(mkFoundation(bot[l].x, bot[l].y));
    }
    for (let g = 0; g < guyLevels; g++) {
        const gz = totalH * ((g + 1) / (guyLevels + 1));
        [v3(guyRadius, 0, 0), v3(-guyRadius, 0, 0), v3(0, guyRadius, 0), v3(0, -guyRadius, 0)].forEach((anc, ai) =>
            m.push(el('member', v3(0, 0, gz), anc, { section: 'L 100x100x10', role: 'bracing', label: `GUY-L${g + 1}-${ai + 1}`, layer: 'TOWER', meta: { type: 'guy_wire' } })));
    }
    return { members: m, connections: c, metadata: { name: 'Guyed Tower 40m', totalH, baseW, panels, guyLevels, type: 'tower' } };
};

// ─── DOMES ───────────────────────────────────────────────────────────────────

const genSchwedlerDome = (cfg = {}) => {
    const { radius = 15, rings = 5, segs = 12 } = cfg;
    const m = [], c = []; const pts = [];
    for (let r = 0; r <= rings; r++) {
        const phi = deg2rad(r * (90 / rings)), row = [];
        for (let s = 0; s < segs; s++) { const theta = deg2rad(s * (360 / segs)); row.push(v3(radius * Math.cos(phi) * Math.cos(theta), radius * Math.cos(phi) * Math.sin(theta), radius * Math.sin(phi) * 0.6)); }
        pts.push(row);
    }
    const apex = v3(0, 0, radius * 0.6);
    for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) {
        const ns = (s + 1) % segs;
        m.push(el('member', pts[r][s], pts[r + 1][s], { section: 'CHS 114.3x5', role: 'dome-rib', label: `MER${r + 1}S${s + 1}`, layer: 'DOME' }));
        m.push(el('member', pts[r][s], pts[r][ns], { section: 'CHS 114.3x5', role: 'dome-ring', label: `RNG${r + 1}S${s + 1}`, layer: 'DOME' }));
        if (r < rings - 1) m.push(el('member', pts[r][s], pts[r + 1][ns], { section: 'L 100x100x10', role: 'diagonal', label: `DG${r + 1}S${s + 1}`, layer: 'DOME' }));
    }
    for (let s = 0; s < segs; s++) m.push(el('member', pts[rings][s], apex, { section: 'CHS 114.3x5', role: 'dome-rib', label: `CAP-S${s + 1}`, layer: 'DOME' }));
    pts[0].forEach((p, i) => { c.push(mkFoundation(p.x, p.y)); c.push(mkConn('bolted_end_plate', p, { plateW: 200, plateH: 200, boltRows: 2, boltCols: 2, boltDia: 20, label: `DOME-BASE-${i + 1}` })); });
    return { members: m, connections: c, metadata: { name: 'Schwedler Dome 30m', radius, rings, segs, type: 'dome' } };
};

const genGeodesicDome = (cfg = {}) => {
    const { radius = 12 } = cfg;
    const m = [], c = []; const phi = (1 + Math.sqrt(5)) / 2;
    const icoV = [[0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi], [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0], [phi, 0, 1], [phi, 0, -1], [-phi, 0, 1], [-phi, 0, -1]].map(([x, y, z]) => { const l = Math.sqrt(x * x + y * y + z * z); return v3(x / l * radius, y / l * radius, z / l * radius); });
    const faces = [[0, 1, 8], [0, 4, 5], [0, 5, 10], [0, 10, 1], [0, 8, 4], [1, 6, 8], [1, 10, 7], [2, 4, 9], [2, 5, 4], [2, 9, 3], [5, 2, 11], [11, 10, 5]];
    const added = new Set();
    faces.forEach(([a, b, cc]) => { [[a, b], [b, cc], [a, cc]].forEach(([u, v]) => { const k = [u, v].sort().join('-'); if (!added.has(k)) { added.add(k); const av = icoV[u], bv = icoV[v]; if (av.z >= 0 || bv.z >= 0) m.push(el('member', av, bv, { section: 'CHS 114.3x5', role: 'dome-rib', label: `GEO-${k}`, layer: 'DOME' })); } }); });
    icoV.filter(v => v.z <= 0.2 && v.z >= -0.5).forEach((v, i) => { c.push(mkFoundation(v.x, v.y)); c.push(mkConn('bolted_end_plate', v, { plateW: 200, plateH: 200, boltRows: 2, boltCols: 2, boltDia: 20, label: `GEO-BASE-${i + 1}` })); });
    return { members: m, connections: c, metadata: { name: 'Geodesic Dome 24m', radius, type: 'dome' } };
};

const genRibbedDome = (cfg = {}) => {
    const { radius = 10, ribs = 12, rings = 4 } = cfg;
    const m = [], c = []; const apex = v3(0, 0, radius * 0.8);
    for (let r = 0; r < ribs; r++) {
        const theta = deg2rad(r * (360 / ribs));
        const ribPts = [];
        for (let rg = 0; rg <= rings; rg++) { const phi = deg2rad(90 * rg / rings); ribPts.push(v3(radius * Math.cos(phi) * Math.cos(theta), radius * Math.cos(phi) * Math.sin(theta), radius * Math.sin(phi) * 0.8)); }
        ribPts.push(apex);
        for (let i = 0; i < ribPts.length - 1; i++) m.push(el('member', ribPts[i], ribPts[i + 1], { section: 'CHS 168.3x6.3', role: 'dome-rib', label: `RIB${r + 1}-${i + 1}`, layer: 'DOME' }));
        const nr = (r + 1) % ribs; const ntheta = deg2rad(nr * (360 / ribs));
        for (let rg = 0; rg <= rings; rg++) {
            const phi = deg2rad(90 * rg / rings);
            const pA = v3(radius * Math.cos(phi) * Math.cos(theta), radius * Math.cos(phi) * Math.sin(theta), radius * Math.sin(phi) * 0.8);
            const pB = v3(radius * Math.cos(phi) * Math.cos(ntheta), radius * Math.cos(phi) * Math.sin(ntheta), radius * Math.sin(phi) * 0.8);
            m.push(el('member', pA, pB, { section: 'CHS 114.3x5', role: 'dome-ring', label: `RING${rg + 1}-${r + 1}`, layer: 'DOME' }));
        }
        c.push(mkFoundation(ribPts[0].x, ribPts[0].y));
    }
    return { members: m, connections: c, metadata: { name: 'Ribbed Dome 20m', radius, ribs, rings, type: 'dome' } };
};

const genLamellaDome = (cfg = {}) => {
    const { radius = 14, rings = 5, segs = 12 } = cfg;
    const m = [], c = [];
    const getPt = (r, s) => { const phi = deg2rad(r * (90 / rings)), theta = deg2rad(s * (360 / segs)); return v3(radius * Math.cos(phi) * Math.cos(theta), radius * Math.cos(phi) * Math.sin(theta), radius * Math.sin(phi) * 0.55); };
    for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) {
        const ns = (s + 1) % segs;
        const p00 = getPt(r, s), p01 = getPt(r, ns), p10 = getPt(r + 1, s), p11 = getPt(r + 1, ns);
        m.push(el('member', p00, p11, { section: 'CHS 114.3x5', role: 'dome-rib', label: `LA${r}${s}`, layer: 'DOME' }));
        m.push(el('member', p01, p10, { section: 'CHS 114.3x5', role: 'dome-rib', label: `LB${r}${s}`, layer: 'DOME' }));
        m.push(el('member', p00, p01, { section: 'CHS 114.3x5', role: 'dome-ring', label: `LR${r}${s}`, layer: 'DOME' }));
        if (r === 0) { c.push(mkFoundation(p00.x, p00.y)); }
    }
    return { members: m, connections: c, metadata: { name: 'Lamella Dome 28m', radius, rings, segs, type: 'dome' } };
};

const genKiewittDome = (cfg = {}) => {
    const { radius = 18, rings = 6, segs = 12 } = cfg;
    const m = [], c = [];
    const getPt = (r, s) => { const phi = deg2rad(r * (85 / rings)), theta = deg2rad(s * (360 / segs)); return v3(radius * Math.cos(phi) * Math.cos(theta), radius * Math.cos(phi) * Math.sin(theta), radius * Math.sin(phi) * 0.65); };
    const apex = v3(0, 0, radius * 0.65);
    for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) {
        const ns = (s + 1) % segs;
        const p0 = getPt(r, s), p1 = getPt(r, ns), p2 = getPt(r + 1, s), p3 = getPt(r + 1, ns);
        m.push(el('member', p0, p1, { section: 'CHS 168.3x6.3', role: 'dome-ring', label: `KWR${r}${s}`, layer: 'DOME' }));
        m.push(el('member', p0, p2, { section: 'CHS 168.3x6.3', role: 'dome-rib', label: `KWM${r}${s}`, layer: 'DOME' }));
        m.push(el('member', p0, p3, { section: 'CHS 114.3x5', role: 'diagonal', label: `KWD${r}${s}`, layer: 'DOME' }));
        if (r === 0) { c.push(mkFoundation(p0.x, p0.y)); c.push(mkConn('base_plate', p0, { plateW: 300, plateH: 300, plateT: 25, boltRows: 2, boltCols: 2, boltDia: 22, anchorDia: 22, anchorEmbedment: 500, label: `KW-BASE-S${s}` })); }
    }
    for (let s = 0; s < segs; s++) m.push(el('member', getPt(rings, s), apex, { section: 'CHS 168.3x6.3', role: 'dome-rib', label: `KWCAP${s}`, layer: 'DOME' }));
    return { members: m, connections: c, metadata: { name: 'Kiewitt Dome 36m', radius, rings, segs, type: 'dome' } };
};

// ─── Registry ────────────────────────────────────────────────────────────────
const REGISTRY = {
    trusses: [
        { id: 'pratt', label: 'Pratt Roof Truss', gen: genPrattTruss, cfg: { span: 12, depth: 1.5, panels: 6, pitch: 15 } },
        { id: 'howe', label: 'Howe Truss', gen: genHoweTruss, cfg: { span: 15, depth: 1.8, panels: 6, pitch: 12 } },
        { id: 'warren', label: 'Warren Truss', gen: genWarrenTruss, cfg: { span: 18, depth: 2, panels: 8 } },
        { id: 'vierendeel', label: 'Vierendeel Truss', gen: genVierendeel, cfg: { span: 10, depth: 1.5, panels: 5 } },
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
        { id: 'arch', label: 'Arch Bridge', gen: genArchBridge, cfg: { span: 35, rise: 8, archSegs: 12 } },
        { id: 'railway', label: 'Railway Bridge', gen: genThroughTruss, cfg: { span: 30, trussH: 3.5, panels: 8, laneW: 4.5 } },
    ],
    towers: [
        { id: 'square', label: 'Square Lattice Tower', gen: genSquareTower, cfg: { totalH: 30, baseW: 6, topW: 1.5, panels: 8 } },
        { id: 'triangular', label: 'Triangular Tower', gen: genTriangularTower, cfg: { totalH: 25, baseW: 5, topW: 1, panels: 8 } },
        { id: 'kbraced', label: 'K-braced Tower', gen: genKBracedTower, cfg: { totalH: 35, baseW: 7, topW: 2, panels: 10 } },
        { id: 'guyed', label: 'Guyed Tower', gen: genGuyedTower, cfg: { totalH: 40, baseW: 3, topW: 1.5, panels: 12, guyLevels: 3 } },
        { id: 'sqsmall', label: 'Compact Square Tower', gen: genSquareTower, cfg: { totalH: 20, baseW: 4, topW: 1, panels: 6 } },
    ],
    domes: [
        { id: 'schwedler', label: 'Schwedler Dome', gen: genSchwedlerDome, cfg: { radius: 15, rings: 5, segs: 12 } },
        { id: 'geodesic', label: 'Geodesic Dome', gen: genGeodesicDome, cfg: { radius: 12 } },
        { id: 'ribbed', label: 'Ribbed Dome', gen: genRibbedDome, cfg: { radius: 10, ribs: 12, rings: 4 } },
        { id: 'lamella', label: 'Lamella Dome', gen: genLamellaDome, cfg: { radius: 14, rings: 5, segs: 12 } },
        { id: 'kiewitt', label: 'Kiewitt Dome', gen: genKiewittDome, cfg: { radius: 18, rings: 6, segs: 12 } },
    ],
};

// ============================================================================
// 2D CANVAS RENDERER (HTML Canvas — no Konva dependency in artifact)
// ============================================================================

const useCanvasRenderer = (canvasRef, structure, selectedIds, viewMode, zoom, pan) => {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !structure) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 0.5;
        const gs = 40 * zoom;
        for (let x = (pan.x % gs) - gs; x < W + gs; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = (pan.y % gs) - gs; y < H + gs; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        // Gather all points for bounding box
        const allPts = structure.members.flatMap(m => [m.start, m.end]);
        if (!allPts.length) return;

        // Project based on view mode
        const proj = (pt) => {
            if (viewMode === 'plan') return { x: pt.x, y: pt.y };
            if (viewMode === 'front') return { x: pt.x, y: -pt.z };
            if (viewMode === 'side') return { x: pt.y, y: -pt.z };
            if (viewMode === 'iso') {
                const ix = pt.x - pt.y * 0.5;
                const iy = -pt.z - (pt.x + pt.y) * 0.2;
                return { x: ix, y: iy };
            }
            return { x: pt.x, y: -pt.z };
        };

        const projPts = allPts.map(proj);
        const minX = Math.min(...projPts.map(p => p.x)), maxX = Math.max(...projPts.map(p => p.x));
        const minY = Math.min(...projPts.map(p => p.y)), maxY = Math.max(...projPts.map(p => p.y));
        const rangeX = (maxX - minX) || 1, rangeY = (maxY - minY) || 1;
        const PAD = 70;
        const baseScale = Math.min((W - PAD * 2) / rangeX, (H - PAD * 2) / rangeY);
        const sc = baseScale * zoom;
        const offX = pan.x + W / 2 - (minX + rangeX / 2) * sc;
        const offY = pan.y + H / 2 - (minY + rangeY / 2) * sc;
        const tx = x => x * sc + offX;
        const ty = y => y * sc + offY;

        // Draw connections first (background)
        structure.connections.forEach(conn => {
            const p = proj(conn.position);
            const cx = tx(p.x), cy = ty(p.y);
            const isSelected = selectedIds.includes(conn.id);
            const pw = (conn.plateW / 1000) * sc, ph = (conn.plateH / 1000) * sc;

            if (conn.type === 'base_plate' || conn.type === 'bolted_end_plate' || conn.type === 'haunch') {
                ctx.save();
                ctx.strokeStyle = isSelected ? '#fff' : '#b45309';
                ctx.fillStyle = isSelected ? '#78350f44' : '#7c341022';
                ctx.lineWidth = isSelected ? 2 : 1;
                ctx.beginPath();
                ctx.rect(cx - pw / 2, cy - ph / 2, pw, ph);
                ctx.fill(); ctx.stroke();

                // Bolts
                const { boltRows, boltCols, boltDia, plateW, plateH } = conn;
                const edgeD = boltDia * 2.5 / 1000 * sc;
                const spX = boltCols > 1 ? (pw - 2 * edgeD) / (boltCols - 1) : 0;
                const spY = boltRows > 1 ? (ph - 2 * edgeD) / (boltRows - 1) : 0;
                for (let r = 0; r < boltRows; r++) for (let cc = 0; cc < boltCols; cc++) {
                    const bx = cx - pw / 2 + edgeD + cc * spX;
                    const by = cy - ph / 2 + edgeD + r * spY;
                    const br = Math.max(1.5, boltDia / 1000 * sc / 2);
                    ctx.fillStyle = isSelected ? '#fbbf24' : '#94a3b8';
                    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#475569'; ctx.lineWidth = 0.5;
                    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.stroke();
                    // Bolt centre cross
                    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 0.5;
                    ctx.beginPath(); ctx.moveTo(bx - br, by); ctx.lineTo(bx + br, by); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(bx, by - br); ctx.lineTo(bx, by + br); ctx.stroke();
                }

                // Stiffeners
                if (conn.hasStiffeners) {
                    ctx.strokeStyle = isSelected ? '#f97316' : '#92400e';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([3, 3]);
                    ctx.beginPath(); ctx.moveTo(cx, cy - ph / 2); ctx.lineTo(cx, cy + ph / 2); ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Anchor bolts (base plates)
                if (conn.type === 'base_plate') {
                    const anchorR = Math.max(2, conn.anchorDia / 1000 * sc / 2);
                    ctx.fillStyle = '#92400e'; ctx.strokeStyle = '#78350f'; ctx.lineWidth = 1;
                    const anchorPts2 = [[-pw / 2, -ph / 2], [pw / 2, -ph / 2], [pw / 2, ph / 2], [-pw / 2, ph / 2]];
                    anchorPts2.forEach(([ax, ay]) => {
                        ctx.beginPath(); ctx.arc(cx + ax * 0.6, cy + ay * 0.6, anchorR, 0, Math.PI * 2);
                        ctx.fill(); ctx.stroke();
                        // Embed line
                        ctx.strokeStyle = '#78350f88'; ctx.lineWidth = 0.8;
                        ctx.beginPath(); ctx.moveTo(cx + ax * 0.6, cy + ay * 0.6); ctx.lineTo(cx + ax * 0.6, cy + ay * 0.6 + conn.anchorEmbedment / 1000 * sc * 0.3); ctx.stroke();
                    });
                    // Grout
                    ctx.fillStyle = '#d9770633'; ctx.lineWidth = 0;
                    ctx.fillRect(cx - pw / 2 - 2, cy - 2, pw + 4, conn.groutThickness / 1000 * sc + 4);
                }
                ctx.restore();
            }

            if (conn.type === 'welded_moment') {
                ctx.save();
                ctx.strokeStyle = isSelected ? '#fde68a' : '#f59e0b';
                ctx.lineWidth = isSelected ? 3 : 1.5;
                ctx.setLineDash([2, 2]);
                ctx.beginPath(); ctx.arc(cx, cy, Math.max(4, conn.plateT / 1000 * sc * 3), 0, Math.PI * 2); ctx.stroke();
                // Weld symbol
                ctx.setLineDash([]); ctx.fillStyle = isSelected ? '#fde68a' : '#f59e0b';
                ctx.font = '8px monospace'; ctx.fillText('W', cx - 3, cy + 3);
                ctx.restore();
            }

            if (conn.type === 'gusset_plate') {
                ctx.save();
                ctx.fillStyle = '#22c55e33'; ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.rect(cx - pw / 2, cy - ph / 2, pw, ph); ctx.fill(); ctx.stroke();
                // Bolts
                const bdia = Math.max(2, conn.boltDia / 1000 * sc / 2);
                for (let r = 0; r < conn.boltRows; r++) for (let cc2 = 0; cc2 < conn.boltCols; cc2++) {
                    const bx = cx - pw / 2 + (cc2 + 1) * (pw / (conn.boltCols + 1)), by = cy - ph / 2 + (r + 1) * (ph / (conn.boltRows + 1));
                    ctx.fillStyle = '#4ade80'; ctx.beginPath(); ctx.arc(bx, by, bdia, 0, Math.PI * 2); ctx.fill();
                }
                ctx.restore();
            }

            if (conn.type === 'pinned') {
                ctx.save();
                const pr = Math.max(5, conn.boltDia / 1000 * sc);
                ctx.fillStyle = '#7c3aed44'; ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                // Pin symbol triangle
                ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(cx, cy + pr); ctx.lineTo(cx - pr, cy + pr * 2); ctx.lineTo(cx + pr, cy + pr * 2); ctx.closePath(); ctx.stroke();
                ctx.restore();
            }
        });

        // Draw members
        structure.members.forEach(mem => {
            if (!mem.visible) return;
            const ps = proj(mem.start), pe = proj(mem.end);
            const x1 = tx(ps.x), y1 = ty(ps.y), x2 = tx(pe.x), y2 = ty(pe.y);
            const isSelected = selectedIds.includes(mem.id);
            const color = rc(mem.role);

            const lineW = {
                'column': 3.5, 'rafter': 3, 'haunch': 4, 'truss-top': 3, 'truss-bottom': 3,
                'vertical': 2, 'diagonal': 1.5, 'leg': 3.5, 'ring': 2, 'x-brace': 1.5,
                'floor-beam': 2.5, 'purlin': 1.2, 'bracing': 1.5, 'dome-rib': 2, 'dome-ring': 1.5,
            }[mem.role] || 2;

            ctx.save();
            if (isSelected) { ctx.shadowColor = color; ctx.shadowBlur = 10; }

            // Section thickness visualization
            const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            if (len > 3 && ['column', 'rafter', 'haunch', 'truss-top', 'truss-bottom', 'leg', 'floor-beam'].includes(mem.role)) {
                const dx = (y2 - y1) / len, dy = -(x2 - x1) / len;
                const hw = Math.max(2, lineW * 0.8);
                ctx.fillStyle = isSelected ? color + '44' : color + '22';
                ctx.beginPath();
                ctx.moveTo(x1 + dx * hw, y1 + dy * hw); ctx.lineTo(x2 + dx * hw, y2 + dy * hw);
                ctx.lineTo(x2 - dx * hw, y2 - dy * hw); ctx.lineTo(x1 - dx * hw, y1 - dy * hw);
                ctx.closePath(); ctx.fill();
            }

            // Member line
            ctx.strokeStyle = isSelected ? '#fff' : color;
            ctx.lineWidth = isSelected ? lineW + 2 : lineW;
            if (['diagonal', 'x-brace', 'bracing'].includes(mem.role)) ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            ctx.setLineDash([]);

            // Joint dots
            if (!['purlin', 'bracing'].includes(mem.role)) {
                const dotR = isSelected ? 3.5 : 2.5;
                [v3(x1, y1, 0), v3(x2, y2, 0)].forEach(({ x, y }) => {
                    ctx.fillStyle = isSelected ? '#fff' : color;
                    ctx.beginPath(); ctx.arc(x, y, dotR, 0, Math.PI * 2); ctx.fill();
                });
            }

            // Label
            if (isSelected || sc > 8) {
                const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
                ctx.font = isSelected ? 'bold 9px monospace' : '7px monospace';
                ctx.fillStyle = isSelected ? '#fff' : color + 'cc';
                ctx.shadowBlur = 0;
                ctx.fillText(mem.label, mx + 3, my - 3);
            }
            ctx.restore();
        });

        // Scale bar
        const barM = 5;
        const barLen = barM * sc;
        ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(20, H - 20); ctx.lineTo(20 + barLen, H - 20); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(20, H - 15); ctx.lineTo(20, H - 25); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(20 + barLen, H - 15); ctx.lineTo(20 + barLen, H - 25); ctx.stroke();
        ctx.fillStyle = '#64748b'; ctx.font = '10px monospace'; ctx.fillText(`${barM}m`, 20 + barLen / 2 - 8, H - 8);

        // Compass
        const cx2 = W - 30, cy2 = 30;
        ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.arc(cx2, cy2, 18, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx2, cy2 - 14); ctx.lineTo(cx2, cy2 + 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx2 - 14, cy2); ctx.lineTo(cx2 + 14, cy2); ctx.stroke();
        ctx.fillStyle = '#ef4444'; ctx.font = 'bold 8px monospace';
        ctx.fillText('N', cx2 - 3, cy2 - 16);
    }, [structure, selectedIds, viewMode, zoom, pan]);
};

// ============================================================================
// 3D RENDERER (Three.js)
// ============================================================================

const CONN_COLOR_MAP = { base_plate: 0xb45309, bolted_end_plate: 0x3b82f6, welded_moment: 0xf59e0b, gusset_plate: 0x22c55e, haunch: 0xef4444, pinned: 0x7c3aed };

const build3DScene = (structure, scene, selectedIds) => {
    // Clear existing objects (keep lights/camera helpers)
    const toRemove = [];
    scene.children.forEach(c => { if (c.userData.isBIM) toRemove.push(c); });
    toRemove.forEach(c => { scene.remove(c); c.geometry?.dispose(); c.material?.dispose(); });

    if (!structure) return;

    // Draw members as tubes/cylinders
    structure.members.forEach(mem => {
        if (!mem.visible) return;
        const s = new THREE.Vector3(mem.start.x, mem.start.z, -mem.start.y);
        const e = new THREE.Vector3(mem.end.x, mem.end.z, -mem.end.y);
        const dir = new THREE.Vector3().subVectors(e, s);
        const len = dir.length();
        if (len < 0.01) return;

        const color = parseInt(rc(mem.role).replace('#', ''), 16);
        const isSelected = selectedIds.includes(mem.id);

        const r = { column: 0.15, rafter: 0.12, haunch: 0.18, 'truss-top': 0.08, 'truss-bottom': 0.08, vertical: 0.06, diagonal: 0.04, leg: 0.1, ring: 0.06, 'x-brace': 0.04, 'floor-beam': 0.1, purlin: 0.05, bracing: 0.04, 'dome-rib': 0.07, 'dome-ring': 0.05 }[mem.role] || 0.06;

        const geo = new THREE.CylinderGeometry(r, r, len, 8);
        const mat = new THREE.MeshPhongMaterial({
            color: isSelected ? 0xffffff : color,
            emissive: isSelected ? color : 0x000000,
            emissiveIntensity: isSelected ? 0.4 : 0,
            shininess: 80,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.userData = { isBIM: true, memberId: mem.id, type: 'member' };

        const mid3 = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5);
        mesh.position.copy(mid3);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
        scene.add(mesh);

        // End caps (joint plates)
        if (['column', 'rafter', 'haunch', 'truss-top', 'truss-bottom', 'leg', 'floor-beam'].includes(mem.role)) {
            const capGeo = new THREE.CylinderGeometry(r * 1.8, r * 1.8, 0.02, 8);
            const capMat = new THREE.MeshPhongMaterial({ color: 0x94a3b8 });
            [s, e].forEach(pos => {
                const cap = new THREE.Mesh(capGeo, capMat);
                cap.userData = { isBIM: true };
                cap.position.copy(pos);
                cap.quaternion.copy(mesh.quaternion);
                scene.add(cap);
            });
        }
    });

    // Draw connections as 3D objects
    structure.connections.forEach(conn => {
        const p = new THREE.Vector3(conn.position.x, conn.position.z, -conn.position.y);
        const isSelected = selectedIds.includes(conn.id);
        const color = isSelected ? 0xffffff : (CONN_COLOR_MAP[conn.type] || 0x94a3b8);

        if (conn.type === 'base_plate' || conn.type === 'bolted_end_plate' || conn.type === 'haunch') {
            const pw = conn.plateW / 1000, ph2 = conn.plateH / 1000, pt = conn.plateT / 1000;
            const geo = new THREE.BoxGeometry(pw, pt, ph2);
            const mat = new THREE.MeshPhongMaterial({ color, transparent: true, opacity: 0.85 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData = { isBIM: true, connId: conn.id, type: 'connection' };
            mesh.position.copy(p);
            if (conn.type === 'base_plate') mesh.position.y -= pt / 2;
            scene.add(mesh);

            // Bolts
            const edgeD = conn.boltDia * 2.5 / 1000;
            const spX = conn.boltCols > 1 ? (pw - 2 * edgeD) / (conn.boltCols - 1) : 0;
            const spZ = conn.boltRows > 1 ? (ph2 - 2 * edgeD) / (conn.boltRows - 1) : 0;
            for (let r = 0; r < conn.boltRows; r++) for (let cc = 0; cc < conn.boltCols; cc++) {
                const bx = -pw / 2 + edgeD + cc * spX;
                const bz = -ph2 / 2 + edgeD + r * spZ;
                const boltH = conn.type === 'base_plate' ? conn.anchorEmbedment / 1000 * 0.3 : pt * 2;
                const bGeo = new THREE.CylinderGeometry(conn.boltDia / 2000, conn.boltDia / 2000, boltH, 6);
                const bMat = new THREE.MeshPhongMaterial({ color: 0x6b7280 });
                const bolt = new THREE.Mesh(bGeo, bMat);
                bolt.userData = { isBIM: true };
                bolt.position.set(p.x + bx, p.y - boltH / 2, p.z + bz);
                scene.add(bolt);
            }

            // Stiffeners
            if (conn.hasStiffeners) {
                const stGeo = new THREE.BoxGeometry(pw * 0.1, pt * 3, ph2 * 0.45);
                const stMat = new THREE.MeshPhongMaterial({ color: 0xa78bfa });
                [-1, 1].forEach(side => {
                    const st = new THREE.Mesh(stGeo, stMat);
                    st.userData = { isBIM: true };
                    st.position.set(p.x + side * pw * 0.35, p.y + pt * 1.5, p.z);
                    scene.add(st);
                });
            }

            // Grout (base plate only)
            if (conn.type === 'base_plate') {
                const grGeo = new THREE.BoxGeometry(pw + 0.04, conn.groutThickness / 1000, ph2 + 0.04);
                const grMat = new THREE.MeshPhongMaterial({ color: 0xd97706, transparent: true, opacity: 0.5 });
                const gr = new THREE.Mesh(grGeo, grMat);
                gr.userData = { isBIM: true };
                gr.position.set(p.x, p.y - pt - conn.groutThickness / 2000, p.z);
                scene.add(gr);
            }
        }

        if (conn.type === 'welded_moment') {
            const wGeo = new THREE.TorusGeometry(0.2, 0.02, 8, 16);
            const wMat = new THREE.MeshPhongMaterial({ color: 0xfde68a });
            const w = new THREE.Mesh(wGeo, wMat);
            w.userData = { isBIM: true, connId: conn.id, type: 'connection' };
            w.position.copy(p);
            scene.add(w);
        }

        if (conn.type === 'pinned') {
            const pGeo = new THREE.CylinderGeometry(conn.boltDia / 2000 * 2, conn.boltDia / 2000 * 2, 0.3, 12);
            const pMat = new THREE.MeshPhongMaterial({ color: 0x7c3aed });
            const pm = new THREE.Mesh(pGeo, pMat);
            pm.userData = { isBIM: true, connId: conn.id, type: 'connection' };
            pm.position.copy(p);
            pm.rotation.z = Math.PI / 2;
            scene.add(pm);
        }

        if (conn.type === 'gusset_plate') {
            const pw = conn.plateW / 1000, ph2 = conn.plateH / 1000, pt = conn.plateT / 1000;
            const gGeo = new THREE.BoxGeometry(pw, pt, ph2);
            const gMat = new THREE.MeshPhongMaterial({ color: 0x22c55e, transparent: true, opacity: 0.8 });
            const gm = new THREE.Mesh(gGeo, gMat);
            gm.userData = { isBIM: true, connId: conn.id, type: 'connection' };
            gm.position.copy(p);
            scene.add(gm);
        }
    });

    // Grid
    const grid = new THREE.GridHelper(100, 50, 0xd1d5db, 0xe5e7eb);
    grid.userData = { isBIM: true };
    scene.add(grid);
};

const ThreeDView = ({ structure, selectedIds, onSelect }) => {
    const mountRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const frameRef = useRef(null);
    const mouseRef = useRef({ down: false, last: { x: 0, y: 0 }, button: 0 });
    const camStateRef = useRef({ theta: 0.5, phi: 0.8, dist: 50, target: { x: 0, y: 0, z: 0 } });

    useEffect(() => {
        const el2 = mountRef.current;
        if (!el2) return;
        const W = el2.clientWidth, H = el2.clientHeight;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf1f5f9);
        scene.fog = new THREE.FogExp2(0xf1f5f9, 0.005);
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 1000);
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(W, H);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        el2.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Lights
        scene.add(new THREE.AmbientLight(0x1e293b, 1));
        const dir = new THREE.DirectionalLight(0xffffff, 1.5);
        dir.position.set(30, 50, 20); dir.castShadow = true; scene.add(dir);
        const pt = new THREE.PointLight(0x4a9eff, 0.8, 200);
        pt.position.set(-20, 30, 0); scene.add(pt);

        const updateCamera = () => {
            const { theta, phi, dist, target } = camStateRef.current;
            camera.position.x = target.x + dist * Math.sin(phi) * Math.cos(theta);
            camera.position.y = target.y + dist * Math.cos(phi);
            camera.position.z = target.z + dist * Math.sin(phi) * Math.sin(theta);
            camera.lookAt(target.x, target.y, target.z);
        };
        updateCamera();

        const animate = () => {
            frameRef.current = requestAnimationFrame(animate);
            renderer.render(scene, camera);
        };
        animate();

        const handleResize = () => {
            const W2 = el2.clientWidth, H2 = el2.clientHeight;
            camera.aspect = W2 / H2; camera.updateProjectionMatrix();
            renderer.setSize(W2, H2);
        };
        window.addEventListener('resize', handleResize);

        const handleMouseDown = (e) => {
            mouseRef.current = { down: true, last: { x: e.clientX, y: e.clientY }, button: e.button };
        };
        const handleMouseMove = (e) => {
            if (!mouseRef.current.down) return;
            const dx = e.clientX - mouseRef.current.last.x, dy = e.clientY - mouseRef.current.last.y;
            const cs = camStateRef.current;
            if (mouseRef.current.button === 0) { // rotate
                cs.theta -= dx * 0.01; cs.phi = Math.max(0.1, Math.min(Math.PI - 0.1, cs.phi + dy * 0.01));
            } else if (mouseRef.current.button === 2) { // pan
                const panSpeed = cs.dist * 0.002;
                cs.target.x -= dx * panSpeed; cs.target.y += dy * panSpeed;
            }
            mouseRef.current.last = { x: e.clientX, y: e.clientY };
            updateCamera();
        };
        const handleMouseUp = (e) => { mouseRef.current.down = false; };
        const handleWheel = (e) => {
            camStateRef.current.dist = Math.max(2, Math.min(200, camStateRef.current.dist + e.deltaY * 0.05));
            updateCamera(); e.preventDefault();
        };
        const handleClick = (e) => {
            if (Math.abs(e.clientX - mouseRef.current.last.x) > 5) return;
            const rect = renderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            const hits = raycaster.intersectObjects(scene.children.filter(c => c.userData.isBIM && (c.userData.memberId || c.userData.connId)));
            if (hits.length) {
                const hit = hits[0].object.userData;
                onSelect(hit.memberId || hit.connId);
            } else {
                onSelect(null);
            }
        };

        el2.addEventListener('mousedown', handleMouseDown);
        el2.addEventListener('mousemove', handleMouseMove);
        el2.addEventListener('mouseup', handleMouseUp);
        el2.addEventListener('wheel', handleWheel, { passive: false });
        el2.addEventListener('click', handleClick);
        el2.addEventListener('contextmenu', e => e.preventDefault());

        return () => {
            cancelAnimationFrame(frameRef.current);
            renderer.dispose();
            el2.removeChild(renderer.domElement);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => {
        if (sceneRef.current) build3DScene(structure, sceneRef.current, selectedIds);
    }, [structure, selectedIds]);

    return <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        <div style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 9, color: '#475569', fontFamily: 'monospace', background: '#0a0f1ecc', padding: '4px 8px', borderRadius: 4 }}>
            LMB: Rotate • RMB: Pan • Scroll: Zoom • Click: Select
        </div>
    </div>;
};

// ============================================================================
// INSPECTOR PANEL
// ============================================================================

const Inspector = ({ item, allStructure, onChange }) => {
    if (!item) return (
        <div style={{ padding: 16, color: '#334155', fontSize: 11, textAlign: 'center', marginTop: 40 }}>
            <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>◈</div>
            Click any member or connection to inspect
        </div>
    );

    const isMember = !!item.start;
    const iConn = !isMember;

    const SECTIONS = ['UB 203x133x25', 'UB 254x146x37', 'UB 305x165x54', 'UB 356x171x67', 'UB 406x178x74', 'UB 457x191x89', 'UC 152x152x37', 'UC 203x203x46', 'UC 254x254x73', 'UC 305x305x97', 'SHS 100x100x6', 'SHS 150x150x8', 'SHS 200x200x10', 'CHS 114.3x5', 'CHS 168.3x6.3', 'CHS 219.1x8', 'L 100x100x10', 'L 150x150x12'];

    const field = (label, key, type = 'text', opts) => {
        const val = isMember ? item[key] : item[key];
        return (
            <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: '#475569', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                {type === 'select' ? (
                    <select value={val || ''} onChange={e => onChange(item.id, key, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                        style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '4px 6px', color: '#1e293b', fontSize: 10, fontFamily: 'monospace' }}>
                        {opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                ) : (
                    <input type={type} value={val || ''} onChange={e => onChange(item.id, key, type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                        style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '4px 6px', color: '#1e293b', fontSize: 10, fontFamily: 'monospace', boxSizing: 'border-box' }} />
                )}
            </div>
        );
    };

    const colorBar = (color) => <div style={{ display: 'inline-block', width: 12, height: 12, background: color, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />;

    return (
        <div style={{ padding: 12, fontSize: 10, overflowY: 'auto', flex: 1 }}>
            <div style={{ background: (isMember ? rc(item.role) : '#b45309') + '22', border: `1px solid ${isMember ? rc(item.role) : '#b45309'}44`, borderRadius: 6, padding: '10px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', marginBottom: 2 }}>{item.label || item.id}</div>
                <div style={{ fontSize: 9, color: '#64748b' }}>{isMember ? `${item.type} · ${item.role}` : `Connection · ${item.type}`}</div>
                {isMember && <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>L = {(item.length || 0).toFixed(3)} m</div>}
            </div>

            {isMember && <>
                {field('Section', 'section', 'select', SECTIONS)}
                {field('Label', 'label')}
                {field('Layer', 'layer', 'select', ['STRUCTURE', 'TRUSS', 'PORTAL', 'BRIDGE', 'TOWER', 'DOME', 'SECONDARY', 'SUPPORT', 'CRANE'])}
                <div style={{ fontSize: 9, color: '#475569', letterSpacing: '0.1em', marginTop: 10, marginBottom: 6 }}>GEOMETRY</div>
                {[['Start X', 'start.x'], ['Start Y', 'start.y'], ['Start Z', 'start.z'], ['End X', 'end.x'], ['End Y', 'end.y'], ['End Z', 'end.z']].map(([lbl, k]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 9 }}>
                        <span style={{ color: '#475569' }}>{lbl}</span>
                        <input type='number' step='0.1' defaultValue={(k.split('.').reduce((o, p) => o?.[p], item) || 0).toFixed(3)}
                            onBlur={e => onChange(item.id, k, parseFloat(e.target.value))}
                            style={{ width: 70, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, padding: '2px 4px', color: '#1e293b', fontSize: 9, fontFamily: 'monospace', textAlign: 'right' }} />
                    </div>
                ))}
                <div style={{ fontSize: 9, color: '#475569', marginTop: 8 }}>Role: {colorBar(rc(item.role))}{item.role}</div>
            </>}

            {iConn && <>
                <div style={{ fontSize: 9, color: '#475569', letterSpacing: '0.1em', marginBottom: 8 }}>CONNECTION DETAILS</div>
                {field('Label', 'label')}
                {[
                    ['Plate Width (mm)', 'plateW', 'number'], ['Plate Height (mm)', 'plateH', 'number'], ['Plate Thick. (mm)', 'plateT', 'number'],
                    ['Bolt Rows', 'boltRows', 'number'], ['Bolt Cols', 'boltCols', 'number'], ['Bolt Dia. (mm)', 'boltDia', 'number'],
                    ['Weld Size (mm)', 'weldSize', 'number'],
                ].map(([lbl, k, t]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 9 }}>
                        <span style={{ color: '#475569' }}>{lbl}</span>
                        <input type={t || 'text'} step='1' defaultValue={item[k] || 0}
                            onBlur={e => onChange(item.id, k, t === 'number' ? parseFloat(e.target.value) : e.target.value)}
                            style={{ width: 70, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 3, padding: '2px 4px', color: '#1e293b', fontSize: 9, fontFamily: 'monospace', textAlign: 'right' }} />
                    </div>
                ))}
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, color: '#64748b' }}>
                    <input type='checkbox' checked={!!item.hasStiffeners} onChange={e => onChange(item.id, 'hasStiffeners', e.target.checked)} style={{ accentColor: '#f97316' }} />
                    Has Stiffener Plates
                </div>
                {item.type === 'base_plate' && <>
                    <div style={{ fontSize: 9, color: '#475569', letterSpacing: '0.1em', marginTop: 10, marginBottom: 6 }}>ANCHOR BOLTS</div>
                    {[['Anchor Dia. (mm)', 'anchorDia', 'number'], ['Embedment (mm)', 'anchorEmbedment', 'number'], ['Grout (mm)', 'groutThickness', 'number']].map(([lbl, k, t]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 9 }}>
                            <span style={{ color: '#475569' }}>{lbl}</span>
                            <input type={t} step='1' defaultValue={item[k] || 0}
                                onBlur={e => onChange(item.id, k, parseFloat(e.target.value))}
                                style={{ width: 70, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 3, padding: '2px 4px', color: '#94a3b8', fontSize: 9, fontFamily: 'monospace', textAlign: 'right' }} />
                        </div>
                    ))}
                </>}
            </>}
        </div>
    );
};

// ============================================================================
// MAIN APP
// ============================================================================

const CAT_ICONS = { trusses: '△', portals: '⌐', bridges: '═', towers: '◈', domes: '◯' };
const CAT_COLORS = { trusses: '#f97316', portals: '#3b82f6', bridges: '#22c55e', towers: '#a855f7', domes: '#38bdf8' };

export default function SteelBIM({ embedded = false, onElementsGenerated }) {
    const [activeCategory, setActiveCategory] = useState('trusses');
    const [activeStructure, setActiveStructure] = useState(null);
    const [structure, setStructure] = useState(null);
    const [selectedIds, setSelectedIds] = useState([]);
    const [viewMode, setViewMode] = useState('front');
    const [view3D, setView3D] = useState(false);
    const [splitView, setSplitView] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [layers, setLayers] = useState({ STRUCTURE: true, TRUSS: true, PORTAL: true, BRIDGE: true, TOWER: true, DOME: true, SECONDARY: true, SUPPORT: true, CRANE: true });
    const canvasRef = useRef(null);
    const isDragging = useRef(false);
    const lastMouse = useRef({ x: 0, y: 0 });
    const [showConnections, setShowConnections] = useState(true);

    const regEntry = useMemo(() => activeStructure ? REGISTRY[activeCategory]?.find(r => r.id === activeStructure) : null, [activeCategory, activeStructure]);

    const loadStructure = useCallback((catId, strId) => {
        _id = 1;
        const entry = REGISTRY[catId]?.find(r => r.id === strId);
        if (!entry) return;
        const result = entry.gen({ ...entry.cfg });
        // Apply layer visibility
        result.members.forEach(m => { m.visible = layers[m.layer] !== false; });
        setStructure(result);
        setSelectedIds([]);
        setPan({ x: 0, y: 0 });
        setZoom(1);
    }, [layers]);

    const filteredStructure = useMemo(() => {
        if (!structure) return null;
        return {
            ...structure,
            members: structure.members.filter(m => layers[m.layer] !== false),
            connections: showConnections ? structure.connections : [],
        };
    }, [structure, layers, showConnections]);

    useCanvasRenderer(canvasRef, filteredStructure, selectedIds, viewMode, zoom, pan);

    const handleCanvasMouseDown = (e) => {
        isDragging.current = false;
        lastMouse.current = { x: e.clientX, y: e.clientY };
    };
    const handleCanvasMouseMove = (e) => {
        if (e.buttons === 1) {
            isDragging.current = true;
            setPan(p => ({ x: p.x + (e.clientX - lastMouse.current.x), y: p.y + (e.clientY - lastMouse.current.y) }));
            lastMouse.current = { x: e.clientX, y: e.clientY };
        }
    };
    const handleCanvasClick = (e) => {
        if (isDragging.current) return;
        const canvas = canvasRef.current;
        if (!filteredStructure || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const my = (e.clientY - rect.top) * (canvas.height / rect.height);
        const W = canvas.width, H = canvas.height;

        const proj = (pt) => {
            if (viewMode === 'plan') return { x: pt.x, y: pt.y };
            if (viewMode === 'side') return { x: pt.y, y: -pt.z };
            if (viewMode === 'iso') { return { x: pt.x - pt.y * 0.5, y: -pt.z - (pt.x + pt.y) * 0.2 }; }
            return { x: pt.x, y: -pt.z };
        };

        const allPts = filteredStructure.members.flatMap(m => [m.start, m.end]);
        if (!allPts.length) return;
        const projPts = allPts.map(proj);
        const minX = Math.min(...projPts.map(p => p.x)), maxX = Math.max(...projPts.map(p => p.x));
        const minY = Math.min(...projPts.map(p => p.y)), maxY = Math.max(...projPts.map(p => p.y));
        const rangeX = (maxX - minX) || 1, rangeY = (maxY - minY) || 1;
        const PAD = 70, baseScale = Math.min((W - PAD * 2) / rangeX, (H - PAD * 2) / rangeY);
        const sc = baseScale * zoom;
        const offX = pan.x + W / 2 - (minX + rangeX / 2) * sc, offY = pan.y + H / 2 - (minY + rangeY / 2) * sc;
        const tx = x => x * sc + offX, ty = y => y * sc + offY;

        let closest = null, minDist = 14;
        // Check members
        filteredStructure.members.forEach(mem => {
            const ps = proj(mem.start), pe = proj(mem.end);
            const x1 = tx(ps.x), y1 = ty(ps.y), x2 = tx(pe.x), y2 = ty(pe.y);
            const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
            if (!len2) return;
            const t = Math.max(0, Math.min(1, ((mx - x1) * dx + (my - y1) * dy) / len2));
            const d = Math.hypot(mx - x1 - t * dx, my - y1 - t * dy);
            if (d < minDist) { minDist = d; closest = { id: mem.id, obj: mem }; }
        });
        // Check connections
        filteredStructure.connections.forEach(conn => {
            const pp = proj(conn.position);
            const d = Math.hypot(mx - tx(pp.x), my - ty(pp.y));
            if (d < 20 && d < minDist) { minDist = d; closest = { id: conn.id, obj: conn }; }
        });

        if (closest) {
            setSelectedIds(prev => e.shiftKey ? (prev.includes(closest.id) ? prev.filter(x => x !== closest.id) : [...prev, closest.id]) : [closest.id]);
        } else {
            setSelectedIds([]);
        }
    };

    const selectedItem = useMemo(() => {
        if (!selectedIds.length || !structure) return null;
        const id = selectedIds[0];
        return structure.members.find(m => m.id === id) || structure.connections.find(c => c.id === id);
    }, [selectedIds, structure]);

    const handleChange = (id, key, value) => {
        setStructure(prev => {
            if (!prev) return prev;
            const updMembers = prev.members.map(m => {
                if (m.id !== id) return m;
                const updated = { ...m };
                if (key.includes('.')) { const [a, b] = key.split('.'); updated[a] = { ...updated[a], [b]: value }; }
                else updated[key] = value;
                if (key.startsWith('start') || key.startsWith('end')) updated.length = vlen(vsub(updated.end, updated.start));
                return updated;
            });
            const updConns = prev.connections.map(c => {
                if (c.id !== id) return c;
                return { ...c, [key]: value };
            });
            return { ...prev, members: updMembers, connections: updConns };
        });
    };

    const handleSelect3D = (id) => {
        if (!id) { setSelectedIds([]); return; }
        setSelectedIds([id]);
    };

    const stats = useMemo(() => {
        if (!structure) return {};
        const totalLen = structure.members.reduce((s, m) => s + (m.length || 0), 0);
        const roles = [...new Set(structure.members.map(m => m.role))];
        const connTypes = [...new Set(structure.connections.map(c => c.type))];
        return { totalLen, roles, connTypes, members: structure.members.length, conns: structure.connections.length };
    }, [structure]);

    const accentColor = CAT_COLORS[activeCategory];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc', color: '#1e293b', fontFamily: "'JetBrains Mono','Fira Code',monospace", overflow: 'hidden' }}>

            {/* TOP BAR */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #e2e8f0', background: '#ffffff', gap: 12, flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: '#2563eb' }}>STEEL BIM</div>
                <div style={{ fontSize: 9, color: '#94a3b8', letterSpacing: '0.1em' }}>STRUCTURAL VIEWER v3.0</div>
                <div style={{ flex: 1 }} />
                {structure && <div style={{ display: 'flex', gap: 16, fontSize: 10, color: '#475569' }}>
                    <span><span style={{ color: accentColor }}>{stats.members}</span> members</span>
                    <span><span style={{ color: accentColor }}>{stats.conns}</span> connections</span>
                    <span><span style={{ color: accentColor }}>{(stats.totalLen || 0).toFixed(1)}m</span> total length</span>
                </div>}
                {/* View toggles */}
                <div style={{ display: 'flex', gap: 4 }}>
                    {['front', 'plan', 'side', 'iso'].map(v => (
                        <button key={v} onClick={() => setViewMode(v)}
                            style={{ padding: '3px 8px', fontSize: 9, background: viewMode === v ? '#2563eb' : 'transparent', border: `1px solid ${viewMode === v ? '#2563eb' : '#e2e8f0'}`, borderRadius: 3, color: viewMode === v ? '#ffffff' : '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                            {v.toUpperCase()}
                        </button>
                    ))}
                    <div style={{ width: 1, background: '#1e293b', margin: '0 4px' }} />
                    <button onClick={() => setSplitView(!splitView)}
                        style={{ padding: '3px 8px', fontSize: 9, background: splitView ? '#f1f5f9' : 'transparent', border: `1px solid ${splitView ? '#cbd5e1' : '#e2e8f0'}`, borderRadius: 3, color: splitView ? '#1e293b' : '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                        SPLIT
                    </button>
                    <button onClick={() => setView3D(!view3D)}
                        style={{ padding: '3px 8px', fontSize: 9, background: view3D ? accentColor + '33' : 'transparent', border: `1px solid ${view3D ? accentColor + '88' : '#e2e8f0'}`, borderRadius: 3, color: view3D ? '#1e293b' : '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>
                        3D
                    </button>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, color: '#475569' }}>CONNS</span>
                    <div onClick={() => setShowConnections(!showConnections)}
                        style={{ width: 28, height: 14, background: showConnections ? accentColor + '88' : '#1e293b', borderRadius: 7, cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                        <div style={{ position: 'absolute', top: 2, left: showConnections ? 14 : 2, width: 10, height: 10, background: '#f8fafc', borderRadius: '50%', transition: 'left 0.2s' }} />
                    </div>
                </div>
                <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ padding: '3px 8px', fontSize: 9, background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 3, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>⟳ RESET</button>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* SIDEBAR: Categories + Structures */}
                <div style={{ width: 220, background: '#f1f5f9', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
                    {/* Category tabs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 8px 4px' }}>
                        {Object.entries(REGISTRY).map(([cat, items]) => (
                            <button key={cat} onClick={() => setActiveCategory(cat)}
                                style={{ textAlign: 'left', background: activeCategory === cat ? CAT_COLORS[cat] + '22' : 'transparent', border: `1px solid ${activeCategory === cat ? CAT_COLORS[cat] + '66' : 'transparent'}`, borderRadius: 5, padding: '6px 8px', cursor: 'pointer', color: activeCategory === cat ? '#f8fafc' : '#475569', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                                <span style={{ color: CAT_COLORS[cat], fontSize: 14 }}>{CAT_ICONS[cat]}</span>
                                <span style={{ letterSpacing: '0.05em', fontFamily: 'inherit' }}>{cat.toUpperCase()}</span>
                                <span style={{ marginLeft: 'auto', fontSize: 9, color: CAT_COLORS[cat], opacity: 0.7 }}>{items.length}</span>
                            </button>
                        ))}
                    </div>

                    {/* Structure list */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 8px' }}>
                        <div style={{ fontSize: 8, color: '#334155', letterSpacing: '0.15em', padding: '6px 4px 4px' }}>STRUCTURES</div>
                        {REGISTRY[activeCategory]?.map(entry => (
                            <button key={entry.id}
                                onClick={() => { setActiveStructure(entry.id); loadStructure(activeCategory, entry.id); }}
                                style={{ width: '100%', textAlign: 'left', background: activeStructure === entry.id ? CAT_COLORS[activeCategory] + '22' : 'transparent', border: `1px solid ${activeStructure === entry.id ? CAT_COLORS[activeCategory] + '55' : '#0f172a'}`, borderRadius: 4, padding: '7px 8px', marginBottom: 3, cursor: 'pointer', color: activeStructure === entry.id ? '#f8fafc' : '#64748b', fontSize: 9, fontFamily: 'inherit', letterSpacing: '0.03em', transition: 'all 0.1s', lineHeight: 1.4 }}>
                                {entry.label}
                            </button>
                        ))}
                    </div>

                    {/* Layer controls */}
                    <div style={{ borderTop: '1px solid #1e293b', padding: '8px' }}>
                        <div style={{ fontSize: 8, color: '#334155', letterSpacing: '0.1em', marginBottom: 6 }}>LAYERS</div>
                        {Object.entries(layers).map(([layer, vis]) => (
                            <div key={layer} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, cursor: 'pointer' }} onClick={() => setLayers(l => ({ ...l, [layer]: !l[layer] }))}>
                                <div style={{ width: 10, height: 10, background: vis ? '#22c55e' : '#334155', borderRadius: 2, flexShrink: 0 }} />
                                <span style={{ fontSize: 8, color: vis ? '#94a3b8' : '#334155', letterSpacing: '0.05em' }}>{layer}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* MAIN VIEWPORT */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {!structure ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                            <div style={{ fontSize: 32, opacity: 0.1 }}>{CAT_ICONS[activeCategory]}</div>
                            <div style={{ fontSize: 11, color: '#334155', letterSpacing: '0.15em' }}>SELECT A STRUCTURE FROM THE PANEL</div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                {REGISTRY[activeCategory]?.slice(0, 3).map(e => (
                                    <button key={e.id} onClick={() => { setActiveStructure(e.id); loadStructure(activeCategory, e.id); }}
                                        style={{ padding: '8px 14px', fontSize: 10, background: CAT_COLORS[activeCategory] + '22', border: `1px solid ${CAT_COLORS[activeCategory]}55`, borderRadius: 5, color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit' }}>
                                        {e.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* 2D Canvas */}
                            <div style={{ flex: splitView && (view3D) ? 1 : 1, position: 'relative', overflow: 'hidden', borderRight: splitView && view3D ? '1px solid #e2e8f0' : 'none', background: '#ffffff' }}
                                onWheel={e => { e.preventDefault(); setZoom(z => Math.max(0.2, Math.min(10, z * (e.deltaY < 0 ? 1.12 : 0.9)))); }}
                            >
                                <canvas ref={canvasRef} width={800} height={600}
                                    style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
                                    onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onClick={handleCanvasClick} />
                                {/* Zoom controls */}
                                <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4 }}>
                                    <button onClick={() => setZoom(z => Math.min(10, z * 1.25))} style={{ width: 24, height: 24, background: '#ffffffcc', border: '1px solid #e2e8f0', borderRadius: 4, color: '#64748b', cursor: 'pointer', fontSize: 14, lineHeight: '22px', textAlign: 'center' }}>+</button>
                                    <button onClick={() => setZoom(z => Math.max(0.1, z * 0.8))} style={{ width: 24, height: 24, background: '#ffffffcc', border: '1px solid #e2e8f0', borderRadius: 4, color: '#64748b', cursor: 'pointer', fontSize: 14, lineHeight: '22px', textAlign: 'center' }}>−</button>
                                    <div style={{ background: '#ffffffcc', border: '1px solid #e2e8f0', borderRadius: 4, padding: '0 8px', fontSize: 9, color: '#64748b', lineHeight: '24px' }}>{(zoom * 100).toFixed(0)}%</div>
                                </div>
                                {/* View label */}
                                <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, color: '#64748b', background: '#ffffffcc', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: 4, letterSpacing: '0.1em' }}>
                                    {viewMode.toUpperCase()} VIEW
                                </div>
                                {/* Role legend */}
                                <div style={{ position: 'absolute', bottom: 8, left: 8, background: '#ffffffcc', border: '1px solid #e2e8f0', borderRadius: 5, padding: '6px 10px' }}>
                                    {[...new Set(structure.members.map(m => m.role))].slice(0, 8).map(role => (
                                        <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                                            <div style={{ width: 14, height: 2, background: rc(role) }} />
                                            <span style={{ fontSize: 7, color: '#64748b', letterSpacing: '0.05em' }}>{role}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 3D View */}
                            {view3D && (
                                <div style={{ flex: splitView ? 1 : 0, minWidth: splitView ? '30%' : 0, overflow: 'hidden', transition: 'flex 0.3s' }}>
                                    <ThreeDView structure={filteredStructure} selectedIds={selectedIds} onSelect={handleSelect3D} />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT INSPECTOR */}
                <div style={{ width: 250, background: '#ffffff', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                    <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 9, letterSpacing: '0.15em', color: '#64748b' }}>INSPECTOR</div>
                    {structure && (
                        <div style={{ padding: '8px 12px', borderBottom: '1px solid #1e293b', fontSize: 9, color: '#64748b' }}>
                            <div style={{ color: accentColor, fontSize: 11, fontWeight: 700, marginBottom: 2 }}>{structure.metadata?.name}</div>
                            <div style={{ color: '#475569', fontSize: 8 }}>{structure.metadata?.type?.toUpperCase()}</div>
                        </div>
                    )}
                    <Inspector item={selectedItem} allStructure={structure} onChange={handleChange} />
                    {selectedItem && (
                        <div style={{ padding: '8px 12px', borderTop: '1px solid #1e293b' }}>
                            <button onClick={() => setSelectedIds([])} style={{ width: '100%', padding: '5px', fontSize: 9, background: 'transparent', border: '1px solid #1e293b', borderRadius: 4, color: '#475569', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em' }}>DESELECT</button>
                        </div>
                    )}
                    {embedded && onElementsGenerated && structure && (
                        <div style={{ padding: '8px 12px', borderTop: '2px solid #1e293b', background: '#0f172a' }}>
                            <button
                                onClick={() => onElementsGenerated(structure.members, structure.connections)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: '#f97316',
                                    border: 'none',
                                    borderRadius: 6,
                                    color: '#fff',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8
                                }}
                            >
                                <span style={{ fontSize: 14 }}>🚀</span> LOAD TO BUILDER
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#f1f5f9;}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:2px;}
        button:hover{opacity:0.85;}
        input[type=number]{-moz-appearance:textfield;}
        input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
        canvas{image-rendering:pixelated;}
      `}</style>
        </div>
    );
}