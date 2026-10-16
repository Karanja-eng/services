// Section library metadata — types, labels, icons (SVG path data), material defaults

export const COLUMN_TYPES = [
  { id: 'rectangular_rc', label: 'Rect RC',    material: 'concrete', icon: 'rect' },
  { id: 'circular_rc',    label: 'Circular RC', material: 'concrete', icon: 'circle' },
  { id: 'l_shaped',       label: 'L-Shape',    material: 'concrete', icon: 'L' },
  { id: 't_shaped',       label: 'T-Shape',    material: 'concrete', icon: 'T' },
  { id: 'steel_i',        label: 'Steel I',    material: 'steel',    icon: 'I' },
  { id: 'steel_hollow',   label: 'SHS/RHS',    material: 'steel',    icon: 'hollow' },
  { id: 'timber',         label: 'Timber',     material: 'timber',   icon: 'timber' },
  { id: 'composite',      label: 'Composite',  material: 'composite',icon: 'composite' },
  { id: 'classical',      label: 'Classical',  material: 'concrete', icon: 'classical' },
]

export const BEAM_TYPES = [
  { id: 'rectangular_beam', label: 'Rect RC',     material: 'concrete', icon: 'rect' },
  { id: 't_beam',           label: 'T-Beam',      material: 'concrete', icon: 'T' },
  { id: 'l_beam',           label: 'L-Beam',      material: 'concrete', icon: 'L' },
  { id: 'steel_i_beam',     label: 'Steel UB',    material: 'steel',    icon: 'I' },
  { id: 'steel_channel',    label: 'PFC Channel',  material: 'steel',    icon: 'C' },
  { id: 'steel_hollow_beam',label: 'RHS Beam',    material: 'steel',    icon: 'hollow' },
  { id: 'timber_beam',      label: 'Timber',      material: 'timber',   icon: 'timber' },
  { id: 'pt_beam',          label: 'Post-Tensioned',material: 'concrete',icon: 'pt' },
  { id: 'cantilever_beam',  label: 'Cantilever',  material: 'concrete', icon: 'cant' },
  { id: 'transfer_beam',    label: 'Transfer',    material: 'concrete', icon: 'transfer' },
]

export const MATERIAL_COLORS = {
  concrete:  { color: '#9ca3af', roughness: 0.85, metalness: 0.0 },
  steel:     { color: '#7A8B8B', roughness: 0.2,  metalness: 0.8 },
  timber:    { color: '#c9a87c', roughness: 0.9,  metalness: 0.0 },
  composite: { color: '#8899aa', roughness: 0.5,  metalness: 0.3 },
}

export const MATERIAL_FILL_2D = {
  concrete:  { fill: '#b0b8c0', stroke: '#4a5568', hatch: 'rc' },
  steel:     { fill: '#7A8B8B', stroke: '#2d3748', hatch: 'solid' },
  timber:    { fill: '#c9a87c', stroke: '#744210', hatch: 'wood' },
  composite: { fill: '#a0aec0', stroke: '#2d3748', hatch: 'composite' },
}

// Span-to-depth guidelines (L/d)
export const SPAN_DEPTH_LIMITS = {
  rectangular_beam: 18,
  t_beam: 22,
  l_beam: 20,
  steel_i_beam: 25,
  steel_channel: 20,
  steel_hollow_beam: 20,
  timber_beam: 15,
  pt_beam: 30,
  cantilever_beam: 8,
  transfer_beam: 10,
}