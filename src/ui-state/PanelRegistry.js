/**
 * PanelRegistry.js
 * Centralized UI panel tracker for BIM system.
 */

class PanelRegistry {
    constructor() {
        this.panels = new Map();
        this.listeners = new Set();
        this.activePanel = null;
    }

    register(id, config) {
        this.panels.set(id, {
            id,
            isOpen: false,
            isInspector: config.isInspector || false,
            ...config
        });
        this.notify();
    }

    // Alias for togglePanel to support both calling conventions
    toggle(id) {
        return this.togglePanel(id);
    }

    togglePanel(id) {
        const panel = this.panels.get(id);
        if (!panel) return;

        const newState = !panel.isOpen;

        if (newState && !panel.isInspector) {
            // Close existing active panel if it's not an inspector
            if (this.activePanel && this.activePanel !== id) {
                const prevPanel = this.panels.get(this.activePanel);
                if (prevPanel) prevPanel.isOpen = false;
            }
            this.activePanel = id;
        } else if (!newState && this.activePanel === id) {
            this.activePanel = null;
        }

        panel.isOpen = newState;
        this.notify();
    }

    open(id) {
        const panel = this.panels.get(id);
        if (!panel || panel.isOpen) return;
        this.togglePanel(id);
    }

    close(id) {
        const panel = this.panels.get(id);
        if (!panel || !panel.isOpen) return;
        this.togglePanel(id);
    }

    closeAll() {
        this.panels.forEach(panel => {
            panel.isOpen = false;
        });
        this.activePanel = null;
        this.notify();
    }

    isOpen(id) {
        return this.panels.get(id)?.isOpen || false;
    }

    getPanels() {
        return Array.from(this.panels.values());
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        this.listeners.forEach(l => l(this.getPanels()));
    }
}

export const panelRegistry = new PanelRegistry();
