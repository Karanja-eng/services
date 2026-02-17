/**
 * Technical CAD Geometry Utilities (Ported from geometry_utils.py)
 * Handles mathematical operations for 2D/3D CAD interactions.
 */

// ============ DISTANCE & MEASUREMENT ============

export const distance = (p1, p2) => {
    return Math.sqrt(
        Math.pow(p2.x - p1.x, 2) +
        Math.pow(p2.y - p1.y, 2) +
        Math.pow((p2.z || 0) - (p1.z || 0), 2)
    );
};

export const distance2D = (p1, p2) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

export const getLineLength = (start, end) => {
    return distance(start, end);
};

export const getPolylineLength = (points) => {
    if (!points || points.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        total += distance(points[i], points[i + 1]);
    }
    return total;
};

// ============ AREA & PERIMETER ============

export const getCircleArea = (radius) => Math.PI * Math.pow(radius, 2);
export const getCircleCircumference = (radius) => 2 * Math.PI * radius;

export const getRectangleArea = (p1, p2) => {
    return Math.abs(p2.x - p1.x) * Math.abs(p2.y - p1.y);
};

export const getPolygonArea = (points) => {
    if (!points || points.length < 3) return 0;
    let area = 0.0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2.0;
};

// ============ TRANSFORMATIONS ============

export const translatePoint = (point, dx, dy, dz = 0) => {
    return { x: point.x + dx, y: point.y + dy, z: (point.z || 0) + dz };
};

export const rotatePoint = (point, center, angleDegrees) => {
    const angleRad = (angleDegrees * Math.PI) / 180.0;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    const x = point.x - center.x;
    const y = point.y - center.y;

    return {
        x: x * cosA - y * sinA + center.x,
        y: x * sinA + y * cosA + center.y,
        z: point.z || 0
    };
};

export const scalePoint = (point, center, scale) => {
    return {
        x: center.x + (point.x - center.x) * scale,
        y: center.y + (point.y - center.y) * scale,
        z: (center.z || 0) + ((point.z || 0) - (center.z || 0)) * scale
    };
};

export const mirrorPoint = (point, axisStart, axisEnd) => {
    const lx = axisEnd.x - axisStart.x;
    const ly = axisEnd.y - axisStart.y;
    const lenL = Math.sqrt(lx * lx + ly * ly);

    if (lenL === 0) return { ...point };

    const uX = lx / lenL;
    const uY = ly / lenL;

    const px = point.x - axisStart.x;
    const py = point.y - axisStart.y;

    const dot = px * uX + py * uY;
    const projX = axisStart.x + dot * uX;
    const projY = axisStart.y + dot * uY;

    return {
        x: 2 * projX - point.x,
        y: 2 * projY - point.y,
        z: point.z || 0
    };
};

// ============ INTERSECTIONS ============

export const lineLineIntersection = (p1, p2, p3, p4) => {
    const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(denom) < 1e-10) return null;

    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
        return {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y),
            z: 0
        };
    }
    return null;
};

// ============ BOUNDING BOX ============

export const getBoundingBox = (objects) => {
    if (!objects || objects.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const expand = (p) => {
        if (!p) return;
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    };

    objects.forEach(obj => {
        if (obj.type === 'line') {
            if (obj.points) obj.points.forEach(expand);
            else { expand(obj.start); expand(obj.end); }
        } else if (obj.type === 'rectangle') {
            expand(obj.start); expand(obj.end);
        } else if (obj.type === 'circle') {
            const { center, radius } = obj;
            expand({ x: center.x - radius, y: center.y - radius });
            expand({ x: center.x + radius, y: center.y + radius });
        } else if (obj.type === 'text') {
            expand(obj.position);
        }
    });

    if (minX === Infinity) return null;

    return {
        minX, minY, maxX, maxY,
        width: maxX - minX,
        height: maxY - minY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
    };
};

// ============ MISC ============

export const angleBetweenPoints = (p1, p2) => {
    return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
};

export const pointToLineDistance = (p, p1, p2) => {
    const numerator = Math.abs((p2.y - p1.y) * p.x - (p2.x - p1.x) * p.y + p2.x * p1.y - p2.y * p1.x);
    const denominator = Math.sqrt(Math.pow(p2.y - p1.y, 2) + Math.pow(p2.x - p1.x, 2));

    if (denominator === 0) return distance2D(p, p1);
    return numerator / denominator;
};
