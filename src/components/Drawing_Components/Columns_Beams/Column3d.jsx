import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  buildIShape, buildLShape, buildTShape, buildRHSShape,
  extrudeAlongY, getRebarPositions
} from './geometry3d.js'
import { MATERIAL_COLORS } from './sectionLibraryData.js'

// ── Materials ────────────────────────────────────────────────────────────────
function useMat(material, override = {}) {
  const base = MATERIAL_COLORS[material] || MATERIAL_COLORS.concrete
  return useMemo(() => new THREE.MeshStandardMaterial({ ...base, ...override }), [material])
}
const steelMat  = new THREE.MeshStandardMaterial({ color: '#7A8B8B', roughness: 0.2, metalness: 0.8 })
const rebarMat  = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.4, metalness: 0.6 })
const boltMat   = new THREE.MeshStandardMaterial({ color: '#2c3e50', roughness: 0.3, metalness: 0.9 })

// ── Rebar in cross-section ───────────────────────────────────────────────────
function RebarArray({ width, depth, count = 8, diaM = 0.016, cover = 0.04, height }) {
  const positions = useMemo(() =>
    getRebarPositions(width, depth, count, cover, diaM), [width, depth, count, cover, diaM])
  return (
    <group>
      {positions.map(([rx, rz], i) => (
        <mesh key={i} position={[rx, height / 2, rz]} material={rebarMat}>
          <cylinderGeometry args={[diaM / 2, diaM / 2, height, 8]} />
        </mesh>
      ))}
    </group>
  )
}

// ── Base Plate ───────────────────────────────────────────────────────────────
function BasePlate({ width, depth, y }) {
  const boltPositions = [[-width/2+0.05, -depth/2+0.05], [width/2-0.05, -depth/2+0.05],
                         [width/2-0.05,  depth/2-0.05],  [-width/2+0.05,  depth/2-0.05]]
  return (
    <group position={[0, y, 0]}>
      <mesh material={steelMat}>
        <boxGeometry args={[width + 0.1, 0.02, depth + 0.1]} />
      </mesh>
      {boltPositions.map(([bx, bz], i) => (
        <mesh key={i} position={[bx, -0.04, bz]} material={boltMat}>
          <cylinderGeometry args={[0.012, 0.012, 0.08, 8]} />
        </mesh>
      ))}
    </group>
  )
}

