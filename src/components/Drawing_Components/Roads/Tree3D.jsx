import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Detailed } from '@react-three/drei';

const TREE_COLORS = {
    deciduous: { trunk: '#5a3a1a', canopy: '#2d6a1a' },
    conifer: { trunk: '#4a2a10', canopy: '#1a4a1a' },
    palm: { trunk: '#8a6a30', canopy: '#3a8a1a' },
    shrub: { trunk: '#5a4a20', canopy: '#4a7a2a' },
};

/**
 * Tree3D — renders with 3 LOD levels.
 *  LOD 0 (< 20m) : detailed multi-geometry
 *  LOD 1 (< 60m) : simplified sphere + cylinder
 *  LOD 2 (< 200m): single merged cone/sphere
 */
export function Tree3D({ element }) {
    const { origin, species = 'deciduous', scale = 1 } = element;
    if (!origin) return null;

    const [x, z] = origin;
    const colors = TREE_COLORS[species] || TREE_COLORS.deciduous;

    return (
        <group position={[x, 0, z]} scale={scale}>
                <Detailed>
                    {/* LOD 0 — Detailed */}
                    <DetailedTree species={species} colors={colors} distance={0} />
                    {/* LOD 1 — Medium */}
                    <MediumTree species={species} colors={colors} distance={20} />
                    {/* LOD 2 — Far */}
                    <FarTree species={species} colors={colors} distance={60} />
                </Detailed>
        </group>
    );
}

function DetailedTree({ species, colors }) {
    if (species === 'conifer') {
        return (
            <group>
                <mesh position={[0, 1.5, 0]} castShadow>
                    <cylinderGeometry args={[0.15, 0.25, 3, 8]} />
                    <meshStandardMaterial color={colors.trunk} roughness={0.9} />
                </mesh>
                <mesh position={[0, 5, 0]} castShadow>
                    <coneGeometry args={[2, 5, 8]} />
                    <meshStandardMaterial color={colors.canopy} roughness={1.0} />
                </mesh>
                <mesh position={[0, 4, 0]} castShadow>
                    <coneGeometry args={[2.5, 3.5, 8]} />
                    <meshStandardMaterial color={colors.canopy} roughness={1.0} />
                </mesh>
                <mesh position={[0, 3, 0]} castShadow>
                    <coneGeometry args={[3, 3, 8]} />
                    <meshStandardMaterial color={colors.canopy} roughness={1.0} />
                </mesh>
            </group>
        );
    }

    if (species === 'palm') {
        return (
            <group>
                {/* Curved trunk */}
                {Array.from({ length: 8 }, (_, i) => {
                    const t = i / 7;
                    const angle = t * 0.3;
                    const y = t * 6;
                    return (
                        <mesh key={i} position={[Math.sin(angle) * 0.3, y, 0]} castShadow>
                            <cylinderGeometry args={[0.2 - t * 0.08, 0.25 - t * 0.05, 1, 6]} />
                            <meshStandardMaterial color={colors.trunk} roughness={0.95} />
                        </mesh>
                    );
                })}
                {/* Fronds */}
                {Array.from({ length: 8 }, (_, i) => {
                    const angle = (i / 8) * Math.PI * 2;
                    return (
                        <mesh
                            key={i}
                            position={[Math.cos(angle) * 2, 6.5, Math.sin(angle) * 2]}
                            rotation={[0.8, angle, 0]}
                            castShadow
                        >
                            <planeGeometry args={[0.4, 3]} />
                            <meshStandardMaterial color={colors.canopy} roughness={1.0} side={THREE.DoubleSide} />
                        </mesh>
                    );
                })}
            </group>
        );
    }

    if (species === 'shrub') {
        return (
            <group>
                <mesh position={[0, 0.6, 0]} castShadow>
                    <sphereGeometry args={[0.8, 8, 6]} />
                    <meshStandardMaterial color={colors.canopy} roughness={1.0} />
                </mesh>
                <mesh position={[0.4, 0.5, 0.3]} castShadow>
                    <sphereGeometry args={[0.5, 6, 5]} />
                    <meshStandardMaterial color={colors.canopy} roughness={1.0} />
                </mesh>
            </group>
        );
    }

    // Deciduous (default)
    return (
        <group>
            <mesh position={[0, 2, 0]} castShadow>
                <cylinderGeometry args={[0.2, 0.35, 4, 8]} />
                <meshStandardMaterial color={colors.trunk} roughness={0.9} />
            </mesh>
            <mesh position={[0, 6, 0]} castShadow>
                <sphereGeometry args={[3, 10, 8]} />
                <meshStandardMaterial color={colors.canopy} roughness={1.0} />
            </mesh>
            <mesh position={[-1, 5, 0.8]} castShadow>
                <sphereGeometry args={[1.8, 8, 6]} />
                <meshStandardMaterial color={colors.canopy} roughness={1.0} />
            </mesh>
            <mesh position={[1.2, 5.2, -0.5]} castShadow>
                <sphereGeometry args={[2, 8, 6]} />
                <meshStandardMaterial color={colors.canopy} roughness={1.0} />
            </mesh>
        </group>
    );
}

function MediumTree({ species, colors }) {
    const trunkH = species === 'shrub' ? 0.3 : 4;
    const canopyR = species === 'conifer' ? 1.5 : species === 'shrub' ? 1 : 2.5;
    const canopyY = species === 'shrub' ? 1 : trunkH + canopyR;

    if (species === 'conifer') {
        return (
            <group>
                <mesh position={[0, trunkH / 2, 0]} castShadow>
                    <cylinderGeometry args={[0.15, 0.2, trunkH, 6]} />
                    <meshStandardMaterial color={colors.trunk} roughness={0.9} />
                </mesh>
                <mesh position={[0, canopyY, 0]} castShadow>
                    <coneGeometry args={[canopyR, canopyR * 2.5, 6]} />
                    <meshStandardMaterial color={colors.canopy} roughness={1.0} />
                </mesh>
            </group>
        );
    }

    return (
        <group>
            <mesh position={[0, trunkH / 2, 0]} castShadow>
                <cylinderGeometry args={[0.15, 0.25, trunkH, 6]} />
                <meshStandardMaterial color={colors.trunk} roughness={0.9} />
            </mesh>
            <mesh position={[0, canopyY, 0]} castShadow>
                <sphereGeometry args={[canopyR, 8, 6]} />
                <meshStandardMaterial color={colors.canopy} roughness={1.0} />
            </mesh>
        </group>
    );
}

function FarTree({ species, colors }) {
    const h = species === 'conifer' ? 4 : 3;
    if (species === 'conifer') {
        return (
            <mesh position={[0, h, 0]} castShadow>
                <coneGeometry args={[1.5, h * 2, 5]} />
                <meshStandardMaterial color={colors.canopy} roughness={1.0} />
            </mesh>
        );
    }
    return (
        <mesh position={[0, h, 0]} castShadow>
            <sphereGeometry args={[2, 5, 4]} />
            <meshStandardMaterial color={colors.canopy} roughness={1.0} />
        </mesh>
    );
}