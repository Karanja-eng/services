// slabTypes.js — Slab & Floor System: type definitions, structural limits, materials

export const SLAB_TYPES = [
  {
    id: 'flat',
    name: 'Flat Slab',
    sub: 'No beams, column drops optional',
    color: '#4F6EF7',
    mat: 'RC',
    ldLimit: 30,
    minThickness: 175,
    description: 'Solid uniform thickness slab supported directly on columns. No beams required.',
    rebarNote: 'T16@200 B1&B2 + T12@200 T1&T2',
  },
  {
    id: 'plate',
    name: 'Flat Plate',
    sub: 'Thinnest solid slab, no drops/beams',
    color: '#7B93FF',
    mat: 'RC',
    ldLimit: 32,
    minThickness: 125,
    description: 'Thinnest flat slab variant. No column drops or beams. Best for light loads ≤3kN/m².',
    rebarNote: 'T12@175 EACH WAY B&T',
  },
  {
    id: 'ribbed',
    name: 'One-Way Ribbed',
    sub: 'Parallel ribs + infill blocks',
    color: '#2ECC71',
    mat: 'RC',
    ldLimit: 24,
    minThickness: 250,
    description: 'Parallel T-beam ribs with EPS/block infill. Two flanking edge beams. Economic for 6–10m spans.',
    rebarNote: 'T20-2/RIB BTMS, T12@200 TOP',
  },
  {
    id: 'waffle',
    name: 'Waffle (Two-Way Ribbed)',
    sub: 'Grid ribs, square coffers, column heads',
    color: '#1ABC9C',
    mat: 'RC',
    ldLimit: 24,
    minThickness: 300,
    description: 'Grid of ribs in X and Y. Square coffers. Column heads thickened. 8–12m spans both directions.',
    rebarNote: 'T16-2/RIB B&T, T10@200 TOPPING',
  },
  {
    id: 'pt',
    name: 'Post-Tensioned Flat',
    sub: 'Embedded tendon paths shown as curves',
    color: '#F39C12',
    mat: 'PT',
    ldLimit: 38,
    minThickness: 180,
    description: 'Flat slab with post-tensioned tendons draped parabolically. Eliminates deflection. Best >10m.',
    rebarNote: 'PT TENDONS 12.9mm Ø @1200 C/C',
  },
  {
    id: 'hollow',
    name: 'Hollow-Core Precast',
    sub: 'Extruded hollow sections, cross-section view',
    color: '#E74C3C',
    mat: 'PC',
    ldLimit: 35,
    minThickness: 150,
    description: 'Precast prestressed units with longitudinal voids. Factory-made. Spans 6–16m.',
    rebarNote: 'PRECAST HOLLOWCORE HC320',
  },
  {
    id: 'composite',
    name: 'Composite Slab',
    sub: 'Steel deck (trapezoidal) + concrete topping',
    color: '#9B59B6',
    mat: 'STL',
    ldLimit: 30,
    minThickness: 120,
    description: 'Trapezoidal steel deck acts as formwork and reinforcement. Composite action via shear studs.',
    rebarNote: 'SHEAR STUDS 19Ø×100 @300 C/C',
  },
  {
    id: 'raft',
    name: 'Raft / Mat Foundation',
    sub: 'Thickened perimeter, uniform base',
    color: '#E67E22',
    mat: 'RC',
    ldLimit: 20,
    minThickness: 300,
    description: 'Continuous slab over entire building footprint. Thickened edges and under columns.',
    rebarNote: 'T20@150 B1&B2 + T16@200 T1&T2',
  },
  {
    id: 'beam-slab',
    name: 'Elevated Ground Beam Slab',
    sub: 'Ground floor slab on beams over void',
    color: '#16A085',
    mat: 'RC',
    ldLimit: 28,
    minThickness: 150,
    description: 'Slab on ground beams with void beneath. Allows services access. Avoids heave risk.',
    rebarNote: 'GROUND BEAMS 300×600 + T16@200',
  },
];

// Material properties
export const MATERIALS = {
  concrete: { roughness: 0.85, metalness: 0.0, color: '#C8C0B0', name: 'Concrete C30/37' },
  steel:    { roughness: 0.2,  metalness: 0.9, color: '#8899AA', name: 'Steel S275' },
  precast:  { roughness: 0.75, metalness: 0.0, color: '#D0C8BC', name: 'Precast C50/60' },
  pt:       { roughness: 0.8,  metalness: 0.05,color: '#C8C0A8', name: 'PT Concrete C40/50' },
};

// Structural adequacy checks
export function checkLdRatio(span, thickness, slabType) {
  const t = SLAB_TYPES.find(s => s.id === slabType);
  const limit = t ? t.ldLimit : 30;
  const actual = span / thickness;
  return {
    actual: Math.round(actual * 10) / 10,
    limit,
    ok: actual <= limit,
    warn: actual > limit * 0.9 && actual <= limit,
    minThickness: Math.ceil(span / limit / 25) * 25,
  };
}

export function calcSelfWeight(thickness) {
  return Math.round((thickness / 1000) * 25 * 10) / 10; // kN/m²
}

export function autoSuggestType(spanMm, imposedLoad) {
  const span = spanMm / 1000;
  if (span <= 5)  return [
    { id: 'plate',  note: 'Flat plate ideal — light loads',   thickness: Math.ceil(spanMm/32/25)*25 },
    { id: 'flat',   note: 'Flat slab — standard',             thickness: Math.ceil(spanMm/30/25)*25 },
  ];
  if (span <= 8)  return [
    { id: 'flat',   note: 'Recommended for this span',         thickness: Math.ceil(spanMm/30/25)*25 },
    { id: 'ribbed', note: 'Economic — save 20-30% concrete',   thickness: Math.ceil(spanMm/24/25)*25 },
  ];
  if (span <= 12) return [
    { id: 'ribbed', note: 'Most economic 1-way option',        thickness: Math.ceil(spanMm/24/25)*25 },
    { id: 'waffle', note: '2-way action — square bays',        thickness: Math.ceil(spanMm/24/25)*25 },
    { id: 'pt',     note: 'Post-tensioned — minimal depth',    thickness: Math.ceil(spanMm/38/25)*25 },
  ];
  return [
    { id: 'pt',        note: 'Required for large span',         thickness: Math.ceil(spanMm/38/25)*25 },
    { id: 'composite', note: 'Steel deck + concrete composite', thickness: Math.ceil(spanMm/30/25)*25 },
  ];
}
