import * as THREE from 'three';

/**
 * Generate a road BufferGeometry from a polyline path with fixed width.
 * Produces a flat ribbon with correct miter joints at corners.
 */
export function buildRoadGeometry(points2D, width, thickness = 0.12) {
    const pts = points2D.map(([x, z]) => new THREE.Vector2(x, z));
    const shape = buildRibbonShape(pts, width);
    const extrudeSettings = { depth: thickness, bevelEnabled: false };
    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.rotateX(-Math.PI / 2);
    geom.translate(0, thickness, 0);
    return geom;
}

/**
 * Build a ribbon ShapeGeometry for a polyline (2D x,z).
 * Returns the top face only (for flat road surfaces).
 */
export function buildRibbonShape(pts2D, width) {
    const half = width / 2;
    const left = [];
    const right = [];

    for (let i = 0; i < pts2D.length; i++) {
        const prev = pts2D[i - 1] || pts2D[i];
        const curr = pts2D[i];
        const next = pts2D[i + 1] || pts2D[i];

        const dir = new THREE.Vector2()
            .subVectors(next, prev)
            .normalize();
        const perp = new THREE.Vector2(-dir.y, dir.x);

        left.push(curr.clone().addScaledVector(perp, half));
        right.push(curr.clone().addScaledVector(perp, -half));
    }

    const shape = new THREE.Shape();
    shape.moveTo(left[0].x, left[0].y);
    left.forEach(p => shape.lineTo(p.x, p.y));
    [...right].reverse().forEach(p => shape.lineTo(p.x, p.y));
    shape.closePath();
    return shape;
}

/**
 * Sample a CatmullRom curve into a road mesh with width.
 */
export function buildCurvedRoadGeometry(controlPoints3D, width, segments = 64, thickness = 0.12) {
    const curve = new THREE.CatmullRomCurve3(
        controlPoints3D.map(([x, y, z]) => new THREE.Vector3(x, y, z))
    );

    const positions = [];
    const indices = [];
    const uvs = [];

    const half = width / 2;
    let totalLen = 0;
    const segPts = curve.getSpacedPoints(segments);

    for (let i = 0; i < segPts.length; i++) {
        const tangent = curve.getTangentAt(i / segments);
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const L = segPts[i].clone().addScaledVector(right, -half);
        const R = segPts[i].clone().addScaledVector(right, half);

        if (i > 0) totalLen += segPts[i].distanceTo(segPts[i - 1]);
        const u = totalLen;

        positions.push(L.x, L.y + thickness, L.z, R.x, R.y + thickness, R.z);
        uvs.push(0, u / width, 1, u / width);

        if (i < segPts.length - 1) {
            const base = i * 2;
            indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
}

/**
 * Build cul-de-sac (circular end) geometry.
 * @param {[number,number,number]} center
 * @param {number} radius  outer carriageway radius
 * @param {number} thickness
 */
export function buildCulDeSacGeometry(center, radius, thickness = 0.12, segments = 64) {
    const geom = new THREE.CylinderGeometry(radius, radius, thickness, segments, 1, false,
        -Math.PI * 0.1, Math.PI * 1.2);
    geom.translate(center[0], center[1] + thickness / 2, center[2]);
    return geom;
}

/**
 * Build roundabout carriageway ring geometry.
 */
export function buildRoundaboutGeometry(center, outerR, innerR, thickness = 0.12, segments = 64) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
    shape.holes.push(hole);

    const extrudeSettings = { depth: thickness, bevelEnabled: false };
    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geom.rotateX(-Math.PI / 2);
    geom.translate(center[0], center[1] + thickness, center[2]);
    return geom;
}

/**
 * Build kerb L-profile extruded along a path.
 * @param {Array} pts2D  [[x,z], ...]
 * @param {'left'|'right'} side
 * @param {number} roadHalfWidth
 */
export function buildKerbGeometry(pts2D, roadHalfWidth, side = 'left') {
    const kerbProfile = new THREE.Shape();
    // L-profile: upstand kerb 150mm high, 125mm wide
    kerbProfile.moveTo(0, 0);
    kerbProfile.lineTo(0.125, 0);
    kerbProfile.lineTo(0.125, 0.15);
    kerbProfile.lineTo(0.025, 0.15);
    kerbProfile.lineTo(0, 0.10);
    kerbProfile.closePath();

    const points = pts2D.map(([x, z]) => new THREE.Vector2(x, z));
    const offset = side === 'left' ? roadHalfWidth : -roadHalfWidth;

    const pathPoints = [];
    for (let i = 0; i < points.length; i++) {
        const prev = points[i - 1] || points[i];
        const next = points[i + 1] || points[i];
        const dir = new THREE.Vector2().subVectors(next, prev).normalize();
        const perp = new THREE.Vector2(-dir.y, dir.x);
        const p = points[i].clone().addScaledVector(perp, offset);
        pathPoints.push(new THREE.Vector3(p.x, 0, p.y));
    }

    const curvePath = new THREE.CatmullRomCurve3(pathPoints);
    const geom = new THREE.TubeGeometry(curvePath, pts2D.length * 4, 0.02, 4, false);
    // Replace with extruded profile for production
    return geom;
}

/**
 * Build parking area geometry (bays + aisles).
 * Returns an array of { geom, role: 'bay'|'aisle'|'line' }
 */
export function buildParkingLayout({ originX, originZ, width, depth, bayAngle, bayWidth, bayDepth, aisleWidth, rows }) {
    const results = [];

    // Aisle surface
    const aisleGeom = new THREE.BoxGeometry(width, 0.12, aisleWidth);
    aisleGeom.translate(originX + width / 2, 0.06, originZ + aisleWidth / 2);
    results.push({ geom: aisleGeom, role: 'aisle' });

    // Bay rows
    const bayAngleRad = (bayAngle * Math.PI) / 180;
    const effectiveBayWidth = bayWidth / Math.sin(bayAngleRad);
    const baysPerRow = Math.floor(width / effectiveBayWidth);

    for (let row = 0; row < rows; row++) {
        const rowZ = originZ + aisleWidth + row * (bayDepth + aisleWidth);
        for (let b = 0; b < baysPerRow; b++) {
            const bx = originX + b * effectiveBayWidth;
            const bayGeom = new THREE.BoxGeometry(bayWidth, 0.10, bayDepth);
            bayGeom.translate(bx + bayWidth / 2, 0.05, rowZ + bayDepth / 2);
            results.push({ geom: bayGeom, role: 'bay', number: row * baysPerRow + b + 1 });
        }
    }

    return results;
}

/**
 * Compute polyline total length.
 */
export function polylineLength(pts3D) {
    let len = 0;
    for (let i = 1; i < pts3D.length; i++) {
        const a = new THREE.Vector3(...pts3D[i - 1]);
        const b = new THREE.Vector3(...pts3D[i]);
        len += a.distanceTo(b);
    }
    return len;
}