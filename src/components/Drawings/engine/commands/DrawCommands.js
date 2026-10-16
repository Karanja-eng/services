import { BaseCommand } from './BaseCommand';
import { Vector2, Arc } from '../Geometry';

export class LineCommand extends BaseCommand {
    constructor(engine) {
        super(engine);
        this.prompt = "Specify first point:";
        this.focusField = "length"; // length or angle
        this.lengthInput = "";
        this.angleInput = "";
    }

    onMouseDown(point, e) {
        if (this.step === 0) {
            this.points.push(point);
            this.step = 1;
            this.prompt = "Specify next point:";
        } else {
            const startPoint = this.points[this.points.length - 1];
            // Resolve point from dynamic input if active
            const finalPoint = this.resolvePoint(point);

            const newObject = {
                type: "line",
                id: Date.now().toString() + "-" + Math.random().toString(36).substr(2, 5),
                start: startPoint.toObject(),
                end: finalPoint.toObject(),
                layerId: this.engine.activeLayerId,
                color: "#000000" // Professional black line
            };
            this.engine.addObject(newObject);
            this.points.push(finalPoint);
            this.lengthInput = "";
            this.angleInput = "";
        }
    }

    onMouseMove(point, e) {
        if (this.step === 1 && this.points.length > 0) {
            const start = this.points[this.points.length - 1];
            const finalPoint = this.resolvePoint(point);

            this.previewGeometry = {
                type: "line",
                id: "preview-line",
                start: start.toObject(),
                end: finalPoint.toObject(),
                color: "#888888",
                lineWidth: 1,
                dash: [5, 5]
            };
        }
    }

    resolvePoint(mousePoint) {
        if (this.points.length === 0) return mousePoint;
        const start = this.points[this.points.length - 1];

        let length = parseFloat(this.lengthInput);
        let angle = parseFloat(this.angleInput);

        const hasLength = !isNaN(length) && this.lengthInput !== "";
        const hasAngle = !isNaN(angle) && this.angleInput !== "";

        if (hasLength && hasAngle) {
            const rad = (angle * Math.PI) / 180;
            return new Vector2(
                start.x + length * Math.cos(rad),
                start.y - length * Math.sin(rad) // Screen Y is inverted
            );
        } else if (hasLength) {
            const dir = mousePoint.sub(start).normalize();
            return start.add(dir.multiply(length));
        } else if (hasAngle) {
            const rad = (angle * Math.PI) / 180;
            const dist = start.distanceTo(mousePoint);
            return new Vector2(
                start.x + dist * Math.cos(rad),
                start.y - dist * Math.sin(rad)
            );
        }
        return mousePoint;
    }

    onKeyDown(e) {
        if (super.onKeyDown(e)) return true;

        if (e.key === "Tab") {
            e.preventDefault();
            this.focusField = this.focusField === "length" ? "angle" : "length";
            this.engine.notifyObservers();
            return true;
        }

        if (/^[0-9.]$/.test(e.key)) {
            if (this.focusField === "length") this.lengthInput += e.key;
            else this.angleInput += e.key;
            this.engine.notifyObservers();
            return true;
        }

        if (e.key === "Backspace") {
            if (this.focusField === "length") this.lengthInput = this.lengthInput.slice(0, -1);
            else this.angleInput = this.angleInput.slice(0, -1);
            this.engine.notifyObservers();
            return true;
        }

        return false;
    }

    getDynamicInputSpecs() {
        if (this.step === 0 || this.points.length === 0) return null;

        const start = this.points[this.points.length - 1];
        const currentMouse = this.engine.lastMousePos || start;
        const dist = start.distanceTo(currentMouse);
        const angle = -Math.atan2(currentMouse.y - start.y, currentMouse.x - start.x) * (180 / Math.PI);

        return {
            fields: [
                { name: "length", label: "Length", value: this.lengthInput || dist.toFixed(2), active: this.focusField === "length" },
                { name: "angle", label: "Angle", value: this.angleInput || angle.toFixed(1), active: this.focusField === "angle" }
            ]
        };
    }
}

export class CircleCommand extends BaseCommand {
    constructor(engine) {
        super(engine);
        this.prompt = "Specify center point for circle:";
        this.radiusInput = "";
    }

    onMouseDown(point, e) {
        if (this.step === 0) {
            this.points.push(point);
            this.step = 1;
            this.prompt = "Specify radius of circle:";
        } else {
            const finalRadius = this.radiusInput !== "" ? parseFloat(this.radiusInput) : this.points[0].distanceTo(point);
            const newObject = {
                type: "circle",
                id: Date.now().toString() + "-" + Math.random().toString(36).substr(2, 5),
                center: this.points[0].toObject(),
                radius: finalRadius,
                layerId: this.engine.activeLayerId,
                color: "#000000"
            };
            this.engine.addObject(newObject);
            this.finalize();
        }
    }

