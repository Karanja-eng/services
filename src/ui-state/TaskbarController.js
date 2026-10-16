/**
 * TaskbarController.js
 * Manages taskbar button states and interactions.
 */

class TaskbarController {
    constructor() {
        this.componentsPanelOpen = false;
        this.listeners = new Set();
    }

    toggleComponents() {
        this.componentsPanelOpen = !this.componentsPanelOpen;
        this.notify();
    }

    setComponentsOpen(isOpen) {
        this.componentsPanelOpen = isOpen;
        this.notify();
    }

    getComponentsOpen() {
        return this.componentsPanelOpen;
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        this.listeners.forEach(l => l({
            componentsPanelOpen: this.componentsPanelOpen
        }));
    }
}

export const taskbarController = new TaskbarController();
