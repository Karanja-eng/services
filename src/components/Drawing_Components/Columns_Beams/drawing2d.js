// Utility functions for 2D Konva plan drawing

// Convert world metres to canvas pixels
export const toPixels = (metres, scale) => metres * scale

// Column cross-section hatch pattern IDs
export const HATCH_PATTERNS = {
  rc:        'hatch-rc',
  solid:     'hatch-solid',
  wood:      'hatch-wood',
  composite: 'hatch-composite',
}

// Build a path string for Konva.Line for dimension arrows
export function dimensionLine(x1, y1, x2, y2, offset = 20) {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const nx = -dy / len, ny = dx / len
  const ox = nx * offset, oy = ny * offset
  return {
    linePoints: [x1 + ox, y1 + oy, x2 + ox, y2 + oy],
    tickLeft:   [x1, y1, x1 + ox, y1 + oy],
    tickRight:  [x2, y2, x2 + ox, y2 + oy],
    midX: (x1 + x2) / 2 + ox,
    midY: (y1 + y2) / 2 + oy,
  }
}

// Column plan shape points (rect, I, L, T, hollow)
export function columnPlanPoints(type, props, scale) {
  const s = (v) => toPixels(v, scale)
  switch (type) {
    case 'rectangular_rc':
    case 'timber':
    case 'composite': {
      const w = s(props.width || props.outerD || 0.4)
      const d = s(props.depth || props.outerD || 0.4)
      return { shape: 'rect', x: -w/2, y: -d/2, width: w, height: d }
    }
    case 'circular_rc': {
      const r = s((props.diameter || 0.5) / 2)
      return { shape: 'circle', radius: r }
    }
    case 'steel_i': {
      const H = s(props.H || 0.3), B = s(props.B || 0.15)
      const tw = s(props.tw || 0.01), tf = s(props.tf || 0.015)
      return {
        shape: 'polygon',
        points: [
          -B/2, -H/2,  B/2, -H/2,  B/2, -H/2+tf,  tw/2, -H/2+tf,
           tw/2,  H/2-tf,  B/2,  H/2-tf,  B/2,  H/2,
          -B/2,  H/2, -B/2,  H/2-tf, -tw/2,  H/2-tf,
          -tw/2, -H/2+tf, -B/2, -H/2+tf,
        ]
      }
    }
    case 'l_shaped': {
      const b1=s(props.b1||0.4), d1=s(props.d1||0.6)
      const b2=s(props.b2||0.6), d2=s(props.d2||0.15)
      return {
        shape: 'polygon',
        points: [0,0, b2,0, b2,d2, b1,d2, b1,d1, 0,d1]
      }
    }
    case 't_shaped': {
      const bw=s(props.bw||0.4), h=s(props.h||0.6)
      const bf=s(props.bf||0.8), tf=s(props.tf||0.15)
      return {
        shape: 'polygon',
        points: [
          -bw/2,0, bw/2,0, bw/2,h-tf, bf/2,h-tf,
          bf/2,h, -bf/2,h, -bf/2,h-tf, -bw/2,h-tf
        ]
      }
    }
    case 'steel_hollow': {
      const B = s(props.B || 0.2), D = s(props.D || 0.2), t = s(props.t || 0.01)
      return { shape: 'hollow_rect', outer: {x:-B/2,y:-D/2,w:B,h:D}, inner: {x:-B/2+t,y:-D/2+t,w:B-2*t,h:D-2*t} }
    }
    case 'classical': {
      const r = s((props.baseDia || 0.7) / 2)
      return { shape: 'circle', radius: r }
    }
    default: {
      const w = s(0.4), d = s(0.4)
      return { shape: 'rect', x: -w/2, y: -d/2, width: w, height: d }
    }
  }
}

// Beam plan dashed rect (beam width centered on line between two points)
export function beamPlanRect(x1, y1, x2, y2, beamWidth, scale) {
  const bw = toPixels(beamWidth, scale)
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx*dx+dy*dy)
  const nx = -dy/len, ny = dx/len
  return [
    x1 + nx*bw/2, y1 + ny*bw/2,
    x2 + nx*bw/2, y2 + ny*bw/2,
    x2 - nx*bw/2, y2 - ny*bw/2,
    x1 - nx*bw/2, y1 - ny*bw/2,
  ]
}

// Grid label (letter rows, number cols)
export const gridLetter = (i) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i] || `${i}`
export const gridNumber = (i) => `${i + 1}`