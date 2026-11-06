// Turning loose line segments into as few pen strokes as possible.
//
// A stroke can only pass through a vertex by using two of its edges, so every
// vertex with an odd number of edges has to start or end a stroke. Starting
// each walk from an odd vertex therefore reaches the minimum of odd/2 strokes.

/** Key for a point in lattice units, so shared points match exactly. */
export const pointKey = ([x, y]) => `${Math.round(x * 1e6)},${Math.round(y * 1e6)}`;

function buildGraph(segments) {
  const nodes = new Map();
  const seen = new Set();
  const edges = [];
  const node = (key, point) => {
    if (!nodes.has(key)) nodes.set(key, { key, point, edges: [], left: 0 });
    return nodes.get(key);
  };
  for (const { a, b, keyA, keyB } of segments) {
    if (keyA === keyB) continue;
    const id = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const edge = { from: node(keyA, a), to: node(keyB, b), used: false };
    edges.push(edge);
    for (const end of [edge.from, edge.to]) {
      end.edges.push(edge);
      end.left++;
    }
  }
  return { nodes, edges };
}

const unit = (p, q) => {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
};

/** Walk unused edges from a node until stuck, keeping as straight as possible. */
function walk(start) {
  const trail = [start];
  let current = start;
  let heading = null;
  let overall = null;
  for (;;) {
    let best = null;
    let bestScore = -Infinity;
    for (const edge of current.edges) {
      if (edge.used) continue;
      const other = edge.from === current ? edge.to : edge.from;
      const dir = unit(current.point, other.point);
      const straight = heading ? dir[0] * heading[0] + dir[1] * heading[1] : 0;
      const onward = overall ? dir[0] * overall[0] + dir[1] * overall[1] : dir[0];
      const score = straight + 0.01 * onward;
      if (score > bestScore) {
        bestScore = score;
        best = { edge, other, dir };
      }
    }
    if (!best) return trail;
    best.edge.used = true;
    current.left--;
    best.other.left--;
    trail.push(best.other);
    heading = best.dir;
    overall ??= best.dir;
    current = best.other;
  }
}

/** Remove duplicates and chain segments into the fewest strokes. */
export function chainSegments(segments) {
  const { nodes } = buildGraph(segments);
  const ordered = [...nodes.values()].sort(
    (n, m) => n.point[0] - m.point[0] || n.point[1] - m.point[1],
  );
  const trails = [];
  for (const n of ordered) {
    if (n.left % 2 === 1) trails.push(walk(n));
  }
  // Anything left forms closed loops. Splice each into a trail that touches it.
  for (const trail of trails) {
    for (let i = 0; i < trail.length; i++) {
      if (trail[i].left > 0) trail.splice(i, 1, ...walk(trail[i]));
    }
  }
  for (const n of ordered) {
    if (n.left > 0) trails.push(walk(n));
  }
  return trails.map((trail) => trail.map((n) => n.point));
}

/**
 * Order strokes by nearest next start, reversing any that end up closer.
 * Stroke ends sit in a coarse grid, so each search only visits nearby cells.
 */
export function orderStrokes(strokes, start = [0, 0]) {
  if (strokes.length < 2) return strokes.slice();
  const ends = strokes.flatMap((stroke, index) => [
    { index, point: stroke[0], reverse: false },
    { index, point: stroke[stroke.length - 1], reverse: true },
  ]);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { point: [x, y] } of ends) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const cell = Math.max(Math.sqrt((spanX * spanY) / strokes.length), Math.max(spanX, spanY) / 512, 1e-6);
  const columns = Math.floor(spanX / cell) + 1;
  const rows = Math.floor(spanY / cell) + 1;
  const clamp = (value, limit) => Math.min(limit - 1, Math.max(0, value));
  const grid = new Map();
  for (const end of ends) {
    const key = Math.floor((end.point[1] - minY) / cell) * columns + Math.floor((end.point[0] - minX) / cell);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(end);
  }

  const placed = new Array(strokes.length).fill(false);
  const nearest = (at) => {
    const cx = clamp(Math.floor((at[0] - minX) / cell), columns);
    const cy = clamp(Math.floor((at[1] - minY) / cell), rows);
    let best = null;
    let bestDistance = Infinity;
    const visit = (x, y) => {
      for (const end of grid.get(y * columns + x) ?? []) {
        if (placed[end.index]) continue;
        const distance = Math.hypot(end.point[0] - at[0], end.point[1] - at[1]);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = end;
        }
      }
    };
    for (let ring = 0; ring <= Math.max(columns, rows); ring++) {
      if (best && (ring - 1) * cell > bestDistance) break;
      for (let x = cx - ring; x <= cx + ring; x++) {
        if (x < 0 || x >= columns) continue;
        if (cy - ring >= 0) visit(x, cy - ring);
        if (ring > 0 && cy + ring < rows) visit(x, cy + ring);
      }
      for (let y = cy - ring + 1; y <= cy + ring - 1; y++) {
        if (y < 0 || y >= rows) continue;
        if (cx - ring >= 0) visit(cx - ring, y);
        if (cx + ring < columns) visit(cx + ring, y);
      }
    }
    return best;
  };

  const ordered = [];
  let at = start;
  for (let i = 0; i < strokes.length; i++) {
    const end = nearest(at);
    placed[end.index] = true;
    const stroke = strokes[end.index];
    const oriented = end.reverse ? stroke.slice().reverse() : stroke;
    ordered.push(oriented);
    at = oriented[oriented.length - 1];
  }
  return ordered;
}

/** Pen-down length, pen-up travel and stroke count for polylines plotted in order. */
export function measure(polylines, start = [0, 0]) {
  let penDown = 0;
  let penUp = 0;
  let at = start;
  for (const line of polylines) {
    penUp += Math.hypot(line[0][0] - at[0], line[0][1] - at[1]);
    for (let i = 1; i < line.length; i++) {
      penDown += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    }
    at = line[line.length - 1];
  }
  return { strokes: polylines.length, penDown, penUp, end: at };
}
