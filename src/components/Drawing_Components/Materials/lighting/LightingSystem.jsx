import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Sky, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { create } from 'zustand';

export const useLightingStore = create((set) => ({
  mode: 'daylight',
  latitude: 51.5, longitude: -0.12, timeOfDay: 12.0,
  turbidity: 3.0, rayleigh: 1.0, ambientIntensity: 0.3,
  interiorLights: [],
  setMode:  (mode) => set({ mode }),
  setSun:   (p)    => set(s => ({ ...s, ...p })),
  setAmbient:(i)   => set({ ambientIntensity: i }),
  addInteriorLight:   (l) => set(s => ({ interiorLights: [...s.interiorLights, l] })),
  removeInteriorLight:(id)=> set(s => ({ interiorLights: s.interiorLights.filter(l=>l.id!==id) })),
  updateInteriorLight:(id,p)=>set(s=>({ interiorLights: s.interiorLights.map(l=>l.id===id?{...l,...p}:l) })),
}));

export function kelvinToColor(k) {
  const t = k / 100;
  let r,g,b;
  if (t<=66) {
    r=255;
    g=Math.max(0,Math.min(255, 99.47*Math.log(t)-161.12));
    b=t<=19?0:Math.max(0,Math.min(255, 138.52*Math.log(t-10)-305.04));
  } else {
    r=Math.max(0,Math.min(255, 329.70*Math.pow(t-60,-0.1332)));
    g=Math.max(0,Math.min(255, 288.12*Math.pow(t-60,-0.0755)));
    b=255;
  }
  return new THREE.Color(r/255, g/255, b/255);
}

export function sunPosition(lat, lon, time) {
  const latR = lat*Math.PI/180;
  const ha   = ((time-12)*15*Math.PI)/180;
  const dec  = (23.45*Math.PI)/180;
  const sinAlt = Math.sin(latR)*Math.sin(dec)+Math.cos(latR)*Math.cos(dec)*Math.cos(ha);
  const alt  = Math.asin(Math.max(-1,Math.min(1,sinAlt)));
  const cosAz= (Math.sin(dec)-Math.sin(latR)*sinAlt)/(Math.cos(latR)*Math.cos(alt));
  const az   = (time<12?1:-1)*Math.acos(Math.max(-1,Math.min(1,cosAz)));
  return {
    x: Math.cos(alt)*Math.sin(az)*100,
    y: Math.sin(alt)*100,
    z: Math.cos(alt)*Math.cos(az)*100,
  };
}

export const LIGHTING_MODES = {
  architectural:{ ambientIntensity:0.8, dirIntensity:0.6, dirColor:'#ffffff', envPreset:'studio',  turbidity:2, rayleigh:0.5, timeOfDay:12, skyVisible:false },
  daylight:     { ambientIntensity:0.3, dirIntensity:1.2, dirColor:'#fffaf0', envPreset:'city',    turbidity:3, rayleigh:1.0, timeOfDay:14, skyVisible:true  },
  golden_hour:  { ambientIntensity:0.25,dirIntensity:1.5, dirColor:'#ff9a3c', envPreset:'sunset',  turbidity:6, rayleigh:4.0, timeOfDay:18.5,skyVisible:true },
  night:        { ambientIntensity:0.05,dirIntensity:0.1, dirColor:'#3355aa', envPreset:'warehouse',turbidity:10,rayleigh:0.2, timeOfDay:22, skyVisible:false },
};

function InteriorLight({ position, lumen=800, kelvin=3000 }) {
  return (
    <pointLight
      position={position}
      intensity={lumen/800}
      color={kelvinToColor(kelvin)}
      distance={8} decay={2} castShadow
    />
  );
}

export function LightingRig() {
  const { mode,latitude,longitude,timeOfDay,turbidity,rayleigh,ambientIntensity,interiorLights } = useLightingStore();
  const { gl } = useThree();
  const preset = LIGHTING_MODES[mode] || LIGHTING_MODES.daylight;
  const t = preset.timeOfDay || timeOfDay;
  const sun = sunPosition(latitude, longitude, t);

  useEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
  }, [gl]);

  const VALID_PRESETS = ['apartment','city','dawn','forest','lobby','night','park','studio','sunset','warehouse'];
  const envPreset = VALID_PRESETS.includes(preset.envPreset) ? preset.envPreset : 'city';

  return (
    <>
      <Environment preset={envPreset} background={false} />
      <ambientLight intensity={preset.ambientIntensity ?? ambientIntensity} />
      {sun.y > -10 && (
        <directionalLight
          position={[sun.x, Math.max(5,sun.y), sun.z]}
          intensity={preset.dirIntensity}
          color={preset.dirColor}
          castShadow
          shadow-mapSize={[2048,2048]}
          shadow-normalBias={0.04}
          shadow-camera-near={0.1}
          shadow-camera-far={500}
          shadow-camera-left={-50}
          shadow-camera-right={50}
          shadow-camera-top={50}
          shadow-camera-bottom={-50}
        />
      )}
      {preset.skyVisible && (
        <Sky
          sunPosition={[sun.x,sun.y,sun.z]}
          turbidity={preset.turbidity ?? turbidity}
          rayleigh={preset.rayleigh ?? rayleigh}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
        />
      )}
      {interiorLights.map(l => <InteriorLight key={l.id} {...l} />)}
    </>
  );
}

export function setLighting(mode, params={}) {
  const s = useLightingStore.getState();
  s.setMode(mode);
  if (params.latitude   !== undefined) s.setSun({ latitude:   params.latitude });
  if (params.longitude  !== undefined) s.setSun({ longitude:  params.longitude });
  if (params.timeOfDay  !== undefined) s.setSun({ timeOfDay:  params.timeOfDay });
  if (params.turbidity  !== undefined) s.setSun({ turbidity:  params.turbidity });
}
