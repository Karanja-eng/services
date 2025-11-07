import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * SLAB DETAILING MODELS - MS1 to MS8
 * Based on IStructE/Concrete Society Standard Method of Detailing Structural Concrete
 * 
 * These components visualize standard reinforcement details for concrete slabs
 * following BS EN 1992 (Eurocode 2) practices.
 */

// ============================================================================
// MS1: ONE AND TWO WAY SLABS - SPAN AND INTERNAL SUPPORT
// ============================================================================

/**
 * MS1: One and Two Way Slabs - Span and Internal Support
 * Shows typical reinforcement arrangement with:
 * - Bottom bars spanning 0.8 x span
 * - Top bars at supports with alternating stagger
 * - Distribution reinforcement
 * - Proper curtailment rules
 * 
 * @param {Object} props
 * @param {number} props.span - Slab span in meters (default: 6.0)
 * @param {number} props.slabDepth - Slab thickness in meters (default: 0.225)
 * @param {number} props.cover - Concrete cover in meters (default: 0.025)
 * @param {number} props.mainBarDiameter - Main bar diameter in meters (default: 0.012)
 * @param {number} props.mainBarSpacing - Main bar spacing in meters (default: 0.200)
 * @param {number} props.distBarDiameter - Distribution bar diameter (default: 0.010)
 * @param {number} props.distBarSpacing - Distribution bar spacing (default: 0.200)
 * @param {Object} props.colors - Color scheme
 * @param {boolean} props.showConcrete - Show concrete slab
 * @param {boolean} props.showRebar - Show reinforcement
 * @param {boolean} props.showLabels - Show dimension labels
 */
