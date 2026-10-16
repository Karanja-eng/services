import { Vector2, LineSegment, Circle, Arc, Polyline, BBox } from './Geometry';

export const SNAP_MODES = {
    ENDPOINT: "endpoint",
    MIDPOINT: "midpoint",
    CENTER: "center",
    QUADRANT: "quadrant",
    INTERSECTION: "intersection",
    PERPENDICULAR: "perpendicular",
    TANGENT: "tangent",
    GRID: "grid",
    NEAREST: "nearest",
};

export class SnapEngine {
    constructor(settings = {}) {
        this.settings = {
            [SNAP_MODES.ENDPOINT]: true,
            [SNAP_MODES.MIDPOINT]: true,
            [SNAP_MODES.CENTER]: true,
            [SNAP_MODES.QUADRANT]: true,
            [SNAP_MODES.INTERSECTION]: true,
            [SNAP_MODES.PERPENDICULAR]: true,
            [SNAP_MODES.TANGENT]: true,
            [SNAP_MODES.GRID]: false,
            [SNAP_MODES.NEAREST]: false,
            ...settings
        };
        this.snapThreshold = 15; // pixels
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }

    findSnapPoint(mousePoint, objects, zoomLevel) {
        const threshold = this.snapThreshold / zoomLevel;
        let bestSnap = null;
        let minDistance = threshold;

        const priorityOrder = [
            SNAP_MODES.ENDPOINT,
            SNAP_MODES.MIDPOINT,
            SNAP_MODES.CENTER,
            SNAP_MODES.INTERSECTION,
            SNAP_MODES.QUADRANT,
            SNAP_MODES.PERPENDICULAR,
            SNAP_MODES.TANGENT,
        ];

        for (const mode of priorityOrder) {
            if (!this.settings[mode]) continue;

            if (mode === SNAP_MODES.INTERSECTION) {
                const intersectionSnap = this.findIntersectionSnap(mousePoint, objects, threshold);
                if (intersectionSnap) return intersectionSnap;
            } else {
                for (const obj of objects) {
                    const snap = this.getSnapPointForObject(mousePoint, obj, mode, threshold);
                    if (snap) {
                        const dist = mousePoint.distanceTo(snap.point);
                        if (dist < minDistance) {
                            minDistance = dist;
                            bestSnap = snap;
                        }
                    }
                }
            }

            if (bestSnap) break;
        }

        return bestSnap;
    }

    findIntersectionSnap(mousePoint, objects, threshold) {
        // Find all objects near mouse
        const nearbyObjects = objects.filter(obj => {
            const bbox = this.getObjectBBox(obj);
            if (!bbox) return false;
            return bbox.expand(threshold).contains(mousePoint);
        });

        for (let i = 0; i < nearbyObjects.length; i++) {
            for (let j = i + 1; j < nearbyObjects.length; j++) {
                const intersections = this.getIntersections(nearbyObjects[i], nearbyObjects[j]);
                for (const pt of intersections) {
                    if (mousePoint.distanceTo(pt) < threshold) {
                        return { point: pt, type: SNAP_MODES.INTERSECTION };
                    }
                }
            }
        }
        return null;
    }

    getObjectBBox(obj) {
        if (obj.type === "line") {
            return new LineSegment(obj.start, obj.end).getBBox();
        }
        if (obj.type === "circle") {
            return new Circle(obj.center, obj.radius).getBBox();
        }
        if (obj.type === "arc") {
            return new Arc(obj.center, obj.radius, obj.startAngle, obj.endAngle, obj.counterClockwise).getBBox();
        }
        if (obj.type === "polyline") {
            const bbox = new BBox();
            obj.points.forEach(p => bbox.expandByPoint(Vector2.fromObject(p)));
            return bbox;
        }
        if (obj.type === "rectangle") {
            const bbox = new BBox();
            bbox.expandByPoint(Vector2.fromObject(obj.start));
            bbox.expandByPoint(Vector2.fromObject(obj.end));
            return bbox;
        }
        return null;
    }

    getIntersections(obj1, obj2) {
        const geom1 = this.toGeometry(obj1);
        const geom2 = this.toGeometry(obj2);
        if (!geom1 || !geom2) return [];

        if (geom1.intersectLine && geom2 instanceof LineSegment) return geom1.intersectLine(geom2);
        if (geom1.intersectCircle && geom2 instanceof Circle) return geom1.intersectCircle(geom2);
        // ... add more permutations as needed, or use a generic dispatcher
        return [];
    }

