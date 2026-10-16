import { useStore } from './useStore';

/**
 * Export the current project to a JSON file.
 */
export function exportProject(filename = 'sitecraft-project.json') {
  const { elements, terrain } = useStore.getState();

  const data = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    elements,
    terrain,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import a project JSON file and restore state.
 */
export function importProject(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const store = useStore.getState();
        store.snapshot();
        // Replace all elements
        store.elements.forEach(el => store.removeElement(el.id));
        data.elements?.forEach(el => store.addElement(el));
        if (data.terrain) store.setTerrain(data.terrain);
        store.pushAgentLog(`✓ Imported ${data.elements?.length || 0} elements from ${file.name}`);
        resolve(data);
      } catch (err) {
        reject(new Error(`Failed to parse project file: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Export elements as a simple JSON spec array (for agent/API consumption).
 */
export function exportElementSpecs() {
  const { elements } = useStore.getState();
  return elements.map(el => ({
    elementType: el.type,
    subType: el.subType,
    path: el.path,
    origin: el.origin,
    width: el.width,
    lanes: el.lanes,
    material: el.material,
    markings: el.markings,
    kerb: el.kerb,
    verge: el.verge,
    properties: el.properties,
  }));
}

/**
 * Import a batch of element specs (from agent JSON output).
 * @param {Array} specs  Array of spec objects
 */
export function importElementSpecs(specs) {
  const { placeSiteElement } = require('./agenInterface');
  const ids = [];
  for (const spec of specs) {
    const id = placeSiteElement(spec);
    ids.push(id);
  }
  return ids;
}

/**
 * Export terrain elevation grid as CSV.
 */
export function exportTerrainCSV(filename = 'terrain.csv') {
  const { terrain } = useStore.getState();
  if (!terrain?.grid) return;

  const csv = terrain.grid.map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export scene as DXF-like text (simplified for CAD import).
 * Produces basic POLYLINE and CIRCLE entities.
 */
export function exportDXF(filename = 'sitecraft-export.dxf') {
  const { elements } = useStore.getState();

  let dxf = '0\nSECTION\n2\nENTITIES\n';

  for (const el of elements) {
    if (el.path && el.path.length >= 2) {
      dxf += `0\nPOLYLINE\n8\n${el.type.toUpperCase()}\n66\n1\n`;
      for (const [x, z] of el.path) {
        dxf += `0\nVERTEX\n8\n${el.type.toUpperCase()}\n10\n${x}\n20\n${z}\n30\n0.0\n`;
      }
      dxf += `0\nSEQEND\n`;
    }
    if (el.origin) {
      const [x, z] = el.origin;
      dxf += `0\nPOINT\n8\n${el.type.toUpperCase()}\n10\n${x}\n20\n${z}\n30\n0.0\n`;
    }
  }

  dxf += '0\nENDSEC\n0\nEOF\n';

  const blob = new Blob([dxf], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}