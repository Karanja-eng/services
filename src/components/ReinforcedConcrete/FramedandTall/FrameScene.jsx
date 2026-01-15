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
                    type: 'beam'
                });
            }
        }
        return { nodes, members };
    }, [floors, bays, h, w]);

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

function Member({ start, end, type }) {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    const length = startVec.distanceTo(endVec);
    const midPoint = startVec.clone().add(endVec).multiplyScalar(0.5);

    // Orientation
    const direction = endVec.clone().sub(startVec).normalize();
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);

    const color = type === 'column' ? '#cccccc' : '#aaaaaa';

    return (
        <mesh position={midPoint} quaternion={quaternion}>
            <boxGeometry args={[0.3, length, 0.3]} />
            <meshStandardMaterial color={color} />
        </mesh>
    );
}
