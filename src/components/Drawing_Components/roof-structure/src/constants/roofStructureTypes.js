// ─────────────────────────────────────────────────────────────
//  roofStructureTypes.js
//  All structural type definitions, node topology tables,
//  member schedules, and material configs.
// ─────────────────────────────────────────────────────────────

export const DEG = Math.PI / 180;

// ── Truss type catalogue ──────────────────────────────────────
export const TRUSS_TYPES = [
  { id: 'king',    label: 'King Post',   ico: '△', maxSpan: 6,  minSpan: 3 },
  { id: 'queen',   label: 'Queen Post',  ico: '⊓', maxSpan: 9,  minSpan: 5 },
  { id: 'howe',    label: 'Howe',        ico: '⊼', maxSpan: 12, minSpan: 7 },
  { id: 'pratt',   label: 'Pratt',       ico: '⊻', maxSpan: 14, minSpan: 9 },
  { id: 'fan',     label: 'Fan',         ico: '⋀', maxSpan: 20, minSpan: 10 },
  { id: 'attic',   label: 'Attic',       ico: '⌂', maxSpan: 12, minSpan: 6 },
  { id: 'mono',    label: 'Mono',        ico: '◺', maxSpan: 8,  minSpan: 2 },
];

export const RAFTER_SUBTYPES = [
  { id: 'common',  label: 'Common',   ico: '╱' },
  { id: 'hip',     label: 'Hip',      ico: '◇' },
  { id: 'valley',  label: 'Valley',   ico: '▽' },
];

export const PORTAL_SUBTYPES = [
  { id: 'pinned',  label: 'Pinned base', ico: '△' },
  { id: 'fixed',   label: 'Fixed base',  ico: '▭' },
];

// ── Visibility toggle keys ────────────────────────────────────
export const VIS_KEYS = {
  chords:  'Chords / top chord',
  webs:    'Web members',
  rafters: 'Common rafters',
  purlins: 'Purlins',
  collar:  'Collar ties',
  bracing: 'Wind bracing',
  gussets: 'Gusset plates',
};

// ── Member colour map (for 2D diagrams & legend) ──────────────
export const MEMBER_COLORS = {
  chord:   '#2563EB',
  web:     '#E24B4A',
  rafter:  '#c9722a',
  purlin:  '#3B6D11',
  collar:  '#9333ea',
  bracing: '#0891b2',
  gusset:  '#888780',
  ridge:   '#c04020',
  column:  '#5b6eae',
  haunch:  '#7c6faa',
  hip:     '#e07020',
  valley:  '#9333ea',
};

// ── Truss description text ────────────────────────────────────
export const TRUSS_INFO = {
  king:   'King post truss: central vertical post from apex to tie beam. Suitable spans up to 6 m. Simple and efficient for small domestic roofs.',
  queen:  'Queen post truss: two vertical posts with a horizontal straining beam creating a central panel. Allows room-in-roof space. Spans to 9 m.',
  howe:   'Howe truss: verticals carry compression, diagonals carry tension. Ideal for steel diagonal + timber vertical hybrid construction.',
  pratt:  'Pratt truss: diagonals in tension under gravity loads — optimal for steel fabrication. Widely used in industrial roofs. Spans 9–14 m.',
  fan:    'Fan truss: multiple top-chord panels with fan web arrangement reducing purlin span. Economical for 10–20 m spans.',
  attic:  'Attic/room-in-roof truss: raised tie beam and knee braces create usable habitable space within the truss depth. Spans to 12 m.',
  mono:   'Mono (lean-to) truss: single-slope asymmetric truss. Used for extensions, lean-to roofs, and industrial ridge glazing.',
};

// ── Material cross-section sizes (metres) ────────────────────
export const SECTION_SIZES = {
  timber: {
    chord_w:  0.12,  chord_h:  0.22,
    web_w:    0.09,  web_h:    0.14,
    rafter_w: 0.05,  rafter_h: 0.17,
    purlin_w: 0.10,  purlin_h: 0.15,
    collar_w: 0.05,  collar_h: 0.10,
    brace_w:  0.05,  brace_h:  0.05,
    ridge_w:  0.05,  ridge_h:  0.22,
    column_w: 0.20,  column_h: 0.20,
    gusset_s: 0.20,  gusset_t: 0.020,
  },
  steel: {
    chord_w:  0.08,  chord_h:  0.20,
    web_w:    0.06,  web_h:    0.10,
    rafter_w: 0.06,  rafter_h: 0.15,
    purlin_w: 0.065, purlin_h: 0.17,
    collar_w: 0.06,  collar_h: 0.10,
    brace_w:  0.04,  brace_h:  0.04,
    ridge_w:  0.10,  ridge_h:  0.22,
    column_w: 0.25,  column_h: 0.25,
    gusset_s: 0.20,  gusset_t: 0.012,
  },
};

