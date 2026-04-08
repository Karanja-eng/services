import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../../store/useStore';
import {
    buildRoadGeometry,
    buildCurvedRoadGeometry,
    buildKerbGeometry,
    buildRoundaboutGeometry,
    buildCulDeSacGeometry,
} from '../../utils/roadGeometry';

const ROAD_COLORS = {
    asphalt: '#1a1a1a',
    concrete: '#b0a898',
    block_paving: '#8a7060',
    gravel: '#9a8870',
    paving: '#a0956a',
};

const KERB_COLOR = '#555555';
const MARKING_COLOR = '#eeeeee';
const YELLOW_LINE_COLOR = '#ffcc00';

export function Road3D({ element }) {
    const { selectedIds } = useStore();
    const isSelected = selectedIds.includes(element.id);
    const { path, width, material, markings, kerb, subType } = element;

    const roadColor = ROAD_COLORS[material] || ROAD_COLORS.asphalt;

    // ── Road surface geometry ──────────────────────────────────────
    const roadGeom = useMemo(() => {
        if (!path || path.length < 2) return null;

        if (subType === 'curved') {
            const ctrl3D = path.map(([x, z]) => [x, 0, z]);
            return buildCurvedRoadGeometry(ctrl3D, width);
        }
        if (subType === 'roundabout') {
            return buildRoundaboutGeometry([0, 0, 0], width / 2 + 3, 3);
        }
        if (subType === 'cul_de_sac') {
            const last = path[path.length - 1];
            return buildCulDeSacGeometry([last[0], 0, last[1]], width / 2 + 1.5);
        }

        return buildRoadGeometry(path, width);
    }, [path, width, subType]);

    // ── Kerb geometry ──────────────────────────────────────────────
    const kerbGeomL = useMemo(() => {
        if (!path || !kerb || kerb === 'none' || subType === 'roundabout') return null;
        return buildKerbGeometry(path, width / 2, 'left');
    }, [path, width, kerb, subType]);

    const kerbGeomR = useMemo(() => {
        if (!path || !kerb || kerb === 'none' || subType === 'roundabout') return null;
        return buildKerbGeometry(path, width / 2, 'right');
    }, [path, width, kerb, subType]);

    // ── Road markings ──────────────────────────────────────────────
    const markingMeshes = useMemo(() => {
        if (!path || path.length < 2 || !markings?.length) return [];
        return generateMarkingMeshes(path, width, markings);
    }, [path, width, markings]);

    if (!roadGeom) return null;

    return (
        <group>
            {/* Road surface */}
            <mesh geometry={roadGeom} receiveShadow>
                <meshStandardMaterial
                    color={roadColor}
                    roughness={0.9}
                    metalness={0.0}
                    emissive={isSelected ? '#003366' : '#000000'}
                    emissiveIntensity={isSelected ? 0.3 : 0}
                />
            </mesh>

            {/* Kerbs */}
            {kerbGeomL && (
                <mesh geometry={kerbGeomL} castShadow receiveShadow>
                    <meshStandardMaterial color={KERB_COLOR} roughness={0.7} />
                </mesh>
            )}
            {kerbGeomR && (
                <mesh geometry={kerbGeomR} castShadow receiveShadow>
                    <meshStandardMaterial color={KERB_COLOR} roughness={0.7} />
                </mesh>
            )}

            {/* Verge (grass strip) */}
            {element.verge > 0 && path?.length >= 2 && (
                <VergeStrip path={path} roadWidth={width} vergeWidth={element.verge} />
            )}

            {/* Markings */}
            {markingMeshes.map((m, i) => (
                <mesh key={i} geometry={m.geom} position={[0, 0.005, 0]}>
                    <meshStandardMaterial
                        color={m.color || MARKING_COLOR}
                        roughness={0.5}
                        depthTest={true}
                        polygonOffset={true}
                        polygonOffsetFactor={-1}
                        polygonOffsetUnits={-1}
                    />
                </mesh>
            ))}
        </group>
    );
}

// ── Verge strip ────────────────────────────────────────────────────────────

function VergeStrip({ path, roadWidth, vergeWidth }) {
    const geomL = useMemo(() => buildRoadGeometry(path, vergeWidth, 0.05).translate(
        ...offsetAlongPath(path, roadWidth / 2 + vergeWidth / 2, 'left'), 0
    ), [path, roadWidth, vergeWidth]);

    return (
        <group>
            <mesh position={[0, 0, 0]} receiveShadow>
                <primitive object={buildRoadGeometry(path, vergeWidth, 0.05)} />
                <meshStandardMaterial color="#3d6b35" roughness={1.0} />
            </mesh>
        </group>
    );
}

// ── Marking generation ─────────────────────────────────────────────────────

function generateMarkingMeshes(path, width, markings) {
    const meshes = [];

    if (markings.includes('centre')) {
        meshes.push({ geom: buildDashedLine(path, 0, 0.10, 3.0, 2.0), color: '#ffffff' });
    }
    if (markings.includes('edge')) {
        meshes.push({ geom: buildSolidLine(path, width / 2 - 0.15, 0.08), color: '#ffffff' });
        meshes.push({ geom: buildSolidLine(path, -(width / 2 - 0.15), 0.08), color: '#ffffff' });
    }
    if (markings.includes('double_yellow')) {
        meshes.push({ geom: buildSolidLine(path, 0.10, 0.05), color: '#ffcc00' });
        meshes.push({ geom: buildSolidLine(path, -0.10, 0.05), color: '#ffcc00' });
    }
    if (markings.includes('stop_line')) {
        const last = path[path.length - 1];
        const second = path[path.length - 2];
        const dir = [last[0] - second[0], last[1] - second[1]];
        const len = Math.hypot(...dir);
        const perp = [-dir[1] / len, dir[0] / len];
        const markPts = [
            [last[0] - perp[0] * width / 2, last[1] - perp[1] * width / 2],
            [last[0] + perp[0] * width / 2, last[1] + perp[1] * width / 2],
        ];
        meshes.push({ geom: buildRoadGeometry(markPts, 0.3, 0.01), color: '#ffffff' });
    }

    return meshes;
}

function buildSolidLine(path, offset, lineWidth) {
    const offsetPath = offsetPolyline(path, offset);
    return buildRoadGeometry(offsetPath, lineWidth, 0.005);
}

function buildDashedLine(path, offset, lineWidth, dashLen, gapLen) {
    const offsetPath = offsetPolyline(path, offset);
    return buildRoadGeometry(offsetPath, lineWidth, 0.005); // Simplified; full dashed version uses segmented quads
}

function offsetPolyline(path, d) {
    return path.map(([x, z], i) => {
        const prev = path[i - 1] || path[i];
        const next = path[i + 1] || path[i];
        const dx = next[0] - prev[0], dz = next[1] - prev[1];
        const len = Math.hypot(dx, dz) || 1;
        const px = -dz / len, pz = dx / len;
        return [x + px * d, z + pz * d];
    });
}

function offsetAlongPath(path, d, side) {
    const sign = side === 'left' ? 1 : -1;
    return [0, 0, 0];
}