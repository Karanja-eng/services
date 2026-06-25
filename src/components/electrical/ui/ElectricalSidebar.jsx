import React, { useState } from 'react';
import { STANDARD_SOCKETS, STANDARD_SWITCHES, STANDARD_LIGHTS } from '../utils/constants';

const CATEGORIES = [
  { key: 'sockets', label: 'Sockets & Power', color: 'text-orange-400', items: STANDARD_SOCKETS },
  { key: 'switches', label: 'Switches & Controls', color: 'text-blue-400', items: STANDARD_SWITCHES },
  { key: 'lights', label: 'Lighting', color: 'text-yellow-400', items: STANDARD_LIGHTS },
];

export default function ElectricalSidebar() {
  const [openCat, setOpenCat] = useState('sockets');

  return (
    <div className="p-2 space-y-1">
      {CATEGORIES.map(cat => (
        <div key={cat.key}>
          <button
            onClick={() => setOpenCat(openCat === cat.key ? null : cat.key)}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${cat.color} hover:bg-white/10 transition-colors`}
          >
            <span>{cat.label}</span>
            <span className="text-white/40">{openCat === cat.key ? '▴' : '▾'}</span>
          </button>
          {openCat === cat.key && (
            <div className="mt-1 mb-2 space-y-0.5">
              {cat.items.map(s => (
                <div
                  key={s.id}
                  className="px-3 py-2 rounded-lg cursor-grab text-[10px] text-gray-300 hover:bg-white/10 hover:text-white border border-transparent hover:border-white/10 transition-all flex justify-between items-center group"
                >
                  <span className="leading-tight">{s.name}</span>
                  {s.current && (
                    <span className="text-[9px] text-gray-500 group-hover:text-gray-400">{s.current}A</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
