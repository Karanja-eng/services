import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { useElectricalStore } from '../../stores/electricalStore';

import SwitchSocket3D from './SwitchSocket3D';
import Lighting3D from './Lighting3D';
import ConsumerUnit3D from './ConsumerUnit3D';
import SafetyDevice3D from './SafetyDevice3D';

export default function Electrical3DView() {
  const { elements } = useElectricalStore();

  return (
    <div className="w-full h-full bg-gray-900">
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <color attach="background" args={['#1a1a1a']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        
        <Grid args={[100, 100]} cellColor="#333" sectionColor="#555" />
        
        <Suspense fallback={null}>
          {Object.values(elements).map(el => {
            const pos = [el.position.x / 100, el.position.y, el.position.z / 100];
            const rot = [0, el.rotation || 0, 0];

            if (el.elementType === 'socket' || el.elementType === 'switch') {
              return <SwitchSocket3D key={el.id} type={el.subType} gang={el.config.gang} position={pos} rotation={rot} />;
            }
            if (el.elementType === 'light') {
              return <Lighting3D key={el.id} type={el.subType} cct={el.config.cct} position={pos} />;
            }
            if (el.elementType === 'db') {
              return <ConsumerUnit3D key={el.id} position={pos} ways={12} />;
            }
            if (el.elementType === 'safetyDevice') {
              return <SafetyDevice3D key={el.id} type={el.subType} position={pos} />;
            }
            return null;
          })}
        </Suspense>

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
