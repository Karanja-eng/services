export const TOOLS = {
  SELECT: 'select',
  PAN: 'pan',
  LINEAR_DIM: 'linear_dim',
  ALIGNED_DIM: 'aligned_dim',
  CHAIN_DIM: 'chain_dim',
  ANGULAR_DIM: 'angular_dim',
  RADIUS_DIM: 'radius_dim',
  DIAMETER_DIM: 'diameter_dim',
  LEADER: 'leader',
  SECTION_MARK: 'section_mark',
  DETAIL_CIRCLE: 'detail_circle',
  ROOM_TAG: 'room_tag',
  GRID_BUBBLE: 'grid_bubble',
  NORTH_ARROW: 'north_arrow',
  SCALE_BAR: 'scale_bar',
  LEVEL_MARKER: 'level_marker',
};

export const COLORS = {
  dim: '#4a9eff',
  annotation: '#ff6b6b',
  grid: '#8090b0',
  selected: '#ffd700',
  background: '#1a1a2e',
  panel: '#0d0d1a',
  border: '#2a2a4a',
  muted: '#5a5a8a',
  accent: '#00d4aa',
};

export const ARROWHEAD_STYLES = ['arrow', 'slash', 'dot', 'open'];
export const UNIT_TYPES = ['mm', 'm', 'ft'];

export const DEFAULT_STYLE = {
  arrowhead: 'slash',
  unit: 'mm',
  precision: 0,
  textSize: 11,
  fontFamily: 'monospace',
  dimColor: '#4a9eff',
  annotationColor: '#ff6b6b',
  gridColor: '#8090b0',
  extGap: 4,
  extOverhang: 6,
  dimOffset: 30,
  lineWidth: 1,
};

export const TOOL_GROUPS = [
  {
    label: 'SELECT',
    tools: [
      { id: TOOLS.SELECT, icon: '↖', label: 'Select', key: 'V' },
      { id: TOOLS.PAN, icon: '✋', label: 'Pan', key: 'H' },
    ],
  },
  {
    label: 'DIMENSIONS',
    tools: [
      { id: TOOLS.LINEAR_DIM, icon: '↔', label: 'Linear', key: 'D' },
      { id: TOOLS.ALIGNED_DIM, icon: '↗', label: 'Aligned', key: 'A' },
      { id: TOOLS.CHAIN_DIM, icon: '⊣⊢', label: 'Chain', key: 'C' },
      { id: TOOLS.ANGULAR_DIM, icon: '∠', label: 'Angular', key: 'G' },
      { id: TOOLS.RADIUS_DIM, icon: 'R', label: 'Radius', key: 'R' },
      { id: TOOLS.DIAMETER_DIM, icon: '⌀', label: 'Diameter', key: 'I' },
      { id: TOOLS.LEVEL_MARKER, icon: '▽', label: 'Level', key: 'L' },
    ],
  },
  {
    label: 'ANNOTATIONS',
    tools: [
      { id: TOOLS.LEADER, icon: '↱', label: 'Leader', key: 'N' },
      { id: TOOLS.SECTION_MARK, icon: '⊕', label: 'Section', key: 'S' },
      { id: TOOLS.DETAIL_CIRCLE, icon: '◎', label: 'Detail', key: 'E' },
      { id: TOOLS.ROOM_TAG, icon: '⬜', label: 'Room Tag', key: 'T' },
      { id: TOOLS.GRID_BUBBLE, icon: '○', label: 'Grid', key: 'B' },
      { id: TOOLS.NORTH_ARROW, icon: '⊕', label: 'North', key: 'P' },
      { id: TOOLS.SCALE_BAR, icon: '━', label: 'Scale', key: 'K' },
    ],
  },
];

export const STATUS_HINTS = {
  [TOOLS.SELECT]: 'Click to select · Del to remove · Dbl-click to edit text',
  [TOOLS.PAN]: 'Drag to pan canvas · Scroll to zoom',
  [TOOLS.LINEAR_DIM]: 'Click point 1 → Click point 2 to place linear dimension',
  [TOOLS.ALIGNED_DIM]: 'Click point 1 → Click point 2 for aligned dimension',
  [TOOLS.CHAIN_DIM]: 'Click points to build chain · Double-click to finish',
  [TOOLS.ANGULAR_DIM]: 'Click vertex → Click arc point for angular dimension',
  [TOOLS.RADIUS_DIM]: 'Click center → Click edge for radius dimension',
  [TOOLS.DIAMETER_DIM]: 'Click center → Click edge for diameter dimension',
  [TOOLS.LEADER]: 'Click note target → Click text position',
  [TOOLS.SECTION_MARK]: 'Click start → Click end of cutting plane',
  [TOOLS.DETAIL_CIRCLE]: 'Click center → Click edge for detail callout',
  [TOOLS.ROOM_TAG]: 'Click to place room name tag',
  [TOOLS.GRID_BUBBLE]: 'Click to place grid reference bubble',
  [TOOLS.NORTH_ARROW]: 'Click to place north arrow',
  [TOOLS.SCALE_BAR]: 'Click to place graphic scale bar',
  [TOOLS.LEVEL_MARKER]: 'Click to place level / spot height marker',
};
