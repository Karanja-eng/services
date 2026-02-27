import React from 'react';
import * as THREE from 'three';
import { getRoleColor } from './SteelBIM_Core.jsx';
import { Line } from '@react-three/drei';

const SteelMember3D = ({ member, isSelected, onSelect, visible, showDiagrams = {}, diagramScale = 1 }) => {
    if (!visible) return null;

    const start = new THREE.Vector3(member.start.x, member.start.z, -member.start.y);
    const end = new THREE.Vector3(member.end.x, member.end.z, -member.end.y);
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    if (len < 0.01) return null;

    const color = getRoleColor(member.role);
    const radius = {
        column: 0.15, rafter: 0.12, haunch: 0.18,
        'truss-top': 0.08, 'truss-bottom': 0.08,
        vertical: 0.06, diagonal: 0.04,
        leg: 0.1, ring: 0.06, 'x-brace': 0.04,
        'floor-beam': 0.1, purlin: 0.05,
        bracing: 0.04, 'dome-rib': 0.07, 'dome-ring': 0.05
    }[member.role] || 0.06;

    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

    const hasCaps = ['column', 'rafter', 'haunch', 'truss-top', 'truss-bottom', 'leg', 'floor-beam'].includes(member.role);

    // Diagram Logic (Moment/Shear)
    const renderDiagram = () => {
        if (!showDiagrams.moment && !showDiagrams.shear) return null;

        // Simplified diagram rendering: a line offset from the member
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(orientation);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(orientation);

        const points = [];
        const diagramColor = showDiagrams.moment ? "#ef4444" : "#3b82f6"; // Red for Moment, Blue for Shear
        const factor = (showDiagrams.moment ? member.M_max : member.V_max) || (Math.random() * 5); // Mock data if missing

        const offset = factor * 0.1 * diagramScale;

        points.push(start.clone());
        points.push(midpoint.clone().add(up.clone().multiplyScalar(offset)));
        points.push(end.clone());

        return (
            <Line
                points={points}
                color={diagramColor}
                lineWidth={3}
                dashed={false}
            />
        );
    };

    return (
        <group>
            <mesh
                position={midpoint}
                quaternion={orientation}
                onClick={(e) => { e.stopPropagation(); onSelect(member.id); }}
            >
                <cylinderGeometry args={[radius, radius, len, 8]} />
                <meshPhongMaterial
                    color={isSelected ? '#ffffff' : color}
                    emissive={isSelected ? color : '#000000'}
                    emissiveIntensity={isSelected ? 0.4 : 0}
                    shininess={80}
                />
            </mesh>
            {hasCaps && [start, end].map((pos, i) => (
                <mesh key={i} position={pos} quaternion={orientation}>
                    <cylinderGeometry args={[radius * 1.8, radius * 1.8, 0.02, 8]} />
                    <meshPhongMaterial color="#94a3b8" />
                </mesh>
            ))}
            {renderDiagram()}
        </group>
    );
};

