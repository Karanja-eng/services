import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useMaterialSlotStore } from '../materials/MaterialSlotSystem.js';
import { getMaterialInstance } from '../hooks/useMaterial.js';

function SlottedMesh({ geometryArgs, position, rotation, elementId, slot, defaultMaterial, onDrop }) {
  const [hovered, setHovered] = useState(false);
  const slotMat = useMaterialSlotStore(s => s.slots[elementId]?.[slot]?.instance);
  useEffect(() => {
    const store = useMaterialSlotStore.getState();
    if (!store.slots[elementId]) store.assignMaterial(elementId, slot, defaultMaterial || 'paint_flat_white');
  }, [elementId, slot, defaultMaterial]);
  const mat = slotMat || getMaterialInstance(defaultMaterial || 'paint_flat_white');
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow material={mat}
      onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}
      onClick={() => onDrop?.(elementId, slot)}>
      <boxGeometry args={geometryArgs} />
      {hovered && <meshBasicMaterial color="#fbbf24" transparent opacity={0.12} depthWrite={false} />}
    </mesh>
  );
}

function Floor({ elementId, onDrop }) {
  const slotMat = useMaterialSlotStore(s => s.slots[elementId]?.surface?.instance);
  const mat = slotMat || getMaterialInstance('concrete_polished');
  useEffect(() => {
    const store = useMaterialSlotStore.getState();
    if (!store.slots[elementId]) store.assignMaterial(elementId,'surface','concrete_polished');
  }, [elementId]);
  return (
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.01,0]} receiveShadow material={mat}
      onClick={()=>onDrop?.(elementId,'surface')}>
      <planeGeometry args={[40,40]} />
    </mesh>
  );
}

export default function DemoScene({ pendingMaterial, onMeshClick }) {
  const apply = (elementId, slot) => {
    if (pendingMaterial) {
      useMaterialSlotStore.getState().assignMaterial(elementId, slot, pendingMaterial.id, pendingMaterial.overrides||{});
    }
    onMeshClick?.({ elementId, slot });
  };
  return (
    <group>
      <Floor elementId="ground" onDrop={apply} />
      <SlottedMesh geometryArgs={[8,6,0.3]}   position={[0,3,-2]}       elementId="wall_rear"      slot="face"    defaultMaterial="concrete_smooth"           onDrop={apply} />
      <SlottedMesh geometryArgs={[0.3,6,5]}   position={[-4,3,0.5]}     elementId="wall_left"      slot="face"    defaultMaterial="concrete_smooth"           onDrop={apply} />
      <SlottedMesh geometryArgs={[0.3,6,5]}   position={[4,3,0.5]}      elementId="wall_right"     slot="face"    defaultMaterial="concrete_smooth"           onDrop={apply} />
      <SlottedMesh geometryArgs={[8.6,0.25,5.6]} position={[0,6.12,0.5]}elementId="roof"           slot="surface" defaultMaterial="concrete_smooth"           onDrop={apply} />
      <SlottedMesh geometryArgs={[2.4,3.5,0.02]} position={[-1.5,2.75,-1.85]} elementId="glazing_left"  slot="surface" defaultMaterial="glass_clear"         onDrop={apply} />
      <SlottedMesh geometryArgs={[2.4,3.5,0.02]} position={[1.5,2.75,-1.85]}  elementId="glazing_right" slot="surface" defaultMaterial="glass_lowe"          onDrop={apply} />
      <SlottedMesh geometryArgs={[5.2,0.12,0.1]} position={[0,4.55,-1.85]}    elementId="wf_top"   slot="surface" defaultMaterial="aluminum_anodized_black"  onDrop={apply} />
      <SlottedMesh geometryArgs={[5.2,0.12,0.1]} position={[0,1.0,-1.85]}     elementId="wf_bot"   slot="surface" defaultMaterial="aluminum_anodized_black"  onDrop={apply} />
      <SlottedMesh geometryArgs={[0.1,3.8,0.1]}  position={[-2.6,2.8,-1.85]}  elementId="wf_l"     slot="surface" defaultMaterial="aluminum_anodized_black"  onDrop={apply} />
      <SlottedMesh geometryArgs={[0.1,3.8,0.1]}  position={[2.6,2.8,-1.85]}   elementId="wf_r"     slot="surface" defaultMaterial="aluminum_anodized_black"  onDrop={apply} />
      <SlottedMesh geometryArgs={[0.1,3.8,0.1]}  position={[0,2.8,-1.85]}     elementId="wf_m"     slot="surface" defaultMaterial="aluminum_anodized_black"  onDrop={apply} />
      <SlottedMesh geometryArgs={[7.6,0.9,0.08]} position={[0,5.65,-1.84]}    elementId="clad_top" slot="surface" defaultMaterial="steel_corten"             onDrop={apply} />
      <SlottedMesh geometryArgs={[7.6,0.8,0.08]} position={[0,0.45,-1.84]}    elementId="clad_bot" slot="surface" defaultMaterial="steel_corten"             onDrop={apply} />
      {[-3,3].map(x=>(
        <SlottedMesh key={x} geometryArgs={[0.25,6,0.25]} position={[x,3,1.5]} elementId={`col_${x}`} slot="surface" defaultMaterial="steel_stainless_brushed" onDrop={apply} />
      ))}
      <SlottedMesh geometryArgs={[6,0.2,1]} position={[0,0.1,1.8]}   elementId="step1"         slot="surface" defaultMaterial="stone_granite"              onDrop={apply} />
      <SlottedMesh geometryArgs={[6,0.2,1]} position={[0,0.3,2.6]}   elementId="step2"         slot="surface" defaultMaterial="stone_granite"              onDrop={apply} />
      <SlottedMesh geometryArgs={[2,5.8,0.3]} position={[-4,2.9,-0.5]} rotation={[0,Math.PI/8,0]} elementId="feature_brick" slot="surface" defaultMaterial="brick_clay_red" onDrop={apply} />
    </group>
  );
}