// ── Auto-select truss type from span ─────────────────────────
export function autoSelectTruss(span) {
  if (span <= 6)  return 'king';
  if (span <= 9)  return 'queen';
  if (span <= 12) return 'howe';
  if (span <= 14) return 'pratt';
  return 'fan';
}

// ── Compute truss node positions and member connectivity ──────
// Returns: { nodes: { [key]: [x, y] }, members: [[a,b,'chord'|'web'], ...], supports: [key,...] }
export function trussTopology(type, span, pitch) {
  const h = (span / 2) * Math.tan(pitch * DEG);
  const s = span;

  switch (type) {
    case 'king':
      return {
        nodes: {
          A: [0, 0],
          B: [s, 0],
          C: [s / 2, h],
          D: [s / 2, 0],
        },
        members: [
          ['A', 'C', 'chord'],
          ['C', 'B', 'chord'],
          ['A', 'B', 'chord'],
          ['C', 'D', 'web'],
          ['A', 'C', 'web'],
          ['B', 'C', 'web'],
        ],
        supports: ['A', 'B'],
      };

    case 'queen': {
      const qx1 = s / 4, qx2 = s * 3 / 4;
      const qy  = h / 2;
      return {
        nodes: {
          A: [0, 0],    B: [s, 0],
          C: [s / 2, h],
          D: [qx1, qy], E: [qx2, qy],
          F: [qx1, 0],  G: [qx2, 0],
        },
        members: [
          ['A', 'D', 'chord'], ['D', 'C', 'chord'],
          ['C', 'E', 'chord'], ['E', 'B', 'chord'],
          ['A', 'B', 'chord'],
          ['D', 'E', 'chord'],
          ['D', 'F', 'web'],   ['E', 'G', 'web'],
          ['A', 'D', 'web'],   ['B', 'E', 'web'],
          ['D', 'G', 'web'],   ['E', 'F', 'web'],
        ],
        supports: ['A', 'B'],
      };
    }

    case 'howe': {
      const p1 = s / 4, p2 = s / 2, p3 = s * 3 / 4;
      const hy1 = h / 2, hy2 = h, hy3 = h / 2;
      return {
        nodes: {
          A: [0, 0],  B: [s, 0],
          C: [p2, h],
          D: [p1, hy1], E: [p3, hy3],
          F: [p1, 0],   G: [p3, 0],
        },
        members: [
          ['A', 'D', 'chord'], ['D', 'C', 'chord'],
          ['C', 'E', 'chord'], ['E', 'B', 'chord'],
          ['A', 'B', 'chord'],
          ['F', 'G', 'chord'],
          ['D', 'F', 'web'], ['E', 'G', 'web'],
          ['A', 'D', 'web'], ['B', 'E', 'web'],
          ['D', 'G', 'web'], ['E', 'F', 'web'],
          ['C', 'F', 'web'], ['C', 'G', 'web'],
        ],
        supports: ['A', 'B'],
      };
    }

    case 'pratt': {
      const n = 4;
      const nodes = {};
      const members = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const y = t <= 0.5 ? t * 2 * h : (1 - t) * 2 * h;
        nodes[`T${i}`] = [t * s, y];
        nodes[`B${i}`] = [t * s, 0];
        if (i > 0) {
          members.push([`T${i - 1}`, `T${i}`, 'chord']);
          members.push([`B${i - 1}`, `B${i}`, 'chord']);
        }
        members.push([`T${i}`, `B${i}`, 'web']);
        if (i > 0 && i <= n / 2) members.push([`T${i - 1}`, `B${i}`, 'web']);
        if (i >= n / 2 && i < n) members.push([`T${i + 1}`, `B${i}`, 'web']);
      }
      return { nodes, members, supports: ['B0', `B${n}`] };
    }

    case 'fan': {
      const n = 6;
      const nodes = {};
      const members = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const y = t <= 0.5 ? t * 2 * h : (1 - t) * 2 * h;
        nodes[`T${i}`] = [t * s, y];
        nodes[`B${i}`] = [t * s, 0];
        if (i > 0) {
          members.push([`T${i - 1}`, `T${i}`, 'chord']);
          members.push([`B${i - 1}`, `B${i}`, 'chord']);
        }
        members.push([`T${i}`, `B${i}`, 'web']);
      }
      const apex = n / 2;
      for (let i = 1; i < apex; i++) members.push([`T${apex}`, `B${i}`, 'web']);
      for (let i = apex + 1; i < n; i++) members.push([`T${apex}`, `B${i}`, 'web']);
      return { nodes, members, supports: ['B0', `B${n}`] };
    }

    case 'attic': {
      const rh  = h * 0.45;
      const iw  = s * 0.35;
      return {
        nodes: {
          A: [0, 0],            B: [s, 0],
          C: [s / 2, h],
          D: [s / 2 - iw / 2, rh], E: [s / 2 + iw / 2, rh],
          F: [s / 2 - iw / 2, 0],  G: [s / 2 + iw / 2, 0],
        },
        members: [
          ['A', 'D', 'chord'], ['D', 'C', 'chord'],
          ['C', 'E', 'chord'], ['E', 'B', 'chord'],
          ['A', 'B', 'chord'], ['D', 'E', 'chord'],
          ['D', 'F', 'web'],   ['E', 'G', 'web'],
          ['A', 'D', 'web'],   ['B', 'E', 'web'],
          ['F', 'G', 'chord'],
        ],
        supports: ['A', 'B'],
      };
    }

    case 'mono': {
      const mh = h * 1.2;
      return {
        nodes: {
          A: [0, 0],
          B: [s, 0],
          C: [0, mh],
          D: [s / 3, mh * 0.35],
          E: [s * 2 / 3, mh * 0.18],
        },
        members: [
          ['A', 'C', 'chord'],
          ['C', 'D', 'chord'], ['D', 'E', 'chord'], ['E', 'B', 'chord'],
          ['A', 'B', 'chord'],
          ['C', 'A', 'web'], ['D', 'A', 'web'],
          ['D', 'B', 'web'], ['E', 'B', 'web'],
        ],
        supports: ['A', 'B'],
      };
    }

    default:
      return trussTopology('king', span, pitch);
  }
}

