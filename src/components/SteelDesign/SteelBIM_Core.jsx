// ============================================================================
// STEEL BIM CORE — Data Models, Geometry Engine, Connection Library
// ============================================================================

export const deg2rad = d => d * Math.PI / 180;
export const rad2deg = r => r * 180 / Math.PI;

// ─── Vector Math ────────────────────────────────────────────────────────────
export const v3 = (x, y, z) => ({ x, y, z });
export const vadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const vscale = (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s });
export const vmid = (a, b) => vscale(vadd(a, b), 0.5);
export const vlen = v => Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
export const vnorm = v => { const l = vlen(v) || 1; return vscale(v, 1 / l); };
export const vdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const vcross = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
});

// ─── Section Database ────────────────────────────────────────────────────────
export const SECTIONS = {
    // UB (Universal Beams) - d x bf x mass kg/m
    'UB 203x133x25': { type: 'UB', d: 203, bf: 133, tf: 7.8, tw: 5.7, mass: 25, Ix: 2340, Zx: 230 },
    'UB 254x146x37': { type: 'UB', d: 254, bf: 146, tf: 10.9, tw: 6.3, mass: 37, Ix: 5540, Zx: 436 },
    'UB 305x165x54': { type: 'UB', d: 305, bf: 165, tf: 13.7, tw: 7.9, mass: 54, Ix: 11700, Zx: 768 },
    'UB 356x171x67': { type: 'UB', d: 356, bf: 173, tf: 15.7, tw: 9.1, mass: 67, Ix: 19500, Zx: 1070 },
    'UB 406x178x74': { type: 'UB', d: 406, bf: 179, tf: 16.0, tw: 9.7, mass: 74, Ix: 27300, Zx: 1320 },
    'UB 457x191x89': { type: 'UB', d: 463, bf: 192, tf: 17.7, tw: 10.5, mass: 89, Ix: 41000, Zx: 1770 },
    'UB 533x210x109': { type: 'UB', d: 539, bf: 211, tf: 18.8, tw: 11.6, mass: 109, Ix: 66800, Zx: 2480 },
    // UC (Universal Columns)
    'UC 152x152x37': { type: 'UC', d: 161, bf: 154, tf: 11.5, tw: 8.0, mass: 37, Ix: 2210, Zx: 275 },
    'UC 203x203x46': { type: 'UC', d: 203, bf: 203, tf: 11.0, tw: 7.2, mass: 46, Ix: 4570, Zx: 450 },
    'UC 254x254x73': { type: 'UC', d: 254, bf: 255, tf: 14.2, tw: 8.6, mass: 73, Ix: 11400, Zx: 898 },
    'UC 305x305x97': { type: 'UC', d: 308, bf: 305, tf: 15.4, tw: 9.9, mass: 97, Ix: 22300, Zx: 1440 },
    'UC 356x368x129': { type: 'UC', d: 355, bf: 369, tf: 17.5, tw: 10.4, mass: 129, Ix: 40200, Zx: 2260 },
    // SHS (Square Hollow Section)
    'SHS 100x100x6': { type: 'SHS', d: 100, b: 100, t: 6, mass: 17.0 },
    'SHS 150x150x8': { type: 'SHS', d: 150, b: 150, t: 8, mass: 34.0 },
    'SHS 200x200x10': { type: 'SHS', d: 200, b: 200, t: 10, mass: 57.0 },
    // CHS (Circular Hollow Section)
    'CHS 114.3x5': { type: 'CHS', od: 114.3, t: 5, mass: 13.5 },
    'CHS 168.3x6.3': { type: 'CHS', od: 168.3, t: 6.3, mass: 25.2 },
    'CHS 219.1x8': { type: 'CHS', od: 219.1, t: 8, mass: 41.6 },
    'CHS 273x10': { type: 'CHS', od: 273, t: 10, mass: 64.9 },
    // Angles
    'L 100x100x10': { type: 'L', a: 100, b: 100, t: 10, mass: 14.9 },
    'L 150x150x12': { type: 'L', a: 150, b: 150, t: 12, mass: 27.3 },
};

