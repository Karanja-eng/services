import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { buildTerrainGeometry, extractContours } from './terrainUtils';

const TERRAIN_MATERIALS = {
    grass: { color: '#4a7c3a', roughness: 1.0, metalness: 0 },
    gravel: { color: '#9a8870', roughness: 0.95, metalness: 0 },
    sand: { color: '#c8b870', roughness: 0.9, metalness: 0 },
    rock: { color: '#7a7060', roughness: 0.8, metalness: 0.1 },
};

export function Terrain3D({ terrain }) {
    const { grid, cellSize = 1, material = 'grass' } = terrain;
    const mat = TERRAIN_MATERIALS[material] || TERRAIN_MATERIALS.grass;

    const geom = useMemo(() => buildTerrainGeometry(grid, cellSize), [grid, cellSize]);

    const contourLevels = useMemo(() => {
        const flat = grid.flat();
        const min = Math.min(...flat), max = Math.max(...flat);
        const step = (max - min) / 8;
        return Array.from({ length: 8 }, (_, i) => min + step * i);
    }, [grid]);

    const contours = useMemo(
        () => extractContours(grid, cellSize, contourLevels),
        [grid, cellSize, contourLevels]
    );

    const cols = grid[0].length;
    const rows = grid.length;
    const offsetX = -((cols - 1) * cellSize) / 2;
    const offsetZ = -((rows - 1) * cellSize) / 2;

    return (
        <group position={[offsetX, 0, offsetZ]}>
            {/* Terrain mesh */}
            <mesh geometry={geom} receiveShadow>
                <meshStandardMaterial
                    color={mat.color}
                    roughness={mat.roughness}
                    metalness={mat.metalness}
                    side={THREE.FrontSide}
                />
            </mesh>

            {/* Contour lines */}
            {contours.map(({ level, segments }) =>
                segments.map(([[x0, z0], [x1, z1]], i) => {
                    const y = level + 0.02;
                    const points = [
                        new THREE.Vector3(x0, y, z0),
                        new THREE.Vector3(x1, y, z1),
                    ];
                    return <ContourLine key={`${level}-${i}`} points={points} level={level} />;
                })
            )}
        </group>
    );
}

function ContourLine({ points, level }) {
    const geom = useMemo(() => {
        const g = new THREE.BufferGeometry().setFromPoints(points);
        return g;
    }, [points]);

    const isMajor = Math.abs(level % 5) < 0.1;

    return (
        <line geometry={geom}>
            <lineBasicMaterial
                color={isMajor ? '#5a9a5a' : '#3a6a3a'}
                linewidth={isMajor ? 2 : 1}
                transparent
                opacity={isMajor ? 0.8 : 0.5}
            />
        </line>
    );
}

/**
 * Swale (V-channel drainage cut in terrain).
 */
export function Swale3D({ path, width = 1.5, depth = 0.5 }) {
    const geom = useMemo(() => {
        if (!path || path.length < 2) return null;
        const shape = new THREE.Shape();
        shape.moveTo(-width / 2, 0);
        shape.lineTo(0, -depth);
        shape.lineTo(width / 2, 0);
        shape.closePath();

        const curvePts = path.map(([x, z]) => new THREE.Vector3(x, 0, z));
        const curve = new THREE.CatmullRomCurve3(curvePts);
        const extrudeSettings = {
            extrudePath: curve,
            steps: path.length * 10,
            bevelEnabled: false,
        };
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }, [path, width, depth]);

    if (!geom) return null;

    return (
        <mesh geometry={geom}>
            <meshStandardMaterial color="#3a5a30" roughness={1.0} side={THREE.DoubleSide} />
        </mesh>
    );
}

/**
 * Retaining wall — vertical extruded slab along path.
 */
export function RetainingWall3D({ path, height = 1.2, thickness = 0.25 }) {
    const geom = useMemo(() => {
        if (!path || path.length < 2) return null;
        const pts2D = path.map(([x, z]) => new THREE.Vector2(x, z));
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(thickness, 0);
        shape.lineTo(thickness, height);
        shape.lineTo(0, height);
        shape.closePath();

        const curvePts = path.map(([x, z]) => new THREE.Vector3(x, 0, z));
        const curve = new THREE.CatmullRomCurve3(curvePts);
        return new THREE.ExtrudeGeometry(shape, {
            extrudePath: curve,
            steps: path.length * 8,
            bevelEnabled: false,
        });
    }, [path, height, thickness]);

    if (!geom) return null;

    return (
        <mesh geometry={geom} castShadow receiveShadow>
            <meshStandardMaterial color="#8a8070" roughness={0.7} />
        </mesh>
    );
}