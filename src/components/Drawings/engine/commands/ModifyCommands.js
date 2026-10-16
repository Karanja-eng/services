import { BaseCommand } from './BaseCommand';
import { Vector2 } from '../Geometry';

export class MoveCommand extends BaseCommand {
    constructor(engine, objectIds) {
        super(engine);
        this.objectIds = objectIds || [];
        this.prompt = "Specify base point:";
        this.step = 0;
        this.basePoint = null;
        this.displacementInput = "";
    }

    onMouseDown(point, e) {
        if (this.step === 0) {
            this.basePoint = point;
            this.step = 1;
            this.prompt = "Specify second point or <displacement>:";
        } else {
            const disp = point.sub(this.basePoint);
            this.engine.moveObjects(this.objectIds, disp);
            this.finalize();
        }
    }

    onMouseMove(point, e) {
        if (this.step === 1) {
            const disp = point.sub(this.basePoint);
            // Preview logic: effectively moving objects in memory for preview
            // For now, just display a tracking line from base to current
            this.previewGeometry = {
                type: "line",
                id: "preview-move-tracking",
                start: this.basePoint.toObject(),
                end: point.toObject(),
                color: "#888888",
                dash: [5, 5]
            };
        }
    }

    getDynamicInputSpecs() {
        if (this.step === 1) {
            const currentMouse = this.engine.lastMousePos || this.basePoint;
            const dist = this.basePoint.distanceTo(currentMouse);
            const angle = -Math.atan2(currentMouse.y - this.basePoint.y, currentMouse.x - this.basePoint.x) * (180 / Math.PI);
            return {
                fields: [
                    { name: "distance", label: "Distance", value: this.displacementInput || dist.toFixed(2), active: true },
                    { name: "angle", label: "Angle", value: angle.toFixed(1), active: false }
                ]
            };
        }
        return null;
    }

    onKeyDown(e) {
        if (super.onKeyDown(e)) return true;
        if (/^[0-9.]$/.test(e.key) && this.step === 1) {
            this.displacementInput += e.key;
            this.engine.notifyObservers();
            return true;
        }
        return false;
    }
}

export class CopyCommand extends MoveCommand {
    onMouseDown(point, e) {
        if (this.step === 0) {
            this.basePoint = point;
            this.step = 1;
            this.prompt = "Specify second point or <displacement>:";
        } else {
            const disp = point.sub(this.basePoint);
            this.engine.copyObjects(this.objectIds, disp);
            this.finalize();
        }
    }
}

export class RotateCommand extends BaseCommand {
    constructor(engine, objectIds) {
        super(engine);
        this.objectIds = objectIds || [];
        this.prompt = "Specify base point:";
        this.basePoint = null;
        this.angleInput = "";
    }

    onMouseDown(point, e) {
        if (this.step === 0) {
            this.basePoint = point;
            this.step = 1;
            this.prompt = "Specify rotation angle:";
        } else {
            const angle = this.angleInput !== "" ? parseFloat(this.angleInput) : 0; // calc from mouse if needed
            this.engine.rotateObjects(this.objectIds, this.basePoint, angle);
            this.finalize();
        }
    }

    getDynamicInputSpecs() {
        if (this.step === 1) {
            return {
                fields: [
                    { name: "angle", label: "Angle", value: this.angleInput || "0", active: true }
                ]
            };
        }
        return null;
    }
}

export class ScaleCommand extends BaseCommand {
    constructor(engine, objectIds) {
        super(engine);
        this.objectIds = objectIds || [];
        this.prompt = "Specify base point:";
        this.basePoint = null;
        this.scaleInput = "";
    }

    onMouseDown(point, e) {
        if (this.step === 0) {
            this.basePoint = point;
            this.step = 1;
            this.prompt = "Specify scale factor:";
        } else {
            const scale = this.scaleInput !== "" ? parseFloat(this.scaleInput) : 1.0;
            this.engine.scaleObjects(this.objectIds, this.basePoint, scale);
            this.finalize();
        }
    }

    getDynamicInputSpecs() {
        if (this.step === 1) {
            return {
                fields: [
                    { name: "scale", label: "Scale Factor", value: this.scaleInput || "1.0", active: true }
                ]
            };
        }
        return null;
    }
}

export class MirrorCommand extends BaseCommand {
    constructor(engine, objectIds) {
        super(engine);
        this.objectIds = objectIds || [];
        this.prompt = "Specify first point of mirror line:";
        this.mirrorPoints = [];
    }

    onMouseDown(point, e) {
        this.mirrorPoints.push(point);
        if (this.mirrorPoints.length === 1) {
            this.prompt = "Specify second point of mirror line:";
            this.step = 1;
        } else {
            this.engine.mirrorObjects(this.objectIds, this.mirrorPoints[0], this.mirrorPoints[1]);
            this.finalize();
        }
    }
}
