export const SYSTEM_TYPES = {
  CWS: 'Cold Water Supply',
  HWS: 'Hot Water Supply',
  HWR: 'Hot Water Return',
  SVP: 'Soil and Vent Pipe',
  WASTE: 'Waste Pipe',
  OVERFLOW: 'Overflow',
  RWP: 'Rainwater Pipe',
  GREY: 'Grey Water',
  GAS: 'Gas Supply'
};

export const COLORS = {
  CWS: '#0000CC', // Blue
  HWS: '#CC0000', // Red
  HWR: '#CC0000', // Red dashed (handled in renderer)
  SVP: '#1A1A1A', // Black/Dark Grey
  WASTE: '#808080', // Grey
  OVERFLOW: '#FFA500', // Orange
  RWP: '#008000', // Green
  GREY: '#800080', // Purple
  GAS: '#FFFF00' // Yellow
};

export const PIPE_MATERIALS = {
  COPPER: 'Copper',
  CPVC: 'CPVC',
  UPVC: 'uPVC',
  MDPE: 'MDPE',
  PEX: 'PEX',
  PPR: 'PPR',
  GALV: 'Galvanised Steel',
  CAST_IRON: 'Cast Iron',
  HDPE: 'HDPE'
};

export const FIXTURE_TYPES = {
  WC: 'WC',
  BASIN: 'Basin',
  BATH: 'Bath',
  SHOWER: 'Shower',
  SINK: 'Sink',
  URINAL: 'Urinal',
  BIDET: 'Bidet'
};

export const ELEMENT_CATEGORIES = {
  PIPE: 'pipe',
  FITTING: 'fitting',
  VALVE: 'valve',
  FIXTURE: 'fixture',
  DRAIN: 'drain',
  VESSEL: 'vessel',
  TAP: 'tap'
};

// Sizes in mm
export const STANDARD_PIPE_SIZES = [15, 22, 28, 32, 35, 40, 42, 50, 54, 110, 160, 200];
