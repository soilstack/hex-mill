// Lattice geometry.
//
// Everything is computed on a flat-top grid in integer lattice units: x in
// steps of s/2 and y in steps of f/2. A hex centred at the origin has corners
// (±2, 0) and (±1, ±1). Every lattice vertex, and every point where a map edge
// cuts a hex at i = 0, is then an integer, so shared edges match exactly.
//
// Pointy-top layouts are the same grid with x and y swapped. Internally `a`
// indexes the staggered lines and `b` the position along a line:
//   q layouts: a = column, b = row.   r layouts: a = row, b = column.

const SQRT3 = Math.sqrt(3);
const EPS = 1e-9;

export const HEX_CORNERS = [[2, 0], [1, 1], [-1, 1], [-2, 0], [-1, -1], [1, -1]];

export function parseLayout(layout) {
  const m = /^(odd|even)-(q|r)$/.exec(layout);
  if (!m) throw new Error(`Unknown layout: ${layout}`);
  return { shovedParity: m[1] === 'odd' ? 1 : 0, pointy: m[2] === 'r' };
}

/** Number of staggered lines (A) and hexes per line (B) for a layout. */
export function lineCounts({ columns, rows }, pointy) {
  return pointy ? { A: rows, B: columns } : { A: columns, B: rows };
}

const isShoved = (a, parity) => a % 2 === parity;

function lineSpan(a, B, opts) {
  const shoved = isShoved(a, opts.shovedParity);
  if (opts.cutRagged) return [shoved ? -1 : 0, B - 1];
  return [0, shoved && opts.shortLines ? B - 2 : B - 1];
}

/** The map rectangle in lattice units. */
export function mapRect(A, B, opts) {
  const firstShoved = isShoved(0, opts.shovedParity);
  const hasPlain = A > 1 || !firstShoved;
  const hasShoved = A > 1 || firstShoved;
  const x0 = opts.cutEnds ? 0 : -2;
  const x1 = opts.cutEnds ? 3 * (A - 1) : 3 * (A - 1) + 2;
  if (opts.cutRagged) return { x0, x1, y0: 0, y1: 2 * B };
  const shovedBottom = opts.shortLines ? 2 * B - 1 : 2 * B + 1;
  return {
    x0,
    x1,
    y0: hasPlain ? 0 : 1,
    y1: Math.max(hasPlain ? 2 * B : -Infinity, hasShoved ? shovedBottom : -Infinity),
  };
}

/** Physical size in mm of a map rectangle, for edge length s. */
export function mapSize(rect, s, pointy) {
  const along = (rect.x1 - rect.x0) * (s / 2);
  const across = (rect.y1 - rect.y0) * ((SQRT3 * s) / 2);
  return pointy ? { width: across, height: along } : { width: along, height: across };
}

/** Largest A and B that fit the available size, for edge length s. */
export function solveCount(avail, s, opts) {
  const pointy = opts.pointy;
  const fits = (A, B) => {
    const size = mapSize(mapRect(A, B, opts), s, pointy);
    return size.width <= avail.width + EPS && size.height <= avail.height + EPS;
  };
  const alongRoom = pointy ? avail.height : avail.width;
  const acrossRoom = pointy ? avail.width : avail.height;
  let A = Math.ceil(alongRoom / (1.5 * s)) + 2;
  let B = Math.ceil(acrossRoom / (SQRT3 * s)) + 2;
  while (A > 1 && !fits(A, 1)) A--;
  while (B > 1 && !fits(A, B)) B--;
  return { A, B, fits: fits(A, B) };
}

/** Largest edge length that fits A × B hexes into the available size. */
export function solveSize(avail, A, B, opts) {
  const unit = mapSize(mapRect(A, B, opts), 1, opts.pointy);
  return Math.min(avail.width / unit.width, avail.height / unit.height);
}

