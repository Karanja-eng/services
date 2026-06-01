import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import { usePlumbingStore } from '../../stores/plumbingStore';

import Pipe3D from './Pipe3D';
import Fixture3D from './Fixture3D';
import Valve3D from './Valve3D';
import Drainage3D from './Drainage3D';
import Storage3D from './Storage3D';

const SCALE = 0.01; // Convert store units (cm) to metres

export default function Plumbing3DView() {
  const { plumbingElements, pipeRoutes } = usePlumbingStore();

  return (
    <div className="w-full h-full bg-gray-900">
      <Canvas
        camera={{ position: [6, 5, 8], fov: 45 }}
        shadows
      >
        <color attach="background" args={['#1c1c1e']} />

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />

        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial color="#2a2a2e" />
        </mesh>

        {/* Grid helper */}
        <Grid args={[50, 50]} cellColor="#3a3a3e" sectionColor="#555" />

        <Suspense fallback={null}>
          {/* Pipe routes */}
          {Object.values(pipeRoutes).map(route => (
            route.points && route.points.length >= 2 && (
              <Pipe3D
                key={route.id}
                points={route.points.map(p => ({
                  x: p.x * SCALE,
                  y: p.y * SCALE,
                  z: p.z * SCALE
                }))}
                size={route.size || 22}
                material={route.material || 'Copper'}
                system={route.system || 'CWS'}
              />
            )
          ))}

          {/* Plumbing elements */}
          {Object.values(plumbingElements).map(el => {
            const pos = [
              el.position.x * SCALE,
              el.position.y * SCALE,
              el.position.z * SCALE
            ];
            const rot = [0, (el.rotation || 0) * Math.PI / 180, 0];

            if (el.category === 'fixture') {
              return (
                <Fixture3D
                  key={el.id}
                  type={el.subType}
                  position={pos}
                  rotation={rot}
                />
              );
            }
            if (el.category === 'valve') {
              return (
                <Valve3D
                  key={el.id}
                  type={el.subType}
                  position={pos}
                  isOpen={el.config?.isOpen !== false}
                />
              );
            }
            if (el.category === 'drain') {
              return (
                <Drainage3D
                  key={el.id}
                  type={el.subType}
                  position={pos}
                />
              );
            }
            if (el.category === 'vessel') {
              return (
                <Storage3D
                  key={el.id}
                  type={el.subType}
                  position={pos}
                  capacity={el.config?.capacity || 100}
                />
              );
            }
            return null;
          })}
        </Suspense>

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
