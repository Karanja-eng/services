import React, { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, GizmoHelper, GizmoViewport } from '@react-three/drei'
import * as THREE from 'three'
import Column3D from '../columns/Column3D'
import Beam3D from '../beams/Beam3D'
import { useStore } from '../../store'

function GroundPlane() {
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color="#0d1f36" roughness={1} />
        </mesh>
    )
}

function LevelIndicator({ elevation, label }) {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-50, elevation, 0),
        new THREE.Vector3(50, elevation, 0),
    ])
    return (
        <group>
            <line geometry={lineGeo}>
                <lineBasicMaterial color="#1a3a5a" />
            </line>
            {/* Level label handled outside scene */}
        </group>
    )
}

export default function Scene3D({ showRebar = false }) {
    const { columns, beams, selectedId, setSelectedId } = useStore()

    const handleColumnClick = (id) => (e) => {
        e.stopPropagation()
        setSelectedId(id)
    }

    return (
        <Canvas
            shadows
            camera={{ position: [15, 12, 15], fov: 45, near: 0.1, far: 1000 }}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
            style={{ background: '#070e1a' }}
        >
            {/* Lighting */}
            <ambientLight intensity={0.4} />
            <directionalLight
                position={[20, 30, 10]} intensity={1.2}
                castShadow shadow-mapSize={[2048, 2048]}
            />
            <directionalLight position={[-10, 20, -10]} intensity={0.4} color="#4a9eff" />
            <pointLight position={[0, 10, 0]} intensity={0.3} color="#7dc3ff" />

            {/* Environment */}
            <GroundPlane />
            <Grid
                args={[100, 100]}
                cellSize={1}
                cellThickness={0.3}
                cellColor="#1a3a5a"
                sectionSize={5}
                sectionThickness={0.8}
                sectionColor="#2a5a8a"
                fadeDistance={60}
                position={[0, -0.005, 0]}
            />

            {/* Columns */}
            {columns.map((col) => (
                <Column3D
                    key={col.id}
                    type={col.type}
                    x={col.x}
                    y={col.y}
                    baseElevation={col.baseElevation}
                    topElevation={col.topElevation}
                    sectionProps={col.sectionProps}
                    material={col.material}
                    showRebar={showRebar}
                    selected={selectedId === col.id}
                    onClick={handleColumnClick(col.id)}
                />
            ))}

            {/* Beams */}
            {beams.map((beam) => {
                const startCol = columns.find(c => c.id === beam.startColId)
                const endCol = columns.find(c => c.id === beam.endColId)
                if (!startCol || !endCol) return null
                return (
                    <Beam3D
                        key={beam.id}
                        type={beam.type}
                        startCol={startCol}
                        endCol={endCol}
                        sectionProps={beam.sectionProps}
                        material={beam.material}
                        haunch={beam.haunch}
                        haunchLength={beam.haunchLength}
                        haunchDepth={beam.haunchDepth}
                        selected={selectedId === beam.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedId(beam.id) }}
                    />
                )
            })}

            {/* Controls */}
            <OrbitControls
                makeDefault
                minPolarAngle={0}
                maxPolarAngle={Math.PI / 2.1}
                enableDamping dampingFactor={0.05}
            />

            {/* View cube */}
            <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
                <GizmoViewport
                    axisColors={['#e74c3c', '#2ecc71', '#4a9eff']}
                    labelColor="#ffffff"
                />
            </GizmoHelper>
        </Canvas>
    )
}