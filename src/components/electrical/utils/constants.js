export const SYSTEM_TYPES = {
  POWER: 'power',
  LIGHTING: 'lighting',
  DATA: 'data',
  FIRE: 'fire',
  SECURITY: 'security'
};

export const ELEMENT_TYPES = {
  CONDUIT: 'conduit',
  TRUNKING: 'trunking',
  SWITCH: 'switch',
  SOCKET: 'socket',
  LIGHT: 'light',
  CONSUMER_UNIT: 'db',
  SAFETY_DEVICE: 'safetyDevice',
  CIRCUIT: 'circuit'
};

export const COLORS = {
  POWER: '#CC0000',
  DATA: '#0033CC',
  EARTH: '#006600',
  FIRE: '#FF6600',
  SECURITY: '#CCCC00',
  CONDUIT_PVC: '#7A7A7A',
  CONDUIT_STEEL: '#B0C4DE'
};

export const BS7671_ZONES = {
  OUTSIDE: 'Outside',
  ZONE_0: 'Zone 0',
  ZONE_1: 'Zone 1',
  ZONE_2: 'Zone 2'
};

export const STANDARD_SOCKETS = [
  { id: 'uk_13a_1g', name: '13A Switched Socket (1-Gang)', type: 'uk_13a', gang: 1, current: 13, ip: 20 },
  { id: 'uk_13a_2g', name: '13A Switched Socket (2-Gang)', type: 'uk_13a', gang: 2, current: 13, ip: 20 },
  { id: 'fcu_switched', name: 'Switched FCU', type: 'fcu', gang: 1, current: 13, ip: 20 },
  { id: 'shaver_dual', name: 'Shaver Socket Dual Voltage', type: 'shaver', gang: 1, current: 0.1, ip: 44 },
  { id: 'cooker_45a', name: '45A Cooker Control', type: 'cooker', gang: 2, current: 45, ip: 20 },
  { id: 'ev_7kw', name: '7kW EV Charger (Type 2)', type: 'ev_charger', gang: 1, current: 32, ip: 65 }
];

export const STANDARD_SWITCHES = [
  { id: '1g_1w', name: '1-Gang 1-Way Switch', type: '1_way', gang: 1 },
  { id: '1g_2w', name: '1-Gang 2-Way Switch', type: '2_way', gang: 1 },
  { id: '2g_1w', name: '2-Gang 1-Way Switch', type: '1_way', gang: 2 },
  { id: 'intermediate', name: 'Intermediate Switch', type: 'intermediate', gang: 1 },
  { id: 'dimmer_1g', name: '1-Gang Dimmer', type: 'dimmer', gang: 1 },
  { id: 'pullcord', name: 'Ceiling Pull-Cord', type: 'pullcord', gang: 1, ip: 44 }
];

export const STANDARD_LIGHTS = [
  { id: 'downlight_led', name: 'LED Recessed Downlight', type: 'downlight', wattage: 7, cct: 3000, cri: 90, ip: 20 },
  { id: 'downlight_ip65', name: 'IP65 LED Downlight', type: 'downlight', wattage: 7, cct: 4000, cri: 90, ip: 65 },
  { id: 'panel_600', name: '600x600 LED Panel', type: 'panel', wattage: 32, cct: 4000, cri: 80, ip: 20 },
  { id: 'batten_1200', name: '1200mm LED Batten', type: 'batten', wattage: 24, cct: 4000, cri: 80, ip: 44 },
  { id: 'bulkhead_ip65', name: 'Bulkhead Light', type: 'bulkhead', wattage: 15, cct: 3000, cri: 80, ip: 65 },
  { id: 'track_spot', name: 'Track Spotlight', type: 'track_head', wattage: 12, cct: 3000, cri: 95, ip: 20 }
];
