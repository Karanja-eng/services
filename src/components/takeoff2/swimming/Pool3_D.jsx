import React, { useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Text, Line, Box, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Eye, Rotate3D, Home } from 'lucide-react';

function PoolStructure({ poolData }) {
    const {
        int_l = 12,
        int_w = 8,
        shallow_depth = 1.5,
        deep_depth = 2.8,
        wall_thick = 0.1,
        bed_thick = 0.15,
        pool_shape = 'rectangular'
    } = poolData;

    const avg_depth = (shallow_depth + deep_depth) / 2;

    const WaterGeometry = () => {
        const shape = new THREE.Shape();
        const halfL = int_l / 2;
        const halfW = int_w / 2;

        if (pool_shape === 'rectangular') {
            shape.moveTo(-halfL, -halfW);
            shape.lineTo(halfL, -halfW);
            shape.lineTo(halfL, halfW);
            shape.lineTo(-halfL, halfW);
            shape.closePath();
        } else if (pool_shape === 'kidney') {
            for (let i = 0; i <= 100; i++) {
                const angle = (i / 100) * Math.PI * 2;
                const r = halfL * (1 + 0.3 * Math.sin(angle * 2));
                const x = r * Math.cos(angle);
                const y = (halfW * 0.8) * Math.sin(angle);
                if (i === 0) shape.moveTo(x, y);
                else shape.lineTo(x, y);
            }
            shape.closePath();
        } else if (pool_shape === 'oval') {
            for (let i = 0; i <= 100; i++) {
                const angle = (i / 100) * Math.PI * 2;
                const x = halfL * Math.cos(angle);
                const y = halfW * Math.sin(angle);
                if (i === 0) shape.moveTo(x, y);
                else shape.lineTo(x, y);
            }
            shape.closePath();
        } else {
            shape.moveTo(-halfL, -halfW);
            shape.lineTo(halfL, -halfW);
            shape.lineTo(halfL, halfW);
            shape.lineTo(-halfL, halfW);
            shape.closePath();
        }

        const extrudeSettings = {
            steps: 10,
            depth: avg_depth,
            bevelEnabled: false
        };

        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    };

    const SlopedBottom = () => {
        const points = [];
        const segments = 20;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = -int_l / 2 + t * int_l;
            const depth = shallow_depth + t * (deep_depth - shallow_depth);
            points.push(new THREE.Vector3(x, -depth, -int_w / 2));
        }
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = int_l / 2 - t * int_l;
            const depth = deep_depth - t * (deep_depth - shallow_depth);
            points.push(new THREE.Vector3(x, -depth, int_w / 2));
        }

        return (
            <group>
                {points.slice(0, segments).map((point, i) => {
                    const nextPoint = points[i + 1];
                    const point2 = points[segments + 1 + i];
                    const nextPoint2 = points[segments + i];

                    const vertices = new Float32Array([
                        point.x, point.y, point.z,
                        nextPoint.x, nextPoint.y, nextPoint.z,
                        point2.x, point2.y, point2.z,
                        nextPoint.x, nextPoint.y, nextPoint.z,
                        nextPoint2.x, nextPoint2.y, nextPoint2.z,
                        point2.x, point2.y, point2.z,
                    ]);

                    return (
                        <mesh key={i}>
                            <bufferGeometry>
                                <bufferAttribute
                                    attach="attributes-position"
                                    count={6}
                                    array={vertices}
                                    itemSize={3}
                                />
                            </bufferGeometry>
                            <meshStandardMaterial color="#1e88e5" opacity={0.6} transparent side={THREE.DoubleSide} />
                        </mesh>
                    );
                })}
            </group>
        );
    };

    const Walls = () => {
        return (
            <group>
                <Box
                    args={[int_l + 2 * wall_thick, avg_depth + bed_thick, wall_thick]}
                    position={[0, -(avg_depth + bed_thick) / 2, -int_w / 2 - wall_thick / 2]}
                >
                    <meshStandardMaterial color="#ff6b35" opacity={0.8} transparent />
                </Box>
                <Box
                    args={[int_l + 2 * wall_thick, avg_depth + bed_thick, wall_thick]}
                    position={[0, -(avg_depth + bed_thick) / 2, int_w / 2 + wall_thick / 2]}
                >
                    <meshStandardMaterial color="#ff6b35" opacity={0.8} transparent />
                </Box>
                <Box
                    args={[wall_thick, avg_depth + bed_thick, int_w]}
                    position={[-int_l / 2 - wall_thick / 2, -(avg_depth + bed_thick) / 2, 0]}
                >
                    <meshStandardMaterial color="#ff6b35" opacity={0.8} transparent />
                </Box>
                <Box
                    args={[wall_thick, avg_depth + bed_thick, int_w]}
                    position={[int_l / 2 + wall_thick / 2, -(avg_depth + bed_thick) / 2, 0]}
                >
                    <meshStandardMaterial color="#ff6b35" opacity={0.8} transparent />
                </Box>
                <Box
                    args={[int_l + 2 * wall_thick, bed_thick, int_w + 2 * wall_thick]}
                    position={[0, -(avg_depth + bed_thick) + bed_thick / 2, 0]}
                >
                    <meshStandardMaterial color="#ff6b35" opacity={0.8} transparent />
                </Box>
            </group>
        );
    };

    return (
        <group>
            <Walls />
            <SlopedBottom />

            <mesh position={[0, -avg_depth / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[int_l, int_w]} />
                <meshStandardMaterial
                    color="#0066cc"
                    opacity={0.5}
                    transparent
                    side={THREE.DoubleSide}
                />
            </mesh>

            <Line
                points={[
                    [-int_l / 2, 0, -int_w / 2],
                    [int_l / 2, 0, -int_w / 2],
                    [int_l / 2, 0, int_w / 2],
                    [-int_l / 2, 0, int_w / 2],
                    [-int_l / 2, 0, -int_w / 2],
                ]}
                color="#003d7a"
                lineWidth={2}
            />

            <Text
                position={[0, 0.5, 0]}
                fontSize={0.5}
                color="#003d7a"
                anchorX="center"
                anchorY="middle"
            >
                {`${int_l}m × ${int_w}m`}
            </Text>
            <Text
                position={[-int_l / 2 - 1, -shallow_depth / 2, 0]}
                fontSize={0.4}
                color="#0066cc"
                anchorX="center"
                anchorY="middle"
            >
                {`${shallow_depth}m`}
            </Text>
            <Text
                position={[int_l / 2 + 1, -deep_depth / 2, 0]}
                fontSize={0.4}
                color="#0066cc"
                anchorX="center"
                anchorY="middle"
            >
                {`${deep_depth}m`}
            </Text>
        </group>
    );
}