// ── Selected highlight ───────────────────────────────────────────────────────
function SelectOutline({ children, selected }) {
  if (!selected) return children
  return (
    <group>
      {children}
      {/* selection glow via emissive override is handled by individual meshes */}
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COLUMN 3D COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function Column3D({
  type = 'rectangular_rc',
  x = 0,
  y = 0,              // plan X
  baseElevation = 0,
  topElevation = 3.5,
  sectionProps = {},
  material = 'concrete',
  showRebar = false,
  selected = false,
  onClick,
}) {
  const height = topElevation - baseElevation
  const midY   = baseElevation + height / 2
  const mat    = useMat(material, selected ? { emissive: '#4a9eff', emissiveIntensity: 0.25 } : {})

  const colBody = useMemo(() => {
    switch (type) {

      // 1. Rectangular RC
      case 'rectangular_rc': {
        const { width = 0.4, depth = 0.4 } = sectionProps
        return (
          <group>
            <mesh material={mat} position={[0, midY, 0]}>
              <boxGeometry args={[width, height, depth]} />
            </mesh>
            {showRebar && (
              <RebarArray
                width={width} depth={depth}
                count={sectionProps.rebarCount || 8}
                diaM={(sectionProps.rebarDia || 16) / 1000}
                cover={(sectionProps.cover || 40) / 1000}
                height={height}
              />
            )}
            <BasePlate width={width} depth={depth} y={baseElevation} />
          </group>
        )
      }

      // 2. Circular RC
      case 'circular_rc': {
        const { diameter = 0.5, rebarCount = 8, rebarDia = 16 } = sectionProps
        const r = diameter / 2
        const rebars = Array.from({ length: rebarCount }, (_, i) => {
          const a = (i / rebarCount) * Math.PI * 2
          const rr = r - 0.05
          return [Math.cos(a) * rr, Math.sin(a) * rr]
        })
        return (
          <group>
            <mesh material={mat} position={[0, midY, 0]}>
              <cylinderGeometry args={[r, r, height, 24]} />
            </mesh>
            {showRebar && rebars.map(([rx, rz], i) => (
              <mesh key={i} position={[rx, midY, rz]} material={rebarMat}>
                <cylinderGeometry args={[rebarDia/2000, rebarDia/2000, height, 8]} />
              </mesh>
            ))}
            <mesh material={steelMat} position={[0, baseElevation, 0]}>
              <cylinderGeometry args={[r + 0.05, r + 0.05, 0.02, 24]} />
            </mesh>
          </group>
        )
      }

      // 3. L-shaped
      case 'l_shaped': {
        const { b1 = 0.4, d1 = 0.6, b2 = 0.6, d2 = 0.15 } = sectionProps
        const shape = buildLShape(b1, d1, b2, d2)
        const geo = extrudeAlongY(shape, height)
        return (
          <mesh material={mat} position={[0, baseElevation, 0]}>
            <primitive object={geo} attach="geometry" />
          </mesh>
        )
      }

      // 4. T-shaped
      case 't_shaped': {
        const { bw = 0.4, h = 0.6, bf = 0.8, tf = 0.15 } = sectionProps
        const shape = buildTShape(bw, h, bf, tf)
        const geo = extrudeAlongY(shape, height)
        return (
          <mesh material={mat} position={[0, baseElevation, 0]}>
            <primitive object={geo} attach="geometry" />
          </mesh>
        )
      }

      // 5. Steel I-section
      case 'steel_i': {
        const { H = 0.3, B = 0.15, tw = 0.01, tf = 0.015, r = 0.008 } = sectionProps
        const shape = buildIShape(H, B, tw, tf, r)
        const geo = extrudeAlongY(shape, height)
        return (
          <group>
            <mesh material={mat} position={[0, baseElevation, 0]}>
              <primitive object={geo} attach="geometry" />
            </mesh>
            {/* Head plate */}
            <mesh material={steelMat} position={[0, topElevation + 0.01, 0]}>
              <boxGeometry args={[B + 0.05, 0.02, B + 0.05]} />
            </mesh>
            <BasePlate width={B + 0.06} depth={B + 0.06} y={baseElevation} />
          </group>
        )
      }

      // 6. Steel hollow (SHS/RHS)
      case 'steel_hollow': {
        const { B = 0.2, D = 0.2, t = 0.01 } = sectionProps
        const shape = buildRHSShape(B, D, t)
        const geo = extrudeAlongY(shape, height)
        return (
          <group>
            <mesh material={mat} position={[0, baseElevation, 0]}>
              <primitive object={geo} attach="geometry" />
            </mesh>
            <BasePlate width={B + 0.06} depth={D + 0.06} y={baseElevation} />
          </group>
        )
      }

      // 7. Timber post
      case 'timber': {
        const { width = 0.2, depth = 0.3 } = sectionProps
        const timberMat = new THREE.MeshStandardMaterial({
          color: '#c9a87c', roughness: 0.9, metalness: 0.0,
        })
        // Layer lines to suggest LVL / GLulam
        const layers = Math.floor(depth / 0.05)
        return (
          <group>
            <mesh material={timberMat} position={[0, midY, 0]}>
              <boxGeometry args={[width, height, depth]} />
            </mesh>
            {Array.from({ length: layers }, (_, i) => (
              <mesh key={i}
                material={new THREE.MeshStandardMaterial({ color: '#8B6914', roughness: 1 })}
                position={[0, midY, -depth/2 + (i + 1) * (depth / layers)]}>
                <boxGeometry args={[width + 0.001, height, 0.002]} />
              </mesh>
            ))}
          </group>
        )
      }

      // 8. Composite (steel encased in concrete)
      case 'composite': {
        const { outerD = 0.5, steelH = 0.2, steelB = 0.1, steelTw = 0.008, steelTf = 0.012 } = sectionProps
        const concMat  = new THREE.MeshStandardMaterial({ color: '#9ca3af', roughness: 0.85 })
        const steelM   = new THREE.MeshStandardMaterial({ color: '#7A8B8B', roughness: 0.2, metalness: 0.8 })
        const iShape   = buildIShape(steelH, steelB, steelTw, steelTf)
        const iGeo     = extrudeAlongY(iShape, height)
        return (
          <group>
            <mesh material={concMat} position={[0, midY, 0]}>
              <cylinderGeometry args={[outerD/2, outerD/2, height, 24]} />
            </mesh>
            <mesh material={steelM} position={[0, baseElevation, 0]}>
              <primitive object={iGeo} attach="geometry" />
            </mesh>
          </group>
        )
      }

      // 9. Classical column (Doric)
      case 'classical': {
        const {
          baseDia = 0.7, shaftTopDia = 0.45, shaftBotDia = 0.55,
          capitalH = 0.3, baseH = 0.3
        } = sectionProps
        const shaftH = height - capitalH - baseH
        const marbMat = new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.4, metalness: 0.05 })
        return (
          <group>
            {/* Base (stylobate) */}
            <mesh material={marbMat} position={[0, baseElevation + baseH/2, 0]}>
              <cylinderGeometry args={[baseDia/2, baseDia/2, baseH, 24]} />
            </mesh>
            {/* Shaft with entasis taper */}
            <mesh material={marbMat} position={[0, baseElevation + baseH + shaftH/2, 0]}>
              <cylinderGeometry args={[shaftTopDia/2, shaftBotDia/2, shaftH, 24]} />
            </mesh>
            {/* Capital */}
            <mesh material={marbMat} position={[0, topElevation - capitalH/2, 0]}>
              <cylinderGeometry args={[baseDia/2 * 0.9, shaftTopDia/2, capitalH * 0.7, 24]} />
            </mesh>
            {/* Abacus (flat slab at top) */}
            <mesh material={marbMat} position={[0, topElevation - 0.03, 0]}>
              <boxGeometry args={[baseDia * 0.95, 0.06, baseDia * 0.95]} />
            </mesh>
          </group>
        )
      }

      default:
        return (
          <mesh material={mat} position={[0, midY, 0]}>
            <boxGeometry args={[0.4, height, 0.4]} />
          </mesh>
        )
    }
  }, [type, sectionProps, material, height, midY, mat, showRebar, selected])

  return (
    <group position={[x, 0, y]} onClick={onClick}>
      {colBody}
    </group>
  )
}