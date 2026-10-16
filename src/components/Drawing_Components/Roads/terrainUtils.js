import * as THREE from 'three';

/**
 * Build a terrain BufferGeometry from a 2D elevation grid.
 * @param {number[][]} grid  [row][col] elevation values in metres
 * @param {number} cellSize  metres per grid cell
 * @returns THREE.BufferGeometry
 */
export function buildTerrainGeometry(grid, cellSize = 1) {
    const rows = grid.length;
    const cols = grid[0].length;
    const geom = new THREE.PlaneGeometry(
        (cols - 1) * cellSize,
        (rows - 1) * cellSize,
        cols - 1,
        rows - 1
    );
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const idx = r * cols + c;
            pos.setY(idx, grid[r][c]);
        }
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
    return geom;
}

/**
 * Generate a procedural elevation grid using simplex-like noise.
 * (Deterministic for demo; replace with actual noise library.)
 */
export function generateProceduralGrid(cols, rows, amplitude = 3, frequency = 0.08) {
    const grid = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            const v =
                amplitude * Math.sin(c * frequency) * Math.cos(r * frequency * 0.7) +
                amplitude * 0.4 * Math.sin(c * frequency * 2.3 + 1) * Math.cos(r * frequency * 1.8);
            row.push(v);
        }
        grid.push(row);
    }
    return grid;
}

/**
 * Sample elevation at a world (x, z) position from a grid.
 * Bilinear interpolation.
 */
export function sampleElevation(grid, cellSize, x, z) {
    const rows = grid.length;
    const cols = grid[0].length;

    const cx = x / cellSize;
    const cz = z / cellSize;
    const col = Math.max(0, Math.min(cols - 2, Math.floor(cx)));
    const row = Math.max(0, Math.min(rows - 2, Math.floor(cz)));
    const fx = cx - col;
    const fz = cz - row;

    const h00 = grid[row][col];
    const h10 = grid[row][col + 1];
    const h01 = grid[row + 1][col];
    const h11 = grid[row + 1][col + 1];

    return h00 * (1 - fx) * (1 - fz) +
        h10 * fx * (1 - fz) +
        h01 * (1 - fx) * fz +
        h11 * fx * fz;
}

/**
 * Extract contour iso-lines from an elevation grid using Marching Squares.
 * @param {number[][]} grid
 * @param {number} cellSize
 * @param {number[]} levels  elevation contour values to extract
 * @returns {Array<{ level: number, segments: [[x,z],[x,z]][] }>}
 */
export function extractContours(grid, cellSize, levels) {
    const rows = grid.length - 1;
    const cols = grid[0].length - 1;
    const result = [];

    for (const level of levels) {
        const segments = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const tl = grid[r][c];
                const tr = grid[r][c + 1];
                const bl = grid[r + 1][c];
                const br = grid[r + 1][c + 1];

                const x0 = c * cellSize;
                const x1 = (c + 1) * cellSize;
                const z0 = r * cellSize;
                const z1 = (r + 1) * cellSize;

                const above = [tl, tr, bl, br].map(v => v >= level);
                const idx = (above[0] ? 8 : 0) | (above[1] ? 4 : 0) | (above[2] ? 1 : 0) | (above[3] ? 2 : 0);

                const lerp = (a, b, va, vb) => a + (b - a) * (level - va) / (vb - va);

                const edgePts = {
                    top: [lerp(x0, x1, tl, tr), z0],
                    right: [x1, lerp(z0, z1, tr, br)],
                    bottom: [lerp(x0, x1, bl, br), z1],
                    left: [x0, lerp(z0, z1, tl, bl)],
                };

                const msTable = {
                    1: [['left', 'bottom']], 2: [['bottom', 'right']], 3: [['left', 'right']],
                    4: [['top', 'right']], 5: [['left', 'top'], ['bottom', 'right']],
                    6: [['top', 'bottom']], 7: [['left', 'top']], 8: [['top', 'left']],
                    9: [['top', 'bottom']], 10: [['top', 'right'], ['left', 'bottom']],
                    11: [['top', 'right']], 12: [['left', 'right']], 13: [['bottom', 'right']],
                    14: [['left', 'bottom']], 15: [],
                };

                const segs = msTable[idx] || [];
                for (const [a, b] of segs) {
                    segments.push([edgePts[a], edgePts[b]]);
                }
            }
        }
        result.push({ level, segments });
    }
    return result;
}

/**
 * Parse a CSV string of elevation data into a grid.
 * CSV format: one row per line, comma-separated elevation values.
 */
export function parseElevationCSV(csvText) {
    return csvText.trim().split('\n').map(line =>
        line.split(',').map(v => parseFloat(v.trim()))
    );
}
