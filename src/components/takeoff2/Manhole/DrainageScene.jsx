import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";

/**
 * Drainage Scene Component - Extracted for use in Universal Canvas
 * This component renders only the 3D geometry without Canvas wrapper
 */
export function DrainageScene({ projectData, calculationResults, settings = {} }) {
    const groupRef = useRef();

    // Default settings
    const {
        showGround = true,
        showManholes = true,
        showPipes = true,
        showExcavation = true,
        showLabels = true,
        showHouses = true,
        opacity = 1.0,
    } = settings;

    // Color scheme
    const colors = {
        ground: 0x8b7355,
        concrete: 0xa9a9a9,
        steel: 0x708090,
        pipe_upvc: 0xff8c00,
        pipe_pcc: 0x696969,
        excavation: 0xd2691e,
        water: 0x4682b4,
        house: 0xdeb887,
        manhole_cover: 0x2f4f4f,
        benching: 0xc0c0c0,
        rock: 0x654321,
    };

    // Helper functions (copied from original DrainageScene3D but adapted where needed)

    // Create text sprite/html for labels
    // Replacing CanvasTexture sprite with Html component for better quality and offline support
    const Label = ({ position, text }) => {
        if (!showLabels) return null;
        return (
            <Html position={position} center>
                <div style={{
                    background: 'rgba(255, 255, 255, 0.8)',
                    padding: '2px 5px',
                    borderRadius: '3px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    pointerEvents: 'none'
                }}>
                    {text}
                </div>
            </Html>
        );
    };

    // 1. Manhole Creator
    const createManhole = (mh, idx) => {
        if (!showManholes) return null;

        const keyPrefix = `mh-${mh.id}-${idx}`;
        const components = [];
        const groundLevel = mh.ground_level;
        const invertLevel = mh.invert_level;
        const depth = groundLevel - invertLevel;

        // Determine dimensions
        let intL, intW, intDiam;
        if (mh.type === "circ") {
            intDiam = mh.internal_diameter;
            intL = intW = intDiam;
        } else {
            intL = mh.internal_length;
            intW = mh.internal_width;
            intDiam = 0;
        }

        const wallThick = mh.wall_thickness;
        const bedThick = mh.bed_thickness;
        const slabThick = mh.slab_thickness;

        // Position at ground level
        const posX = mh.position_x;
        const posZ = mh.position_y;

        // 1. Concrete Bed
        if (mh.type === "circ") {
            components.push(
                <mesh key={`${keyPrefix}-bed`} position={[posX, invertLevel + bedThick / 2, posZ]}>
                    <cylinderGeometry args={[intDiam / 2 + wallThick, intDiam / 2 + wallThick, bedThick, 32]} />
                    <meshStandardMaterial color={colors.concrete} opacity={opacity} transparent={opacity < 1} />
                </mesh>
            );
        } else {
            const extL = intL + 2 * wallThick;
            const extW = intW + 2 * wallThick;
            components.push(
                <mesh key={`${keyPrefix}-bed`} position={[posX, invertLevel + bedThick / 2, posZ]}>
                    <boxGeometry args={[extL, bedThick, extW]} />
                    <meshStandardMaterial color={colors.concrete} opacity={opacity} transparent={opacity < 1} />
                </mesh>
            );
        }

        // 2. Walls
        const wallHeight = depth - slabThick;
        const wallY = invertLevel + bedThick + wallHeight / 2;

        if (mh.type === "circ") {
            const outerRad = intDiam / 2 + wallThick;
            const innerRad = intDiam / 2;
            components.push(
                <mesh key={`${keyPrefix}-wall`} position={[posX, wallY, posZ]}>
                    <cylinderGeometry args={[outerRad, outerRad, wallHeight, 32]} />
                    <meshStandardMaterial color={colors.concrete} opacity={opacity} transparent={opacity < 1} />
                </mesh>
                // Note: Inner hole not purely handled here without CSG, but rendering cylinder is fine for visual
                // For proper hole, we'd need subtraction. For now, solid cylinder is okay or we can use RingGeometry logic or double siding if needed.
                // The original code made a separate inner cylinder, likely relying on Z-fighting or just visual representation.
                // Actually original code creates two cylinders? No, it created a holeGeom but didn't use CSG.
                // It just rendered a cylinder. Simplified here.
            );
        } else {
            const extL = intL + 2 * wallThick;
            const extW = intW + 2 * wallThick;
            // Front/Back
            components.push(
                <mesh key={`${keyPrefix}-wall-f`} position={[posX, wallY, posZ + extW / 2 - wallThick / 2]}>
                    <boxGeometry args={[extL, wallHeight, wallThick]} />
                    <meshStandardMaterial color={colors.concrete} opacity={opacity} transparent={opacity < 1} />
                </mesh>
            );
            components.push(
                <mesh key={`${keyPrefix}-wall-b`} position={[posX, wallY, posZ - extW / 2 + wallThick / 2]}>
                    <boxGeometry args={[extL, wallHeight, wallThick]} />
                    <meshStandardMaterial color={colors.concrete} opacity={opacity} transparent={opacity < 1} />
                </mesh>
            );
            // Left/Right
            components.push(
                <mesh key={`${keyPrefix}-wall-l`} position={[posX - extL / 2 + wallThick / 2, wallY, posZ]}>
                    <boxGeometry args={[wallThick, wallHeight, intW]} />
                    <meshStandardMaterial color={colors.concrete} opacity={opacity} transparent={opacity < 1} />
                </mesh>
            );
            components.push(
                <mesh key={`${keyPrefix}-wall-r`} position={[posX + extL / 2 - wallThick / 2, wallY, posZ]}>
                    <boxGeometry args={[wallThick, wallHeight, intW]} />
                    <meshStandardMaterial color={colors.concrete} opacity={opacity} transparent={opacity < 1} />
                </mesh>
            );
        }

        // 3. Top Slab
        const slabY = groundLevel - slabThick / 2;
        if (mh.type === "circ") {
            const extDiam = intDiam + 2 * wallThick;
            components.push(
                <mesh key={`${keyPrefix}-slab`} position={[posX, slabY, posZ]}>
                    <cylinderGeometry args={[extDiam / 2, extDiam / 2, slabThick, 32]} />
                    <meshStandardMaterial color={colors.concrete} opacity={opacity} transparent={opacity < 1} />
                </mesh>
            );
        } else {
            const extL = intL + 2 * wallThick;
            const extW = intW + 2 * wallThick;
            components.push(
                <mesh key={`${keyPrefix}-slab`} position={[posX, slabY, posZ]}>
                    <boxGeometry args={[extL, slabThick, extW]} />
                    <meshStandardMaterial color={colors.concrete} opacity={opacity} transparent={opacity < 1} />
                </mesh>
            );
        }

        // 4. Manhole Cover
        components.push(
            <mesh key={`${keyPrefix}-cover`} position={[posX, groundLevel + 0.025, posZ]}>
                <boxGeometry args={[mh.cover_length, 0.05, mh.cover_width]} />
                <meshStandardMaterial color={colors.manhole_cover} metalness={0.8} roughness={0.3} />
            </mesh>
        );

        // 5. Excavation Outline
        if (showExcavation) {
            const excProjThick = mh.projection_thickness || 0.1;
            const excExtL = intL + 2 * (wallThick + excProjThick);
            const excExtW = intW + 2 * (wallThick + excProjThick);
            const excDepth = depth + bedThick;

            components.push(
                <group key={`${keyPrefix}-exc`} position={[posX, invertLevel + excDepth / 2, posZ]}>
                    <lineSegments>
                        <edgesGeometry args={[new THREE.BoxGeometry(excExtL, excDepth, excExtW)]} />
                        <lineBasicMaterial color={colors.excavation} linewidth={2} />
                    </lineSegments>
                </group>
            );
        }

        // 6. Label
        if (showLabels) {
            components.push(
                <Label key={`${keyPrefix}-label`} position={[posX, groundLevel + 0.5, posZ]} text={mh.id} />
            );
        }

        return components;
    };

    // 2. Pipe Creator
    const createPipe = (pipe, idx, manholes) => {
        if (!showPipes) return null;

        const keyPrefix = `pipe-${idx}`;
        const components = [];

        // Find start and end positions
        const fromMH = manholes.find((m) => m.id === pipe.from_point);
        const toMH = manholes.find((m) => m.id === pipe.to_point);

        if (!fromMH && !toMH) return null;

        let startX, startY, startZ, endX, endY, endZ;

        if (fromMH) {
            startX = fromMH.position_x;
            startZ = fromMH.position_y;
            startY = fromMH.invert_level;
        } else {
            // From house
            startX = toMH.position_x - pipe.length;
            startZ = toMH.position_y;
            startY = toMH.invert_level + (pipe.length * pipe.gradient) / 100;
        }

        if (toMH) {
            endX = toMH.position_x;
            endZ = toMH.position_y;
            endY = toMH.invert_level;
        } else {
            // To next point
            endX = fromMH.position_x + pipe.length;
            endZ = fromMH.position_y;
            endY = fromMH.invert_level - (pipe.length * pipe.gradient) / 100;
        }

        const length = Math.sqrt(
            Math.pow(endX - startX, 2) +
            Math.pow(endY - startY, 2) +
            Math.pow(endZ - startZ, 2)
        );

        const diam = (pipe.diameter_mm || 150) / 1000;
        const pipeColor = pipe.pipe_material?.toLowerCase().includes("pvc")
            ? colors.pipe_upvc
            : colors.pipe_pcc;

        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        const midZ = (startZ + endZ) / 2;

        const direction = new THREE.Vector3(endX - startX, endY - startY, endZ - startZ).normalize();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

        components.push(
            <mesh key={`${keyPrefix}-mesh`} position={[midX, midY, midZ]} quaternion={quaternion}>
                <cylinderGeometry args={[diam / 2, diam / 2, length, 16]} />
                <meshStandardMaterial color={pipeColor} opacity={opacity} transparent={opacity < 1} />
            </mesh>
        );

        // Trench
        if (showExcavation) {
            const trenchWidth = pipe.trench_width;
            // Simplified trench visualization - just a line for now or box along path
            // Doing detailed tube geometry is complex in pure React without native references, sticking to what works visually
            // Original used TubeGeometry which is fine.
            // We can generate points and use Line from drei or just custom geometry.
            // Let's stick to simple line for trench centerline or simplified box

            components.push(
                <mesh key={`${keyPrefix}-trench`} position={[midX, midY, midZ]} quaternion={quaternion}>
                    <boxGeometry args={[trenchWidth, length, trenchWidth]} />
                    <meshBasicMaterial color={colors.excavation} wireframe />
                </mesh>
            );
        }

        return components;
    };

    // 3. House Creator
    const createHouse = (x, z, groundLevel, idx) => {
        if (!showHouses) return null;

        const keyPrefix = `house-${idx}`;
        return (
            <group key={keyPrefix} position={[x, groundLevel, z]}>
                <mesh position={[0, 1.5, 0]}>
                    <boxGeometry args={[4, 3, 5]} />
                    <meshStandardMaterial color={colors.house} />
                </mesh>
                <mesh position={[0, 4, 0]} rotation={[0, Math.PI / 4, 0]}>
                    <coneGeometry args={[3.5, 2, 4]} />
                    <meshStandardMaterial color={0x8b4513} />
                </mesh>
            </group>
        );
    };

    // Main Render Logic
    const manholes = projectData?.manholes || projectData?.boq_items?.filter(i => i.type === 'manhole') || []; // Fallback if data structure varies
    // Using projectData directly as per usage in MainTakeoff (passed as calculationResults)
    const effectiveManholes = projectData?.manholes || [];
    const effectivePipes = projectData?.pipes || [];

    // Identify Houses
    const housePipes = effectivePipes.filter((p) =>
        p.from_point?.toLowerCase().includes("house")
    );


    return (
        <group ref={groupRef}>
            {/* Ground Plane */}
            {showGround && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                    <planeGeometry args={[100, 100]} />
                    <meshStandardMaterial color={colors.ground} side={THREE.DoubleSide} />
                </mesh>
            )}

            {/* Manholes */}
            {effectiveManholes.map((mh, idx) => createManhole(mh, idx))}

            {/* Pipes */}
            {effectivePipes.map((pipe, idx) => createPipe(pipe, idx, effectiveManholes))}

            {/* Houses */}
            {housePipes.map((pipe, idx) => {
                const toMH = effectiveManholes.find((m) => m.id === pipe.to_point);
                if (toMH) {
                    const houseX = toMH.position_x - pipe.length - 5;
                    const houseZ = toMH.position_y + idx * 10;
                    return createHouse(houseX, houseZ, toMH.ground_level, idx);
                }
                return null;
            })}
        </group>
    );
}

export default DrainageScene;
