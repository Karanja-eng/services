import React from 'react';
import { COLORS } from '../utils/constants';
import { distance, toPointArray } from '../utils/geometry';

export function PropertiesPanel({ annotation, updateAnnotation }) {
  if (!annotation) {
    return (
      <div className="border-t border-[#1a1a3a] p-4 text-center">
        <div className="text-[#2a2a4a] text-[8px] uppercase tracking-widest mb-3">Properties</div>
        <div className="text-[#2a2a4a] text-[9px] mb-4">No selection</div>
        <div className="space-y-1 text-[8px] text-[#222240]">
          <div>↖ Click to select</div>
          <div>⌫ Delete selected</div>
          <div>✦ Dbl-click to edit text</div>
          <div>⟳ Scroll to zoom</div>
          <div>ESC cancel / reset tool</div>
        </div>
      </div>
    );
  }

  const pts = toPointArray(annotation.points || []);

  return (
    <div className="border-t border-[#1a1a3a]">
      <div className="px-3 py-1.5 text-[#2a4a6a] text-[8px] tracking-widest uppercase font-bold bg-[#070712]">
        Properties
      </div>
      <div className="p-3 space-y-2 text-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-[#4a4a7a]">Type</span>
          <span className="bg-[#0a1a2a] text-[#4a9eff] px-1.5 py-0.5 rounded text-[8px] font-mono">
            {annotation.type}
          </span>
        </div>

        {pts.length >= 2 && (
          <div className="flex items-center justify-between">
            <span className="text-[#4a4a7a]">Length</span>
            <span className="text-[#6a8ab0] font-mono">
              {Math.round(distance(pts[0], pts[pts.length - 1]))} px
            </span>
          </div>
        )}

        {annotation.text !== undefined && (
          <div className="pt-1 border-t border-[#1a1a2e]">
            <div className="text-[#4a4a7a] mb-1">Text</div>
            <input
              type="text"
              value={annotation.text}
              onChange={e => updateAnnotation(annotation.id, { text: e.target.value })}
              className="w-full bg-[#0f0f20] border border-[#2a2a4a] text-[#6a8ab0] text-[10px] px-2 py-1 rounded outline-none focus:border-[#4a9eff] font-mono"
            />
          </div>
        )}

        {annotation.area !== undefined && (
          <div>
            <div className="text-[#4a4a7a] mb-1">Area (m²)</div>
            <input
              type="number"
              value={annotation.area}
              onChange={e => updateAnnotation(annotation.id, { area: parseFloat(e.target.value) || 0 })}
              className="w-full bg-[#0f0f20] border border-[#2a2a4a] text-[#6a8ab0] text-[10px] px-2 py-1 rounded outline-none focus:border-[#4a9eff] font-mono"
              step="0.01"
            />
          </div>
        )}

        {['linear_dim', 'aligned_dim', 'chain_dim'].includes(annotation.type) && (
          <div className="pt-1 border-t border-[#1a1a2e]">
            <div className="text-[#4a4a7a] mb-1">Dim offset</div>
            <input
              type="number"
              value={annotation.offset || annotation.style?.dimOffset || 30}
              onChange={e => updateAnnotation(annotation.id, { offset: Number(e.target.value) })}
              className="w-full bg-[#0f0f20] border border-[#2a2a4a] text-[#6a8ab0] text-[10px] px-2 py-1 rounded outline-none focus:border-[#4a9eff] font-mono"
              min={10} max={200}
            />
          </div>
        )}

        {annotation.type === 'north_arrow' && (
          <div className="pt-1 border-t border-[#1a1a2e]">
            <div className="flex justify-between text-[#4a4a7a] mb-1">
              <span>Rotation</span>
              <span className="font-mono text-[#6a8ab0]">{annotation.rotation || 0}°</span>
            </div>
            <input
              type="range" min={0} max={360}
              value={annotation.rotation || 0}
              onChange={e => updateAnnotation(annotation.id, { rotation: Number(e.target.value) })}
              className="w-full accent-[#4a9eff]"
            />
          </div>
        )}

        <div className="pt-1 border-t border-[#1a1a2e]">
          <div className="text-[#4a4a7a] mb-1">Color</div>
          <input
            type="color"
            value={annotation.style?.dimColor || annotation.style?.annotationColor || '#4a9eff'}
            onChange={e => updateAnnotation(annotation.id, {
              style: { ...annotation.style, dimColor: e.target.value, annotationColor: e.target.value },
            })}
            className="w-full h-6 rounded cursor-pointer border border-[#2a2a4a] bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}