function Scene({ poolData, viewMode }) {
    const controlsRef = useRef();

    const resetCamera = () => {
        if (controlsRef.current) {
            controlsRef.current.reset();
        }
    };

    return (
        <>
            <PerspectiveCamera
                makeDefault
                position={viewMode === 'top' ? [0, 15, 0.1] : [15, 10, 15]}
                fov={50}
            />
            <OrbitControls
                ref={controlsRef}
                enableDamping
                dampingFactor={0.05}
                minDistance={5}
                maxDistance={50}
            />

            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
            <directionalLight position={[-10, 10, -5]} intensity={0.5} />

            <Grid args={[50, 50]} cellColor="#6e6e6e" sectionColor="#3c3c3c" fadeDistance={50} />

            <Suspense fallback={null}>
                <PoolStructure poolData={poolData} />
            </Suspense>

            <axesHelper args={[5]} />
        </>
    );
}

export default function Pool3DVisualization({ poolData = {} }) {
    const [viewMode, setViewMode] = useState('perspective');

    return (
        <div className="w-full h-full bg-gray-900 flex flex-col">
            <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-white">3D Pool Visualization</h2>
                    <span className="text-sm text-gray-400">
                        {poolData.int_l || 12}m × {poolData.int_w || 8}m × {poolData.deep_depth || 2.8}m
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setViewMode('perspective')}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'perspective'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                    >
                        <Rotate3D className="w-4 h-4" />
                        3D View
                    </button>
                    <button
                        onClick={() => setViewMode('top')}
                        className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${viewMode === 'top'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                    >
                        <Eye className="w-4 h-4" />
                        Top View
                    </button>
                </div>
            </div>

            <div className="flex-1">
                <Canvas shadows>
                    <Scene poolData={poolData} viewMode={viewMode} />
                </Canvas>
            </div>

            <div className="bg-gray-800 border-t border-gray-700 p-3">
                <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>Use mouse to rotate, zoom, and pan</span>
                    <span>Pool Type: {(poolData.pool_shape || 'rectangular').toUpperCase()}</span>
                </div>
            </div>
        </div>
    );
}