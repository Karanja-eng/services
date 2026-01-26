import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text, Line } from '@react-three/drei';

export function FrameScene({
    floors,
    bays,
    story_height: h,
    bay_width: w,
    results, // Analysis results (moments, shears, disp)
    showResults = true,
    scaleFactor = 100, // For drift exaggeration
    beamType = "T-Beam", // Default to T-Beam for frames
    flangeWidth = 1.0,
    flangeThickness = 0.15,
    webWidth = 0.3,
    ...props
}) {
    // Generate Geometry
    const structure = useMemo(() => {
        const nodes = [];
        const members = [];

        // Nodes
        for (let row = 0; row <= floors; row++) {
            for (let col = 0; col <= bays; col++) {
                nodes.push({
                    id: `n-${row}-${col}`,
                    x: col * w,
                    y: row * h,
                    z: 0,
                    isSupport: row === 0
                });
            }
        }

        // Members
        // Columns
        for (let row = 0; row < floors; row++) {
            for (let col = 0; col <= bays; col++) {
                members.push({
                    id: `c-${row}-${col}`,
                    start: [col * w, row * h, 0],
                    end: [col * w, (row + 1) * h, 0],
                    type: 'column'
                });
            }
        }
        // Beams
        for (let row = 1; row <= floors; row++) {
            for (let col = 0; col < bays; col++) {
                members.push({
                    id: `b-${row}-${col}`,
                    start: [col * w, row * h, 0],
                    end: [(col + 1) * w, row * h, 0],
                    type: 'beam',
                    beamType: beamType // Pass beam type to members
                });
            }
        }
        return { nodes, members };
    }, [floors, bays, h, w, beamType]);

    // Parse Results for Visualization (if available)
    // Legacy mapping: results.moments is [val, val...] mapped to members?
    // Current backend returns simplified lists. For full vis we need element mapping.
    // For now, we will render the structure and placeholder result overlays if no detailed map.

    return (
        <group>
            {/* Render Nodes */}
            {structure.nodes.map((node) => (
                <mesh key={node.id} position={[node.x, node.y, node.z]}>
                    <sphereGeometry args={[node.isSupport ? 0.3 : 0.15]} />
                    <meshStandardMaterial color={node.isSupport ? "#ff0000" : "#ffffff"} />
                </mesh>
            ))}

            {/* Render Members */}
            {structure.members.map((member) => (
                <Member
                    key={member.id}
                    start={member.start}
                    end={member.end}
                    type={member.type}
                    beamType={member.beamType || "Rectangular"}
                    flangeWidth={flangeWidth}
                    flangeThickness={flangeThickness}
                    webWidth={webWidth}
                />
            ))}

            {/* Results Overlay (Simplified for now) */}
            {showResults && results && (
                // Text labels for max/min moments? TBD
                <group>
                </group>
            )}
        </group>
    );
}

function Member({ start, end, type, beamType = "Rectangular", flangeWidth = 1.0, flangeThickness = 0.15, webWidth = 0.3 }) {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    const length = startVec.distanceTo(endVec);
    const midPoint = startVec.clone().add(endVec).multiplyScalar(0.5);

    // Orientation
    const direction = endVec.clone().sub(startVec).normalize();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

    const color = type === 'column' ? '#cccccc' : '#aaaaaa';
    const beamDepth = 0.5; // Default beam depth

    // For columns, use simple box
    if (type === 'column') {
        return (
            <mesh position={midPoint} quaternion={quaternion}>
                <boxGeometry args={[0.3, length, 0.3]} />
                <meshStandardMaterial color={color} />
            </mesh>
        );
    }

    // For beams, check if T-beam or L-beam
    if (beamType === "T-Beam") {
        const webDepth = beamDepth - flangeThickness;
        // Rotate 90 degrees for horizontal beam
        const beamQuaternion = new THREE.Quaternion();
        beamQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);

        return (
            <group position={midPoint} quaternion={beamQuaternion}>
                {/* Flange (slab part) - top */}
                <mesh position={[0, beamDepth / 2 - flangeThickness / 2, 0]}>
                    <boxGeometry args={[length, flangeThickness, flangeWidth]} />
                    <meshStandardMaterial color={color} transparent opacity={0.7} />
                </mesh>
                {/* Web (beam stem) - extends down */}
                <mesh position={[0, -flangeThickness / 2 - webDepth / 2, 0]}>
                    <boxGeometry args={[length, webDepth, webWidth]} />
                    <meshStandardMaterial color={color} transparent opacity={0.7} />
                </mesh>
            </group>
        );
    } else if (beamType === "L-Beam") {
        const webDepth = beamDepth - flangeThickness;
        const flangeOffset = (flangeWidth - webWidth) / 2;
        const beamQuaternion = new THREE.Quaternion();
        beamQuaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);

        return (
            <group position={midPoint} quaternion={beamQuaternion}>
                {/* Flange (slab part) - offset to create L */}
                <mesh position={[0, beamDepth / 2 - flangeThickness / 2, flangeOffset]}>
                    <boxGeometry args={[length, flangeThickness, flangeWidth]} />
                    <meshStandardMaterial color={color} transparent opacity={0.7} />
                </mesh>
                {/* Web (beam stem) */}
                <mesh position={[0, -flangeThickness / 2 - webDepth / 2, 0]}>
                    <boxGeometry args={[length, webDepth, webWidth]} />
                    <meshStandardMaterial color={color} transparent opacity={0.7} />
                </mesh>
            </group>
        );
    }

    // Default rectangular beam
    return (
        <mesh position={midPoint} quaternion={quaternion}>
            <boxGeometry args={[0.3, length, 0.3]} />
            <meshStandardMaterial color={color} />
        </mesh>
    );
}
