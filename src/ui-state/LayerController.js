/**
 * LayerController.js
 * BIM layer visibility and transparency controller.
 * Maps metadata (system, subsystem, layer) to scene object material properties.
 */

class LayerController {
    constructor() {
        this.layerStates = new Map(); // id -> { visible, opacity, isolated }
        this.listeners = new Set();
        this.registeredNodes = new Map(); // nodeUuid -> { node, metadata }
    }

    // Register a single scene node with its metadata
    registerNode(node, metadata) {
        if (!node || !metadata) return;
        this.registeredNodes.set(node.uuid, { node, metadata });
        this.applyStateToNode(node, metadata);
    }

    unregisterNode(node) {
        if (!node) return;
        this.registeredNodes.delete(node.uuid);
    }

    setLayerVisibility(system, layer, visible) {
        const id = `${system}:${layer}`;
        const currentState = this.layerStates.get(id) || { visible: true, opacity: 1, isolated: false };
        this.layerStates.set(id, { ...currentState, visible });
        this.updateSceneState();
        this.notify();
    }

    setLayerOpacity(system, layer, opacity) {
        const id = `${system}:${layer}`;
        const currentState = this.layerStates.get(id) || { visible: true, opacity: 1, isolated: false };
        this.layerStates.set(id, { ...currentState, opacity });
        this.updateSceneState();
        this.notify();
    }

    toggleIsolation(system, layer) {
        const id = `${system}:${layer}`;
        const currentState = this.layerStates.get(id) || { visible: true, opacity: 1, isolated: false };
        const newIsolated = !currentState.isolated;

        // Reset all others if isolating
        if (newIsolated) {
            this.layerStates.forEach((state, key) => {
                state.isolated = false;
            });
        }

        this.layerStates.set(id, { ...currentState, isolated: newIsolated });
        this.updateSceneState();
        this.notify();
    }

    updateSceneState() {
        const isolationActive = Array.from(this.layerStates.values()).some(s => s.isolated);

        this.registeredNodes.forEach(({ node, metadata }) => {
            this.applyStateToNode(node, metadata, isolationActive);
        });
    }

    applyStateToNode(node, metadata, isolationActive = null) {
        if (isolationActive === null) {
            isolationActive = Array.from(this.layerStates.values()).some(s => s.isolated);
        }

        const layerId = `${metadata.system}:${metadata.layer}`;
        const state = this.layerStates.get(layerId) || { visible: true, opacity: 1, isolated: false };

        // Visibility Logic
        let isVisible = state.visible;
        if (isolationActive && !state.isolated) {
            isVisible = false;
        }

        node.visible = isVisible;

        // Material Logic (traverse if group)
        node.traverse(child => {
            if (child.material) {
                child.material.transparent = state.opacity < 1;
                child.material.opacity = state.opacity;
                child.material.needsUpdate = true;
            }
        });
    }

    getStates() {
        return Object.fromEntries(this.layerStates);
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        this.listeners.forEach(l => l(this.getStates()));
    }
}

export const layerController = new LayerController();