    onMouseMove(point, e) {
        if (this.step === 1) {
            const radius = this.radiusInput !== "" ? parseFloat(this.radiusInput) : this.points[0].distanceTo(point);
            this.previewGeometry = {
                type: "circle",
                id: "preview-circle",
                center: this.points[0].toObject(),
                radius: radius,
                color: "#888888",
                lineWidth: 1,
                dash: [5, 5]
            };
        }
    }

    onKeyDown(e) {
        if (super.onKeyDown(e)) return true;
        if (/^[0-9.]$/.test(e.key)) {
            this.radiusInput += e.key;
            this.engine.notifyObservers();
            return true;
        }
        if (e.key === "Backspace") {
            this.radiusInput = this.radiusInput.slice(0, -1);
            this.engine.notifyObservers();
            return true;
        }
        return false;
    }

    getDynamicInputSpecs() {
        if (this.step === 0 || this.points.length === 0) return null;
        const radius = this.radiusInput || this.points[0].distanceTo(this.engine.lastMousePos || this.points[0]).toFixed(2);
        return {
            fields: [
                { name: "radius", label: "Radius", value: radius, active: true }
            ]
        };
    }
}

export class ArcCommand extends BaseCommand {
    constructor(engine) {
        super(engine);
        this.prompt = "Specify start point of arc:";
        this.step = 0;
    }

    onMouseDown(point, e) {
        if (this.step === 0) {
            this.points.push(point);
            this.step = 1;
            this.prompt = "Specify second point of arc:";
        } else if (this.step === 1) {
            this.points.push(point);
            this.step = 2;
            this.prompt = "Specify end point of arc:";
        } else {
            this.points.push(point);
            this.finalize();
        }
    }

    onMouseMove(point, e) {
        if (this.step === 1) {
            this.previewGeometry = {
                type: "line",
                id: "preview-arc-1",
                start: this.points[0].toObject(),
                end: point.toObject(),
                color: "#888888",
                dash: [5, 5]
            };
        } else if (this.step === 2) {
            const arc = Arc.from3Points(this.points[0], this.points[1], point);
            if (arc) {
                this.previewGeometry = {
                    type: "arc",
                    id: "preview-arc-final",
                    center: arc.center.toObject(),
                    radius: arc.radius,
                    startAngle: arc.startAngle,
                    endAngle: arc.endAngle,
                    counterClockwise: arc.counterClockwise,
                    color: "#888888",
                    dash: [5, 5]
                };
            }
        }
    }

    finalize() {
        if (this.points.length < 3) return null;
        const arc = Arc.from3Points(this.points[0], this.points[1], this.points[2]);
        if (!arc) return null;

        const newObject = {
            type: "arc",
            id: Date.now().toString() + "-" + Math.random().toString(36).substr(2, 5),
            center: arc.center.toObject(),
            radius: arc.radius,
            startAngle: arc.startAngle,
            endAngle: arc.endAngle,
            counterClockwise: arc.counterClockwise,
            layerId: this.engine.activeLayerId,
            color: "#000000"
        };
        this.engine.addObject(newObject);
        super.finalize();
    }
}

export class PolylineCommand extends BaseCommand {
    constructor(engine) {
        super(engine);
        this.prompt = "Specify start point:";
        this.focusField = "length";
        this.lengthInput = "";
        this.angleInput = "";
    }

    onMouseDown(point, e) {
        const finalPoint = this.points.length > 0 ? this.resolvePoint(point) : point;
        this.points.push(finalPoint);
        this.step++;
        this.prompt = "Specify next point:";
        this.lengthInput = "";
        this.angleInput = "";
    }

    resolvePoint(mousePoint) {
        if (this.points.length === 0) return mousePoint;
        const start = this.points[this.points.length - 1];
        let length = parseFloat(this.lengthInput);
        let angle = parseFloat(this.angleInput);
        const hasLength = !isNaN(length) && this.lengthInput !== "";
        const hasAngle = !isNaN(angle) && this.angleInput !== "";

        if (hasLength && hasAngle) {
            const rad = (angle * Math.PI) / 180;
            return new Vector2(start.x + length * Math.cos(rad), start.y - length * Math.sin(rad));
        } else if (hasLength) {
            const dir = mousePoint.sub(start).normalize();
            return start.add(dir.multiply(length));
        } else if (hasAngle) {
            const rad = (angle * Math.PI) / 180;
            const dist = start.distanceTo(mousePoint);
            return new Vector2(start.x + dist * Math.cos(rad), start.y - dist * Math.sin(rad));
        }
        return mousePoint;
    }

    onMouseMove(point, e) {
        if (this.points.length > 0) {
            const finalPoint = this.resolvePoint(point);
            const previewPoints = [...this.points.map(p => p.toObject()), finalPoint.toObject()];
            this.previewGeometry = {
                type: "polyline",
                id: "preview-polyline",
                points: previewPoints,
                color: "#888888",
                lineWidth: 1,
                dash: [5, 5]
            };
        }
    }