    toGeometry(obj) {
        if (obj.type === "line") return new LineSegment(Vector2.fromObject(obj.start), Vector2.fromObject(obj.end));
        if (obj.type === "circle") return new Circle(Vector2.fromObject(obj.center), obj.radius);
        // ... add polyline/arc
        return null;
    }

    getSnapPointForObject(mousePoint, obj, mode, threshold) {
        switch (obj.type) {
            case "line":
                return this.getSnapForLine(mousePoint, obj, mode, threshold);
            case "polyline":
                return this.getSnapForPolyline(mousePoint, obj, mode, threshold);
            case "circle":
                return this.getSnapForCircle(mousePoint, obj, mode, threshold);
            case "arc":
                return this.getSnapForArc(mousePoint, obj, mode, threshold);
            default:
                return null;
        }
    }

    getSnapForLine(mousePoint, obj, mode, threshold) {
        if (!obj.start || !obj.end) return null;
        const start = Vector2.fromObject(obj.start);
        const end = Vector2.fromObject(obj.end);
        const line = new LineSegment(start, end);

        if (mode === SNAP_MODES.ENDPOINT) {
            const dStart = mousePoint.distanceTo(start);
            if (dStart < threshold) return { point: start, type: SNAP_MODES.ENDPOINT };
            const dEnd = mousePoint.distanceTo(end);
            if (dEnd < threshold) return { point: end, type: SNAP_MODES.ENDPOINT };
        }

        if (mode === SNAP_MODES.MIDPOINT) {
            const mid = line.getPointAt(0.5);
            if (mousePoint.distanceTo(mid) < threshold) return { point: mid, type: SNAP_MODES.MIDPOINT };
        }

        return null;
    }

    getSnapForPolyline(mousePoint, obj, mode, threshold) {
        if (!obj.points) return null;

        for (let i = 0; i < obj.points.length; i++) {
            const p = Vector2.fromObject(obj.points[i]);
            if (mode === SNAP_MODES.ENDPOINT) {
                if (mousePoint.distanceTo(p) < threshold) return { point: p, type: SNAP_MODES.ENDPOINT };
            }

            if (i < obj.points.length - 1 && mode === SNAP_MODES.MIDPOINT) {
                const nextP = Vector2.fromObject(obj.points[i + 1]);
                const mid = p.add(nextP).multiply(0.5);
                if (mousePoint.distanceTo(mid) < threshold) return { point: mid, type: SNAP_MODES.MIDPOINT };
            }
        }
        return null;
    }

    getSnapForCircle(mousePoint, obj, mode, threshold) {
        if (!obj.center) return null;
        const center = Vector2.fromObject(obj.center);
        if (mode === SNAP_MODES.CENTER) {
            if (mousePoint.distanceTo(center) < threshold) return { point: center, type: SNAP_MODES.CENTER };
        }

        if (mode === SNAP_MODES.QUADRANT) {
            const quadrants = [
                new Vector2(center.x + obj.radius, center.y),
                new Vector2(center.x - obj.radius, center.y),
                new Vector2(center.x, center.y + obj.radius),
                new Vector2(center.x, center.y - obj.radius),
            ];
            for (const q of quadrants) {
                if (mousePoint.distanceTo(q) < threshold) return { point: q, type: SNAP_MODES.QUADRANT };
            }
        }
        return null;
    }

    getSnapForArc(mousePoint, obj, mode, threshold) {
        if (!obj.center) return null;
        const center = Vector2.fromObject(obj.center);
        if (mode === SNAP_MODES.CENTER) {
            if (mousePoint.distanceTo(center) < threshold) return { point: center, type: SNAP_MODES.CENTER };
        }
        // Endpoints for arc
        if (mode === SNAP_MODES.ENDPOINT) {
            const start = new Vector2(
                center.x + obj.radius * Math.cos(obj.startAngle),
                center.y + obj.radius * Math.sin(obj.startAngle)
            );
            const end = new Vector2(
                center.x + obj.radius * Math.cos(obj.endAngle),
                center.y + obj.radius * Math.sin(obj.endAngle)
            );
            if (mousePoint.distanceTo(start) < threshold) return { point: start, type: SNAP_MODES.ENDPOINT };
            if (mousePoint.distanceTo(end) < threshold) return { point: end, type: SNAP_MODES.ENDPOINT };
        }
        return null;
    }
}
