import React, { useMemo } from 'react'
import * as THREE from 'three'
import {
  buildIShape, buildChannelShape, buildRHSShape, buildTShape, buildLShape,
  extrudeAlongY
} from '../../utils/geometry3d'
import { MATERIAL_COLORS } from '../../data/sectionLibrary'

const rebarMat   = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.4, metalness: 0.6 })
const tendonMat  = new THREE.MeshStandardMaterial({ color: '#f39c12', roughness: 0.3, metalness: 0.7 })

function useMat(material, selected) {
  return useMemo(() => {
    const base = MATERIAL_COLORS[material] || MATERIAL_COLORS.concrete
    return new THREE.MeshStandardMaterial({
      ...base,
      ...(selected ? { emissive: '#4a9eff', emissiveIntensity: 0.2 } : {}),
    })
  }, [material, selected])
}

// Build and orient beam geometry along the direction from start to end
function OrientedBeam({ geometry, start, end, yOffset = 0, selected }) {
  const [sx, sy, sz] = start
  const [ex, ey, ez] = end
  const dx = ex - sx, dy = ey - sy, dz = ez - sz
  const len = Math.sqrt(dx*dx + dy*dy + dz*dz)
  const mid = [(sx+ex)/2, (sy+ey)/2 + yOffset, (sz+ez)/2]

  // Euler angles to orient
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion()
    const from = new THREE.Vector3(0, 1, 0)
    const to   = new THREE.Vector3(dx/len, dy/len, dz/len)
    q.setFromUnitVectors(from, to)
    return q
  }, [dx, dy, dz, len])

  return (
    <mesh
      geometry={geometry}
      position={mid}
      quaternion={quaternion}
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// BEAM 3D COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function Beam3D({
  type = 'rectangular_beam',
  startCol,    // { x, y, topElevation, sectionProps }
  endCol,      // { x, y, topElevation, sectionProps }
  sectionProps = {},
  material = 'concrete',
  haunch = false,
  haunchLength = 0.5,
  haunchDepth = 0.15,
  selected = false,
  onClick,
}) {
  if (!startCol || !endCol) return null

  const mat = useMat(material, selected)

  const elevation = Math.min(startCol.topElevation, endCol.topElevation)

  // Offset beam ends to column faces
  const sx = startCol.x, sz = startCol.y
  const ex = endCol.x,   ez = endCol.y
  const dx = ex - sx, dz = ez - sz
  const span = Math.sqrt(dx*dx + dz*dz)
  const ux = dx / span, uz = dz / span

  // Approximate column half-width for face offset
  const startHW = (startCol.sectionProps?.width || startCol.sectionProps?.diameter || 0.4) / 2
  const endHW   = (endCol.sectionProps?.width   || endCol.sectionProps?.diameter   || 0.4) / 2
  const start3  = [sx + ux * startHW, elevation, sz + uz * startHW]
  const end3    = [ex - ux * endHW,   elevation, ez - uz * endHW]

  const beamSpan = span - startHW - endHW

  const beamBody = useMemo(() => {
    const makeGeo = () => {
      switch (type) {

        // 1. Rectangular RC beam
        case 'rectangular_beam': {
          const { width = 0.3, depth = 0.5 } = sectionProps
          const geo = new THREE.BoxGeometry(width, beamSpan, depth)
          geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI/2))
          return geo
        }

        // 2. T-beam
        case 't_beam': {
          const { bw = 0.3, hw = 0.45, bf = 0.9, tf = 0.15 } = sectionProps
          const shape = buildTShape(bw, hw + tf, bf, tf)
          return extrudeAlongY(shape, beamSpan)
        }

        // 3. L-beam
        case 'l_beam': {
          const { bw = 0.3, hw = 0.45, bf = 0.5, tf = 0.15 } = sectionProps
          const shape = buildLShape(bw, hw + tf, bf, tf)
          return extrudeAlongY(shape, beamSpan)
        }

        // 4. Steel I-beam
        case 'steel_i_beam': {
          const { H = 0.45, B = 0.19, tw = 0.01, tf = 0.015, r = 0.01 } = sectionProps
          const shape = buildIShape(H, B, tw, tf, r)
          return extrudeAlongY(shape, beamSpan)
        }

        // 5. Steel channel (PFC)
        case 'steel_channel': {
          const { H = 0.3, B = 0.1, tw = 0.009, tf = 0.014 } = sectionProps
          const shape = buildChannelShape(H, B, tw, tf)
          return extrudeAlongY(shape, beamSpan)
        }

        // 6. Steel hollow section beam
        case 'steel_hollow_beam': {
          const { B = 0.25, D = 0.15, t = 0.01 } = sectionProps
          const shape = buildRHSShape(B, D, t)
          return extrudeAlongY(shape, beamSpan)
        }

        // 7. Timber beam
        case 'timber_beam': {
          const { width = 0.2, depth = 0.45 } = sectionProps
          const geo = new THREE.BoxGeometry(width, beamSpan, depth)
          geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI/2))
          return geo
        }

        // 8. Post-tensioned beam (rectangular, tendons shown as curves)
        case 'pt_beam': {
          const { width = 0.35, depth = 0.6 } = sectionProps
          const geo = new THREE.BoxGeometry(width, beamSpan, depth)
          geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI/2))
          return geo
        }

        // 9. Cantilever (tapered depth)
        case 'cantilever_beam': {
          const { width = 0.3, depthRoot = 0.6, depthTip = 0.3 } = sectionProps
          // Build tapered shape manually
          const shape = new THREE.Shape()
          shape.moveTo(-width/2, 0)
          shape.lineTo( width/2, 0)
          shape.lineTo( width/2, depthTip)
          // Tapered top surface
          shape.lineTo(-width/2, depthTip)
          shape.closePath()
          // Simple tapered box: just use variable-depth box approximation
          const geo = new THREE.BoxGeometry(width, beamSpan, (depthRoot + depthTip) / 2)
          geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI/2))
          return geo
        }

        // 10. Transfer beam (deep section)
        case 'transfer_beam': {
          const { width = 0.5, depth = 1.2 } = sectionProps
          const geo = new THREE.BoxGeometry(width, beamSpan, depth)
          geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI/2))
          return geo
        }

        default: {
          const geo = new THREE.BoxGeometry(0.3, beamSpan, 0.5)
          geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI/2))
          return geo
        }
      }
    }

    return makeGeo()
  }, [type, sectionProps, beamSpan])

  // Tendon curves for PT beam
  const tendons = useMemo(() => {
    if (type !== 'pt_beam') return null
    const { tendons: count = 4, width = 0.35, depth = 0.6 } = sectionProps
    return Array.from({ length: count }, (_, i) => {
      const tx = -width/2 + 0.1 + i * (width - 0.2) / Math.max(count - 1, 1)
      return tx
    })
  }, [type, sectionProps])

  // Timber layer lines for GLulam/LVL
  const timberLayers = useMemo(() => {
    if (type !== 'timber_beam') return null
    const { depth = 0.45, width = 0.2, layers = 5 } = sectionProps
    return Array.from({ length: layers - 1 }, (_, i) => ({
      z: -depth/2 + (i + 1) * depth / layers,
      w: width,
    }))
  }, [type, sectionProps])

  // Haunch geometry
  const haunchGeos = useMemo(() => {
    if (!haunch) return null
    const { width = sectionProps.width || 0.3, depth = sectionProps.depth || 0.5 } = sectionProps
    // Left haunch
    const startGeo = new THREE.BoxGeometry(width, haunchLength, depth + haunchDepth / 2)
    startGeo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI/2))
    return { startGeo, width, depth }
  }, [haunch, haunchLength, haunchDepth, sectionProps])

  const midX = (start3[0] + end3[0]) / 2
  const midZ = (start3[2] + end3[2]) / 2
  const midY = elevation - (sectionProps.depth || sectionProps.H || 0.5) / 2

  const dx3 = end3[0] - start3[0]
  const dz3 = end3[2] - start3[2]
  const angleY = Math.atan2(dx3, dz3)

  return (
    <group onClick={onClick}>
      {/* Main beam body */}
      <mesh
        geometry={beamBody}
        material={mat}
        position={[midX, midY, midZ]}
        rotation={[0, angleY, 0]}
      />

      {/* Timber layer lines */}
      {timberLayers && timberLayers.map((layer, i) => (
        <mesh key={i}
          position={[midX, midY + layer.z, midZ]}
          rotation={[0, angleY, 0]}
          material={new THREE.MeshStandardMaterial({ color: '#8B6914', roughness: 1 })}
        >
          <boxGeometry args={[layer.w + 0.002, beamSpan, 0.003]} />
        </mesh>
      ))}

      {/* PT tendons (symbolic) */}
      {tendons && tendons.map((tx, i) => {
        const { depth = 0.6 } = sectionProps
        return (
          <mesh key={i}
            position={[midX + tx, midY - depth * 0.3, midZ]}
            rotation={[0, angleY, 0]}
            material={tendonMat}
          >
            <cylinderGeometry args={[0.012, 0.012, beamSpan, 6]} />
          </mesh>
        )
      })}
    </group>
  )
}