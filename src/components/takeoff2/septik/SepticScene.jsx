import React, { useMemo } from 'react';
import { OrbitControls, PerspectiveCamera, Environment, SoftShadows } from '@react-three/drei';
import * as THREE from 'three';

// --- Helper Components ---

const BoxMesh = ({ position, rotation, args, material, castShadow = true, receiveShadow = true }) => (
    <mesh position={position} rotation={rotation} castShadow={castShadow} receiveShadow={receiveShadow} material={material}>
        <boxGeometry args={args} />
    </mesh>
);

const CylinderMesh = ({ position, rotation, args, material, castShadow = true, receiveShadow = true }) => (
    <mesh position={position} rotation={rotation} castShadow={castShadow} receiveShadow={receiveShadow} material={material}>
        <cylinderGeometry args={args} />
    </mesh>
);

// --- Sub-Systems ---

const SepticTank = ({ config, materials }) => {
    const st = config.septicTank;
    const extL = st.intL + 2 * st.wallThick;
    const extW = st.intW + 2 * st.wallThick;

    // Baffles logic
    const baffles = [];
    for (let i = 0; i < st.numBaffles; i++) {
        const spacing = st.intL / (st.numBaffles + 1);
        const baffleX = -st.intL / 2 + spacing * (i + 1);
        const baffleH = st.baffleHeights[i] || 1.5;
        baffles.push({ x: baffleX, h: baffleH });
    }

    const waterLevel = st.depth * 0.8;

    return (
        <group>
            {/* Bed */}
            <BoxMesh
                position={[0, st.bedThick / 2, 0]}
                args={[extL, st.bedThick, extW]}
                material={materials.concrete}
            />
            {/* Front Wall */}
            <BoxMesh
                position={[0, st.bedThick + st.depth / 2, -extW / 2 + st.wallThick / 2]}
                args={[extL, st.depth, st.wallThick]}
                material={materials.concrete}
            />
            {/* Back Wall */}
            <BoxMesh
                position={[0, st.bedThick + st.depth / 2, extW / 2 - st.wallThick / 2]}
                args={[extL, st.depth, st.wallThick]}
                material={materials.concrete}
            />
            {/* Left Wall */}
            <BoxMesh
                position={[-extL / 2 + st.wallThick / 2, st.bedThick + st.depth / 2, 0]}
                args={[st.wallThick, st.depth, extW]}
                material={materials.concrete}
            />
            {/* Right Wall */}
            <BoxMesh
                position={[extL / 2 - st.wallThick / 2, st.bedThick + st.depth / 2, 0]}
                args={[st.wallThick, st.depth, extW]}
                material={materials.concrete}
            />

            {/* Baffles */}
            {baffles.map((b, i) => (
                <BoxMesh
                    key={`baffle-${i}`}
                    position={[b.x, st.bedThick + b.h / 2, 0]}
                    args={[st.baffleThick, b.h, st.intW]}
                    material={materials.concrete}
                />
            ))}

            {/* Water */}
            <BoxMesh
                position={[0, st.bedThick + waterLevel / 2, 0]}
                args={[st.intL, waterLevel, st.intW]}
                material={materials.water}
                castShadow={false}
            />

            {/* Top Slab */}
            <BoxMesh
                position={[0, st.bedThick + st.depth + st.slabThick / 2, 0]}
                args={[extL, st.slabThick, extW]}
                material={materials.concrete}
            />

            {/* Manhole Opening (Visualized as Black Box for now) */}
            <BoxMesh
                position={[0, st.bedThick + st.depth + st.slabThick / 2, 0]}
                args={[0.6, st.slabThick + 0.01, 0.45]}
                material={new THREE.MeshBasicMaterial({ color: 0x000000 })}
            />

            {/* Inlet Pipe */}
            <CylinderMesh
                position={[-extL / 2 - 0.5, st.bedThick + st.depth * 0.7, 0]}
                rotation={[0, 0, -Math.PI / 2]}
                args={[config.connections.pipeDiameter / 2, config.connections.pipeDiameter / 2, 1.0, 16]}
                material={materials.pipe}
            />

            {/* Outlet Pipe */}
            <CylinderMesh
                position={[extL / 2 + 0.5, st.bedThick + st.depth * 0.6, 0]}
                rotation={[0, 0, -Math.PI / 2]}
                args={[config.connections.pipeDiameter / 2, config.connections.pipeDiameter / 2, 1.0, 16]}
                material={materials.pipe}
            />
        </group>
    );
};

