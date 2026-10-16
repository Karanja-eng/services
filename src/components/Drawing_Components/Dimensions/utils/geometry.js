export function distance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angle(p1, p2) {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

export function midpoint(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

export function formatDim(pixels, unit = 'mm', precision = 0) {
  const val = pixels;
  if (unit === 'mm') return `${val.toFixed(precision)}`;
  if (unit === 'm') return `${(val / 1000).toFixed(Math.max(precision, 2))}m`;
  if (unit === 'ft') {
    const totalIn = val / 25.4;
    const ft = Math.floor(totalIn / 12);
    const inches = (totalIn % 12).toFixed(precision);
    return `${ft}'-${inches}"`;
  }
  return `${val.toFixed(precision)}`;
}

export function toPointArray(points) {
  if (!points || points.length === 0) return [];
  if (typeof points[0] === 'number') {
    const arr = [];
    for (let i = 0; i < points.length; i += 2) {
      arr.push({ x: points[i], y: points[i + 1] });
    }
    return arr;
  }
  return points;
}

export function flatPoints(pts) {
  return pts.flatMap(p => [p.x, p.y]);
}

export function computeAlignedDim(p1, p2, offset = 30) {
  const ang = angle(p1, p2);
  const perp = ang + Math.PI / 2;
  return {
    dimLine: {
      start: { x: p1.x + Math.cos(perp) * offset, y: p1.y + Math.sin(perp) * offset },
      end:   { x: p2.x + Math.cos(perp) * offset, y: p2.y + Math.sin(perp) * offset },
    },
    ang,
    perp,
    dist: distance(p1, p2),
  };
}
