
// ============================================================================
// STRUCTURAL ELEMENT CLASSES
// ============================================================================

export class StructuralGrid {
    constructor(spacing = 5) {
        this.spacing = spacing;
        this.idCounter = 0;
        this.xLines = []; // Array of { id, val, label } for vertical lines (x-axis positions)
        this.yLines = []; // Array of { id, val, label } for horizontal lines (y-axis positions)

        // Initialize with default grid
        this.generateDefaultGrid(50, 50);
    }

    generateDefaultGrid(width, height) {
        this.xLines = [];
        this.yLines = [];

        // Vertical grid lines (labeled 1, 2, 3...)
        for (let x = 0; x <= width; x += this.spacing) {
            this.xLines.push({
                id: `grid-x-${this.idCounter++}`,
                val: x,
                label: String(this.xLines.length + 1)
            });
        }

        // Horizontal grid lines (labeled A, B, C...)
        for (let y = 0; y <= height; y += this.spacing) {
            this.yLines.push({
                id: `grid-y-${this.idCounter++}`,
                val: y,
                label: String.fromCharCode(65 + this.yLines.length)
            });
        }
    }

    // Update a line's position
    moveLine(id, newVal, axis) {
        if (axis === 'x') {
            const line = this.xLines.find(l => l.id === id);
            if (line) line.val = newVal;
        } else {
            const line = this.yLines.find(l => l.id === id);
            if (line) line.val = newVal;
        }
    }

    // Auto-align grid to elements (Columns/Walls)
    autoAlign(elements) {
        // Collect unique X and Y coordinates from columns and walls
        const coordsX = [];
        const coordsY = [];

        elements.forEach(el => {
            if (el.type === 'column') {
                coordsX.push(el.position.x);
                coordsY.push(el.position.y);
            } else if (el.type === 'wall') {
                if (el.position.start) {
                    coordsX.push(el.position.start.x);
                    coordsY.push(el.position.start.y);
                    coordsX.push(el.position.end.x);
                    coordsY.push(el.position.end.y);
                }
            }
        });

        // Helper to group coordinates with a small tolerance (e.g., 5cm)
        const groupCoords = (coords, tolerance = 0.05) => {
            if (coords.length === 0) return [];
            const sorted = [...coords].sort((a, b) => a - b);
            const groups = [sorted[0]];

            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i] - groups[groups.length - 1] > tolerance) {
                    groups.push(sorted[i]);
                }
            }
            return groups;
        };

        const sortedX = groupCoords(coordsX);
        const sortedY = groupCoords(coordsY);

        // Rebuild lines
        this.xLines = sortedX.map((x, i) => ({
            id: `grid-x-auto-${i}`,
            val: Math.round(x * 100) / 100,
            label: String(i + 1)
        }));

        this.yLines = sortedY.map((y, i) => ({
            id: `grid-y-auto-${i}`,
            val: Math.round(y * 100) / 100,
            label: String.fromCharCode(65 + i)
        }));
    }

    getGridLines(width, height) {
        // Calculate dynamic bounds if width/height not provided or to ensure coverage
        // For drawing, we return the lines with start/end points
        const renderLines = [];

        // Vertical Lines
        this.xLines.forEach(line => {
            renderLines.push({
                id: line.id,
                x1: line.val,
                y1: -2, // Extend slightly
                x2: line.val,
                y2: height + 2,
                type: 'vertical',
                label: line.label,
                val: line.val // original value for drag reference
            });
        });

        // Horizontal Lines
        this.yLines.forEach(line => {
            renderLines.push({
                id: line.id,
                x1: -2,
                y1: line.val,
                x2: width + 2,
                y2: line.val,
                type: 'horizontal',
                label: line.label,
                val: line.val
            });
        });

        return renderLines;
    }

    getGridIntersections(width, height) {
        const intersections = [];

        this.xLines.forEach((xLine, i) => {
            this.yLines.forEach((yLine, j) => {
                intersections.push({
                    id: `G-${i}-${j}`,
                    x: xLine.val,
                    y: yLine.val,
                    gridX: i,
                    gridY: j,
                    labelX: xLine.label,
                    labelY: yLine.label
                });
            });
        });

        return intersections;
    }

    getClosestIntersectionLabel(x, y) {
        // Find closest X line
        let closestX = this.xLines[0];
        let minDistX = Infinity;

        this.xLines.forEach(line => {
            const dist = Math.abs(x - line.val);
            if (dist < minDistX) {
                minDistX = dist;
                closestX = line;
            }
        });

        // Find closest Y line
        let closestY = this.yLines[0];
        let minDistY = Infinity;

        this.yLines.forEach(line => {
            const dist = Math.abs(y - line.val);
            if (dist < minDistY) {
                minDistY = dist;
                closestY = line;
            }
        });

        if (closestX && closestY) {
            return `${closestY.label}${closestX.label}`;
        }
        return null;
    }
}

export class StructuralElement {
    constructor(type, id, position, properties = {}) {
        this.type = type; // 'column', 'beam', 'slab', 'wall', 'foundation'
        this.id = id;
        this.position = position; // { x, y, z } or { start, end }
        this.properties = {
            width: 0.45,    // default 450mm
            depth: 0.45,    // default 450mm
            height: 3.5,    // default 3.5m
            thickness: 0.2, // default 200mm
            material: 'C30',
            ...properties
        };
        this.layer = this.properties.layer || 'Floor 1';
        this.selected = false;
        this.visible = true;
        this.loads = [];
        this.reinforcement = null;
        this.analysisResults = null;
    }

    getBounds() {
        switch (this.type) {
            case 'column':
                return {
                    x: this.position.x - (this.properties.width / 2),
                    y: this.position.y - (this.properties.depth / 2),
                    width: this.properties.width,
                    height: this.properties.depth
                };

            case 'beam':
                const dx = this.position.end.x - this.position.start.x;
                const dy = this.position.end.y - this.position.start.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                return {
                    x: this.position.start.x,
                    y: this.position.start.y,
                    width: length,
                    height: this.properties.depth
                };

            case 'slab':
                return {
                    x: this.position.x,
                    y: this.position.y,
                    width: this.properties.width,
                    height: this.properties.depth
                };

            default:
                return { x: 0, y: 0, width: 0, height: 0 };
        }
    }

    containsPoint(x, y) {
        const bounds = this.getBounds();
        return (
            x >= bounds.x &&
            x <= bounds.x + bounds.width &&
            y >= bounds.y &&
            y <= bounds.y + bounds.height
        );
    }
}
