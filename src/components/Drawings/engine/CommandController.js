export class CommandController {
    constructor(engine) {
        this.engine = engine;
        this.activeCommand = null;
        this.lastCommand = null; // For repeat with SPACE
        this.history = [];
        this.redoStack = [];
    }

    execute(command) {
        if (this.activeCommand) {
            this.activeCommand.cancel();
        }
        this.activeCommand = command;
        this.lastCommand = command.constructor; // Store for repeat
        this.activeCommand.start();
        this.engine.notifyObservers();
    }

    cancelActive() {
        if (this.activeCommand) {
            this.activeCommand.cancel();
            this.activeCommand = null;
            this.engine.notifyObservers();
        }
    }

    confirmActive() {
        if (this.activeCommand) {
            const result = this.activeCommand.finalize();
            if (result) {
                this.addToHistory(result);
            }
            this.activeCommand = null;
            this.engine.notifyObservers();
        }
    }

    // Called by Command.finalize() to cleanly end
    finishCommand() {
        this.activeCommand = null;
        this.engine.notifyObservers();
    }

    addToHistory(action) {
        this.history.push(action);
        this.redoStack = []; // Clear redo stack on new action
    }

    undo() {
        if (this.history.length === 0) return;
        const action = this.history.pop();
        this.redoStack.push(action);
        this.engine.applyAction(action, true);
        this.engine.notifyObservers();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        const action = this.redoStack.pop();
        this.history.push(action);
        this.engine.applyAction(action, false);
        this.engine.notifyObservers();
    }

    handleMouseDown(point, e) {
        if (this.activeCommand) {
            this.activeCommand.onMouseDown(point, e);
            this.engine.notifyObservers();
        }
    }

    handleMouseMove(point, e) {
        if (this.activeCommand) {
            this.activeCommand.onMouseMove(point, e);
            this.engine.notifyObservers();
        }
    }

    handleKeyDown(e) {
        // AutoCAD SPACE = REPEAT if no command active
        if (e.key === " " && !this.activeCommand && this.lastCommand) {
            e.preventDefault();
            this.execute(new this.lastCommand(this.engine));
            return true;
        }

        if (e.key === "Escape") {
            this.cancelActive();
            return true;
        }

        if (e.key === "Enter") {
            this.confirmActive();
            return true;
        }

        // Numeric input routing for Dynamic Input
        if (this.activeCommand) {
            const isNumeric = /^[0-9.<>,-]$/.test(e.key);
            if (isNumeric || e.key === "Tab" || e.key === "Backspace") {
                // Let the command handle direct numeric entry if it wants
                if (this.activeCommand.onKeyDown(e)) {
                    return true;
                }
            }
            return this.activeCommand.onKeyDown(e);
        }

        return false;
    }
}
