import React from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Pool 3D Scene Component - Extracted for use in Universal Canvas
 * This component renders only the 3D geometry without Canvas wrapper
 */
export function PoolScene({ poolData, settings = {} }) {
    const {
        int_l = 12,
        int_w = 8,
        shallow_depth = 1.5,
        deep_depth = 2.8,
        wall_thick = 0.1,
        bed_thick = 0.15,
        pool_shape = 'rectangular'
    } = poolData;

    const {
        showWalls = true,
        showWater = true,
        showDimensions = true,
        waterOpacity = 0.5,
        wallOpacity = 0.8,
    } = settings;

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
                            <meshStandardMaterial color="#1e88e5" opacity={waterOpacity} transparent side={THREE.DoubleSide} />
                        </mesh>
                    );
                })}
            </group>
        );
    };

    const Walls = () => {
        if (!showWalls) return null;

        return (
            <group>
                {/* Front Wall */}
                <mesh position={[0, -(avg_depth + bed_thick) / 2, -int_w / 2 - wall_thick / 2]}>
                    <boxGeometry args={[int_l + 2 * wall_thick, avg_depth + bed_thick, wall_thick]} />
                    <meshStandardMaterial color="#ff6b35" opacity={wallOpacity} transparent />
                </mesh>
                {/* Back Wall */}
                <mesh position={[0, -(avg_depth + bed_thick) / 2, int_w / 2 + wall_thick / 2]}>
                    <boxGeometry args={[int_l + 2 * wall_thick, avg_depth + bed_thick, wall_thick]} />
                    <meshStandardMaterial color="#ff6b35" opacity={wallOpacity} transparent />
                </mesh>
                {/* Left Wall */}
                <mesh position={[-int_l / 2 - wall_thick / 2, -(avg_depth + bed_thick) / 2, 0]}>
                    <boxGeometry args={[wall_thick, avg_depth + bed_thick, int_w]} />
                    <meshStandardMaterial color="#ff6b35" opacity={wallOpacity} transparent />
                </mesh>
                {/* Right Wall */}
                <mesh position={[int_l / 2 + wall_thick / 2, -(avg_depth + bed_thick) / 2, 0]}>
                    <boxGeometry args={[wall_thick, avg_depth + bed_thick, int_w]} />
                    <meshStandardMaterial color="#ff6b35" opacity={wallOpacity} transparent />
                </mesh>
                {/* Bottom Slab */}
                <mesh position={[0, -(avg_depth + bed_thick) + bed_thick / 2, 0]}>
                    <boxGeometry args={[int_l + 2 * wall_thick, bed_thick, int_w + 2 * wall_thick]} />
                    <meshStandardMaterial color="#ff6b35" opacity={wallOpacity} transparent />
                </mesh>
            </group>
        );
    };

    return (
        <group>
            <Walls />
            {showWater && <SlopedBottom />}

            {/* Water Surface */}
            {showWater && (
                <mesh position={[0, -avg_depth / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[int_l, int_w]} />
                    <meshStandardMaterial
                        color="#0066cc"
                        opacity={waterOpacity}
                        transparent
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}

            {/* Pool Outline */}
            <lineSegments>
                <edgesGeometry attach="geometry" args={[new THREE.BoxGeometry(int_l, 0.01, int_w)]} />
                <lineBasicMaterial attach="material" color="#003d7a" linewidth={2} />
            </lineSegments>

            {/* Dimensions */}
            {showDimensions && (
                <>
                    <Html position={[0, 0.5, 0]} center>
                        <div style={{ color: '#003d7a', fontSize: '16px', fontWeight: 'bold', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                            {`${int_l}m × ${int_w}m`}
                        </div>
                    </Html>
                    <Html position={[-int_l / 2 - 1, -shallow_depth / 2, 0]} center>
                        <div style={{ color: '#0066cc', fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                            {`${shallow_depth}m`}
                        </div>
                    </Html>
                    <Html position={[int_l / 2 + 1, -deep_depth / 2, 0]} center>
                        <div style={{ color: '#0066cc', fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                            {`${deep_depth}m`}
                        </div>
                    </Html>
                </>
            )}
        </group>
    );
}

export default PoolScene;
