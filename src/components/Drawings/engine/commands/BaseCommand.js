export class BaseCommand {
    constructor(engine) {
        this.engine = engine;
        this.step = 0;
        this.points = [];
        this.previewGeometry = null;
        this.prompt = ""; // User-facing instructions
        this.activeInputBuffer = ""; // For numeric entry
        this.inputMode = "point"; // point, distance, angle, text
    }

    start() { }

    onMouseDown(point, e) { }

    onMouseMove(point, e) { }

    onKeyDown(e) {
        if (e.key === "Escape") {
            this.engine.commandController.cancelActive();
            return true;
        }
        if (e.key === "Enter") {
            this.finalize();
            return true;
        }
        return false;
    }

    // Handles numeric input from Dynamic Input boxes or Command Line
    handleInput(value, type = "numeric") {
        return false;
    }

    // Returns specifications for Dynamic Input fields (e.g. { length: 100, angle: 45 })
    getDynamicInputSpecs() {
        return null;
    }

    finalize() {
        this.engine.commandController.finishCommand();
    }

    cancel() { }

    getPreviewObjects() {
        return this.previewGeometry ? [this.previewGeometry] : [];
    }
}