// ── Generate member schedule counts ──────────────────────────
export function memberSchedule({ element, subType, span, pitch, bays, spacing, material }) {
  const rise     = (span / 2) * Math.tan(pitch * DEG);
  const slopeLen = Math.sqrt(rise * rise + (span / 2) ** 2);
  const totalLen = (bays - 1) * spacing;
  const rafterSpacing = 0.6;
  const numRafters = Math.floor(totalLen / rafterSpacing) + 2;

  if (element === 'truss') {
    const { nodes } = trussTopology(subType, span, pitch);
    const nodeCount  = Object.keys(nodes).length;
    const webCounts  = { king: 1, queen: 6, howe: 8, pratt: 14, fan: 18, attic: 7, mono: 5 };
    return [
      { key: 'chord',   label: 'Top chord',      count: bays * 2,          length: `${slopeLen.toFixed(2)} m ea`,  color: MEMBER_COLORS.chord },
      { key: 'chord',   label: 'Bottom tie',      count: bays,              length: `${span.toFixed(1)} m ea`,      color: MEMBER_COLORS.chord },
      { key: 'web',     label: 'Web members',     count: bays * (webCounts[subType] || 4), length: 'varies',        color: MEMBER_COLORS.web },
      { key: 'purlin',  label: 'Purlins',         count: 4,                 length: `${totalLen.toFixed(1)} m ea`,  color: MEMBER_COLORS.purlin },
      { key: 'collar',  label: 'Collar ties',     count: bays,              length: `${(span * 0.55).toFixed(1)} m`, color: MEMBER_COLORS.collar },
      { key: 'gusset',  label: 'Gusset plates',   count: nodeCount * bays,  length: '—',                            color: MEMBER_COLORS.gusset },
    ];
  }

  if (element === 'rafters') {
    return [
      { key: 'rafter',  label: 'Common rafters',  count: numRafters * 2,    length: `${slopeLen.toFixed(2)} m ea`, color: MEMBER_COLORS.rafter },
      { key: 'purlin',  label: 'Purlins',         count: 6,                 length: `${totalLen.toFixed(1)} m ea`, color: MEMBER_COLORS.purlin },
      { key: 'ridge',   label: 'Ridge beam',      count: 1,                 length: `${totalLen.toFixed(1)} m`,    color: MEMBER_COLORS.ridge },
      { key: 'collar',  label: 'Collar ties',     count: numRafters,        length: `${(span * 0.5).toFixed(1)} m ea`, color: MEMBER_COLORS.collar },
      ...(subType === 'hip' ? [{ key: 'hip', label: 'Hip rafters', count: 4, length: 'varies', color: MEMBER_COLORS.hip }] : []),
    ];
  }

  // portal
  return [
    { key: 'column',  label: 'Steel columns',  count: bays * 2,  length: '3.5 m ea',             color: MEMBER_COLORS.column },
    { key: 'chord',   label: 'Rafter members', count: bays * 2,  length: `${slopeLen.toFixed(2)} m ea`, color: MEMBER_COLORS.chord },
    { key: 'haunch',  label: 'Haunches',       count: bays * 2,  length: '1.2 m ea',             color: MEMBER_COLORS.haunch },
  ];
}
