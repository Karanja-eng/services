import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Sky, Environment, Stats } from '@react-three/drei';
import { useStore } from './useStore';
import { Road3D } from './Road3D';
import { Terrain3D } from './Terrain3D';
import { Tree3D } from './Tree3D';
import { ParkingArea3D } from './ParkingArea3D';
import { Fence3D } from './Fence3D';
import { Light3D } from './Light3D';
import { WaterFeature3D } from './WaterFeature3D';

export function Viewport3D() {
    const { elements, terrain, gridVisible } = useStore();

    return (
        <div className="relative w-full h-full bg-[#0d1420]">
            {/* Overlay label */}
            <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-[#0d1420]/80 border border-[#2a3144] rounded text-xs text-[#4a6fa5] font-mono">
                ◈ 3D VIEW
            </div>

            <Canvas
                shadows
                camera={{ position: [40, 30, 40], fov: 45, near: 0.1, far: 2000 }}
                gl={{ antialias: true }}
                style={{ background: '#0d1420' }}
            >
                <Suspense fallback={null}>
                    {/* Lighting */}
                    <ambientLight intensity={0.4} />
                    <directionalLight
                        position={[50, 80, 30]}
                        intensity={1.2}
                        castShadow
                        shadow-mapSize={[2048, 2048]}
                        shadow-camera-near={1}
                        shadow-camera-far={300}
                        shadow-camera-left={-80}
                        shadow-camera-right={80}
                        shadow-camera-top={80}
                        shadow-camera-bottom={-80}
                    />
                    <hemisphereLight skyColor="#b1e1ff" groundColor="#3a5a3a" intensity={0.3} />

                    <Sky sunPosition={[50, 20, 10]} turbidity={6} rayleigh={1} />
                    <Environment preset="park" />

                    {/* Ground grid */}
                    {gridVisible && (
                        <Grid
                            args={[200, 200]}
                            cellSize={1}
                            cellThickness={0.3}
                            cellColor="#1a2540"
                            sectionSize={10}
                            sectionThickness={0.8}
                            sectionColor="#243050"
                            fadeDistance={120}
                            fadeStrength={1}
                            position={[0, 0.01, 0]}
                        />
                    )}

                    {/* Terrain */}
                    {terrain && <Terrain3D terrain={terrain} />}

                    {/* All scene elements */}
                    {elements.map(el => <SceneElement3D key={el.id} element={el} />)}

                    {/* Camera controls */}
                    <OrbitControls
                        makeDefault
                        maxPolarAngle={Math.PI / 2.05}
                        enableDamping
                        dampingFactor={0.05}
                    />
                </Suspense>

                <Stats className="!absolute !bottom-2 !left-2" />
            </Canvas>
        </div>
    );
}

function SceneElement3D({ element }) {
    switch (element.type) {
        case 'road':
        case 'path':
        case 'driveway':
            return <Road3D element={element} />;
        case 'parking':
            return <ParkingArea3D element={element} />;
        case 'tree':
            return <Tree3D element={element} />;
        case 'fence':
            return <Fence3D element={element} />;
        case 'light':
            return <Light3D element={element} />;
        case 'water':
            return <WaterFeature3D element={element} />;
        default:
            return null;
    }
}