export function DrawSlabMS1({
  span = 6.0,
  slabDepth = 0.225,
  width = 4.0,
  cover = 0.025,
  mainBarDiameter = 0.012,
  mainBarSpacing = 0.200,
  distBarDiameter = 0.010,
  distBarSpacing = 0.200,
  colors = {
    concrete: '#a8a8a8',
    mainRebar: '#cc3333',
    distributionBars: '#cc8833',
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4
}) {
  
  // Calculate key dimensions per MS1 detail
  const bottomBarLength = 0.8 * span + 0.5 * (mainBarDiameter * 42); // 0.5 x tension lap
  const topBarExtension = 0.3 * span;
  const supportWidth = 0.3; // Typical support width
  
  // Number of bars
  const numMainBars = Math.floor(width / mainBarSpacing) + 1;
  const numDistBars = Math.floor(span / distBarSpacing) + 1;

  // Concrete geometry
  const concreteGeometry = useMemo(
    () => new THREE.BoxGeometry(span, slabDepth, width),
    [span, slabDepth, width]
  );

  const concreteMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.concrete,
      transparent: true,
      opacity: opacity,
      wireframe: wireframe
    }),
    [colors.concrete, opacity, wireframe]
  );

  // Bar geometries
  const mainBarGeometry = useMemo(
    () => new THREE.CylinderGeometry(
      mainBarDiameter / 2,
      mainBarDiameter / 2,
      bottomBarLength,
      16
    ),
    [mainBarDiameter, bottomBarLength]
  );

  const topBarGeometry = useMemo(
    () => new THREE.CylinderGeometry(
      mainBarDiameter / 2,
      mainBarDiameter / 2,
      topBarExtension * 2,
      16
    ),
    [mainBarDiameter, topBarExtension]
  );

  const distBarGeometry = useMemo(
    () => new THREE.CylinderGeometry(
      distBarDiameter / 2,
      distBarDiameter / 2,
      width,
      16
    ),
    [distBarDiameter, width]
  );

  const mainBarMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.mainRebar,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.mainRebar, wireframe]
  );

  const distBarMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.distributionBars,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.distributionBars, wireframe]
  );

  return (
    <group name="MS1-Slab">
      {/* Concrete Slab */}
      {showConcrete && (
        <mesh
          geometry={concreteGeometry}
          material={concreteMaterial}
          position={[0, 0, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Bottom Main Bars - Spanning 0.8 x span */}
          <group name="bottom-main-bars">
            {Array.from({ length: numNominalBarsInDrop }).map((_, i) => {
              const x = -dropSize / 2 + i * nominalBarSpacing;
              const y = -dropDepth / 2 + cover + nominalBarDiameter * 1.5;

              const barGeometry = new THREE.CylinderGeometry(
                nominalBarDiameter / 2,
                nominalBarDiameter / 2,
                dropSize,
                16
              );

              return (
                <mesh
                  key={`nominal-drop-perp-${i}`}
                  geometry={barGeometry}
                  material={nominalBarMaterial}
                  position={[x, y, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>

          {/* 75mm minimum edge distance indicator */}
          {showLabels && (
            <group name="edge-indicators">
              {/* Visual markers for 75mm clearance */}
            </group>
          )}
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Drop dimensions and reinforcement specifications */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MS8: RIBBED AND COFFERED SLABS
// ============================================================================

/**
 * MS8: Ribbed and Coffered Slabs
 * Shows:
 * - Detail A: Hollow pot construction
 * - Detail B: Coffered slab
 * - Detail C: Coffered with supplementary fire reinforcement
 * - Nominal fabric in topping
 * - Links in ribs if required for shear
 * - Lacing bars for deep ribs
 */
export function DrawSlabMS8({
  span = 6.0,
  width = 4.0,
  ribSpacing = 0.6,
  ribWidth = 0.125,
  ribDepth = 0.450,
  topFlange = 0.075,
  cover = 0.025,
  ribBarDiameter = 0.016,
  ribBarCount = 2,
  linkDiameter = 0.008,
  linkSpacing = 0.200,
  lacingBarDiameter = 0.012,
  detailType = 'B', // 'A' = hollow pot, 'B' = coffered, 'C' = coffered with fire reinf
  colors = {
    concrete: '#a8a8a8',
    mainRebar: '#cc3333',
    links: '#3366cc',
    fabric: '#cc8833',
    lacingBars: '#999999',
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4
}) {

  const totalDepth = ribDepth + topFlange;
  const numRibs = Math.floor(width / ribSpacing);
  const actualRibSpacing = width / numRibs;

  // Concrete materials
  const concreteMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.concrete,
      transparent: true,
      opacity: opacity,
      wireframe: wireframe
    }),
    [colors.concrete, opacity, wireframe]
  );

  const barMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.mainRebar,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.mainRebar, wireframe]
  );

  const linkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.links,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.links, wireframe]
  );

  const fabricMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.fabric,
      metalness: 0.5,
      roughness: 0.4,
      wireframe: wireframe
    }),
    [colors.fabric, wireframe]
  );

  const lacingMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.lacingBars,
      metalness: 0.6,
      roughness: 0.4,
      wireframe: wireframe
    }),
    [colors.lacingBars, wireframe]
  );

  // Top flange geometry
  const flangeGeometry = useMemo(
    () => new THREE.BoxGeometry(span, topFlange, width),
    [span, topFlange, width]
  );

  // Rib geometry
  const ribGeometry = useMemo(
    () => new THREE.BoxGeometry(span, ribDepth, ribWidth),
    [span, ribDepth, ribWidth]
  );

  return (
    <group name="MS8-Ribbed-Coffered-Slab">
      {/* Concrete Structure */}
      {showConcrete && (
        <group name="concrete-structure">
          {/* Top flange/topping */}
          <mesh
            geometry={flangeGeometry}
            material={concreteMaterial}
            position={[0, ribDepth / 2 + topFlange / 2, 0]}
          />

          {/* Ribs */}
          <group name="ribs">
            {Array.from({ length: numRibs }).map((_, i) => {
              const zPos = -width / 2 + (i + 0.5) * actualRibSpacing;
              
              return (
                <mesh
                  key={`rib-${i}`}
                  geometry={ribGeometry}
                  material={concreteMaterial}
                  position={[0, 0, zPos]}
                />
              );
            })}
          </group>

          {/* For coffered slabs (Detail B & C), add ribs in perpendicular direction */}
          {(detailType === 'B' || detailType === 'C') && (
            <group name="perpendicular-ribs">
              {Array.from({ length: Math.floor(span / ribSpacing) }).map((_, i) => {
                const xPos = -span / 2 + (i + 0.5) * ribSpacing;
                
                const perpRibGeometry = new THREE.BoxGeometry(ribWidth, ribDepth, width);
                
                return (
                  <mesh
                    key={`perp-rib-${i}`}
                    geometry={perpRibGeometry}
                    material={concreteMaterial}
                    position={[xPos, 0, 0]}
                  />
                );
              })}
            </group>
          )}
        </group>
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Nominal fabric in top flange - A252 typical */}
          <group name="top-fabric">
            {/* Main wires */}
            {Array.from({ length: Math.floor(width / 0.200) + 1 }).map((_, i) => {
              const z = -width / 2 + i * 0.200;
              const y = ribDepth / 2 + topFlange / 2;
              
              const wireGeometry = new THREE.CylinderGeometry(
                0.008 / 2,
                0.008 / 2,
                span,
                8
              );

              return (
                <mesh
                  key={`fabric-main-${i}`}
                  geometry={wireGeometry}
                  material={fabricMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}

            {/* Cross wires */}
            {Array.from({ length: Math.floor(span / 0.200) + 1 }).map((_, i) => {
              const x = -span / 2 + i * 0.200;
              const y = ribDepth / 2 + topFlange / 2 - 0.005;
              
              const wireGeometry = new THREE.CylinderGeometry(
                0.008 / 2,
                0.008 / 2,
                width,
                8
              );

              return (
                <mesh
                  key={`fabric-cross-${i}`}
                  geometry={wireGeometry}
                  material={fabricMaterial}
                  position={[x, y, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>

          {/* Main bars in ribs */}
          <group name="rib-main-bars">
            {Array.from({ length: numRibs }).map((_, ribIdx) => {
              const zPos = -width / 2 + (ribIdx + 0.5) * actualRibSpacing;
              
              return (
                <group key={`rib-bars-${ribIdx}`}>
                  {/* Bottom bars (typically 2 bars for ribWidth >= 125mm) */}
                  {ribBarCount === 2 ? (
                    <>
                      <mesh
                        geometry={new THREE.CylinderGeometry(
                          ribBarDiameter / 2,
                          ribBarDiameter / 2,
                          span,
                          16
                        )}
                        material={barMaterial}
                        position={[0, -ribDepth / 2 + cover + ribBarDiameter / 2, zPos - ribWidth / 4]}
                        rotation={[0, 0, Math.PI / 2]}
                      />
                      <mesh
                        geometry={new THREE.CylinderGeometry(
                          ribBarDiameter / 2,
                          ribBarDiameter / 2,
                          span,
                          16
                        )}
                        material={barMaterial}
                        position={[0, -ribDepth / 2 + cover + ribBarDiameter / 2, zPos + ribWidth / 4]}
                        rotation={[0, 0, Math.PI / 2]}
                      />
                    </>
                  ) : (
                    <mesh
                      geometry={new THREE.CylinderGeometry(
                        ribBarDiameter / 2,
                        ribBarDiameter / 2,
                        span,
                        16
                      )}
                      material={barMaterial}
                      position={[0, -ribDepth / 2 + cover + ribBarDiameter / 2, zPos]}
                      rotation={[0, 0, Math.PI / 2]}
                    />
                  )}
                </group>
              );
            })}
          </group>

          {/* Links in ribs (if required for shear) */}
          <group name="rib-links">
            {Array.from({ length: numRibs }).map((_, ribIdx) => {
              const zPos = -width / 2 + (ribIdx + 0.5) * actualRibSpacing;
              const numLinks = Math.floor(span / linkSpacing);
              
              return (
                <group key={`rib-links-${ribIdx}`}>
                  {Array.from({ length: numLinks }).map((_, linkIdx) => {
                    const xPos = -span / 2 + (linkIdx + 1) * linkSpacing;
                    
                    // Create closed rectangular link
                    const linkPath = new THREE.CurvePath();
                    const linkWidth = ribWidth - 2 * cover;
                    const linkHeight = ribDepth - 2 * cover;
                    
                    const lw = linkWidth / 2;
                    const lh = linkHeight / 2;
                    
                    linkPath.add(new THREE.LineCurve3(
                      new THREE.Vector3(-lw, -lh, 0),
                      new THREE.Vector3(lw, -lh, 0)
                    ));
                    linkPath.add(new THREE.LineCurve3(
                      new THREE.Vector3(lw, -lh, 0),
                      new THREE.Vector3(lw, lh, 0)
                    ));
                    linkPath.add(new THREE.LineCurve3(
                      new THREE.Vector3(lw, lh, 0),
                      new THREE.Vector3(-lw, lh, 0)
                    ));
                    linkPath.add(new THREE.LineCurve3(
                      new THREE.Vector3(-lw, lh, 0),
                      new THREE.Vector3(-lw, -lh, 0)
                    ));

                    const linkGeometry = new THREE.TubeGeometry(
                      linkPath,
                      32,
                      linkDiameter / 2,
                      8,
                      true
                    );

                    return (
                      <mesh
                        key={`link-${linkIdx}`}
                        geometry={linkGeometry}
                        material={linkMaterial}
                        position={[xPos, 0, zPos]}
                      />
                    );
                  })}
                </group>
              );
            })}
          </group>

          {/* Lacing bars (12mm bars for ribs > 750mm deep) */}
          {ribDepth > 0.750 && (
            <group name="lacing-bars">
              {Array.from({ length: numRibs }).map((_, ribIdx) => {
                const zPos = -width / 2 + (ribIdx + 0.5) * actualRibSpacing;
                const numLacers = Math.floor(ribDepth / 0.300); // Typically every 300mm
                
                return (
                  <group key={`lacer-group-${ribIdx}`}>
                    {Array.from({ length: numLacers }).map((_, lacerIdx) => {
                      const yPos = -ribDepth / 2 + (lacerIdx + 1) * (ribDepth / (numLacers + 1));
                      
                      const lacerGeometry = new THREE.CylinderGeometry(
                        lacingBarDiameter / 2,
                        lacingBarDiameter / 2,
                        span,
                        16
                      );

                      return (
                        <mesh
                          key={`lacer-${lacerIdx}`}
                          geometry={lacerGeometry}
                          material={lacingMaterial}
                          position={[0, yPos, zPos]}
                          rotation={[0, 0, Math.PI / 2]}
                        />
                      );
                    })}
                  </group>
                );
              })}
            </group>
          )}

          {/* Supplementary fire reinforcement (Detail C) - 6mm links @ 200mm */}
          {detailType === 'C' && cover > 0.040 && (
            <group name="fire-reinforcement">
              {Array.from({ length: numRibs }).map((_, ribIdx) => {
                const zPos = -width / 2 + (ribIdx + 0.5) * actualRibSpacing;
                const numFireLinks = Math.floor(span / 0.200);
                
                return (
                  <group key={`fire-links-${ribIdx}`}>
                    {Array.from({ length: numFireLinks }).map((_, linkIdx) => {
                      const xPos = -span / 2 + linkIdx * 0.200;
                      
                      // Small 6mm U-shaped fire links
                      const fireU = new THREE.CurvePath();
                      const fw = (ribWidth - 2 * cover) / 2;
                      const fh = ribDepth * 0.6;
                      
                      fireU.add(new THREE.LineCurve3(
                        new THREE.Vector3(-fw, -fh / 2, 0),
                        new THREE.Vector3(-fw, fh / 2, 0)
                      ));
                      fireU.add(new THREE.LineCurve3(
                        new THREE.Vector3(-fw, fh / 2, 0),
                        new THREE.Vector3(fw, fh / 2, 0)
                      ));
                      fireU.add(new THREE.LineCurve3(
                        new THREE.Vector3(fw, fh / 2, 0),
                        new THREE.Vector3(fw, -fh / 2, 0)
                      ));

                      const fireGeometry = new THREE.TubeGeometry(
                        fireU,
                        16,
                        0.003, // 6mm
                        8,
                        false
                      );

                      return (
                        <mesh
                          key={`fire-link-${linkIdx}`}
                          geometry={fireGeometry}
                          material={linkMaterial}
                          position={[xPos, 0, zPos]}
                        />
                      );
                    })}
                  </group>
                );
              })}
            </group>
          )}

          {/* Nominal fabric in solid areas around columns (for coffered slabs) */}
          {(detailType === 'B' || detailType === 'C') && (
            <group name="solid-area-fabric">
              {/* Bottom fabric in solid sections */}
              <mesh
                geometry={new THREE.PlaneGeometry(ribSpacing, ribSpacing)}
                material={fabricMaterial}
                position={[0, -ribDepth / 2 + cover * 2, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
              />
            </group>
          )}
        </group>
      )}

      {/* Labels and annotations */}
      {showLabels && (
        <group name="labels">
          {/* Rib spacing, depth labels */}
          {/* 300mm lap requirement indicator for fabric */}
        </group>
      )}

      {/* Notes on drawing */}
      <group name="detail-notes">
        {/* Special care message for fabric laps */}
        {/* Minimum rib width requirements (75mm for 1 bar, 125mm for 2 bars) */}
      </group>
    </group>
  );
}

// ============================================================================
// EXPORT ALL SLAB DETAILS
// ============================================================================

/**
 * Complete slab detailing library following IStructE/Concrete Society standards.
 * Each component can be integrated with the StructuralVisualizationComponent.
 * 
 * Usage example:
 * ```jsx
 * import { DrawSlabMS1, DrawSlabMS2 } from './slab-details-ms1-ms8';
 * 
 * <DrawSlabMS1
 *   span={6.0}
 *   slabDepth={0.225}
 *   colors={colors}
 *   showConcrete={showConcrete}
 *   showRebar={showRebar}
 *   wireframe={wireframe}
 *   opacity={0.4}
 * />
 * ```
 */

export default {
  DrawSlabMS1,
  DrawSlabMS2,
  DrawSlabMS3,
  DrawSlabMS4,
  DrawSlabMS5,
  DrawSlabMS6,
  DrawSlabMS7,
  DrawSlabMS8,
};MainBars }).map((_, i) => {
              const z = -width / 2 + i * mainBarSpacing;
              const y = -slabDepth / 2 + cover + mainBarDiameter / 2;
              
              // Alternating bar positions per MS1 detail
              const isAlternate = i % 2 === 0;
              const xOffset = isAlternate ? 0 : (span - bottomBarLength) / 2;
              
              return (
                <mesh
                  key={`bottom-main-${i}`}
                  geometry={mainBarGeometry}
                  material={mainBarMaterial}
                  position={[xOffset, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Top Support Bars - Alternately Staggered */}
          <group name="top-support-bars-left">
            {Array.from({ length: numMainBars }).map((_, i) => {
              const z = -width / 2 + i * mainBarSpacing;
              const y = slabDepth / 2 - cover - mainBarDiameter / 2;
              
              // Alternating stagger per MS1
              const isAlternate = i % 2 === 0;
              const xPosition = isAlternate 
                ? -span / 2 + topBarExtension 
                : -span / 2 + topBarExtension * 0.7;
              
              return (
                <mesh
                  key={`top-left-${i}`}
                  geometry={topBarGeometry}
                  material={mainBarMaterial}
                  position={[xPosition, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          <group name="top-support-bars-right">
            {Array.from({ length: numMainBars }).map((_, i) => {
              const z = -width / 2 + i * mainBarSpacing;
              const y = slabDepth / 2 - cover - mainBarDiameter / 2;
              
              const isAlternate = i % 2 === 0;
              const xPosition = isAlternate 
                ? span / 2 - topBarExtension 
                : span / 2 - topBarExtension * 0.7;
              
              return (
                <mesh
                  key={`top-right-${i}`}
                  geometry={topBarGeometry}
                  material={mainBarMaterial}
                  position={[xPosition, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Distribution Bars */}
          <group name="distribution-bars-bottom">
            {Array.from({ length: numDistBars }).map((_, i) => {
              const x = -span / 2 + i * distBarSpacing;
              const y = -slabDepth / 2 + cover + mainBarDiameter + distBarDiameter / 2;
              
              return (
                <mesh
                  key={`dist-bottom-${i}`}
                  geometry={distBarGeometry}
                  material={distBarMaterial}
                  position={[x, y, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Dimension indicators would be added here */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MS2: EXTERNAL RESTRAINED SUPPORTS
// ============================================================================

/**
 * MS2: External Restrained Supports - Details A, B, C
 * Shows connection details at restrained edges:
 * - Detail A: Standard U-bar connection
 * - Detail B: Connection with bearing stress consideration
 * - Detail C: Non-standard bend radius
 * 
 * @param {Object} props
 * @param {string} props.detailType - 'A', 'B', or 'C' (default: 'A')
 */
export function DrawSlabMS2({
  span = 6.0,
  slabDepth = 0.225,
  width = 4.0,
  supportWidth = 0.300,
  cover = 0.025,
  mainBarDiameter = 0.012,
  mainBarSpacing = 0.200,
  detailType = 'A', // 'A', 'B', or 'C'
  colors = {
    concrete: '#a8a8a8',
    mainRebar: '#cc3333',
    support: '#666666',
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4
}) {

  const numMainBars = Math.floor(width / mainBarSpacing) + 1;
  const uBarSpacing = mainBarSpacing * 2; // U-bars at alternate positions
  const numUBars = Math.floor(numMainBars / 2);

  // Tension anchorage length (per BS EN 1992)
  const tensionAnchorage = mainBarDiameter * 36; // Simplified for C30/37
  const uBarLegLength = Math.max(tensionAnchorage, 0.5);

  // Concrete geometry
  const slabGeometry = useMemo(
    () => new THREE.BoxGeometry(span, slabDepth, width),
    [span, slabDepth, width]
  );

  const supportGeometry = useMemo(
    () => new THREE.BoxGeometry(supportWidth, 0.5, width),
    [supportWidth, width]
  );

  const concreteMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.concrete,
      transparent: true,
      opacity: opacity,
      wireframe: wireframe
    }),
    [colors.concrete, opacity, wireframe]
  );

  const supportMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.support,
      transparent: true,
      opacity: 0.6
    }),
    [colors.support]
  );

  const barMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.mainRebar,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.mainRebar, wireframe]
  );

  // Create U-bar geometry based on detail type
  const createUBarPath = (legLength, type) => {
    const path = new THREE.CurvePath();
    const bendRadius = type === 'C' ? mainBarDiameter * 5 : mainBarDiameter * 2;

    // Bottom horizontal section
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(-legLength / 2, 0, 0),
      new THREE.Vector3(-bendRadius, 0, 0)
    ));

    // Left bend (90 degrees)
    const leftArc = new THREE.ArcCurve(
      -bendRadius, bendRadius,
      bendRadius,
      Math.PI, Math.PI / 2,
      true
    );
    const leftArcPoints = leftArc.getPoints(12);
    const leftArc3D = leftArcPoints.map(p => new THREE.Vector3(p.x, p.y, 0));
    for (let i = 0; i < leftArc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(leftArc3D[i], leftArc3D[i + 1]));
    }

    // Vertical section
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(-bendRadius * 2, bendRadius, 0),
      new THREE.Vector3(-bendRadius * 2, slabDepth - bendRadius - cover * 2, 0)
    ));

    return path;
  };

  return (
    <group name="MS2-Slab-External-Support">
      {/* Slab */}
      {showConcrete && (
        <mesh
          geometry={slabGeometry}
          material={concreteMaterial}
          position={[0, 0, 0]}
        />
      )}

      {/* Support/Wall */}
      {showConcrete && (
        <>
          <mesh
            geometry={supportGeometry}
            material={supportMaterial}
            position={[-span / 2 - supportWidth / 2, -slabDepth / 2 - 0.25, 0]}
          />
          <mesh
            geometry={supportGeometry}
            material={supportMaterial}
            position={[span / 2 + supportWidth / 2, -slabDepth / 2 - 0.25, 0]}
          />
        </>
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Bottom main bars */}
          {Array.from({ length: numMainBars }).map((_, i) => {
            const z = -width / 2 + i * mainBarSpacing;
            const y = -slabDepth / 2 + cover + mainBarDiameter / 2;
            
            const barGeometry = new THREE.CylinderGeometry(
              mainBarDiameter / 2,
              mainBarDiameter / 2,
              span,
              16
            );

            return (
              <mesh
                key={`main-bar-${i}`}
                geometry={barGeometry}
                material={barMaterial}
                position={[0, y, z]}
                rotation={[0, 0, Math.PI / 2]}
              />
            );
          })}

          {/* U-bars at supports - Detail specific */}
          {['left', 'right'].map((side) => (
            <group key={`u-bars-${side}`} name={`u-bars-${side}`}>
              {Array.from({ length: numUBars }).map((_, i) => {
                const z = -width / 2 + i * uBarSpacing;
                const xPos = side === 'left' ? -span / 2 + uBarLegLength / 2 : span / 2 - uBarLegLength / 2;
                
                const uBarPath = createUBarPath(uBarLegLength, detailType);
                const uBarGeometry = new THREE.TubeGeometry(
                  uBarPath,
                  64,
                  mainBarDiameter / 2,
                  8,
                  false
                );

                const rotationY = side === 'right' ? Math.PI : 0;

                return (
                  <mesh
                    key={`u-bar-${side}-${i}`}
                    geometry={uBarGeometry}
                    material={barMaterial}
                    position={[xPos, -slabDepth / 2 + cover, z]}
                    rotation={[0, rotationY, 0]}
                  />
                );
              })}
            </group>
          ))}

          {/* Top bars at edge */}
          {Array.from({ length: numMainBars }).map((_, i) => {
            const z = -width / 2 + i * mainBarSpacing;
            const y = slabDepth / 2 - cover - mainBarDiameter / 2;
            const topBarLength = 0.3 * span;
            
            const topBarGeometry = new THREE.CylinderGeometry(
              mainBarDiameter / 2,
              mainBarDiameter / 2,
              topBarLength,
              16
            );

            return (
              <React.Fragment key={`top-edge-${i}`}>
                <mesh
                  geometry={topBarGeometry}
                  material={barMaterial}
                  position={[-span / 2 + topBarLength / 2, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
                <mesh
                  geometry={topBarGeometry}
                  material={barMaterial}
                  position={[span / 2 - topBarLength / 2, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              </React.Fragment>
            );
          })}
        </group>
      )}

      {/* Labels for Detail Type */}
      {showLabels && (
        <group name="labels">
          {/* Add text labels here */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MS3: EXTERNAL UNRESTRAINED SUPPORTS  
// ============================================================================

/**
 * MS3: External Unrestrained Supports - Details A, B, C
 * Shows simply supported edge details:
 * - Detail A: Standard for slab depth ≥ 150mm
 * - Detail B: For slab depth < 150mm with support width < 200mm
 * - Detail C: For slab depth < 150mm with support width ≥ 200mm
 */
export function DrawSlabMS3({
  span = 6.0,
  slabDepth = 0.200,
  width = 4.0,
  supportWidth = 0.250,
  cover = 0.025,
  mainBarDiameter = 0.012,
  mainBarSpacing = 0.200,
  detailType = 'A', // 'A', 'B', or 'C'
  colors = {
    concrete: '#a8a8a8',
    mainRebar: '#cc3333',
    support: '#8B4513',
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4
}) {

  const numMainBars = Math.floor(width / mainBarSpacing) + 1;
  const effectiveDepth = slabDepth - cover - mainBarDiameter / 2;
  
  // Anchorage requirements per MS3
  const minAnchorage = Math.max(
    effectiveDepth,
    0.3 * mainBarDiameter * 36, // 0.3 x l_b,rqd
    mainBarDiameter * 10,
    0.100
  );

  // Determine if bobbed bars are needed
  const needBobs = detailType === 'A' && slabDepth >= 0.150;
  const bobLength = needBobs ? mainBarDiameter * 10 : 0;

  const slabGeometry = useMemo(
    () => new THREE.BoxGeometry(span, slabDepth, width),
    [span, slabDepth, width]
  );

  const supportGeometry = useMemo(
    () => new THREE.BoxGeometry(supportWidth, 0.3, width),
    [supportWidth, width]
  );

  const concreteMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.concrete,
      transparent: true,
      opacity: opacity,
      wireframe: wireframe
    }),
    [colors.concrete, opacity, wireframe]
  );

  const supportMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.support,
      opacity: 0.7,
      transparent: true
    }),
    [colors.support]
  );

  const barMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.mainRebar,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.mainRebar, wireframe]
  );

  // Create bobbed bar end geometry
  const createBobbedBarPath = () => {
    const path = new THREE.CurvePath();
    const horizontalLength = minAnchorage - bobLength;
    
    // Horizontal section
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(horizontalLength, 0, 0)
    ));

    // 90 degree bend
    const bendRadius = mainBarDiameter * 2;
    const arc = new THREE.ArcCurve(
      horizontalLength + bendRadius, bendRadius,
      bendRadius,
      -Math.PI / 2, 0,
      false
    );
    const arcPoints = arc.getPoints(12);
    const arc3D = arcPoints.map(p => new THREE.Vector3(p.x, p.y, 0));
    for (let i = 0; i < arc3D.length - 1; i++) {
      path.add(new THREE.LineCurve3(arc3D[i], arc3D[i + 1]));
    }

    // Vertical bob
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(horizontalLength + bendRadius * 2, bendRadius, 0),
      new THREE.Vector3(horizontalLength + bendRadius * 2, bendRadius + bobLength, 0)
    ));

    return path;
  };

  return (
    <group name="MS3-Slab-Unrestrained-Support">
      {/* Slab */}
      {showConcrete && (
        <mesh
          geometry={slabGeometry}
          material={concreteMaterial}
          position={[0, 0, 0]}
        />
      )}

      {/* Supports (e.g., brick/block wall) */}
      {showConcrete && (
        <>
          <mesh
            geometry={supportGeometry}
            material={supportMaterial}
            position={[-span / 2 - supportWidth / 2, -slabDepth / 2 - 0.15, 0]}
          />
          <mesh
            geometry={supportGeometry}
            material={supportMaterial}
            position={[span / 2 + supportWidth / 2, -slabDepth / 2 - 0.15, 0]}
          />
        </>
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Main bottom bars with end details */}
          {Array.from({ length: numMainBars }).map((_, i) => {
            const z = -width / 2 + i * mainBarSpacing;
            const y = -slabDepth / 2 + cover + mainBarDiameter / 2;

            if (needBobs && detailType === 'A') {
              // Bobbed bars for Detail A
              const bobbedPath = createBobbedBarPath();
              const bobbedGeometry = new THREE.TubeGeometry(
                bobbedPath,
                64,
                mainBarDiameter / 2,
                8,
                false
              );

              const centralBarGeometry = new THREE.CylinderGeometry(
                mainBarDiameter / 2,
                mainBarDiameter / 2,
                span - 2 * minAnchorage,
                16
              );

              return (
                <group key={`bar-group-${i}`}>
                  {/* Central straight section */}
                  <mesh
                    geometry={centralBarGeometry}
                    material={barMaterial}
                    position={[0, y, z]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                  {/* Left bobbed end */}
                  <mesh
                    geometry={bobbedGeometry}
                    material={barMaterial}
                    position={[-span / 2, y, z]}
                    rotation={[0, 0, 0]}
                  />
                  {/* Right bobbed end */}
                  <mesh
                    geometry={bobbedGeometry}
                    material={barMaterial}
                    position={[span / 2, y, z]}
                    rotation={[0, Math.PI, 0]}
                  />
                </group>
              );
            } else {
              // Straight bars for Details B and C
              const straightBarGeometry = new THREE.CylinderGeometry(
                mainBarDiameter / 2,
                mainBarDiameter / 2,
                span,
                16
              );

              return (
                <mesh
                  key={`bar-straight-${i}`}
                  geometry={straightBarGeometry}
                  material={barMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            }
          })}

          {/* End U-bars for thin slabs (Details B & C) */}
          {(detailType === 'B' || detailType === 'C') && slabDepth < 0.150 && (
            <>
              {['left', 'right'].map((side) => (
                Array.from({ length: Math.floor(numMainBars / 2) }).map((_, i) => {
                  const z = -width / 2 + i * mainBarSpacing * 2;
                  const xBase = side === 'left' ? -span / 2 : span / 2;
                  
                  // Simple U-bar path
                  const uPath = new THREE.CurvePath();
                  const uWidth = slabDepth * 0.8;
                  const uHeight = slabDepth - cover * 2;

                  uPath.add(new THREE.LineCurve3(
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(0, uHeight, 0)
                  ));
                  uPath.add(new THREE.LineCurve3(
                    new THREE.Vector3(0, uHeight, 0),
                    new THREE.Vector3(uWidth, uHeight, 0)
                  ));
                  uPath.add(new THREE.LineCurve3(
                    new THREE.Vector3(uWidth, uHeight, 0),
                    new THREE.Vector3(uWidth, 0, 0)
                  ));

                  const uGeometry = new THREE.TubeGeometry(
                    uPath,
                    32,
                    mainBarDiameter / 2,
                    8,
                    false
                  );

                  const rotation = side === 'right' ? Math.PI : 0;

                  return (
                    <mesh
                      key={`u-bar-${side}-${i}`}
                      geometry={uGeometry}
                      material={barMaterial}
                      position={[xBase, -slabDepth / 2 + cover, z]}
                      rotation={[0, rotation, 0]}
                    />
                  );
                })
              ))}
            </>
          )}
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Detail type indicator */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MS4: CANTILEVER SLABS
// ============================================================================

/**
 * MS4: Cantilever Slabs
 * Shows cantilever reinforcement with:
 * - Top bars extending 2 x cantilever length
 * - Bottom bars at least 0.5 x area of top reinforcement
 * - Alternating stagger of top bars
 */
export function DrawSlabMS4({
  cantileverLength = 2.0,
  backspan = 3.0,
  slabDepth = 0.225,
  width = 4.0,
  cover = 0.025,
  topBarDiameter = 0.016,
  topBarSpacing = 0.150,
  bottomBarDiameter = 0.012,
  bottomBarSpacing = 0.200,
  colors = {
    concrete: '#a8a8a8',
    mainRebar: '#cc3333',
    distributionBars: '#cc8833',
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4
}) {

  const totalLength = cantileverLength + backspan;
  const numTopBars = Math.floor(width / topBarSpacing) + 1;
  const numBottomBars = Math.floor(width / bottomBarSpacing) + 1;

  // Top bars extend minimum 2 x cantilever length
  const topBarLength = Math.max(2 * cantileverLength, backspan);
  const tensionLap = topBarDiameter * 42; // Simplified

  const slabGeometry = useMemo(
    () => new THREE.BoxGeometry(totalLength, slabDepth, width),
    [totalLength, slabDepth, width]
  );

  const concreteMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.concrete,
      transparent: true,
      opacity: opacity,
      wireframe: wireframe
    }),
    [colors.concrete, opacity, wireframe]
  );

  const topBarMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.mainRebar,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.mainRebar, wireframe]
  );

  const bottomBarMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.distributionBars,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.distributionBars, wireframe]
  );

  return (
    <group name="MS4-Cantilever-Slab">
      {/* Concrete Slab */}
      {showConcrete && (
        <mesh
          geometry={slabGeometry}
          material={concreteMaterial}
          position={[backspan / 2 - cantileverLength / 2, 0, 0]}
        />
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Top Cantilever Bars - Main reinforcement */}
          <group name="top-cantilever-bars">
            {Array.from({ length: numTopBars }).map((_, i) => {
              const z = -width / 2 + i * topBarSpacing;
              const y = slabDepth / 2 - cover - topBarDiameter / 2;
              
              // Alternating stagger per MS4
              const isAlternate = i % 2 === 0;
              const barLength = isAlternate ? topBarLength : topBarLength * 0.85;
              const xPosition = cantileverLength - barLength / 2;

              const topBarGeometry = new THREE.CylinderGeometry(
                topBarDiameter / 2,
                topBarDiameter / 2,
                barLength,
                16
              );

              return (
                <mesh
                  key={`top-cant-${i}`}
                  geometry={topBarGeometry}
                  material={topBarMaterial}
                  position={[xPosition, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Bottom Bars - Minimum 50% of top reinforcement area */}
          <group name="bottom-bars">
            {Array.from({ length: numBottomBars }).map((_, i) => {
              const z = -width / 2 + i * bottomBarSpacing;
              const y = -slabDepth / 2 + cover + bottomBarDiameter / 2;
              const bottomBarLength = Math.min(cantileverLength * 0.5, backspan * 0.3);

              const bottomBarGeometry = new THREE.CylinderGeometry(
                bottomBarDiameter / 2,
                bottomBarDiameter / 2,
                bottomBarLength,
                16
              );

              return (
                <mesh
                  key={`bottom-cant-${i}`}
                  geometry={bottomBarGeometry}
                  material={bottomBarMaterial}
                  position={[cantileverLength - bottomBarLength / 2, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* U-bars to ensure lever arm retained */}
          <group name="u-bars">
            {Array.from({ length: Math.floor(numTopBars / 3) }).map((_, i) => {
              const z = -width / 2 + i * topBarSpacing * 3;
              const uHeight = slabDepth - cover * 2 - topBarDiameter;
              const uWidth = 0.3; // 300mm minimum

              const uPath = new THREE.CurvePath();
              uPath.add(new THREE.LineCurve3(
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, -uHeight, 0)
              ));
              uPath.add(new THREE.LineCurve3(
                new THREE.Vector3(0, -uHeight, 0),
                new THREE.Vector3(uWidth, -uHeight, 0)
              ));
              uPath.add(new THREE.LineCurve3(
                new THREE.Vector3(uWidth, -uHeight, 0),
                new THREE.Vector3(uWidth, 0, 0)
              ));

              const uGeometry = new THREE.TubeGeometry(
                uPath,
                32,
                topBarDiameter / 2,
                8,
                false
              );

              return (
                <mesh
                  key={`u-bar-${i}`}
                  geometry={uGeometry}
                  material={topBarMaterial}
                  position={[cantileverLength - 0.5 * tensionLap, slabDepth / 2 - cover, z]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Cantilever length indicator */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MS5: FLAT SLABS - SPAN AND INTERNAL SUPPORT
// ============================================================================

/**
 * MS5: Flat Slabs
 * Shows flat slab reinforcement with:
 * - Column strips (60% of reinforcement)
 * - Middle strips (40% of reinforcement)
 * - Distribution bars
 * - Two bottom bars passing through column
 */
export function DrawSlabMS5({
  spanX = 6.0,
  spanY = 6.0,
  slabDepth = 0.250,
  columnWidth = 0.4,
  cover = 0.025,
  columnStripBarDiameter = 0.016,
  columnStripBarSpacing = 0.150,
  middleStripBarSpacing = 0.250,
  colors = {
    concrete: '#a8a8a8',
    mainRebar: '#cc3333',
    distributionBars: '#cc8833',
    column: '#666666',
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4
}) {

  // Column strip width = half of shorter span dimension
  const columnStripWidth = Math.min(spanX, spanY) / 2;
  const middleStripWidth = (Math.max(spanX, spanY) - columnStripWidth) / 2;

  // Number of bars in each zone
  const numColumnStripBars = Math.floor(columnStripWidth / columnStripBarSpacing) + 1;
  const numMiddleStripBars = Math.floor(middleStripWidth / middleStripBarSpacing) + 1;

  const slabGeometry = useMemo(
    () => new THREE.BoxGeometry(spanX, slabDepth, spanY),
    [spanX, slabDepth, spanY]
  );

  const columnGeometry = useMemo(
    () => new THREE.BoxGeometry(columnWidth, 1.0, columnWidth),
    [columnWidth]
  );

  const concreteMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.concrete,
      transparent: true,
      opacity: opacity,
      wireframe: wireframe
    }),
    [colors.concrete, opacity, wireframe]
  );

  const columnMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.column,
      transparent: true,
      opacity: 0.6
    }),
    [colors.column]
  );

  const barMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.mainRebar,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.mainRebar, wireframe]
  );

  const distBarMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.distributionBars,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.distributionBars, wireframe]
  );

  return (
    <group name="MS5-Flat-Slab">
      {/* Concrete Slab */}
      {showConcrete && (
        <mesh
          geometry={slabGeometry}
          material={concreteMaterial}
          position={[0, 0, 0]}
        />
      )}

      {/* Columns at corners */}
      {showConcrete && (
        <>
          <mesh
            geometry={columnGeometry}
            material={columnMaterial}
            position={[-spanX / 4, -slabDepth / 2 - 0.5, -spanY / 4]}
          />
          <mesh
            geometry={columnGeometry}
            material={columnMaterial}
            position={[spanX / 4, -slabDepth / 2 - 0.5, -spanY / 4]}
          />
          <mesh
            geometry={columnGeometry}
            material={columnMaterial}
            position={[-spanX / 4, -slabDepth / 2 - 0.5, spanY / 4]}
          />
          <mesh
            geometry={columnGeometry}
            material={columnMaterial}
            position={[spanX / 4, -slabDepth / 2 - 0.5, spanY / 4]}
          />
        </>
      )}

      {/* Reinforcement */}
      {showRebar && (
        <group name="reinforcement">
          {/* Top Column Strip Bars - 75% of support moment */}
          <group name="top-column-strip">
            {[-spanX / 4, spanX / 4].map((colX) => (
              Array.from({ length: numColumnStripBars }).map((_, i) => {
                const z = -columnStripWidth / 2 + i * columnStripBarSpacing;
                const y = slabDepth / 2 - cover - columnStripBarDiameter / 2;
                const barLength = spanX * 0.25; // Extends 0.3L from support face

                const barGeometry = new THREE.CylinderGeometry(
                  columnStripBarDiameter / 2,
                  columnStripBarDiameter / 2,
                  barLength,
                  16
                );

                return (
                  <mesh
                    key={`top-col-${colX}-${i}`}
                    geometry={barGeometry}
                    material={barMaterial}
                    position={[colX, y, z]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                );
              })
            ))}
          </group>

          {/* Bottom Column Strip Bars - 55% of span moment */}
          <group name="bottom-column-strip">
            {Array.from({ length: numColumnStripBars }).map((_, i) => {
              const z = -columnStripWidth / 2 + i * columnStripBarSpacing;
              const y = -slabDepth / 2 + cover + columnStripBarDiameter / 2;
              const barLength = spanX * 0.6; // Central region

              const barGeometry = new THREE.CylinderGeometry(
                columnStripBarDiameter / 2,
                columnStripBarDiameter / 2,
                barLength,
                16
              );

              return (
                <mesh
                  key={`bottom-col-${i}`}
                  geometry={barGeometry}
                  material={barMaterial}
                  position={[0, y, z]}
                  rotation={[0, 0, Math.PI / 2]}
                />
              );
            })}
          </group>

          {/* Two bars passing through column (minimum requirement) */}
          <group name="column-pass-through-bars">
            {[-spanX / 4, spanX / 4].map((colX) => (
              [-columnWidth / 4, columnWidth / 4].map((offset, idx) => {
                const barGeometry = new THREE.CylinderGeometry(
                  columnStripBarDiameter / 2,
                  columnStripBarDiameter / 2,
                  spanY,
                  16
                );

                return (
                  <mesh
                    key={`pass-through-${colX}-${idx}`}
                    geometry={barGeometry}
                    material={barMaterial}
                    position={[colX + offset, -slabDepth / 2 + cover + columnStripBarDiameter / 2, 0]}
                    rotation={[Math.PI / 2, 0, 0]}
                  />
                );
              })
            ))}
          </group>

          {/* Middle Strip Bars - Reduced spacing */}
          <group name="middle-strip-bars">
            {Array.from({ length: numMiddleStripBars }).map((_, i) => {
              const z = columnStripWidth / 2 + i * middleStripBarSpacing;
              const y = -slabDepth / 2 + cover + columnStripBarDiameter / 2;

              const barGeometry = new THREE.CylinderGeometry(
                columnStripBarDiameter / 2,
                columnStripBarDiameter / 2,
                spanX * 0.5,
                16
              );

              return (
                <React.Fragment key={`middle-${i}`}>
                  <mesh
                    geometry={barGeometry}
                    material={distBarMaterial}
                    position={[0, y, z]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                  <mesh
                    geometry={barGeometry}
                    material={distBarMaterial}
                    position={[0, y, -z]}
                    rotation={[0, 0, Math.PI / 2]}
                  />
                </React.Fragment>
              );
            })}
          </group>

          {/* Distribution Bars - 0.6 x span length */}
          <group name="distribution-bars">
            {Array.from({ length: Math.floor(spanX / 0.3) }).map((_, i) => {
              const x = -spanX / 2 + i * 0.3;
              const y = -slabDepth / 2 + cover + columnStripBarDiameter * 1.5;
              const distLength = spanY * 0.6;

              const distGeometry = new THREE.CylinderGeometry(
                columnStripBarDiameter * 0.8 / 2,
                columnStripBarDiameter * 0.8 / 2,
                distLength,
                16
              );

              return (
                <mesh
                  key={`dist-${i}`}
                  geometry={distGeometry}
                  material={distBarMaterial}
                  position={[x, y, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Column strip and middle strip indicators */}
        </group>
      )}
    </group>
  );
}

// ============================================================================
// MS6: FLAT SLABS - SHEAR REINFORCEMENT
// ============================================================================

/**
 * MS6: Flat Slabs - Shear Reinforcement
 * Shows punching shear reinforcement around columns:
 * - Links on rectangular perimeters
 * - Spacing requirements (0.75d, 1.5d)
 * - Hanger bars to locate links
 */
export function DrawSlabMS6({
  slabDepth = 0.300,
  columnWidth = 0.400,
  cover = 0.030,
  linkDiameter = 0.010,
  linkSpacing = 0.225, // 0.75d typically
  hangerBarDiameter = 0.012,
  perimeters = 3, // Number of link perimeters
  colors = {
    concrete: '#a8a8a8',
    links: '#3366cc',
    hangerBars: '#cc8833',
    column: '#666666',
  },
  showConcrete = true,
  showRebar = true,
  showLabels = true,
  wireframe = false,
  opacity = 0.4
}) {

  const effectiveDepth = slabDepth - cover - 0.020; // Approximate
  const firstPerimeterDistance = 2 * effectiveDepth; // 2d from column face

  const slabSize = columnWidth + firstPerimeterDistance * 2 + linkSpacing * perimeters * 2 + 1.0;

  const slabGeometry = useMemo(
    () => new THREE.BoxGeometry(slabSize, slabDepth, slabSize),
    [slabSize, slabDepth]
  );

  const columnGeometry = useMemo(
    () => new THREE.BoxGeometry(columnWidth, 1.0, columnWidth),
    [columnWidth]
  );

  const concreteMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.concrete,
      transparent: true,
      opacity: opacity,
      wireframe: wireframe
    }),
    [colors.concrete, opacity, wireframe]
  );

  const columnMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.column,
      transparent: true,
      opacity: 0.6
    }),
    [colors.column]
  );

  const linkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.links,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.links, wireframe]
  );

  const hangerMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: colors.hangerBars,
      metalness: 0.7,
      roughness: 0.3,
      wireframe: wireframe
    }),
    [colors.hangerBars, wireframe]
  );

  // Create rectangular link perimeter
  const createLinkPerimeter = (perimeterSize) => {
    const path = new THREE.CurvePath();
    const hw = perimeterSize / 2;
    const hh = perimeterSize / 2;

    const points = [
      new THREE.Vector3(-hw, 0, -hh),
      new THREE.Vector3(hw, 0, -hh),
      new THREE.Vector3(hw, 0, hh),
      new THREE.Vector3(-hw, 0, hh),
      new THREE.Vector3(-hw, 0, -hh),
    ];

    for (let i = 0; i < points.length - 1; i++) {
      path.add(new THREE.LineCurve3(points[i], points[i + 1]));
    }

    return path;
  };

  // Create vertical link
  const createVerticalLink = (height) => {
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(0, -height / 2, 0),
      new THREE.Vector3(0, height / 2, 0)
    ));
    return path;
  };

  return (
    <group name="MS6-Flat-Slab-Shear-Reinforcement">
      {/* Concrete Slab */}
      {showConcrete && (
        <mesh
          geometry={slabGeometry}
          material={concreteMaterial}
          position={[0, 0, 0]}
        />
      )}

      {/* Column */}
      {showConcrete && (
        <mesh
          geometry={columnGeometry}
          material={columnMaterial}
          position={[0, -slabDepth / 2 - 0.5, 0]}
        />
      )}

      {/* Shear Reinforcement */}
      {showRebar && (
        <group name="shear-reinforcement">
          {/* Link Perimeters */}
          {Array.from({ length: perimeters }).map((_, perimeterIdx) => {
            const distance = firstPerimeterDistance + perimeterIdx * linkSpacing;
            const perimeterSize = columnWidth + 2 * distance;
            const numLinksPerSide = Math.floor(perimeterSize / (effectiveDepth * 1.5)) + 1;

            const perimeterPath = createLinkPerimeter(perimeterSize);
            const perimeterPoints = perimeterPath.getPoints(numLinksPerSide * 4);

            return (
              <group key={`perimeter-${perimeterIdx}`} name={`perimeter-${perimeterIdx + 1}`}>
                {/* Perimeter outline */}
                <lineSegments>
                  <bufferGeometry attach="geometry">
                    <bufferAttribute
                      attach="attributes-position"
                      count={perimeterPoints.length}
                      array={new Float32Array(perimeterPoints.flatMap(p => [p.x, p.y, p.z]))}
                      itemSize={3}
                    />
                  </bufferGeometry>
                  <lineBasicMaterial attach="material" color={colors.links} opacity={0.3} transparent />
                </lineSegments>

                {/* Vertical links at intervals */}
                {perimeterPoints.filter((_, idx) => idx % Math.floor(numLinksPerSide) === 0).map((point, linkIdx) => {
                  const verticalLinkPath = createVerticalLink(slabDepth - 2 * cover);
                  const verticalLinkGeometry = new THREE.TubeGeometry(
                    verticalLinkPath,
                    8,
                    linkDiameter / 2,
                    8,
                    false
                  );

                  return (
                    <mesh
                      key={`vlink-${perimeterIdx}-${linkIdx}`}
                      geometry={verticalLinkGeometry}
                      material={linkMaterial}
                      position={[point.x, 0, point.z]}
                    />
                  );
                })}
              </group>
            );
          })}

          {/* Hanger Bars - 12mm fixing bars */}
          <group name="hanger-bars">
            {[...Array(4)].map((_, i) => {
              const angle = (i * Math.PI) / 2;
              const radius = columnWidth / 2 + firstPerimeterDistance + (perimeters - 1) * linkSpacing / 2;
              const x = Math.cos(angle) * radius;
              const z = Math.sin(angle) * radius;
              const hangerLength = perimeters * linkSpacing + linkSpacing;

              const hangerGeometry = new THREE.CylinderGeometry(
                hangerBarDiameter / 2,
                hangerBarDiameter / 2,
                hangerLength,
                16
              );

              const rotationAxis = i % 2 === 0 ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];

              return (
                <mesh
                  key={`hanger-${i}`}
                  geometry={hangerGeometry}
                  material={hangerMaterial}
                  position={[x, slabDepth / 2 - cover - hangerBarDiameter / 2, z]}
                  rotation={rotationAxis}
                />
              );
            })}
          </group>
        </group>
      )}

      {/* Labels */}
      {showLabels && (
        <group name="labels">
          {/* Spacing annotations */}
        </group>
      )}
    </group>
  );
}



