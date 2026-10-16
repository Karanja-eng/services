/**
 * AI Agent Interface
 * Callable by external AI/LLM agents via JSON commands.
 * All functions mutate the Zustand store.
 */

import { useStore } from './useStore';
import { generateProceduralGrid } from './terrainUtils';

/**
 * Place any site element from a JSON spec.
 * @param {Object} spec
 * @param {string} spec.elementType  'road'|'path'|'driveway'|'parking'|'tree'|'fence'|'light'|'water'
 * @param {string} [spec.subType]
 * @param {Array}  [spec.path]   [[x,z], ...] for linear elements
 * @param {Array}  [spec.origin] [x,z] for point elements
 * @param {number} [spec.width]
 * @param {number} [spec.lanes]
 * @param {string} [spec.material]
 * @param {Array}  [spec.markings]
 * @param {string} [spec.kerb]
 * @param {number} [spec.verge]
 * @param {Object} [spec.properties] extra element-specific props
 */
export function placeSiteElement(spec) {
    const store = useStore.getState();
    store.snapshot();

    const element = {
        id: crypto.randomUUID(),
        type: spec.elementType,
        subType: spec.subType || null,
        path: spec.path || null,
        origin: spec.origin || null,
        width: spec.width ?? defaultWidth(spec.elementType),
        lanes: spec.lanes ?? 2,
        material: spec.material || defaultMaterial(spec.elementType),
        markings: spec.markings || defaultMarkings(spec.elementType),
        kerb: spec.kerb || 'upstand',
        verge: spec.verge ?? 0.5,
        properties: spec.properties || {},
        createdBy: 'agent',
        timestamp: Date.now(),
    };

    store.addElement(element);
    store.pushAgentLog(`✓ Placed ${element.type}${element.subType ? '/' + element.subType : ''} [${element.id.slice(0, 8)}]`);
    return element.id;
}

/**
 * Auto-generate a parking layout within a rectangular area.
 * @param {Object} params
 * @param {{ x: number, z: number, width: number, depth: number }} params.area
 * @param {number} params.bayAngle   45|60|90
 * @param {number} params.bayWidth   metres (default 2.5)
 * @param {number} params.bayDepth   metres (default 5.0)
 * @param {number} params.aisleWidth metres (default 6.0)
 * @param {string} params.material
 */
export function generateParkingLayout({ area, bayAngle = 90, bayWidth = 2.5, bayDepth = 5.0, aisleWidth = 6.0, material = 'asphalt' }) {
    const store = useStore.getState();
    store.snapshot();

    const rows = Math.floor(area.depth / (bayDepth + aisleWidth));
    const baysPerRow = Math.floor(area.width / bayWidth);

    const element = {
        id: crypto.randomUUID(),
        type: 'parking',
        origin: [area.x, area.z],
        width: area.width,
        depth: area.depth,
        bayAngle,
        bayWidth,
        bayDepth,
        aisleWidth,
        rows,
        baysPerRow,
        totalBays: rows * baysPerRow,
        material,
        markings: ['bay_lines', 'bay_numbers'],
        createdBy: 'agent',
        timestamp: Date.now(),
    };

    store.addElement(element);
    store.pushAgentLog(`✓ Parking: ${element.totalBays} bays at ${bayAngle}° [${element.id.slice(0, 8)}]`);
    return element;
}

/**
 * Generate terrain from elevation data.
 * @param {{ bounds: { width, depth }, elevationData: number[][] }} params
 */
export function generateTerrain({ bounds, elevationData, cellSize = 1 }) {
    const store = useStore.getState();
    store.snapshot();

    const grid = elevationData || generateProceduralGrid(
        Math.floor(bounds.width / cellSize) + 1,
        Math.floor(bounds.depth / cellSize) + 1
    );

    store.setTerrain({
        grid,
        cellSize,
        bounds,
        material: 'grass',
    });

    store.pushAgentLog(`✓ Terrain ${grid[0].length}×${grid.length} cells, ${cellSize}m/cell`);
}

/**
 * Plant trees within a boundary polygon.
 * @param {Object} params
 * @param {Array} params.boundary   [[x,z], ...] polygon
 * @param {string} params.species   'deciduous'|'conifer'|'palm'|'shrub'
 * @param {number} params.spacing   metres between trees
 * @param {string} params.pattern   'grid'|'random'|'avenue'
 */
export function plantTrees({ boundary, species = 'deciduous', spacing = 6, pattern = 'grid', scale = 1 }) {
    const store = useStore.getState();
    store.snapshot();

    const positions = computeTreePositions(boundary, spacing, pattern);
    const ids = [];

    for (const [x, z] of positions) {
        if (!pointInPolygon([x, z], boundary)) continue;
        const id = crypto.randomUUID();
        store.addElement({
            id,
            type: 'tree',
            origin: [x, z],
            species,
            scale,
            createdBy: 'agent',
            timestamp: Date.now(),
        });
        ids.push(id);
    }

    store.pushAgentLog(`✓ Planted ${ids.length} ${species} trees (${pattern}, ${spacing}m spacing)`);
    return ids;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeTreePositions(boundary, spacing, pattern) {
    const xs = boundary.map(p => p[0]);
    const zs = boundary.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const positions = [];

    if (pattern === 'grid') {
        for (let x = minX + spacing / 2; x < maxX; x += spacing) {
            for (let z = minZ + spacing / 2; z < maxZ; z += spacing) {
                positions.push([x, z]);
            }
        }
    } else if (pattern === 'random') {
        const area = (maxX - minX) * (maxZ - minZ);
        const count = Math.floor(area / (spacing * spacing));
        for (let i = 0; i < count; i++) {
            positions.push([
                minX + Math.random() * (maxX - minX),
                minZ + Math.random() * (maxZ - minZ),
            ]);
        }
    } else if (pattern === 'avenue') {
        // Along boundary edges
        for (let i = 0; i < boundary.length; i++) {
            const a = boundary[i];
            const b = boundary[(i + 1) % boundary.length];
            const dx = b[0] - a[0], dz = b[1] - a[1];
            const len = Math.hypot(dx, dz);
            const steps = Math.floor(len / spacing);
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                positions.push([a[0] + dx * t, a[1] + dz * t]);
            }
        }
    }

    return positions;
}

function pointInPolygon([px, pz], poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, zi] = poly[i];
        const [xj, zj] = poly[j];
        if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) {
            inside = !inside;
        }
    }
    return inside;
}

function defaultWidth(type) {
    return { road: 7, path: 1.8, driveway: 3.2, parking: 20 }[type] ?? 3;
}

function defaultMaterial(type) {
    return { road: 'asphalt', path: 'paving', driveway: 'block_paving', parking: 'asphalt', terrain: 'grass' }[type] ?? 'asphalt';
}

function defaultMarkings(type) {
    return { road: ['centre', 'edge'], path: [], driveway: [] }[type] ?? [];
}