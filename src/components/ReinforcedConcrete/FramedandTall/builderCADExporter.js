/**
 * Utility to convert structural elements from InteractiveStructureBuilder 
 * into CAD primitives for the universal CadDrawer.
 */

export const exportStructureToCAD = (elements, structuralGrid) => {
    const objects = [];
    const S = 100; // DRAW_SCALE: Converts meters to logical CAD units

    const layerIdGrid = "grid";
    const layerIdColumns = "columns";
    const layerIdBeams = "beams";
    const layerIdSlabs = "slabs";
    const layerIdLabels = "labels";
    const layerIdVoids = "voids";

    // 1. Export Grid from actual StructuralGrid object
    if (structuralGrid) {
        // Find max bounds for line lengths
        let minX = 0, minY = 0, maxX = 20, maxY = 20;
        elements.forEach(el => {
            if (el.position.x !== undefined) {
                minX = Math.min(minX, el.position.x - 5);
                minY = Math.min(minY, el.position.y - 5);
                maxX = Math.max(maxX, el.position.x + 10);
                maxY = Math.max(maxY, el.position.y + 10);
            } else if (el.position.start) {
                minX = Math.min(minX, el.position.start.x - 5, el.position.end.x - 5);
                minY = Math.min(minY, el.position.start.y - 5, el.position.end.y - 5);
                maxX = Math.max(maxX, el.position.start.x + 10, el.position.end.x + 10);
                maxY = Math.max(maxY, el.position.start.y + 10, el.position.end.y + 10);
            }
        });

        const gridExt = 2 * S; // Extension beyond last line

        // Vertical Lines
        structuralGrid.xLines.forEach((line, idx) => {
            const lx = line.val * S;
            objects.push({
                id: line.id,
                type: "line",
                start: { x: lx, y: minY * S - gridExt, z: 0 },
                end: { x: lx, y: maxY * S + gridExt, z: 0 },
                color: "#888888",
                layerId: layerIdGrid,
                lineWidth: 1,
                dash: [100, 50, 20, 50]
            });
            // Bubble Circle
            objects.push({
                id: `${line.id}-bubble`,
                type: "circle",
                center: { x: lx, y: minY * S - gridExt - (1 * S), z: 0 },
                radius: 0.6 * S,
                color: "#000000",
                layerId: layerIdGrid
            });
            // Label
            objects.push({
                id: `${line.id}-label`,
                type: "text",
                position: { x: lx, y: minY * S - gridExt - (1 * S), z: 0 }, // Center on bubble
                text: line.label,
                size: 5.0, // Scale up to fill the 0.6*S radius bubble
                color: "#000000",
                layerId: layerIdGrid,
                align: 'center',
                verticalAlign: 'middle',
                isGridLabel: true
            });

            // Dimension between vertical lines
            if (idx < structuralGrid.xLines.length - 1) {
                const nextLine = structuralGrid.xLines[idx + 1];
                const nx = nextLine.val * S;
                const midX = (lx + nx) / 2;
                const dimY = minY * S - gridExt - (3 * S);

                // Dim Line
                objects.push({
                    id: `dim-v-${line.id}-${nextLine.id}`,
                    type: "line",
                    start: { x: lx, y: dimY, z: 0 },
                    end: { x: nx, y: dimY, z: 0 },
                    color: "#666666",
                    layerId: layerIdLabels,
                    lineWidth: 1
                });
                // Ticks
                objects.push({
                    id: `tick-v-start-${line.id}-${nextLine.id}`,
                    type: "line",
                    start: { x: lx - (0.2 * S), y: dimY - (0.2 * S), z: 0 },
                    end: { x: lx + (0.2 * S), y: dimY + (0.2 * S), z: 0 },
                    color: "#000",
                    layerId: layerIdLabels
                });
                objects.push({
                    id: `tick-v-end-${line.id}-${nextLine.id}`,
                    type: "line",
                    start: { x: nx - (0.2 * S), y: dimY - (0.2 * S), z: 0 },
                    end: { x: nx + (0.2 * S), y: dimY + (0.2 * S), z: 0 },
                    color: "#000",
                    layerId: layerIdLabels
                });
                // Text
                objects.push({
                    id: `label-v-dim-${line.id}-${nextLine.id}`,
                    type: "text",
                    position: { x: midX - (0.4 * S), y: dimY - (0.5 * S), z: 0 },
                    text: (nextLine.val - line.val).toFixed(2) + "m",
                    size: 0.6,
                    color: "#000000",
                    layerId: layerIdLabels
                });
            }
        });

        // Horizontal Lines
        structuralGrid.yLines.forEach((line, idx) => {
            const ly = line.val * S;
            objects.push({
                id: line.id,
                type: "line",
                start: { x: minX * S - gridExt, y: ly, z: 0 },
                end: { x: maxX * S + gridExt, y: ly, z: 0 },
                color: "#888888",
                layerId: layerIdGrid,
                lineWidth: 1,
                dash: [100, 50, 20, 50]
            });
            // Bubble Circle
            objects.push({
                id: `${line.id}-bubble`,
                type: "circle",
                center: { x: minX * S - gridExt - (1 * S), y: ly, z: 0 },
                radius: 0.6 * S,
                color: "#000000",
                layerId: layerIdGrid
            });
            // Label
            objects.push({
                id: `${line.id}-label`,
                type: "text",
                position: { x: minX * S - gridExt - (1 * S), y: ly, z: 0 }, // Center on bubble
                text: line.label,
                size: 5.0,
                color: "#000000",
                layerId: layerIdGrid,
                align: 'center',
                verticalAlign: 'middle',
                isGridLabel: true
            });

            // Dimension between horizontal lines
            if (idx < structuralGrid.yLines.length - 1) {
                const nextLine = structuralGrid.yLines[idx + 1];
                const ny = nextLine.val * S;
                const midY = (ly + ny) / 2;
                const dimX = minX * S - gridExt - (3 * S);

                // Dim Line
                objects.push({
                    id: `dim-h-${line.id}-${nextLine.id}`,
                    type: "line",
                    start: { x: dimX, y: ly, z: 0 },
                    end: { x: dimX, y: ny, z: 0 },
                    color: "#666666",
                    layerId: layerIdLabels,
                    lineWidth: 1
                });
                // Ticks
                objects.push({
                    id: `tick-h-start-${line.id}-${nextLine.id}`,
                    type: "line",
                    start: { x: dimX - (0.2 * S), y: ly - (0.2 * S), z: 0 },
                    end: { x: dimX + (0.2 * S), y: ly + (0.2 * S), z: 0 },
                    color: "#000",
                    layerId: layerIdLabels
                });
                objects.push({
                    id: `tick-h-end-${line.id}-${nextLine.id}`,
                    type: "line",
                    start: { x: dimX - (0.2 * S), y: ny - (0.2 * S), z: 0 },
                    end: { x: dimX + (0.2 * S), y: ny + (0.2 * S), z: 0 },
                    color: "#000",
                    layerId: layerIdLabels
                });
                // Text
                objects.push({
                    id: `label-h-dim-${line.id}-${nextLine.id}`,
                    type: "text",
                    position: { x: dimX - (1.2 * S), y: midY - (0.3 * S), z: 0 },
                    text: (nextLine.val - line.val).toFixed(2) + "m",
                    size: 0.6,
                    color: "#000000",
                    layerId: layerIdLabels,
                    rotation: -90
                });
            }
        });
    }

    // 2. Export elements in correct Z-order (Slabs -> Beams -> Columns)

    // 2a. Slabs first (Background)
    elements.filter(el => el.type === 'slab').forEach(el => {
        const { x, y } = el.position;
        const w = el.properties.width || 5;
        const d = el.properties.depth || 5;

        objects.push({
            id: el.id,
            type: "rectangle",
            start: { x: x * S, y: y * S, z: 0 },
            end: { x: (x + w) * S, y: (y + d) * S, z: 0 },
            color: "#cccccc",
            layerId: layerIdSlabs,
            lineWidth: 1,
            opacity: 0.15,
            fill: "#f8f8f8"
        });
    });

    // 2b. Beams (Middle)
    elements.filter(el => el.type === 'beam' || el.type === 'wall').forEach(el => {
        const start = { x: el.position.start.x * S, y: el.position.start.y * S };
        const end = { x: el.position.end.x * S, y: el.position.end.y * S };
        const depth = (el.properties.depth || 0.3) * S;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const angle = Math.atan2(dy, dx);
        const offsetX = -Math.sin(angle) * (depth / 2);
        const offsetY = Math.cos(angle) * (depth / 2);

        objects.push({
            id: `${el.id}-outline`,
            type: "line",
            points: [
                { x: start.x + offsetX, y: start.y + offsetY },
                { x: end.x + offsetX, y: end.y + offsetY },
                { x: end.x - offsetX, y: end.y - offsetY },
                { x: start.x - offsetX, y: start.y - offsetY },
                { x: start.x + offsetX, y: start.y + offsetY }
            ],
            closed: true,
            color: "#000000",
            layerId: layerIdBeams,
            lineWidth: 2,
            fill: "#e8f4f8"
        });

        objects.push({
            id: `${el.id}-center`,
            type: "line",
            start: { x: start.x, y: start.y, z: 0 },
            end: { x: end.x, y: end.y, z: 0 },
            color: "#444444",
            layerId: layerIdBeams,
            lineWidth: 0.8,
            dash: [12 * (S / 100), 6 * (S / 100)]
        });

        objects.push({
            id: `${el.id}-label`,
            type: "text",
            position: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - (0.3 * S), z: 0 },
            text: el.id,
            size: 0.5,
            color: "#000000",
            layerId: layerIdLabels
        });
    });

    // 2c. Columns (Top)
    elements.filter(el => el.type === 'column').forEach(el => {
        const w = (el.properties.width || 0.45) * S;
        const d = (el.properties.depth || 0.45) * S;
        const x = (el.position.x * S) - w / 2;
        const y = (el.position.y * S) - d / 2;

        objects.push({
            id: el.id || `col-${Math.random().toString(36).substr(2, 9)}`,
            type: "rectangle",
            start: { x: x, y: y, z: 0 },
            end: { x: x + w, y: y + d, z: 0 },
            color: "#000000",
            layerId: layerIdColumns,
            lineWidth: 2.5,
            fill: "#f0f0f0"
        });

        objects.push({
            id: `${el.id || 'col'}-x1-${Math.random().toString(36).substr(2, 4)}`,
            type: "line",
            start: { x: x, y: y, z: 0 },
            end: { x: x + w, y: y + d, z: 0 },
            color: "#000000", // Darker
            layerId: layerIdColumns,
            lineWidth: 1.5 // Thicker
        });

        objects.push({
            id: `${el.id || 'col'}-x2-${Math.random().toString(36).substr(2, 4)}`,
            type: "line",
            start: { x: x + w, y: y, z: 0 },
            end: { x: x, y: y + d, z: 0 },
            color: "#000000", // Darker
            layerId: layerIdColumns,
            lineWidth: 1.5 // Thicker
        });

        objects.push({
            id: `${el.id || 'col'}-label`,
            type: "text",
            position: { x: x + w + (0.2 * S), y: y, z: 0 },
            text: el.id || "Column",
            size: 0.6,
            color: "#000000",
            layerId: layerIdLabels
        });
    });

    // 2d. Voids
    elements.filter(el => el.type === 'void').forEach(el => {
        const { x, y } = el.position;
        const w = el.properties.width;
        const d = el.properties.depth;

        objects.push({
            id: el.id,
            type: "rectangle",
            start: { x: x * S, y: y * S, z: 0 },
            end: { x: (x + w) * S, y: (y + d) * S, z: 0 },
            color: "#000000",
            layerId: layerIdVoids,
            lineWidth: 2.5
        });
        // Cross lines omitted for brevity in summary but preserved in reality
        objects.push({
            id: `${el.id}-x1`,
            type: "line",
            start: { x: x * S, y: y * S, z: 0 },
            end: { x: (x + w) * S, y: (y + d) * S, z: 0 },
            color: "#000000",
            layerId: layerIdVoids,
            lineWidth: 1.5
        });
        objects.push({
            id: `${el.id}-x2`,
            type: "line",
            start: { x: (x + w) * S, y: y * S, z: 0 },
            end: { x: x * S, y: (y + d) * S, z: 0 },
            color: "#000000",
            layerId: layerIdVoids,
            lineWidth: 1.5
        });
        objects.push({
            id: `${el.id}-label`,
            type: "text",
            position: { x: (x + w / 2) * S - (1.5 * S), y: (y + d / 2) * S - (0.3 * S), z: 0 },
            text: "OPENING",
            size: 0.8,
            color: "#000000",
            layerId: layerIdLabels
        });
    });

    return objects;
};