/** Hexes in plotting order, sweeping back and forth along the lines. */
export function enumerateHexes(A, B, opts) {
  const hexes = [];
  for (let a = 0; a < A; a++) {
    const shoved = isShoved(a, opts.shovedParity);
    const [first, last] = lineSpan(a, B, opts);
    const line = [];
    for (let b = first; b <= last; b++) {
      line.push({ a, b, shoved, cx: 3 * a, cy: 2 * b + 1 + (shoved ? 1 : 0) });
    }
    hexes.push(...(a % 2 === 0 ? line : line.reverse()));
  }
  return hexes;
}

/** The six corners of a hex in lattice units, scaled about its centre by k. */
export const hexCorners = (hex, k = 1) =>
  HEX_CORNERS.map(([x, y]) => [hex.cx + x * k, hex.cy + y * k]);

/** Clip a convex polygon to a rectangle. Sides may be infinite. */
export function clipPolygon(points, rect) {
  const sides = [
    [(p) => p[0] - rect.x0, 0],
    [(p) => rect.x1 - p[0], 0],
    [(p) => p[1] - rect.y0, 1],
    [(p) => rect.y1 - p[1], 1],
  ];
  let poly = points;
  for (const [inside] of sides) {
    const next = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const n = poly[(i + 1) % poly.length];
      const dp = inside(p);
      const dn = inside(n);
      if (dp >= -EPS) next.push(p);
      if ((dp > EPS && dn < -EPS) || (dp < -EPS && dn > EPS)) {
        const t = dp / (dp - dn);
        next.push([p[0] + (n[0] - p[0]) * t, p[1] + (n[1] - p[1]) * t]);
      }
    }
    poly = next;
    if (poly.length === 0) break;
  }
  return poly;
}

/** Clip a line segment to a rectangle, returning null if nothing remains. */
export function clipSegment(p, n, rect) {
  let t0 = 0;
  let t1 = 1;
  const dx = n[0] - p[0];
  const dy = n[1] - p[1];
  const checks = [
    [-dx, p[0] - rect.x0],
    [dx, rect.x1 - p[0]],
    [-dy, p[1] - rect.y0],
    [dy, rect.y1 - p[1]],
  ];
  for (const [d, q] of checks) {
    if (Math.abs(d) < EPS) {
      if (q < -EPS) return null;
      continue;
    }
    const t = q / d;
    if (d < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1 + EPS) return null;
  }
  if (t1 - t0 < EPS) return null;
  return [[p[0] + dx * t0, p[1] + dy * t0], [p[0] + dx * t1, p[1] + dy * t1]];
}

export function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    sum += x0 * y1 - x1 * y0;
  }
  return Math.abs(sum) / 2;
}

/** True if a point lies strictly inside a hex scaled by k, so not on its outline. */
export function strictlyInsideHex(point, hex, k) {
  const dx = Math.abs(point[0] - hex.cx);
  const dy = Math.abs(point[1] - hex.cy);
  return dy < k - 1e-7 && dx + dy < 2 * k - 1e-7;
}

/**
 * Split a clipped polygon into open polylines, dropping the edges created by
 * the cut. Returns null if no edge was dropped, meaning it stays closed.
 */
export function openAtCuts(polygon, hex, k) {
  const n = polygon.length;
  const isCut = polygon.map((p, i) => {
    const q = polygon[(i + 1) % n];
    return strictlyInsideHex([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], hex, k);
  });
  if (!isCut.includes(true)) return null;
  const start = isCut.indexOf(true) + 1;
  const pieces = [];
  let piece = [];
  for (let step = 0; step < n; step++) {
    const i = (start + step) % n;
    if (piece.length === 0) piece.push(polygon[i]);
    if (isCut[i]) {
      if (piece.length > 1) pieces.push(piece);
      piece = [];
    } else {
      piece.push(polygon[(i + 1) % n]);
    }
  }
  if (piece.length > 1) pieces.push(piece);
  return pieces;
}
