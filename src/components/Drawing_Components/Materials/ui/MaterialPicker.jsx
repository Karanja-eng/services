import { useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { MaterialLibrary, CATEGORIES } from '../materials/MaterialLibrary.js';

function swatchColor(spec) {
  const c = spec.color;
  if (!c) return '#888888';
  if (c.isColor) return '#' + c.getHexString();
  return '#888888';
}

function BrickPattern({ brickColor }) {
  const [r,g,b] = brickColor.map(v=>Math.round(v*255));
  const bc = `rgb(${r},${g},${b})`;
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 40 40">
      <rect width="40" height="40" fill="#b0aa9f"/>
      {[0,8,16,24,32].map((y,ri)=>
        ri%2===0
          ? [0,20].map(x=><rect key={`${ri}-${x}`} x={x+1} y={y+1} width={18} height={6} fill={bc}/>)
          : [-10,10,30].map(x=><rect key={`${ri}-${x}`} x={x+1} y={y+1} width={18} height={6} fill={bc}/>)
      )}
    </svg>
  );
}

function TimberPattern({ woodLight, woodDark }) {
  const wl=woodLight.map(v=>Math.round(v*255));
  const wd=woodDark.map(v=>Math.round(v*255));
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 40 40" preserveAspectRatio="none">
      <rect width="40" height="40" fill={`rgb(${wl.join(',')})`}/>
      {Array.from({length:8}).map((_,i)=>(
        <path key={i}
          d={`M 0 ${i*5+Math.sin(i)*2} Q 20 ${i*5+Math.cos(i*0.7)*3} 40 ${i*5+Math.sin(i*1.2)*2}`}
          stroke={`rgb(${wd.join(',')})`} strokeWidth={1+(i%3)*0.5} fill="none" opacity="0.7"/>
      ))}
    </svg>
  );
}

