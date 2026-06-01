import { useState } from 'react';
import { useLightingStore, LIGHTING_MODES, kelvinToColor } from '../lighting/LightingSystem.jsx';

const MODE_META = {
  architectural:{ icon:'⬜', label:'Studio'    },
  daylight:     { icon:'☀',  label:'Daylight'  },
  golden_hour:  { icon:'🌅', label:'Golden Hr' },
  night:        { icon:'🌙', label:'Night'     },
};

function KelvinBadge({ k }) {
  const col = kelvinToColor(k);
  return <span className="inline-block w-3 h-3 rounded-full border border-zinc-600" style={{background:'#'+col.getHexString()}}/>;
}

export default function LightingPanel({ className='' }) {
  const { mode,setMode,latitude,longitude,timeOfDay,turbidity,rayleigh,ambientIntensity,
          setSun,setAmbient,interiorLights,addInteriorLight,removeInteriorLight } = useLightingStore();
  const [nl,setNl] = useState({ x:0,y:2.5,z:0,lumen:800,kelvin:3000 });
  const hh = String(Math.floor(timeOfDay)).padStart(2,'0');
  const mm = String(Math.round((timeOfDay%1)*60)).padStart(2,'0');

  return (
    <div className={`flex flex-col bg-zinc-900 text-zinc-200 rounded-xl overflow-hidden border border-zinc-700/50 shadow-2xl ${className}`}
      style={{fontFamily:"'DM Mono','Courier New',monospace"}}>
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/80">
        <p className="text-[10px] text-amber-400 tracking-[0.2em] uppercase font-semibold">Lighting</p>
      </div>
      <div className="overflow-y-auto p-3 space-y-4" style={{maxHeight:520}}>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Mode</p>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.keys(LIGHTING_MODES).map(m=>(
              <button key={m} onClick={()=>setMode(m)}
                className={`px-2 py-2 rounded-lg text-[10px] font-medium flex items-center gap-1.5 transition-all
                  ${mode===m?'bg-amber-500 text-zinc-950':'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}>
                <span>{MODE_META[m].icon}</span><span>{MODE_META[m].label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Sun Position</p>
          {[
            { label:'Time of Day', val:timeOfDay, min:0,max:24,step:0.25, display:`${hh}:${mm}`, onChange:v=>setSun({timeOfDay:v}) },
            { label:'Latitude',    val:latitude,  min:-90,max:90,step:0.5,display:`${latitude.toFixed(1)}°`, onChange:v=>setSun({latitude:v}) },
            { label:'Turbidity',   val:turbidity, min:1,max:20,step:0.5, display:turbidity.toFixed(1), onChange:v=>setSun({turbidity:v}) },
            { label:'Ambient',     val:ambientIntensity, min:0,max:2,step:0.05, display:ambientIntensity.toFixed(2), onChange:v=>setAmbient(v) },
          ].map(({label,val,min,max,step,display,onChange})=>(
            <label key={label} className="block">
              <div className="flex justify-between mb-1">
                <span className="text-[10px] text-zinc-400">{label}</span>
                <span className="text-[10px] text-zinc-300 font-mono">{display}</span>
              </div>
              <input type="range" min={min} max={max} step={step} value={val}
                onChange={e=>onChange(parseFloat(e.target.value))} className="w-full accent-amber-400"/>
            </label>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Interior Lights</p>
          <div className="bg-zinc-800/60 rounded-lg p-2 space-y-2">
            <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Add Point Light</p>
            <div className="grid grid-cols-3 gap-1">
              {['x','y','z'].map(axis=>(
                <label key={axis}>
                  <span className="text-[9px] text-zinc-500 uppercase">{axis}</span>
                  <input type="number" step="0.5" value={nl[axis]}
                    onChange={e=>setNl(p=>({...p,[axis]:parseFloat(e.target.value)}))}
                    className="w-full bg-zinc-700 border border-zinc-600 rounded px-1.5 py-1 text-[10px] text-zinc-200 focus:outline-none focus:border-amber-500/60"/>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1">
              <label>
                <span className="text-[9px] text-zinc-500">Lumens</span>
                <input type="number" step="100" min="0" max="10000" value={nl.lumen}
                  onChange={e=>setNl(p=>({...p,lumen:parseInt(e.target.value)}))}
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-1.5 py-1 text-[10px] text-zinc-200 focus:outline-none focus:border-amber-500/60"/>
              </label>
              <label>
                <span className="text-[9px] text-zinc-500">Kelvin</span>
                <select value={nl.kelvin} onChange={e=>setNl(p=>({...p,kelvin:parseInt(e.target.value)}))}
                  className="w-full bg-zinc-700 border border-zinc-600 rounded px-1.5 py-1 text-[10px] text-zinc-200 focus:outline-none">
                  {[[2700,'Warm'],[3000,'Soft'],[4000,'Neutral'],[5000,'Cool'],[6500,'Daylight']].map(([k,l])=>(
                    <option key={k} value={k}>{k}K – {l}</option>
                  ))}
                </select>
              </label>
            </div>
            <button onClick={()=>addInteriorLight({id:Date.now().toString(),position:[nl.x,nl.y,nl.z],lumen:nl.lumen,kelvin:nl.kelvin})}
              className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[10px] font-semibold rounded transition-colors uppercase tracking-wider">
              + Add Light
            </button>
          </div>
          {interiorLights.length===0
            ? <p className="text-[10px] text-zinc-600 text-center py-2">No interior lights</p>
            : <div className="space-y-1">
                {interiorLights.map(l=>(
                  <div key={l.id} className="flex items-center gap-2 bg-zinc-800/50 rounded px-2 py-1.5">
                    <KelvinBadge k={l.kelvin}/>
                    <span className="text-[9px] text-zinc-300 flex-1 font-mono">[{l.position.map(v=>v.toFixed(1)).join(', ')}] · {l.lumen}lm · {l.kelvin}K</span>
                    <button onClick={()=>removeInteriorLight(l.id)} className="text-zinc-600 hover:text-red-400 text-xs transition-colors">✕</button>
                  </div>
                ))}
              </div>}
        </div>
      </div>
    </div>
  );
}
