import * as THREE from 'three'

// ── I-Section Shape ──────────────────────────────────────────────────────────
export function buildIShape(H, B, tw, tf, r = 0) {
  const shape = new THREE.Shape()
  const hw = H / 2, bw = B / 2

  // Clockwise from bottom-left
  shape.moveTo(-bw, -hw)
  shape.lineTo( bw, -hw)
  shape.lineTo( bw, -hw + tf)
  shape.lineTo( tw / 2 + r, -hw + tf)
  if (r > 0) shape.quadraticCurveTo(tw / 2, -hw + tf + r, tw / 2, -hw + tf + r)
  shape.lineTo( tw / 2,  hw - tf)
  if (r > 0) shape.quadraticCurveTo(tw / 2, hw - tf - r, bw, hw - tf)
  shape.lineTo( bw, hw - tf)
  shape.lineTo( bw,  hw)
  shape.lineTo(-bw,  hw)
  shape.lineTo(-bw,  hw - tf)
  shape.lineTo(-tw / 2, hw - tf)
  shape.lineTo(-tw / 2, -hw + tf)
  shape.lineTo(-bw, -hw + tf)
  shape.closePath()
  return shape
}

// ── Channel (PFC) Shape ──────────────────────────────────────────────────────
export function buildChannelShape(H, B, tw, tf) {
  const shape = new THREE.Shape()
  const hw = H / 2
  shape.moveTo(0, -hw)
  shape.lineTo(B, -hw)
  shape.lineTo(B, -hw + tf)
  shape.lineTo(tw, -hw + tf)
  shape.lineTo(tw, hw - tf)
  shape.lineTo(B, hw - tf)
  shape.lineTo(B, hw)
  shape.lineTo(0, hw)
  shape.closePath()
  return shape
}

// ── Rectangular Hollow Shape ─────────────────────────────────────────────────
export function buildRHSShape(B, D, t) {
  const outer = new THREE.Shape()
  const bh = B / 2, dh = D / 2
  outer.moveTo(-bh, -dh)
  outer.lineTo( bh, -dh)
  outer.lineTo( bh,  dh)
  outer.lineTo(-bh,  dh)
  outer.closePath()

  const inner = new THREE.Path()
  const bi = bh - t, di = dh - t
  inner.moveTo(-bi, -di)
  inner.lineTo(-bi,  di)
  inner.lineTo( bi,  di)
  inner.lineTo( bi, -di)
  inner.closePath()
  outer.holes.push(inner)
  return outer
}

// ── L-Shape ──────────────────────────────────────────────────────────────────
export function buildLShape(b1, d1, b2, d2) {
  // b1×d1 = vertical leg, b2×d2 = horizontal leg thickness
  const shape = new THREE.Shape()
  shape.moveTo(0, 0)
  shape.lineTo(b2, 0)
  shape.lineTo(b2, d2)
  shape.lineTo(b1, d2)
  shape.lineTo(b1, d1)
  shape.lineTo(0, d1)
  shape.closePath()
  return shape
}

// ── T-Shape ──────────────────────────────────────────────────────────────────
export function buildTShape(bw, h, bf, tf) {
  const shape = new THREE.Shape()
  const bfh = bf / 2, bwh = bw / 2
  // web bottom to top
  shape.moveTo(-bwh, 0)
  shape.lineTo( bwh, 0)
  shape.lineTo( bwh, h - tf)
  shape.lineTo( bfh, h - tf)
  shape.lineTo( bfh, h)
  shape.lineTo(-bfh, h)
  shape.lineTo(-bfh, h - tf)
  shape.lineTo(-bwh, h - tf)
  shape.closePath()
  return shape
}

// ── Extrude along Y axis ─────────────────────────────────────────────────────
export function extrudeAlongY(shape, length, bevelEnabled = false) {
  const settings = {
    steps: 1,
    depth: length,
    bevelEnabled,
  }
  const geo = new THREE.ExtrudeGeometry(shape, settings)
  // Rotate so extrusion is along Y
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
  return geo
}

// ── Rebar positions in rectangular section ───────────────────────────────────
export function getRebarPositions(width, depth, count, cover, diaM) {
  const positions = []
  const cx = cover + diaM / 2
  const cy = cover + diaM / 2
  // Corner rebars first, then distribute along edges
  const corners = [
    [-width / 2 + cx, -depth / 2 + cy],
    [ width / 2 - cx, -depth / 2 + cy],
    [ width / 2 - cx,  depth / 2 - cy],
    [-width / 2 + cx,  depth / 2 - cy],
  ]
  positions.push(...corners)
  const remaining = Math.max(0, count - 4)
  const perFace = Math.floor(remaining / 4)
  for (let i = 0; i < perFace; i++) {
    const t = (i + 1) / (perFace + 1)
    const bx = -width / 2 + cx + t * (width - 2 * cx)
    positions.push([bx, -depth / 2 + cy])  // bottom
    positions.push([bx,  depth / 2 - cy])  // top
    const dy = -depth / 2 + cy + t * (depth - 2 * cy)
    positions.push([-width / 2 + cx, dy])  // left
    positions.push([ width / 2 - cx, dy])  // right
  }
  return positions.slice(0, count)
}

// ── Beam direction vector ────────────────────────────────────────────────────
export function beamDirectionAndLength(sx, sy, sz, ex, ey, ez) {
  const dx = ex - sx, dy = ey - sy, dz = ez - sz
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz)
  return { dir: [dx / len, dy / len, dz / len], length: len }
}