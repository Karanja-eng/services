import React from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

const CadObjects3D = ({ objects = [], showDimensions = true }) => {
    return (
        <group>
            {objects.map((obj) => {
                const color = obj.color || "#FFFFFF";

                switch (obj.type) {
                    case "line":
                        return (
                            <line key={obj.id}>
                                <bufferGeometry attach="geometry" onUpdate={self => self.setFromPoints([
                                    new THREE.Vector3(obj.start.x, obj.start.y, obj.start.z || 0),
                                    new THREE.Vector3(obj.end.x, obj.end.y, obj.end.z || 0)
                                ])} />
                                <lineBasicMaterial attach="material" color={color} linewidth={2} />
                            </line>
                        );

                    case "circle":
                        return (
                            <line key={obj.id} position={[obj.center.x, obj.center.y, obj.center.z || 0]}>
                                <ringGeometry attach="geometry" args={[obj.radius, obj.radius + 0.05, 64]} />
                                <lineBasicMaterial attach="material" color={color} />
                            </line>
                        );

                    case "rectangle":
                        const width = Math.abs(obj.end.x - obj.start.x);
                        const height = Math.abs(obj.end.y - obj.start.y);
                        return (
                            <line key={obj.id} position={[(obj.start.x + obj.end.x) / 2, (obj.start.y + obj.end.y) / 2, 0]}>
                                <edgesGeometry attach="geometry">
                                    <planeGeometry args={[width, height]} />
                                </edgesGeometry>
                                <lineBasicMaterial attach="material" color={color} />
                            </line>
                        );

                    case "box":
                        return (
                            <mesh key={obj.id} position={[obj.position.x, obj.position.y, obj.position.z || 0]}>
                                <boxGeometry args={[obj.width || 1, obj.height || 1, obj.depth || 1]} />
                                <meshStandardMaterial color={color} />
                            </mesh>
                        );

                    case "extrusion":
                        if (obj.points && obj.points.length > 2) {
                            const shape = new THREE.Shape();
                            obj.points.forEach((p, i) => {
                                if (i === 0) shape.moveTo(p.x, p.y);
                                else shape.lineTo(p.x, p.y);
                            });
                            shape.closePath();
                            const extrudeSettings = {
                                depth: obj.depth || 1,
                                bevelEnabled: false,
                            };
                            return (
                                <mesh key={obj.id}>
                                    <extrudeGeometry args={[shape, extrudeSettings]} />
                                    <meshStandardMaterial color={color} side={THREE.DoubleSide} />
                                </mesh>
                            );
                        }
                        return null;

                    default:
                        return null;
                }
            })}
        </group>
    );
};

export default CadObjects3D;