    onKeyDown(e) {
        if (super.onKeyDown(e)) return true;
        if (e.key === "Tab") {
            e.preventDefault();
            this.focusField = this.focusField === "length" ? "angle" : "length";
            this.engine.notifyObservers();
            return true;
        }
        if (/^[0-9.]$/.test(e.key)) {
            if (this.focusField === "length") this.lengthInput += e.key;
            else this.angleInput += e.key;
            this.engine.notifyObservers();
            return true;
        }
        if (e.key === "Backspace") {
            if (this.focusField === "length") this.lengthInput = this.lengthInput.slice(0, -1);
            else this.angleInput = this.angleInput.slice(0, -1);
            this.engine.notifyObservers();
            return true;
        }
        return false;
    }

    getDynamicInputSpecs() {
        if (this.points.length === 0) return null;
        const start = this.points[this.points.length - 1];
        const currentMouse = this.engine.lastMousePos || start;
        const dist = start.distanceTo(currentMouse);
        const angle = -Math.atan2(currentMouse.y - start.y, currentMouse.x - start.x) * (180 / Math.PI);
        return {
            fields: [
                { name: "length", label: "Length", value: this.lengthInput || dist.toFixed(2), active: this.focusField === "length" },
                { name: "angle", label: "Angle", value: this.angleInput || angle.toFixed(1), active: this.focusField === "angle" }
            ]
        };
    }

    finalize() {
        if (this.points.length < 2) return null;
        const newObject = {
            type: "polyline",
            id: Date.now().toString() + "-" + Math.random().toString(36).substr(2, 5),
            points: this.points.map(p => p.toObject()),
            layerId: this.engine.activeLayerId,
            color: "#000000"
        };
        this.engine.addObject(newObject);
        super.finalize();
    }
}

export class RectangleCommand extends BaseCommand {
    constructor(engine) {
        super(engine);
        this.prompt = "Specify first corner point:";
        this.focusField = "width";
        this.widthInput = "";
        this.heightInput = "";
    }

    onMouseDown(point, e) {
        if (this.step === 0) {
            this.points.push(point);
            this.step = 1;
            this.prompt = "Specify other corner point:";
        } else {
            const finalPoint = this.resolvePoint(point);
            const newObject = {
                type: "rectangle",
                id: Date.now().toString() + "-" + Math.random().toString(36).substr(2, 5),
                start: this.points[0].toObject(),
                end: finalPoint.toObject(),
                layerId: this.engine.activeLayerId,
                color: "#000000"
            };
            this.engine.addObject(newObject);
            this.finalize();
        }
    }

    resolvePoint(mousePoint) {
        if (this.points.length === 0) return mousePoint;
        const start = this.points[0];
        let width = parseFloat(this.widthInput);
        let height = parseFloat(this.heightInput);
        const hasWidth = !isNaN(width) && this.widthInput !== "";
        const hasHeight = !isNaN(height) && this.heightInput !== "";

        if (hasWidth && hasHeight) {
            return new Vector2(start.x + width, start.y + height);
        } else if (hasWidth) {
            return new Vector2(start.x + width, mousePoint.y);
        } else if (hasHeight) {
            return new Vector2(mousePoint.x, start.y + height);
        }
        return mousePoint;
    }

    onMouseMove(point, e) {
        if (this.step === 1) {
            const finalPoint = this.resolvePoint(point);
            this.previewGeometry = {
                type: "rectangle",
                id: "preview-rect",
                start: this.points[0].toObject(),
                end: finalPoint.toObject(),
                color: "#888888",
                dash: [5, 5]
            };
        }
    }

    onKeyDown(e) {
        if (super.onKeyDown(e)) return true;
        if (e.key === "Tab") {
            e.preventDefault();
            this.focusField = this.focusField === "width" ? "height" : "width";
            this.engine.notifyObservers();
            return true;
        }
        if (/^[0-9.]$/.test(e.key)) {
            if (this.focusField === "width") this.widthInput += e.key;
            else this.heightInput += e.key;
            this.engine.notifyObservers();
            return true;
        }
        if (e.key === "Backspace") {
            if (this.focusField === "width") this.widthInput = this.widthInput.slice(0, -1);
            else this.heightInput = this.heightInput.slice(0, -1);
            this.engine.notifyObservers();
            return true;
        }
        return false;
    }

    getDynamicInputSpecs() {
        if (this.step === 0 || this.points.length === 0) return null;
        const start = this.points[0];
        const currentMouse = this.engine.lastMousePos || start;
        const width = this.widthInput || (currentMouse.x - start.x).toFixed(2);
        const height = this.heightInput || (currentMouse.y - start.y).toFixed(2);
        return {
            fields: [
                { name: "width", label: "Width", value: width, active: this.focusField === "width" },
                { name: "height", label: "Height", value: height, active: this.focusField === "height" }
            ]
        };
    }
}

