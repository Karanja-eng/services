import { useRenderStore } from '../rendering/RenderingEngine.jsx';

const MODES = [
  { id:'realistic',  label:'Realistic',  desc:'Full PBR + shadows + post-processing', icon:'◉' },
  { id:'conceptual', label:'Conceptual', desc:'Flat-shaded, no reflections',           icon:'◫' },
  { id:'wireframe',  label:'Wireframe',  desc:'Geometry edges only',                   icon:'⬡' },
  { id:'xray',       label:'X-Ray',      desc:'Semi-transparent surfaces',             icon:'◌' },
  { id:'ao_only',    label:'AO Only',    desc:'Ambient occlusion pass',               icon:'◍' },
];

export default function RenderPanel({ onScreenshot, className='' }) {
  const { renderMode,setRenderMode,fov,setFOV,resolution,setResolution,
          postProcessing,togglePostProcessing,bloomIntensity,setBloom } = useRenderStore();
  return (
    <div className={`flex flex-col bg-zinc-900 text-zinc-200 rounded-xl overflow-hidden border border-zinc-700/50 shadow-2xl ${className}`}
      style={{fontFamily:"'DM Mono','Courier New',monospace"}}>
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/80">
        <p className="text-[10px] text-amber-400 tracking-[0.2em] uppercase font-semibold">Render Settings</p>
      </div>
      <div className="overflow-y-auto p-3 space-y-4" style={{maxHeight:480}}>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">View Mode</p>
          <div className="space-y-1">
            {MODES.map(m=>(
              <button key={m.id} onClick={()=>setRenderMode(m.id)}
                className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-all
                  ${renderMode===m.id?'bg-amber-500/15 border border-amber-500/40 text-amber-300':'bg-zinc-800/50 border border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}>
                <span className="text-base leading-none mt-0.5 flex-shrink-0">{m.icon}</span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide">{m.label}</p>
                  <p className="text-[9px] opacity-60 leading-tight">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Camera</p>
          <label className="block">
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-zinc-400">Field of View</span>
              <span className="text-[10px] text-zinc-300 font-mono">{fov}°</span>
            </div>
            <input type="range" min="15" max="90" step="1" value={fov}
              onChange={e=>setFOV(parseInt(e.target.value))} className="w-full accent-amber-400"/>
          </label>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Post-Processing</p>
            <button onClick={togglePostProcessing}
              className={`w-10 h-5 rounded-full relative transition-all ${postProcessing?'bg-amber-500':'bg-zinc-700'}`}>
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${postProcessing?'left-5':'left-0.5'}`}/>
            </button>
          </div>
          {postProcessing && (
            <label className="block">
              <div className="flex justify-between mb-1">
                <span className="text-[10px] text-zinc-400">Bloom Intensity</span>
                <span className="text-[10px] text-zinc-300 font-mono">{bloomIntensity.toFixed(2)}</span>
              </div>
              <input type="range" min="0" max="1" step="0.01" value={bloomIntensity}
                onChange={e=>setBloom(parseFloat(e.target.value))} className="w-full accent-yellow-400"/>
            </label>
          )}
        </div>
        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Export Resolution</p>
          <div className="grid grid-cols-3 gap-1">
            {[[1,'1× Native'],[2,'2× HD'],[4,'4× 4K']].map(([r,l])=>(
              <button key={r} onClick={()=>setResolution(r)}
                className={`py-1.5 rounded text-[10px] font-medium transition-all
                  ${resolution===r?'bg-amber-500 text-zinc-950':'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <button onClick={onScreenshot}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 text-xs font-bold rounded-lg transition-all uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95">
          ⬇ Export PNG
        </button>
        <div className="bg-zinc-800/40 rounded-lg p-2">
          <p className="text-[9px] text-zinc-500 leading-relaxed">SSAO · Bloom · FXAA · ACESFilmic tone mapping in realistic mode. Shadows: PCFSoft, 2048².</p>
        </div>
      </div>
    </div>
  );
}
