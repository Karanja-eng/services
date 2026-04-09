// ─────────────────────────────────────────────────────────────
//  index.js — barrel exports for the roof-structure module
// ─────────────────────────────────────────────────────────────

// ── Top-level app ─────────────────────────────────────────────
export { default as RoofStructureApp }     from './src/components/RoofStructureApp.jsx';

// ── 3D components ─────────────────────────────────────────────
export { default as RoofTruss3D }          from './src/components/3d/RoofTruss3D.jsx';
export { default as RoofFraming3D }        from './src/components/3d/RoofFraming3D.jsx';
export { default as PortalFrame3D }        from './src/components/3d/PortalFrame3D.jsx';

// ── 2D components ─────────────────────────────────────────────
export { default as Truss2D }              from './src/components/2d/Truss2D.jsx';
export { default as Framing2D }            from './src/components/2d/Framing2D.jsx';

// ── UI panels ─────────────────────────────────────────────────
export { default as StructureControlPanel } from './src/components/ui/StructureControlPanel.jsx';
export { default as StructureInfoPanel }    from './src/components/ui/StructureInfoPanel.jsx';

// ── Hook ──────────────────────────────────────────────────────
export { useRoofStructure }                from './src/hooks/useRoofStructure.js';

// ── Utilities ─────────────────────────────────────────────────
export * from './src/utils/geometryUtils.js';
export * from './src/utils/materialFactory.js';

// ── Constants ─────────────────────────────────────────────────
export * from './src/constants/roofStructureTypes.js';