// ─── Material Database ───────────────────────────────────────────────────────
export const MATERIALS = {
    'S275': { fy: 275, fu: 430, E: 210000, color: '#7090b8' },
    'S355': { fy: 355, fu: 510, E: 210000, color: '#4a7ab5' },
    'S420': { fy: 420, fu: 520, E: 210000, color: '#3568a0' },
    'Grade 4.6 Bolt': { fy: 240, fu: 400, color: '#a0a0a0' },
    'Grade 8.8 Bolt': { fy: 640, fu: 800, color: '#606060' },
    'Grade 10.9 Bolt': { fy: 900, fu: 1000, color: '#404040' },
};

// ─── Connection Types ────────────────────────────────────────────────────────
export const CONNECTION_TYPES = {
    WELDED_MOMENT: 'welded_moment',
    BOLTED_END_PLATE: 'bolted_end_plate',
    BOLTED_CLEAT: 'bolted_cleat',
    BASE_PLATE: 'base_plate',
    GUSSET_PLATE: 'gusset_plate',
    PINNED: 'pinned',
    SPLICE: 'splice',
    HAUNCH: 'haunch',
};

// ─── Core Element Class ──────────────────────────────────────────────────────
export class SteelElement {
    constructor(id, type, start, end, opts = {}) {
        this.id = id;
        this.type = type; // 'member' | 'plate' | 'bolt' | 'weld' | 'foundation'
        this.start = start; // {x,y,z}
        this.end = end;
        this.section = opts.section || 'UB 305x165x54';
        this.material = opts.material || 'S355';
        this.role = opts.role || 'beam';
        this.label = opts.label || id;
        this.layer = opts.layer || 'STRUCTURE';
        this.selected = false;
        this.visible = true;
        this.color = opts.color || null; // null = use role color
        this.frameId = opts.frameId || null;
        this.panelIdx = opts.panelIdx || 0;
        this.meta = opts.meta || {};
        // Derived
        this.length = vlen(vsub(end, start));
        this.midpoint = vmid(start, end);
        // Local axes
        const dir = vnorm(vsub(end, start));
        this.localX = dir;
        this.localY = { x: 0, y: 0, z: 1 }; // up by default
        this.localZ = vnorm(vcross(dir, { x: 0, y: 0, z: 1 }));
    }
    getSection() { return SECTIONS[this.section] || null; }
}

// ─── Connection Class ────────────────────────────────────────────────────────
export class Connection {
    constructor(id, type, position, members, opts = {}) {
        this.id = id;
        this.type = type; // CONNECTION_TYPES.*
        this.position = position;
        this.members = members; // array of element IDs
        this.selected = false;
        this.visible = true;
        // Geometry details
        this.plateW = opts.plateW || 200; // mm
        this.plateH = opts.plateH || 300; // mm
        this.plateT = opts.plateT || 20;  // mm
        this.boltRows = opts.boltRows || 2;
        this.boltCols = opts.boltCols || 2;
        this.boltDia = opts.boltDia || 20;  // mm
        this.boltGrade = opts.boltGrade || 'Grade 8.8 Bolt';
        this.weldSize = opts.weldSize || 8;   // mm fillet
        this.weldType = opts.weldType || 'fillet'; // 'fillet' | 'butt' | 'groove'
        this.label = opts.label || `${type.toUpperCase()}-${id}`;
        this.meta = opts.meta || {};
        // Anchor bolt specific
        this.anchorDia = opts.anchorDia || 24;
        this.anchorEmbedment = opts.anchorEmbedment || 500; // mm
        this.groutThickness = opts.groutThickness || 30;  // mm
        // Stiffeners
        this.hasStiffeners = opts.hasStiffeners || false;
        this.stiffenerT = opts.stiffenerT || 12;  // mm
    }
}

