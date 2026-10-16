export class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
    multiply(scalar) { return new Vector2(this.x * scalar, this.y * scalar); }
    divide(scalar) { return new Vector2(this.x / scalar, this.y / scalar); }

    dot(v) { return this.x * v.x + this.y * v.y; }
    cross(v) { return this.x * v.y - this.y * v.x; }

    length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    lengthSq() { return this.x * this.x + this.y * this.y; }

    normalize() {
        const len = this.length();
        return len === 0 ? new Vector2(0, 0) : this.divide(len);
    }

    distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y); }

    angle() { return Math.atan2(this.y, this.x); }

    lerp(v, t) {
        return new Vector2(
            this.x + (v.x - this.x) * t,
            this.y + (v.y - this.y) * t
        );
    }

    projectOn(v) {
        const dp = this.dot(v);
        return v.multiply(dp / v.lengthSq());
    }

    clone() {
        return new Vector2(this.x, this.y);
    }

    rotate(angle, center = new Vector2(0, 0)) {
        const s = Math.sin(angle);
        const c = Math.cos(angle);
        const px = this.x - center.x;
        const py = this.y - center.y;
        return new Vector2(
            px * c - py * s + center.x,
            px * s + py * c + center.y
        );
    }

    static fromObject(obj) {
        return new Vector2(obj.x, obj.y);
    }

    toObject() {
        return { x: this.x, y: this.y, z: 0 };
    }
}

export class LineSegment {
    constructor(start, end) {
        this.start = Vector2.fromObject(start);
        this.end = Vector2.fromObject(end);
    }

    getLength() { return this.start.distanceTo(this.end); }

    getPointAt(t) {
        return this.start.add(this.end.sub(this.start).multiply(t));
    }

    getClosestPoint(p) {
        const v = this.end.sub(this.start);
        const w = p.sub(this.start);
        let t = w.dot(v) / v.lengthSq();
        t = Math.max(0, Math.min(1, t));
        return this.getPointAt(t);
    }

    distanceToPoint(p) {
        return p.distanceTo(this.getClosestPoint(p));
    }

    intersectLine(other) {
        const x1 = this.start.x, y1 = this.start.y, x2 = this.end.x, y2 = this.end.y;
        const x3 = other.start.x, y3 = other.start.y, x4 = other.end.x, y4 = other.end.y;

        const det = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (det === 0) return null; // Parallel

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / det;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / det;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return new Vector2(x1 + t * (x2 - x1), y1 + t * (y2 - y1));
        }
        return null;
    }

    getOffsetLine(distance) {
        const v = this.end.sub(this.start);
        const n = new Vector2(-v.y, v.x).normalize().multiply(distance);
        return new LineSegment(this.start.add(n), this.end.add(n));
    }

    intersectCircle(circle) {
        const v = this.end.sub(this.start);
        const w = this.start.sub(circle.center);
        const a = v.dot(v);
        const b = 2 * w.dot(v);
        const c = w.dot(w) - circle.radius * circle.radius;
        const disc = b * b - 4 * a * c;

        if (disc < 0) return [];

        const t1 = (-b + Math.sqrt(disc)) / (2 * a);
        const t2 = (-b - Math.sqrt(disc)) / (2 * a);

        const results = [];
        if (t1 >= 0 && t1 <= 1) results.push(this.getPointAt(t1));
        if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 1e-10) results.push(this.getPointAt(t2));
        return results;
    }

    getBBox() {
        const bbox = new BBox();
        bbox.expandByPoint(this.start);
        bbox.expandByPoint(this.end);
        return bbox;
    }
}

export class Circle {
    constructor(center, radius) {
        this.center = Vector2.fromObject(center);
        this.radius = radius;
    }

    getArea() { return Math.PI * this.radius * this.radius; }
    getPerimeter() { return 2 * Math.PI * this.radius; }

    static from3Points(p1, p2, p3) {
        const x1 = p1.x, y1 = p1.y;
        const x2 = p2.x, y2 = p2.y;
        const x3 = p3.x, y3 = p3.y;

        const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
        if (Math.abs(D) < 1e-10) return null; // Collinear

        const centerX = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
        const centerY = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;

        const center = new Vector2(centerX, centerY);
        const radius = center.distanceTo(p1);
        return new Circle(center, radius);
    }

    intersectLine(line) {
        return line.intersectCircle(this);
    }

    intersectCircle(other) {
        const d = this.center.distanceTo(other.center);
        if (d > this.radius + other.radius || d < Math.abs(this.radius - other.radius) || d === 0) {
            return [];
        }

        const a = (this.radius * this.radius - other.radius * other.radius + d * d) / (2 * d);
        const h = Math.sqrt(this.radius * this.radius - a * a);
        const p2 = this.center.add(other.center.sub(this.center).multiply(a / d));

        const x3_1 = p2.x + h * (other.center.y - this.center.y) / d;
        const y3_1 = p2.y - h * (other.center.x - this.center.x) / d;
        const x3_2 = p2.x - h * (other.center.y - this.center.y) / d;
        const y3_2 = p2.y + h * (other.center.x - this.center.x) / d;

        const results = [new Vector2(x3_1, y3_1)];
        if (h > 1e-10) results.push(new Vector2(x3_2, y3_2));
        return results;
    }

    getBBox() {
        const bbox = new BBox();
        bbox.expandByPoint(new Vector2(this.center.x - this.radius, this.center.y - this.radius));
        bbox.expandByPoint(new Vector2(this.center.x + this.radius, this.center.y + this.radius));
        return bbox;
    }
}

