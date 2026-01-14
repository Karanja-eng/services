import React, { useMemo } from "react";
import { OrbitControls, PerspectiveCamera, Environment, SoftShadows } from "@react-three/drei";
import * as THREE from "three";

const FoundationWall = ({ wall, height, stripWidth, stripDepth }) => {
    const { start, end, thickness } = wall;
    const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
    const length = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
    const midX = (start[0] + end[0]) / 2;
    const midY = (start[1] + end[1]) / 2;

    const sWidth = parseFloat(stripWidth) || 0.6;
    const sDepth = parseFloat(stripDepth) || 0.2;

    return (
        <group>
            {/* Foundation Wall */}
            <mesh position={[midX, -height / 2, midY]} rotation={[0, -angle, 0]} castShadow receiveShadow>
                <boxGeometry args={[length, height, thickness]} />
                <meshStandardMaterial color="#64748b" roughness={0.8} />
            </mesh>
            {/* Strip Foundation */}
            <mesh position={[midX, -height - (sDepth / 2), midY]} rotation={[0, -angle, 0]} castShadow receiveShadow>
                <boxGeometry args={[length + (sWidth - thickness), sDepth, sWidth]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.9} />
            </mesh>
        </group>
    );
};

const ColumnBase = ({ column, height, baseLength, baseWidth, baseDepth }) => {
    if (!column || !column.position) return null; // Guard against missing data
    const { position, size } = column;
    const s = size || 0.2;
    // Default to square if width not provided
    const bL = parseFloat(baseLength) || 1.2;
    const bW = parseFloat(baseWidth) || 1.2;
    const bD = parseFloat(baseDepth) || 0.3;

    return (
        <group position={[position[0], 0, position[1]]}>
            {/* Foundation Column Stub */}
            <mesh position={[0, -height / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[s, height, s]} />
                <meshStandardMaterial color="#475569" />
            </mesh>
            {/* Column Pad Base */}
            <mesh position={[0, -height - (bD / 2), 0]} castShadow receiveShadow>
                <boxGeometry args={[bL, bD, bW]} />
                <meshStandardMaterial color="#cbd5e1" />
            </mesh>
        </group>
    );
};

export const Substructure3DScene = ({ buildingData, parameters }) => {
    if (!buildingData) return null;
    const foundationHeight = 1.2; // Could also be parameterized if 'trench_depth' is meant to be this height

    // Extract parameters or use defaults
    const {
        strip_width,
        conc_thick_strip,
        col_base_length,
        col_base_width,
        col_base_depth
    } = parameters || {};

    return (
        <>
            <SoftShadows size={25} samples={10} />
            <PerspectiveCamera makeDefault position={[10, 5, 10]} fov={50} />
            <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
            <Environment preset="city" />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 20, 10]} intensity={1} castShadow />

            <group>
                {/* Wall Foundations */}
                {buildingData.floors[0].walls.map(w => (
                    <FoundationWall
                        key={w.id}
                        wall={w}
                        height={foundationHeight}
                        stripWidth={strip_width}
                        stripDepth={conc_thick_strip}
                    />
                ))}

                {/* Door Foundations (Closing gaps) */}
                {buildingData.floors[0].doors && buildingData.floors[0].doors.map((d, i) => (
                    <OpeningFoundation
                        key={`d-${i}`}
                        opening={d}
                        height={foundationHeight}
                        stripWidth={strip_width}
                        stripDepth={conc_thick_strip}
                        wallThickness={parameters.wall_thick || 0.2}
                    />
                ))}

                {/* Window Foundations (Closing gaps) */}
                {buildingData.floors[0].windows && buildingData.floors[0].windows.map((w, i) => (
                    <OpeningFoundation
                        key={`w-${i}`}
                        opening={w}
                        height={foundationHeight}
                        stripWidth={strip_width}
                        stripDepth={conc_thick_strip}
                        wallThickness={parameters.wall_thick || 0.2}
                    />
                ))}

                {/* Column Foundations */}
                {buildingData.floors[0].columns.map((c, i) => (
                    <ColumnBase
                        key={i}
                        column={c}
                        height={foundationHeight}
                        baseLength={col_base_length}
                        baseWidth={col_base_width}
                        baseDepth={col_base_depth}
                    />
                ))}
            </group>
            {/* Ground Plane (Transparent to show foundations below?) 
                Actually foundations are usually below ground. 
                Let's keep ground at 0, foundations go negative. 
                Make ground semi-transparent to see them.
            */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color="#1e293b" transparent opacity={0.3} side={THREE.DoubleSide} />
            </mesh>
            <gridHelper args={[100, 100]} position={[0, -0.001, 0]} />
        </>
    );
};

// Helper component for Opening Foundations
const OpeningFoundation = ({ opening, height, stripWidth, stripDepth, wallThickness }) => {
    if (!opening || !opening.position) return null;
    const { position, width, rotation } = opening;

    // Convert rotation from degrees to radians if necessary. 
    // Assuming backend returns DEGREES (standard CV), but if using specific libraries might be radians.
    // Let's assume Degrees based on typical direct outputs, but if 0-2PI is small values, its Rads.
    // If rot > 6.3, it's definitely degrees. 
    // Usually standardizing on Radians for internal math is safer if known.
    // BUT! FoundationWall uses atan2 which produces radians. 
    // Let's try direct radian usage first if rotation is small.
    // However, safest is to construct the box directly at position with rotation.

    // ThreeJS uses radians for rotation props. 
    // If 'rotation' is degrees, we need to convert. 
    // If 'rotation' is radians, we use as is.
    // Let's try using the rotation prop on mesh directly! 

    // We don't need start/end if we place at 'position' and rotate by 'rotation'.
    // BUT we need to ensure coordinate system matches.
    // FoundationWall does: rotation={[0, -angle, 0]}
    // So we probably need rotation={[0, -rotation, 0]} or similar.
    // Also typical CV rotation might be clockwise vs counter-clockwise.

    // Let's try direct mesh placement.
    const rotRad = rotation * (Math.PI / 180); // Assuming Degrees for now. 

    const sWidth = parseFloat(stripWidth) || 0.6;
    const sDepth = parseFloat(stripDepth) || 0.2;
    const wThick = parseFloat(wallThickness) || 0.2;

    return (
        <group>
            {/* Foundation Wall Segment Under Opening */}
            <mesh position={[position[0], -height / 2, position[1]]} rotation={[0, -rotRad, 0]} castShadow receiveShadow>
                <boxGeometry args={[width, height, wThick]} />
                <meshStandardMaterial color="#64748b" roughness={0.8} />
            </mesh>
            {/* Strip Foundation Segment Under Opening */}
            <mesh position={[position[0], -height - (sDepth / 2), position[1]]} rotation={[0, -rotRad, 0]} castShadow receiveShadow>
                <boxGeometry args={[width + (sWidth - wThick), sDepth, sWidth]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.9} />
            </mesh>
        </group>
    );
};

export default Substructure3DScene;
