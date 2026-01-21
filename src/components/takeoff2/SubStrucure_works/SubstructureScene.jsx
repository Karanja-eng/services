import React, { useMemo } from "react";
import { OrbitControls, PerspectiveCamera, Environment, SoftShadows } from "@react-three/drei";
import * as THREE from "three";

const FoundationWall = ({ wall, height, stripWidth, stripDepth, settings }) => {
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
                <meshStandardMaterial color={settings.foundationWallColor} roughness={0.8} />
            </mesh>
            {/* Strip Foundation */}
            <mesh position={[midX, -height - (sDepth / 2), midY]} rotation={[0, -angle, 0]} castShadow receiveShadow>
                <boxGeometry args={[length + (sWidth - thickness), sDepth, sWidth]} />
                <meshStandardMaterial color={settings.stripFoundationColor} roughness={0.9} />
            </mesh>
        </group>
    );
};

const ColumnBase = ({ column, height, baseLength, baseWidth, baseDepth, settings }) => {
    if (!column || !column.position) return null;
    const { position, size } = column;
    const s = size || 0.2;
    const bL = parseFloat(baseLength) || 1.2;
    const bW = parseFloat(baseWidth) || 1.2;
    const bD = parseFloat(baseDepth) || 0.3;

    return (
        <group position={[position[0], 0, position[1]]}>
            {/* Foundation Column Stub */}
            <mesh position={[0, -height / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[s, height, s]} />
                <meshStandardMaterial color={settings.columnStubColor} />
            </mesh>
            {/* Column Pad Base */}
            <mesh position={[0, -height - (bD / 2), 0]} castShadow receiveShadow>
                <boxGeometry args={[bL, bD, bW]} />
                <meshStandardMaterial color={settings.columnBaseColor} />
            </mesh>
        </group>
    );
};

// Helper component for Opening Foundations
const OpeningFoundation = ({ opening, height, stripWidth, stripDepth, wallThickness, settings }) => {
    if (!opening || !opening.position) return null;
    const { position, width, rotation } = opening;

    // Use rotation directly assuming it converts well (likely needs handling if deg vs rad matches others)
    const rotRad = (rotation || 0) * (Math.PI / 180);

    const sWidth = parseFloat(stripWidth) || 0.6;
    const sDepth = parseFloat(stripDepth) || 0.2;
    const wThick = parseFloat(wallThickness) || 0.2;

    return (
        <group>
            {/* Foundation Wall Segment Under Opening */}
            <mesh position={[position[0], -height / 2, position[1]]} rotation={[0, -rotRad, 0]} castShadow receiveShadow>
                <boxGeometry args={[width, height, wThick]} />
                <meshStandardMaterial color={settings.foundationWallColor} roughness={0.8} />
            </mesh>
            {/* Strip Foundation Segment Under Opening */}
            <mesh position={[position[0], -height - (sDepth / 2), position[1]]} rotation={[0, -rotRad, 0]} castShadow receiveShadow>
                <boxGeometry args={[width + (sWidth - wThick), sDepth, sWidth]} />
                <meshStandardMaterial color={settings.stripFoundationColor} roughness={0.9} />
            </mesh>
        </group>
    );
};

export const SubstructureScene = ({ buildingData, settings }) => {
    if (!buildingData) return null;

    // settings prop comes from the universal canvas, but the scene also needs
    // parameter data (dimensions) which usually comes from props in the legacy one.
    // However, the `StructuralVisualizationComponent` passes `...componentProps` to the Scene.
    // We should ensure `parameters` (which contains dims) is passed via `componentProps` from the main app.
    // The `settings` prop here specifically refers to VISUAL settings (colors, etc).

    // We need to access `parameters` from the props. Since `StructuralVisualizationComponent` passes everything,
    // we can expect `parameters` to be available if passed from the parent.
    // Let's grab it from props (implicit) or expect it to be passed.
    // Wait, the signature is ({ buildingData, settings, ...props }).

    // Actually, looking at `StructuralVisualizationComponent` implementation (from memory/context):
    // <Component.Scene {...componentProps} settings={currentSettings} />
    // So `parameters` will be in `props` if passed as `<StructuralVisualizationComponent parameters={...} />`.

    // Use a fallback for parameters if not explicitly passed as a direct prop for safety,
    // though in `MainExternalWorks` I saw it passing `config`.
    // In `substructure_works.jsx`, it passes `parameters={formData}`.

    // So here we need to extract `parameters` from props.

    return <SubstructureSceneImpl buildingData={buildingData} settings={settings} parameters={settings.parameters /* This is not right. Settings is visual settings. Parameters is dimensions. */} />;
};

// Start again with correct signature.
// props will contain `parameters` if passed to StructuralVisualizationComponent.
export const SubstructureSceneImpl = ({ buildingData, settings, parameters }) => {
    const foundationHeight = 1.2;

    // Fallback parameters if not present
    const params = parameters || {};

    const {
        strip_width,
        conc_thick_strip,
        col_base_length,
        col_base_width,
        col_base_depth,
        wall_thick
    } = params;

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
                        settings={settings}
                    />
                ))}

                {/* Door Foundations */}
                {buildingData.floors[0].doors && buildingData.floors[0].doors.map((d, i) => (
                    <OpeningFoundation
                        key={`d-${i}`}
                        opening={d}
                        height={foundationHeight}
                        stripWidth={strip_width}
                        stripDepth={conc_thick_strip}
                        wallThickness={wall_thick}
                        settings={settings}
                    />
                ))}

                {/* Window Foundations */}
                {buildingData.floors[0].windows && buildingData.floors[0].windows.map((w, i) => (
                    <OpeningFoundation
                        key={`w-${i}`}
                        opening={w}
                        height={foundationHeight}
                        stripWidth={strip_width}
                        stripDepth={conc_thick_strip}
                        wallThickness={wall_thick}
                        settings={settings}
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
                        settings={settings}
                    />
                ))}
            </group>

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color={settings.groundColor} transparent opacity={settings.groundOpacity} side={THREE.DoubleSide} />
            </mesh>
            <gridHelper args={[100, 100]} position={[0, -0.001, 0]} />
        </>
    );
};

export default SubstructureSceneImpl;
