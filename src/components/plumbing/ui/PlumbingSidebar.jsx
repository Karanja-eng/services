import React, { useState } from 'react';
import { usePlumbingStore } from '../stores/plumbingStore';

const PALETTE = {
  Fixtures: [
    { id: 'wc_cc',       label: 'Close-coupled WC',   icon: '🚽', category: 'fixture', config: { material: 'Ceramic' } },
    { id: 'wc_wh',       label: 'Wall-hung WC',        icon: '🚽', category: 'fixture', config: { material: 'Ceramic' } },
    { id: 'wc_squat',    label: 'Squat Pan',            icon: '🪣', category: 'fixture', config: { material: 'Ceramic' } },
    { id: 'basin_ped',   label: 'Pedestal Basin',       icon: '🪣', category: 'fixture', config: { material: 'Ceramic' } },
    { id: 'basin_wall',  label: 'Wall-hung Basin',      icon: '🪣', category: 'fixture', config: { material: 'Ceramic' } },
    { id: 'basin_cpt',   label: 'Compact Basin',        icon: '🪣', category: 'fixture', config: { material: 'Ceramic' } },
    { id: 'bath_std',    label: 'Standard Bath',        icon: '🛁', category: 'fixture', config: { material: 'Acrylic' } },
    { id: 'bath_free',   label: 'Freestanding Bath',    icon: '🛁', category: 'fixture', config: { material: 'Cast Iron' } },
    { id: 'shower_tray', label: 'Shower Tray',          icon: '🚿', category: 'fixture', config: { material: 'Stone Resin' } },
    { id: 'wetroom',     label: 'Wet Room',             icon: '🚿', category: 'fixture', config: { material: 'Tiled' } },
    { id: 'sink_ss',     label: 'Stainless Steel Sink', icon: '🪣', category: 'fixture', config: { material: 'Stainless Steel' } },
    { id: 'urinal_wh',   label: 'Wall-hung Urinal',     icon: '🚾', category: 'fixture', config: { material: 'Ceramic' } },
  ],
  Valves: [
    { id: 'val_ball',    label: 'Ball Valve',           icon: '🔵', category: 'valve', config: { isOpen: true } },
    { id: 'val_gate',    label: 'Gate Valve',           icon: '🔵', category: 'valve', config: { isOpen: true } },
    { id: 'val_check',   label: 'Check / NRV',          icon: '🔵', category: 'valve', config: {} },
    { id: 'val_prv',     label: 'PRV',                  icon: '🔵', category: 'valve', config: {} },
    { id: 'val_tmv',     label: 'TMV',                  icon: '🔵', category: 'valve', config: { setTemp: 43 } },
    { id: 'val_fv',      label: 'Float Valve',          icon: '🔵', category: 'valve', config: {} },
    { id: 'val_sv',      label: 'Service Valve',        icon: '🔵', category: 'valve', config: {} },
    { id: 'val_dcv',     label: 'Double Check Valve',   icon: '🔵', category: 'valve', config: {} },
    { id: 'val_motor',   label: 'Motorised Zone Valve', icon: '🔵', category: 'valve', config: {} },
  ],
  Vessels: [
    { id: 'cwst_100',    label: 'CWST 100L',            icon: '🗃️', category: 'vessel', config: { capacity: 100 } },
    { id: 'cwst_500',    label: 'CWST 500L',            icon: '🗃️', category: 'vessel', config: { capacity: 500 } },
    { id: 'cwst_1000',   label: 'CWST 1000L',           icon: '🗃️', category: 'vessel', config: { capacity: 1000 } },
    { id: 'hwc_150',     label: 'HW Cylinder 150L',     icon: '💧', category: 'vessel', config: { capacity: 150 } },
    { id: 'hwc_210',     label: 'HW Cylinder 210L',     icon: '💧', category: 'vessel', config: { capacity: 210 } },
    { id: 'septic',      label: 'Septic Tank 2700L',    icon: '🪣', category: 'vessel', config: { capacity: 2700 } },
    { id: 'biodigest',   label: 'Biodigester',          icon: '🪣', category: 'vessel', config: { capacity: 3000 } },
    { id: 'rain_tank',   label: 'Rainwater Tank',       icon: '💧', category: 'vessel', config: { capacity: 5000 } },
  ],
  Drainage: [
    { id: 'drain_floor', label: 'Floor Drain',          icon: '⬇️', category: 'drain', config: {} },
    { id: 'drain_linear',label: 'Linear Channel Drain', icon: '⬇️', category: 'drain', config: {} },
    { id: 'gully_big',   label: 'Back-inlet Gully',     icon: '⬇️', category: 'drain', config: {} },
    { id: 'ic_preform',  label: 'Inspection Chamber',   icon: '⬛', category: 'drain', config: {} },
    { id: 'manhole',     label: 'Manhole',              icon: '⬛', category: 'drain', config: {} },
    { id: 'soakaway',    label: 'Soakaway',             icon: '⬇️', category: 'drain', config: {} },
    { id: 'ic_rodding',  label: 'Rodding Eye',          icon: '🔩', category: 'drain', config: {} },
  ],
  Taps: [
    { id: 'tap_pillar',  label: 'Pillar Tap',           icon: '🚰', category: 'tap', config: {} },
    { id: 'tap_mono',    label: 'Monobloc Mixer',       icon: '🚰', category: 'tap', config: {} },
    { id: 'tap_shower',  label: 'Thermostatic Bar',     icon: '🚰', category: 'tap', config: { setTemp: 38 } },
    { id: 'tap_hose',    label: 'Hose Union Bib Tap',   icon: '🚰', category: 'tap', config: {} },
    { id: 'tap_garden',  label: 'Garden Tap',           icon: '🚰', category: 'tap', config: {} },
    { id: 'tap_sensor',  label: 'Sensor Tap',           icon: '🚰', category: 'tap', config: {} },
  ],
};

// System colour dots
const SYSTEM_COLOURS = {
  CWS: '#0000CC', HWS: '#CC0000', HWR: '#CC0000',
  SVP: '#1A1A1A', WASTE: '#808080', RWP: '#008000',
  OVERFLOW: '#FFA500', GREY: '#800080', GAS: '#CCCC00',
};

export default function PlumbingSidebar() {
  const [activeTab, setActiveTab] = useState('Fixtures');
  const { setActiveTool, setActivePlacementSpec } = usePlumbingStore();

  const handlePick = (item) => {
    setActiveTool('place');
    setActivePlacementSpec({ ...item, subType: item.label });
  };

  return (
    <div className="w-64 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-10 shrink-0 shadow-sm">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Component Library</h2>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100 dark:border-gray-800">
        {Object.keys(PALETTE).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* System legend (pipes) */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Pipe Systems</p>
        <div className="space-y-1">
          {Object.entries(SYSTEM_COLOURS).map(([sys, col]) => (
            <div key={sys} className="flex items-center gap-2">
              <div className="w-5 h-0.5 rounded" style={{ backgroundColor: col }} />
              <span className="text-[9px] text-gray-500 dark:text-gray-400">{sys}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Element list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {(PALETTE[activeTab] || []).map(item => (
          <button
            key={item.id}
            onClick={() => handlePick(item)}
            className="w-full flex items-center gap-2 px-2 py-2 rounded text-left border border-transparent hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors group"
          >
            <span className="text-base">{item.icon}</span>
            <span className="text-[10px] text-gray-700 dark:text-gray-300 group-hover:text-blue-700 dark:group-hover:text-blue-300 leading-tight">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