function MaterialSwatch({ id, spec, isSelected, onClick, onDragStart }) {
  const bg = swatchColor(spec);
  const isGlass  = spec._category === 'Glazing';
  const isMetal  = ['Steel','Aluminium','Copper','Zinc'].includes(spec._category);
  return (
    <div
      className={`group relative cursor-pointer rounded select-none transition-all duration-150
        ${isSelected?'ring-2 ring-amber-400 ring-offset-1 ring-offset-zinc-900 scale-105':'hover:scale-105 hover:ring-1 hover:ring-zinc-400'}`}
      draggable onClick={()=>onClick(id,spec)} onDragStart={e=>onDragStart(e,id,spec)} title={spec._label||id}
    >
      <div className="w-full aspect-square rounded overflow-hidden relative"
        style={{
          background: isGlass
            ? `linear-gradient(135deg,${bg}66 0%,${bg}33 50%,${bg}66 100%)`
            : isMetal ? `linear-gradient(135deg,${bg}cc,${bg}ff,${bg}88)` : bg,
          boxShadow:'inset 0 1px 0 rgba(255,255,255,0.1),inset 0 -1px 0 rgba(0,0,0,0.3)',
        }}>
        {isGlass && <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"/>}
        {isMetal && <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/20"/>}
        {spec._procedural==='brick'  && <BrickPattern  brickColor={spec._brickColor||[0.7,0.33,0.21]}/>}
        {spec._procedural==='timber' && <TimberPattern woodLight={spec._woodLight||[0.85,0.73,0.51]} woodDark={spec._woodDark||[0.62,0.46,0.28]}/>}
      </div>
      <p className="text-[9px] text-zinc-400 text-center mt-0.5 leading-tight truncate px-0.5 group-hover:text-zinc-200 transition-colors">
        {spec._label||id}
      </p>
    </div>
  );
}

function MaterialEditor({ materialId, spec, overrides, onChange }) {
  if (!materialId) return <div className="text-zinc-500 text-xs text-center py-6">Select a material to edit</div>;
  const roughness = overrides.roughness ?? spec.roughness ?? 0.5;
  const metalness = overrides.metalness ?? spec.metalness ?? 0;
  const colorHex = (() => {
    const c = overrides.color ?? spec.color;
    if (!c) return '#888888';
    if (c.isColor) return '#'+c.getHexString();
    return '#888888';
  })();
  return (
    <div className="space-y-3 p-3">
      <div>
        <p className="text-xs font-medium text-amber-400 mb-1 font-mono">{spec._label||materialId}</p>
        <span className="text-[9px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">{spec._category}</span>
      </div>
      <label className="block">
        <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Colour</span>
        <div className="flex items-center gap-2 mt-1">
          <input type="color" value={colorHex}
            onChange={e=>onChange({ color: new THREE.Color(e.target.value) })}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"/>
          <span className="text-xs text-zinc-400 font-mono">{colorHex.toUpperCase()}</span>
        </div>
      </label>
      <label className="block">
        <div className="flex justify-between">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Roughness</span>
          <span className="text-[10px] text-zinc-300 font-mono">{roughness.toFixed(2)}</span>
        </div>
        <input type="range" min="0" max="1" step="0.01" value={roughness}
          onChange={e=>onChange({roughness:parseFloat(e.target.value)})} className="w-full mt-1 accent-amber-400"/>
      </label>
      <label className="block">
        <div className="flex justify-between">
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Metalness</span>
          <span className="text-[10px] text-zinc-300 font-mono">{metalness.toFixed(2)}</span>
        </div>
        <input type="range" min="0" max="1" step="0.01" value={metalness}
          onChange={e=>onChange({metalness:parseFloat(e.target.value)})} className="w-full mt-1 accent-amber-400"/>
      </label>
      {spec.type==='MeshPhysicalMaterial' && (
        <label className="block">
          <div className="flex justify-between">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Transmission</span>
            <span className="text-[10px] text-zinc-300 font-mono">{(overrides.transmission??spec.transmission??0).toFixed(2)}</span>
          </div>
          <input type="range" min="0" max="1" step="0.01" value={overrides.transmission??spec.transmission??0}
            onChange={e=>onChange({transmission:parseFloat(e.target.value)})} className="w-full mt-1 accent-sky-400"/>
        </label>
      )}
    </div>
  );
}

export default function MaterialPicker({ onSelect, onDragStart, className='' }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [editorOpen, setEditorOpen] = useState(false);

  const filtered = useMemo(() =>
    Object.entries(MaterialLibrary).filter(([id,spec]) => {
      const cat = activeCategory==='All' || spec._category===activeCategory;
      const q = search.toLowerCase();
      return cat && (!q || (spec._label||id).toLowerCase().includes(q));
    }), [activeCategory, search]);

  const handleSelect = useCallback((id,spec) => {
    setSelectedId(id); setOverrides({}); setEditorOpen(true);
    onSelect?.({ id, spec, overrides:{} });
  }, [onSelect]);

  const handleEditorChange = useCallback(patch => {
    setOverrides(prev => {
      const next = {...prev,...patch};
      onSelect?.({ id:selectedId, spec:MaterialLibrary[selectedId], overrides:next });
      return next;
    });
  }, [selectedId, onSelect]);

  const handleDragStart = useCallback((e,id,spec) => {
    e.dataTransfer.setData('materialId', id);
    onDragStart?.(id,spec);
  }, [onDragStart]);

  return (
    <div className={`flex flex-col bg-zinc-900 text-zinc-200 rounded-xl overflow-hidden border border-zinc-700/50 shadow-2xl ${className}`}
      style={{fontFamily:"'DM Mono','Courier New',monospace"}}>
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/80">
        <p className="text-[10px] text-amber-400 tracking-[0.2em] uppercase font-semibold mb-2">Material Library</p>
        <input type="text" placeholder="Search materials…" value={search} onChange={e=>setSearch(e.target.value)}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60 transition-colors"/>
      </div>
      <div className="flex gap-1 px-2 py-2 overflow-x-auto border-b border-zinc-800 scrollbar-none">
        {CATEGORIES.map(cat=>(
          <button key={cat} onClick={()=>setActiveCategory(cat)}
            className={`flex-shrink-0 px-2.5 py-1 rounded text-[9px] tracking-wide uppercase font-medium transition-all
              ${activeCategory===cat?'bg-amber-500 text-zinc-950':'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}>
            {cat}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 min-h-0" style={{maxHeight:280}}>
        {filtered.length===0
          ? <p className="text-zinc-500 text-xs text-center py-8">No materials found</p>
          : <div className="grid grid-cols-4 gap-2">
              {filtered.map(([id,spec])=>(
                <MaterialSwatch key={id} id={id} spec={spec} isSelected={selectedId===id}
                  onClick={handleSelect} onDragStart={handleDragStart}/>
              ))}
            </div>}
      </div>
      <div className="border-t border-zinc-800">
        <button className="w-full px-4 py-2 flex items-center justify-between text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors"
          onClick={()=>setEditorOpen(v=>!v)}>
          <span className="uppercase tracking-wider">Material Editor</span>
          <span className={`transition-transform ${editorOpen?'rotate-180':''}`}>▾</span>
        </button>
        {editorOpen && <MaterialEditor materialId={selectedId} spec={selectedId?MaterialLibrary[selectedId]:null}
          overrides={overrides} onChange={handleEditorChange}/>}
      </div>
      <div className="px-4 py-1.5 border-t border-zinc-800 bg-zinc-950/50">
        <p className="text-[9px] text-zinc-600">{filtered.length} / {Object.keys(MaterialLibrary).length} materials</p>
      </div>
    </div>
  );
}