const Manhole = ({ config, materials }) => {
    const mh = config.manhole;
    const extL = mh.intL + 2 * mh.wallThick;
    const extW = mh.intW + 2 * mh.wallThick;

    return (
        <group position={mh.position}>
            {/* Base */}
            <BoxMesh position={[0, 0.075, 0]} args={[extL, 0.15, extW]} material={materials.concrete} />

            {/* Walls */}
            <BoxMesh position={[0, 0.15 + mh.depth / 2, -extW / 2 + mh.wallThick / 2]} args={[extL, mh.depth, mh.wallThick]} material={materials.concrete} />
            <BoxMesh position={[0, 0.15 + mh.depth / 2, extW / 2 - mh.wallThick / 2]} args={[extL, mh.depth, mh.wallThick]} material={materials.concrete} />
            <BoxMesh position={[-extL / 2 + mh.wallThick / 2, 0.15 + mh.depth / 2, 0]} args={[mh.wallThick, mh.depth, extW]} material={materials.concrete} />
            <BoxMesh position={[extL / 2 - mh.wallThick / 2, 0.15 + mh.depth / 2, 0]} args={[mh.wallThick, mh.depth, extW]} material={materials.concrete} />

            {/* Cover Slab */}
            <BoxMesh position={[0, 0.15 + mh.depth + 0.075, 0]} args={[extL, 0.15, extW]} material={materials.concrete} />

            {/* Cover Top */}
            <BoxMesh position={[0, 0.15 + mh.depth + 0.15 + 0.025, 0]} args={[mh.coverL, 0.05, mh.coverW]} material={new THREE.MeshStandardMaterial({ color: 0x4a5568 })} />
        </group>
    );
};

const Soakpit = ({ config, materials }) => {
    const sp = config.soakpit;

    // Perforations helper
    const perforations = useMemo(() => {
        if (sp.shape !== 'circular') return [];
        const radius = sp.diameter / 2;
        const holes = [];
        for (let i = 0; i < 16; i++) {
            const angle = (i * Math.PI * 2) / 16;
            holes.push({
                x: (radius + sp.wallThick / 2) * Math.cos(angle),
                z: (radius + sp.wallThick / 2) * Math.sin(angle),
                rotZ: Math.PI / 2
            });
        }
        return holes;
    }, [sp.shape, sp.diameter, sp.wallThick]);

    return (
        <group position={sp.position}>
            {sp.shape === 'circular' ? (
                <>
                    {/* Wall (Transparent) */}
                    <CylinderMesh
                        position={[0, sp.depth / 2, 0]}
                        args={[sp.diameter / 2 + sp.wallThick, sp.diameter / 2 + sp.wallThick, sp.depth, 32, 1, true]} // openEnded=false but we want hollow?
                        // Legacy used CylinderGeometry(radius, radius, depth, 32, 1, false). It's a solid cylinder.
                        // But material was transparent.
                        // Wait, legacy wall geometry radius was radius+thick.
                        // And there was an INNER fill.
                        // So it's essentially a solid block of "wall material" with "soil material" inside.
                        material={materials.transparentConcrete}
                    />
                    <CylinderMesh
                        position={[0, sp.depth / 2, 0]}
                        args={[sp.diameter / 2, sp.diameter / 2, sp.depth, 32]}
                        material={materials.soil}
                    />
                    {/* Holes */}
                    {perforations.map((h, i) => (
                        <CylinderMesh
                            key={`hole-${i}`}
                            position={[h.x, sp.depth / 2, h.z]}
                            rotation={[0, 0, h.rotZ]}
                            args={[0.05, 0.05, sp.wallThick + 0.1, 8]}
                            material={new THREE.MeshBasicMaterial({ color: 0x000000 })}
                        />
                    ))}
                    {/* Cover */}
                    <CylinderMesh
                        position={[0, sp.depth + 0.1, 0]}
                        args={[sp.diameter / 2 + sp.wallThick, sp.diameter / 2 + sp.wallThick, 0.2, 32]}
                        material={materials.concrete}
                    />
                </>
            ) : (
                <>
                    {/* Rectangular impl similar to legacy */}
                    {/* Front/Back */}
                    <BoxMesh position={[0, sp.depth / 2, -sp.diameter / 2 - sp.wallThick / 2]} args={[sp.diameter + 2 * sp.wallThick, sp.depth, sp.wallThick]} material={materials.transparentConcrete} />
                    <BoxMesh position={[0, sp.depth / 2, sp.diameter / 2 + sp.wallThick / 2]} args={[sp.diameter + 2 * sp.wallThick, sp.depth, sp.wallThick]} material={materials.transparentConcrete} />
                    {/* Side Walls */}
                    <BoxMesh position={[-sp.diameter / 2 - sp.wallThick / 2, sp.depth / 2, 0]} args={[sp.wallThick, sp.depth, sp.diameter]} material={materials.transparentConcrete} />
                    <BoxMesh position={[sp.diameter / 2 + sp.wallThick / 2, sp.depth / 2, 0]} args={[sp.wallThick, sp.depth, sp.diameter]} material={materials.transparentConcrete} />

                    {/* Fill */}
                    <BoxMesh position={[0, sp.depth / 2, 0]} args={[sp.diameter, sp.depth, sp.diameter]} material={materials.soil} />

                    {/* Cover */}
                    <BoxMesh position={[0, sp.depth + 0.1, 0]} args={[sp.diameter + 2 * sp.wallThick, 0.2, sp.diameter + 2 * sp.wallThick]} material={materials.concrete} />
                </>
            )}
        </group>
    );
};

