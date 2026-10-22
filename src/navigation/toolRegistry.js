/**
 * Fundi Studio — route/tool registry.
 *
 * Single source of truth for "what tool am I in?" metadata used by the
 * application shell (active tool label, breadcrumb/back control, document
 * title) and by the navigation drawer.
 *
 * IMPORTANT: this file describes routes that already exist in
 * `src/components/engineering_appp.jsx`. It never adds, removes or redirects a
 * route — navigation behaviour is unchanged.
 */

export const TOOL_GROUPS = {
  home: "Workspace",
  structural: "Structural design",
  quantity: "Quantity & surveying",
  survey: "Surveying & soil mechanics",
  cad: "CAD, BIM & IFC",
};

/**
 * @typedef {object} ToolMeta
 * @property {string} path     Exact route path.
 * @property {string} title    Human-facing tool name.
 * @property {keyof TOOL_GROUPS} group
 * @property {string} parent   Route the mobile back control returns to.
 * @property {string} [standard] Design code / method shown in the header.
 */

/** @type {ToolMeta[]} */
export const TOOLS = [
  { path: "/", title: "Home", group: "home", parent: "/" },

  // ---------------------------------------------------------------- structural
  {
    path: "/structural/manual/beam",
    title: "RC Beam Design",
    group: "structural",
    parent: "/",
    standard: "BS 8110 · Eurocode 2",
  },
  {
    path: "/structural/manual/slabs",
    title: "RC Slab Design",
    group: "structural",
    parent: "/",
    standard: "BS 8110 · Eurocode 2",
  },
  {
    path: "/structural/manual/column",
    title: "RC Column Design",
    group: "structural",
    parent: "/",
    standard: "BS 8110",
  },
  {
    path: "/structural/manual/stairs",
    title: "RC Stair Design",
    group: "structural",
    parent: "/",
    standard: "BS 8110 · Eurocode 2",
  },
  {
    path: "/structural/manual/foundation",
    title: "RC Foundation Design",
    group: "structural",
    parent: "/",
    standard: "BS 8110 · BS 8004 · EN 1997",
  },
  {
    path: "/structural/manual/wall",
    title: "RC Wall Design",
    group: "structural",
    parent: "/",
    standard: "BS 8110 · Eurocode 2",
  },
  {
    path: "/structural/manual/retaining",
    title: "Retaining Wall Design",
    group: "structural",
    parent: "/",
    standard: "BS 8002 · EN 1997",
  },
  {
    path: "/structural/manual/eurocode_structural_app",
    title: "Framed & Tall Buildings",
    group: "structural",
    parent: "/",
    standard: "BS 8110 · BS 6399 · EN 1990–1998",
  },
  {
    path: "/structural/manual/steel",
    title: "Steel Member & Frame Design",
    group: "structural",
    parent: "/",
    standard: "BS 5950-1:2000",
  },
  {
    path: "/structural/automatic/bolt_connections",
    title: "Bolted Connections",
    group: "structural",
    parent: "/structural/manual/steel",
    standard: "BS 5950-1:2000",
  },
  {
    path: "/structural/automatic/weld_connections",
    title: "Welded Joints",
    group: "structural",
    parent: "/structural/manual/steel",
    standard: "BS 5950-1:2000",
  },
  {
    path: "/structural/manual/Timber_design",
    title: "Timber Design",
    group: "structural",
    parent: "/",
    standard: "BS 5268-2:2002",
  },
  {
    path: "/structural/manual/Masonry_design",
    title: "Masonry Design",
    group: "structural",
    parent: "/",
    standard: "BS 5628-1:2005",
  },

  // -------------------------------------------------------- quantity surveying
  {
    path: "/quantity/manual/taking-off",
    title: "Taking-Off Sheet",
    group: "quantity",
    parent: "/",
    standard: "English method",
  },
  {
    path: "/quantity/manual/approximate",
    title: "Dimension Paper",
    group: "quantity",
    parent: "/quantity/manual/taking-off",
  },
  {
    path: "/quantity/manual/boq",
    title: "Bill of Quantities",
    group: "quantity",
    parent: "/quantity/manual/taking-off",
  },
  {
    path: "/quantity/manual/documents",
    title: "Measurement Documents",
    group: "quantity",
    parent: "/quantity/manual/taking-off",
  },
  { path: "/quantity/manual/roof-taking-off", title: "Roof Takeoff", group: "quantity", parent: "/" },
  { path: "/quantity/manual/septic-taking-off", title: "Septic Tank Takeoff", group: "quantity", parent: "/" },
  { path: "/quantity/manual/drainage-taking-off", title: "Drainage Takeoff", group: "quantity", parent: "/" },
  { path: "/quantity/manual/external-taking-off", title: "External Works Takeoff", group: "quantity", parent: "/" },
  { path: "/quantity/manual/swimming-pool-taking-off", title: "Swimming Pool Takeoff", group: "quantity", parent: "/" },
  { path: "/quantity/manual/basement-taking-off", title: "Basement Takeoff", group: "quantity", parent: "/" },
  { path: "/quantity/manual/rcc-superstructure", title: "RCC Superstructure Takeoff", group: "quantity", parent: "/" },
  { path: "/quantity/manual/superstructure-takeoff", title: "Superstructure Takeoff", group: "quantity", parent: "/" },
  { path: "/quantity/manual/substructure_works", title: "Substructure Works Takeoff", group: "quantity", parent: "/" },
  { path: "/quantity/manual/staircase_takeoff", title: "Staircase Takeoff", group: "quantity", parent: "/" },
  { path: "/quantity/manual/door_window", title: "Doors & Windows Takeoff", group: "quantity", parent: "/" },
  { path: "/quantity/manual/internal_finishes", title: "Internal Finishes Takeoff", group: "quantity", parent: "/" },
  { path: "/quantity/manual/electrical_plumbing", title: "Electrical & Plumbing Takeoff", group: "quantity", parent: "/" },
  { path: "/quantity/manual/Underground_tank", title: "Underground Tank Takeoff", group: "quantity", parent: "/" },

  // ---------------------------------------------------- surveying & geotechnics
  { path: "/surveying", title: "Civil Surveying Suite", group: "survey", parent: "/" },
  { path: "/surveying/earthworks", title: "Earthworks", group: "survey", parent: "/surveying" },
  { path: "/surveying/contouring", title: "Contouring & Terrain", group: "survey", parent: "/surveying" },
  { path: "/surveying/road-railway", title: "Road & Railway Alignment", group: "survey", parent: "/surveying" },
  { path: "/surveying/geoid-model", title: "GNSS / Geoid Model", group: "survey", parent: "/surveying" },
  { path: "/surveying/utilities", title: "Utilities Infrastructure", group: "survey", parent: "/surveying" },
  { path: "/surveying/setting-out", title: "Setting Out", group: "survey", parent: "/surveying" },
  { path: "/surveying/monitoring", title: "Deformation Monitoring", group: "survey", parent: "/surveying" },
  { path: "/surveying/soil-mechanics", title: "Soil Mechanics", group: "survey", parent: "/surveying" },

  // -------------------------------------------------------------------- CAD/BIM
  { path: "/drawing", title: "2D CAD Drafting", group: "cad", parent: "/" },
  { path: "/visualise", title: "3D Visualiser", group: "cad", parent: "/" },
  { path: "/interop/cad-bim", title: "CAD / BIM / IFC Workbench", group: "cad", parent: "/" },
  { path: "/drawing/roads", title: "Road Cross-Sections", group: "cad", parent: "/drawing" },
  { path: "/drawing/columns_beams", title: "Columns & Beams Drafting", group: "cad", parent: "/drawing" },
  { path: "/drawing/roof_structure", title: "Roof Structure Drafting", group: "cad", parent: "/drawing" },
  { path: "/drawing/slabs", title: "Slab Detailing", group: "cad", parent: "/drawing" },
  { path: "/drawing/dimensions", title: "Dimensions & Annotation", group: "cad", parent: "/drawing" },
  { path: "/drawing/materials", title: "Materials & Hatching", group: "cad", parent: "/drawing" },
  { path: "/drawing/electrical", title: "Electrical Schematics", group: "cad", parent: "/drawing" },
  { path: "/drawing/plumbing", title: "Plumbing Schematics", group: "cad", parent: "/drawing" },
];

const TOOL_MAP = new Map(TOOLS.map((tool) => [tool.path, tool]));

/**
 * Resolve tool metadata for a pathname.
 * Exact match first, then the longest registered prefix (for nested sub-pages).
 *
 * @param {string} pathname
 * @returns {ToolMeta}
 */
export function getToolMeta(pathname) {
  const clean = (pathname || "/").replace(/\/+$/, "") || "/";
  if (TOOL_MAP.has(clean)) return TOOL_MAP.get(clean);

  let best = null;
  for (const tool of TOOLS) {
    if (clean.startsWith(`${tool.path}/`) && (!best || tool.path.length > best.path.length)) {
      best = tool;
    }
  }
  return (
    best || {
      path: clean,
      title: "Fundi Studio",
      group: "home",
      parent: "/",
    }
  );
}

export const getGroupLabel = (group) => TOOL_GROUPS[group] || TOOL_GROUPS.home;

const toolRegistry = { TOOLS, TOOL_GROUPS, getToolMeta, getGroupLabel };

export default toolRegistry;