export class Arc {
    constructor(center, radius, startAngle, endAngle, counterClockwise = false) {
        this.center = Vector2.fromObject(center);
        this.radius = radius;
        this.startAngle = startAngle;
        this.endAngle = endAngle;
        this.counterClockwise = counterClockwise;
    }

    getStartPoint() {
        return new Vector2(
            this.center.x + this.radius * Math.cos(this.startAngle),
            this.center.y + this.radius * Math.sin(this.startAngle)
        );
    }

    getEndPoint() {
        return new Vector2(
            this.center.x + this.radius * Math.cos(this.endAngle),
            this.center.y + this.radius * Math.sin(this.endAngle)
        );
    }

    getMidPoint() {
        let diff = this.endAngle - this.startAngle;
        if (this.counterClockwise) {
            if (diff > 0) diff -= 2 * Math.PI;
        } else {
            if (diff < 0) diff += 2 * Math.PI;
        }
        const midAngle = this.startAngle + diff / 2;
        return new Vector2(
            this.center.x + this.radius * Math.cos(midAngle),
            this.center.y + this.radius * Math.sin(midAngle)
        );
    }

    containsAngle(angle) {
        let normalizedAngle = angle;
        while (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
        while (normalizedAngle >= 2 * Math.PI) normalizedAngle -= 2 * Math.PI;

        let s = this.startAngle;
        let e = this.endAngle;
        while (s < 0) s += 2 * Math.PI;
        while (s >= 2 * Math.PI) s -= 2 * Math.PI;
        while (e < 0) e += 2 * Math.PI;
        while (e >= 2 * Math.PI) e -= 2 * Math.PI;

        if (this.counterClockwise) {
            if (s > e) return normalizedAngle <= e || normalizedAngle >= s;
            return normalizedAngle >= s && normalizedAngle <= e;
        } else {
            if (s < e) return normalizedAngle >= s && normalizedAngle <= e;
            return normalizedAngle >= s || normalizedAngle <= e;
        }
    }

    static from3Points(p1, p2, p3) {
        const circle = Circle.from3Points(p1, p2, p3);
        if (!circle) return null;

        const startAngle = Math.atan2(p1.y - circle.center.y, p1.x - circle.center.x);
        const midAngle = Math.atan2(p2.y - circle.center.y, p2.x - circle.center.x);
        const endAngle = Math.atan2(p3.y - circle.center.y, p3.x - circle.center.x);

        // Determine direction: clockwise or counter-clockwise
        // Using cross product of (p2-p1) and (p3-p2)
        const v1 = p2.sub(p1);
        const v2 = p3.sub(p2);
        const cross = v1.x * v2.y - v1.y * v2.x;
        const counterClockwise = cross < 0;

        return new Arc(circle.center, circle.radius, startAngle, endAngle, counterClockwise);
    }

    intersectLine(line) {
        return Circle.prototype.intersectLine.call(this, line).filter(p => {
            const angle = Math.atan2(p.y - this.center.y, p.x - this.center.x);
            return this.containsAngle(angle);
        });
    }

    intersectCircle(circle) {
        return Circle.prototype.intersectCircle.call(this, circle).filter(p => {
            const angle = Math.atan2(p.y - this.center.y, p.x - this.center.x);
            return this.containsAngle(angle);
        });
    }

    intersectArc(other) {
        return Circle.prototype.intersectCircle.call(this, other).filter(p => {
            const angle1 = Math.atan2(p.y - this.center.y, p.x - this.center.x);
            const angle2 = Math.atan2(p.y - other.center.y, p.x - other.center.x);
            return this.containsAngle(angle1) && other.containsAngle(angle2);
        });
    }

    getBBox() {
        // Simplified BBox for arc: same as circle
        const bbox = new BBox();
        bbox.expandByPoint(new Vector2(this.center.x - this.radius, this.center.y - this.radius));
        bbox.expandByPoint(new Vector2(this.center.x + this.radius, this.center.y + this.radius));
        return bbox;
    }
}

export class Polyline {
    constructor(points = [], closed = false) {
        this.points = points.map(p => Vector2.fromObject(p));
        this.closed = closed;
    }

    getSegments() {
        const segments = [];
        for (let i = 0; i < this.points.length - 1; i++) {
            segments.push(new LineSegment(this.points[i], this.points[i + 1]));
        }
        if (this.closed && this.points.length > 2) {
            segments.push(new LineSegment(this.points[this.points.length - 1], this.points[0]));
        }
        return segments;
    }
}

export class BBox {
    constructor() {
        this.min = new Vector2(Infinity, Infinity);
        this.max = new Vector2(-Infinity, -Infinity);
    }

    expandByPoint(p) {
        this.min.x = Math.min(this.min.x, p.x);
        this.min.y = Math.min(this.min.y, p.y);
        this.max.x = Math.max(this.max.x, p.x);
        this.max.y = Math.max(this.max.y, p.y);
    }

    expandByBBox(bbox) {
        this.expandByPoint(bbox.min);
        this.expandByPoint(bbox.max);
    }

    expand(margin) {
        const newBBox = new BBox();
        newBBox.min = new Vector2(this.min.x - margin, this.min.y - margin);
        newBBox.max = new Vector2(this.max.x + margin, this.max.y + margin);
        return newBBox;
    }

    contains(p) {
        return p.x >= this.min.x && p.x <= this.max.x &&
            p.y >= this.min.y && p.y <= this.max.y;
    }
}