// ─── Role → Drawing Style ────────────────────────────────────────────────────
export const ROLE_COLORS = {
    'column': '#4a9eff',
    'rafter': '#ff8c42',
    'beam': '#ffcc44',
    'truss-top': '#ff6b6b',
    'truss-bottom': '#ffa552',
    'vertical': '#94a3b8',
    'diagonal': '#64748b',
    'purlin': '#4fd1c7',
    'bracing': '#a78bfa',
    'leg': '#c084fc',
    'x-brace': '#7c3aed',
    'ring': '#e879f9',
    'floor-beam': '#4ade80',
    'stringer': '#86efac',
    'deck': '#bbf7d0',
    'dome-rib': '#38bdf8',
    'dome-ring': '#0ea5e9',
    'north-rafter': '#60a5fa',
    'south-rafter': '#f59e0b',
    'haunch': '#ef4444',
    'plate': '#cbd5e1',
    'bolt': '#94a3b8',
    'weld': '#fde68a',
    'foundation': '#b45309',
    'anchor': '#92400e',
    'grout': '#d97706',
    'generic': '#94a3b8',
};

export const getRoleColor = (role) => ROLE_COLORS[role] || ROLE_COLORS['generic'];

// ─── Section Profile Points (for 2D cross-section drawing) ──────────────────
export const getSectionProfile = (sectionName, scale = 1) => {
    const sec = SECTIONS[sectionName];
    if (!sec) return [];
    const s = scale / 1000; // convert mm to m then scale

    if (sec.type === 'UB' || sec.type === 'UC') {
        const d = sec.d * s / 2, bf = sec.bf * s / 2;
        const tf = sec.tf * s, tw = sec.tw * s / 2;
        // I-section profile points (closed polygon)
        return [
            [-bf, -d], [bf, -d], [bf, -d + tf], [tw, -d + tf],
            [tw, d - tf], [bf, d - tf], [bf, d], [-bf, d],
            [-bf, d - tf], [-tw, d - tf], [-tw, -d + tf], [-bf, -d + tf]
        ];
    }
    if (sec.type === 'SHS') {
        const d = sec.d * s / 2, t = sec.t * s;
        return [[-d, -d], [d, -d], [d, d], [-d, d], [-d, -d],
        [-(d - t), -(d - t)], [-(d - t), (d - t)], [(d - t), (d - t)], [(d - t), -(d - t)], [-(d - t), -(d - t)]];
    }
    if (sec.type === 'CHS') {
        const r = sec.od * s / 2, ri = (sec.od - 2 * sec.t) * s / 2;
        const pts = [];
        for (let a = 0; a <= 360; a += 15) pts.push([r * Math.cos(deg2rad(a)), r * Math.sin(deg2rad(a))]);
        for (let a = 360; a >= 0; a -= 15) pts.push([ri * Math.cos(deg2rad(a)), ri * Math.sin(deg2rad(a))]);
        return pts;
    }
    return [[-0.05, -0.05], [0.05, -0.05], [0.05, 0.05], [-0.05, 0.05]];
};

// ─── Bolt Circle Pattern ─────────────────────────────────────────────────────
export const getBoltPattern = (conn) => {
    const { boltRows, boltCols, boltDia, plateW, plateH } = conn;
    const bolts = [];
    const edgeDist = boltDia * 2.5 / 1000; // m
    const spaceX = boltCols > 1 ? (plateW / 1000 - 2 * edgeDist) / (boltCols - 1) : 0;
    const spaceY = boltRows > 1 ? (plateH / 1000 - 2 * edgeDist) / (boltRows - 1) : 0;
    for (let r = 0; r < boltRows; r++) {
        for (let c = 0; c < boltCols; c++) {
            bolts.push({
                dx: -plateW / 2000 + edgeDist + c * spaceX,
                dy: -plateH / 2000 + edgeDist + r * spaceY,
                dia: boltDia / 1000,
            });
        }
    }
    return bolts;
};