const SteelConnection3D = ({ conn, isSelected, onSelect, visible }) => {
    if (!visible) return null;
    const p = new THREE.Vector3(conn.position.x, conn.position.z, -conn.position.y);
    const color = isSelected ? '#ffffff' : '#94a3b8';

    if (['base_plate', 'bolted_end_plate', 'haunch', 'gusset_plate'].includes(conn.type)) {
        const pw = conn.plateW / 1000;
        const ph = conn.plateH / 1000;
        const pt = conn.plateT / 1000;

        const plateColor = conn.type === 'gusset_plate' ? '#22c55e' : color;
        const platePos = [...p.toArray()];
        if (conn.type === 'base_plate') platePos[1] -= pt / 2;

        return (
            <group>
                <mesh position={platePos} onClick={(e) => { e.stopPropagation(); onSelect(conn.id); }}>
                    <boxGeometry args={[pw, pt, ph]} />
                    <meshPhongMaterial color={plateColor} transparent opacity={0.85} />
                </mesh>

                {/* Bolts */}
                {conn.type !== 'gusset_plate' && Array.from({ length: conn.boltRows * conn.boltCols }).map((_, i) => {
                    const r = Math.floor(i / conn.boltCols);
                    const c = i % conn.boltCols;
                    const edgeD = conn.boltDia * 2.5 / 1000;
                    const spX = conn.boltCols > 1 ? (pw - 2 * edgeD) / (conn.boltCols - 1) : 0;
                    const spZ = conn.boltRows > 1 ? (ph - 2 * edgeD) / (conn.boltRows - 1) : 0;
                    const bx = -pw / 2 + edgeD + c * spX;
                    const bz = -ph / 2 + edgeD + r * spZ;
                    const boltH = conn.type === 'base_plate' ? conn.anchorEmbedment / 1000 * 0.3 : pt * 2.2;

                    return (
                        <mesh key={i} position={[p.x + bx, p.y - (conn.type === 'base_plate' ? boltH / 2 : 0), p.z + bz]}>
                            <cylinderGeometry args={[conn.boltDia / 2000, conn.boltDia / 2000, boltH, 6]} />
                            <meshPhongMaterial color="#6b7280" />
                        </mesh>
                    );
                })}

                {/* Stiffeners */}
                {conn.hasStiffeners && [-1, 1].map(side => (
                    <mesh key={side} position={[p.x + side * pw * 0.35, p.y + pt * 1.5, p.z]}>
                        <boxGeometry args={[pw * 0.1, pt * 3, ph * 0.45]} />
                        <meshPhongMaterial color="#a78bfa" />
                    </mesh>
                ))}

                {/* Grout */}
                {conn.type === 'base_plate' && (
                    <mesh position={[p.x, p.y - pt - conn.groutThickness / 2000, p.z]}>
                        <boxGeometry args={[pw + 0.04, conn.groutThickness / 1000, ph + 0.04]} />
                        <meshPhongMaterial color="#d97706" transparent opacity={0.5} />
                    </mesh>
                )}
            </group>
        );
    }

    if (conn.type === 'welded_moment') {
        return (
            <mesh position={p} rotation={[Math.PI / 2, 0, 0]} onClick={(e) => { e.stopPropagation(); onSelect(conn.id); }}>
                <torusGeometry args={[0.2, 0.02, 8, 16]} />
                <meshPhongMaterial color="#fde68a" />
            </mesh>
        );
    }

    if (conn.type === 'pinned') {
        return (
            <mesh position={p} rotation={[0, 0, Math.PI / 2]} onClick={(e) => { e.stopPropagation(); onSelect(conn.id); }}>
                <cylinderGeometry args={[conn.boltDia / 2000 * 2, conn.boltDia / 2000 * 2, 0.3, 12]} />
                <meshPhongMaterial color="#7c3aed" />
            </mesh>
        );
    }

    return null;
};

const SteelStructure3D = ({ structure, selectedIds = [], onSelect, layers = {}, showDiagrams = {}, diagramScale = 1 }) => {
    if (!structure) return null;

    // Normalize structure to handle both BIM results and flat element lists
    const members = structure.members || (Array.isArray(structure) ? structure.filter(e => e.type === 'beam' || e.type === 'column') : []);
    const connections = structure.connections || [];

    return (
        <group>
            {members.map(member => {
                // Handle different member formats (BIM format vs StructuralElement format)
                const normalizedMember = member.start3D ? {
                    ...member,
                    start: member.start3D,
                    end: member.end3D,
                    role: member.properties?.role || member.type
                } : member;

                if (!normalizedMember.start || !normalizedMember.end) return null;

                return (
                    <SteelMember3D
                        key={member.id}
                        member={normalizedMember}
                        isSelected={selectedIds.includes(member.id)}
                        onSelect={onSelect || (() => { })}
                        visible={layers[normalizedMember.layer] !== false}
                        showDiagrams={showDiagrams}
                        diagramScale={diagramScale}
                    />
                );
            })}
            {connections.map(conn => (
                <SteelConnection3D
                    key={conn.id}
                    conn={conn}
                    isSelected={selectedIds.includes(conn.id)}
                    onSelect={onSelect || (() => { })}
                    visible={true}
                />
            ))}
        </group>
    );
};

export default SteelStructure3D;
