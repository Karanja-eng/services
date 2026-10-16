import { Vector2 } from './Geometry';
import { SnapEngine } from './SnapEngine';
import { CommandController } from './CommandController';

export class CadEngine {
    constructor() {
        this.objects = [];
        this.layers = [];
        this.activeLayerId = "1";
        this.activeColor = "#FFFFFF";

        this.snapEngine = new SnapEngine();
        this.commandController = new CommandController(this);

        this.observers = new Set();
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        this.lastMousePos = new Vector2(0, 0); // Tracked for Dynamic Input
    }

    subscribe(callback) {
        this.observers.add(callback);
        return () => this.observers.delete(callback);
    }

    notifyObservers() {
        this.observers.forEach(cb => cb());
    }

    addObject(obj) {
        this.objects.push(obj);
        this.notifyObservers();
    }

    updateObject(id, partial) {
        this.objects = this.objects.map(o => o.id === id ? { ...o, ...partial } : o);
        this.notifyObservers();
    }

    deleteObject(id) {
        this.objects = this.objects.filter(o => o.id !== id);
        this.notifyObservers();
    }

    applyAction(action, isUndo) {
        switch (action.type) {
            case "ADD_OBJECT":
                if (isUndo) {
                    this.objects = this.objects.filter(o => o.id !== action.object.id);
                } else {
                    this.objects.push(action.object);
                }
                break;
            // Add more action types as needed (MOVE, ROTATE, etc.)
        }
    }

    moveObjects(ids, delta) {
        this.objects = this.objects.map(o => {
            if (ids.includes(o.id)) {
                if (o.type === "line" || o.type === "rectangle") {
                    return {
                        ...o,
                        start: { x: o.start.x + delta.x, y: o.start.y + delta.y, z: o.start.z || 0 },
                        end: { x: o.end.x + delta.x, y: o.end.y + delta.y, z: o.end.z || 0 }
                    };
                } else if (o.type === "circle" || o.type === "arc") {
                    return {
                        ...o,
                        center: { x: o.center.x + delta.x, y: o.center.y + delta.y, z: o.center.z || 0 }
                    };
                } else if (o.type === "polyline") {
                    return {
                        ...o,
                        points: o.points.map(p => ({ x: p.x + delta.x, y: p.y + delta.y, z: p.z || 0 }))
                    };
                }
            }
            return o;
        });
        this.notifyObservers();
    }

    copyObjects(ids, delta) {
        const newObjects = this.objects
            .filter(o => ids.includes(o.id))
            .map(o => {
                const copy = JSON.parse(JSON.stringify(o));
                copy.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                if (copy.type === "line" || copy.type === "rectangle") {
                    copy.start.x += delta.x; copy.start.y += delta.y;
                    copy.end.x += delta.x; copy.end.y += delta.y;
                } else if (copy.type === "circle" || copy.type === "arc") {
                    copy.center.x += delta.x; copy.center.y += delta.y;
                } else if (copy.type === "polyline") {
                    copy.points = copy.points.map(p => ({ x: p.x + delta.x, y: p.y + delta.y, z: p.z || 0 }));
                }
                return copy;
            });
        this.objects.push(...newObjects);
        this.notifyObservers();
    }

    setZoom(zoom) {
        this.zoomLevel = zoom;
        this.notifyObservers();
    }

    setPan(pan) {
        this.panOffset = pan;
        this.notifyObservers();
    }

    rotateObjects(ids, basePoint, angleDegrees) {
        const rad = (angleDegrees * Math.PI) / 180;
        this.objects = this.objects.map(o => {
            if (ids.includes(o.id)) {
                return this.transformObject(o, p => p.rotate(basePoint, rad));
            }
            return o;
        });
        this.notifyObservers();
    }

    scaleObjects(ids, basePoint, scale) {
        this.objects = this.objects.map(o => {
            if (ids.includes(o.id)) {
                return this.transformObject(o, p => basePoint.add(p.sub(basePoint).multiply(scale)));
            }
            return o;
        });
        this.notifyObservers();
    }

    mirrorObjects(ids, p1, p2) {
        this.objects = this.objects.map(o => {
            if (ids.includes(o.id)) {
                return this.transformObject(o, p => p.mirror(p1, p2));
            }
            return o;
        });
        this.notifyObservers();
    }

    transformObject(obj, transformFn) {
        const newObj = JSON.parse(JSON.stringify(obj));
        if (newObj.type === "line" || newObj.type === "rectangle") {
            const start = transformFn(Vector2.fromObject(newObj.start));
            const end = transformFn(Vector2.fromObject(newObj.end));
            newObj.start = start.toObject();
            newObj.end = end.toObject();
        } else if (newObj.type === "circle" || newObj.type === "arc") {
            const center = transformFn(Vector2.fromObject(newObj.center));
            newObj.center = center.toObject();
            // Note: Rotation doesn't affect circle radius, but Mirroring might flip angles for Arc
            if (newObj.type === "arc") {
                // Simplified: transforming start/end points of arc
                // Professional implementation would transform angles
            }
        } else if (newObj.type === "polyline") {
            newObj.points = newObj.points.map(p => transformFn(Vector2.fromObject(p)).toObject());
        }
        return newObj;
    }

    executeCommand(command) {
        this.commandController.execute(command);
        this.notifyObservers();
    }

    handleMouseMove(point, e) {
        this.lastMousePos = point;
        this.commandController.handleMouseMove(point, e);
        this.notifyObservers();
    }

    handleMouseDown(point, e) {
        this.commandController.handleMouseDown(point, e);
        this.notifyObservers();
    }

    handleKeyDown(e) {
        const result = this.commandController.handleKeyDown(e);
        this.notifyObservers();
        return result;
    }

    getSnapPoint(mousePoint) {
        return this.snapEngine.findSnapPoint(mousePoint, this.objects, this.zoomLevel);
    }

    getCombinedObjects() {
        // Current objects + command preview
        const preview = this.commandController.activeCommand
            ? this.commandController.activeCommand.getPreviewObjects()
            : [];
        return [...this.objects, ...preview];
    }
}