const Connections = ({ config, materials }) => {
    // Septic to Manhole
    const st = config.septicTank;
    const mh = config.manhole;
    const sp = config.soakpit;

    // We assume standard positioning based on config logic
    // ST is at 0,0,0

    const pipes = [];

    if (config.connections.septicToManhole) {
        const extL = st.intL + 2 * st.wallThick;
        const distance = mh.position[0] - extL / 2;
        // Pipe connects from end of ST to start of MH
        // Position X = extL/2 + distance/2
        pipes.push({
            pos: [extL / 2 + distance / 2, st.bedThick + st.depth * 0.6, 0],
            len: distance
        });
    }

    if (config.connections.manholeToSoakpit) {
        const mhExtL = mh.intL + 2 * mh.wallThick;
        const distance = sp.position[0] - mh.position[0] - mhExtL / 2;
        pipes.push({
            pos: [mh.position[0] + mhExtL / 2 + distance / 2, mh.position[1] + 0.15 + mh.depth * 0.6, 0],
            len: distance
        });
    }

    return (
        <group>
            {pipes.map((p, i) => (
                <CylinderMesh
                    key={`pipe-${i}`}
                    position={p.pos}
                    rotation={[0, 0, -Math.PI / 2]}
                    args={[config.connections.pipeDiameter / 2, config.connections.pipeDiameter / 2, p.len, 16]}
                    material={materials.pipe}
                />
            ))}
        </group>
    );
};


export const SepticScene = ({ buildingData, settings }) => {
    // buildingData is the full config object, including defaults if needed. 
    // Usually legacy component merges defaults. 
    // We should ensure buildingData has the structure.

    const defaultConfig = {
        septicTank: {
            intL: 3.0, intW: 2.5, depth: 2.0, wallThick: 0.2, slabThick: 0.2, bedThick: 0.15,
            numBaffles: 2, baffleThick: 0.2, baffleHeights: [1.5, 1.3], floorSlope: 0
        },
        manhole: {
            intL: 0.7, intW: 0.6, depth: 0.7, wallThick: 0.2, coverL: 0.6, coverW: 0.45,
            position: [4.5, 0, 0]
        },
        soakpit: {
            diameter: 2.0, depth: 3.0, wallThick: 0.23, shape: 'circular',
            position: [8, 0, 0]
        },
        connections: {
            septicToManhole: true, manholeToSoakpit: true, pipeDiameter: 0.15
        }
    };

    // Merge provided buildingData (which is `config={visualConfig}` in legacy) with defaults
    // Note: buildingData structure from Universal Component matches what was passed in legacy props.
    // In septik_tank.jsx: <StructuralVisualizationComponent buildingData={visualConfig} ... />

    const config = useMemo(() => {
        if (!buildingData) return defaultConfig;
        return {
            septicTank: { ...defaultConfig.septicTank, ...(buildingData.septicTank || {}) },
            manhole: { ...defaultConfig.manhole, ...(buildingData.manhole || {}) },
            soakpit: { ...defaultConfig.soakpit, ...(buildingData.soakpit || {}) },
            connections: { ...defaultConfig.connections, ...(buildingData.connections || {}) }
        };
    }, [buildingData]);

    const materials = useMemo(() => {
        const concColor = settings?.concreteColor || '#8b9098';
        const waterColor = settings?.waterColor || '#3b82f6';

        return {
            concrete: new THREE.MeshStandardMaterial({
                color: concColor,
                roughness: 0.7,
                metalness: 0.1
            }),
            transparentConcrete: new THREE.MeshStandardMaterial({
                color: concColor,
                transparent: true,
                opacity: 0.7,
                roughness: 0.7
            }),
            water: new THREE.MeshStandardMaterial({
                color: waterColor,
                transparent: true,
                opacity: 0.5,
                roughness: 0.1,
                metalness: 0.1
            }),
            soil: new THREE.MeshStandardMaterial({
                color: '#92400e',
                roughness: 0.9,
                metalness: 0
            }),
            pipe: new THREE.MeshStandardMaterial({
                color: '#64748b',
                roughness: 0.5,
                metalness: 0.3
            })
        };
    }, [settings]);

    return (
        <>
            <SoftShadows size={25} samples={10} />
            <PerspectiveCamera makeDefault position={[10, 8, 10]} fov={60} />
            <OrbitControls makeDefault />
            <Environment preset="city" />
            <ambientLight intensity={0.6} />
            <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />

            <group>
                <SepticTank config={config} materials={materials} />
                <Manhole config={config} materials={materials} />
                <Soakpit config={config} materials={materials} />
                <Connections config={config} materials={materials} />
            </group>

            {/* Ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
                <planeGeometry args={[30, 30]} />
                <meshStandardMaterial color={settings?.groundColor || "#a8a29e"} roughness={0.8} />
            </mesh>
            <gridHelper args={[30, 30]} position={[0, 0, 0]} />
        </>
    );
};

export default SepticScene;
