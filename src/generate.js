// Turns parameters into a scene: layers of paths in millimetres, plus statistics
// and warnings. The SVG writer and the preview both draw from this scene.

import { flatten, layoutText, mapPoints } from './fonts.js';
import {
  clipPolygon, clipSegment, enumerateHexes, hexCorners, lineCounts, mapRect, mapSize,
  openAtCuts, parseLayout, polygonArea, solveCount, solveSize,
} from './lattice.js';
import { isLabelled, makeLabeller } from './numbering.js';
import { edgeLength, pageSize, withDefaults } from './params.js';
import { chainSegments, measure, orderStrokes, pointKey } from './strokes.js';

const SQRT3 = Math.sqrt(3);
const FULL_AREA = 6; // a whole hex in lattice units
const ALIGN = { start: 0, center: 0.5, end: 1 };
const MAX_HEXES = 20000;

const num = (n) => {
  const text = n.toFixed(3).replace(/\.?0+$/, '');
  return text === '-0' ? '0' : text;
};

const pathData = (subpaths) =>
  subpaths
    .map((sub) =>
      sub.map((seg) => seg[0] + seg.slice(1).map(num).join(' ')).join(''),
    )
    .join('');

export function makePath(subpaths, extra = {}) {
  return { ...extra, d: pathData(subpaths), polylines: subpaths.map((sub) => flatten(sub)) };
}

export const polylineSub = (points, closed = false) => [
  ['M', ...points[0]],
  ...points.slice(1).map((p) => ['L', ...p]),
  ...(closed ? [['Z']] : []),
];

function circleSub([cx, cy], radius) {
  const points = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * 2 * Math.PI;
    points.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)]);
  }
  return polylineSub(points, true);
}

function crossSubs([x, y], half) {
  return [
    polylineSub([[x - half, y], [x + half, y]]),
    polylineSub([[x, y - half], [x, y + half]]),
  ];
}

/** Resolve the solve mode into final counts, edge length and page size. */
function resolveGrid(p, warnings) {
  const { lattice, margins } = p;
  const layout = parseLayout(lattice.layout);
  const opts = {
    ...layout,
    cutEnds: lattice.cutEnds,
    cutRagged: lattice.cutRagged,
    shortLines: lattice.shortLines,
  };
  let page = pageSize(p.page);
  const avail = () => ({
    width: page.width - margins.left - margins.right,
    height: page.height - margins.top - margins.bottom,
  });
  let { A, B } = lineCounts(lattice, layout.pointy);
  let s = edgeLength(lattice.measure, lattice.size);
  if (lattice.solve !== 'size' && !(s > 0 && Number.isFinite(s))) {
    throw new Error('Hex size must be greater than 0.');
  }
  if (lattice.solve !== 'count' && !(Number.isInteger(A) && Number.isInteger(B) && A >= 1 && B >= 1)) {
    throw new Error('Columns and rows must be whole numbers of at least 1.');
  }
  const room = avail();
  if (lattice.solve !== 'page' && !(room.width > 0 && room.height > 0)) {
    throw new Error('The margins leave no room on the page.');
  }

  if (lattice.solve === 'count') {
    const solved = solveCount(avail(), s, opts);
    ({ A, B } = solved);
    if (!solved.fits) warnings.push('Even one hex does not fit in the available area.');
  } else if (lattice.solve === 'size') {
    s = solveSize(avail(), A, B, opts);
  } else if (lattice.solve === 'page') {
    const size = mapSize(mapRect(A, B, opts), s, layout.pointy);
    page = {
      width: size.width + margins.left + margins.right,
      height: size.height + margins.top + margins.bottom,
    };
  } else {
    throw new Error(`Unknown solve mode: ${lattice.solve}`);
  }
  if (A * B > MAX_HEXES) {
    throw new Error(`That is ${(A * B).toLocaleString('en')} hexes. The limit is ${MAX_HEXES.toLocaleString('en')}.`);
  }
  if (lattice.cutEnds && A < 2) throw new Error('Cutting the ends needs at least two lines of hexes.');

  const rect = mapRect(A, B, opts);
  const size = mapSize(rect, s, layout.pointy);
  const space = avail();
  const offset = {
    x: margins.left + (space.width - size.width) * ALIGN[lattice.align.x],
    y: margins.top + (space.height - size.height) * ALIGN[lattice.align.y],
  };
  if (size.width > space.width + 1e-6 || size.height > space.height + 1e-6) {
    warnings.push(
      `The map (${num(size.width)} × ${num(size.height)} mm) is larger than the area inside the margins.`,
    );
  }
  const columns = layout.pointy ? B : A;
  const rows = layout.pointy ? A : B;
  return { opts, A, B, s, f: SQRT3 * s, rect, size, offset, page, columns, rows, pointy: layout.pointy };
}

export function generate(input = {}, { fonts = {} } = {}) {
  const p = withDefaults(input);
  const warnings = [];
  const g = resolveGrid(p, warnings);
  const { s, f, rect, offset, pointy } = g;
  const { inset, style, penWidth, cornerLength } = p.render;

  const ux = s / 2;
  const vy = f / 2;
  const toMm = ([x, y]) => {
    const along = (x - rect.x0) * ux;
    const across = (y - rect.y0) * vy;
    return pointy ? [offset.x + across, offset.y + along] : [offset.x + along, offset.y + across];
  };

  const valid = inset >= 0 && inset < f / 2;
  if (!valid) warnings.push(`Inset must be at least 0 and less than ${num(f / 2)} mm for this hex size.`);
  const k = valid ? (f - 2 * inset) / f : 1;
  const simplify = p.render.simplify && inset === 0;
  if (p.render.simplify && inset !== 0) {
    warnings.push('Simplify only applies at inset 0, because inset hexes share no lines.');
  }

  // Only cut sides clip anything. A closed cut sits inset from the map edge.
  const pull = p.lattice.closePartials ? 1 : 0;
  const pad = { x: (inset / ux) * pull, y: (inset / vy) * pull };
  const clip = {
    x0: g.opts.cutEnds ? rect.x0 + pad.x : -Infinity,
    x1: g.opts.cutEnds ? rect.x1 - pad.x : Infinity,
    y0: g.opts.cutRagged ? rect.y0 + pad.y : -Infinity,
    y1: g.opts.cutRagged ? rect.y1 - pad.y : Infinity,
  };

  const hexes = enumerateHexes(g.A, g.B, g.opts).map((hex) => ({
    ...hex,
    q: pointy ? hex.b : hex.a,
    r: pointy ? hex.a : hex.b,
  }));
  const hexId = (hex) => `hex-q${hex.q}-r${hex.r}`;

  // Clip every hex once, and note which survive whole.
  const cells = [];
  for (const hex of hexes) {
    const polygon = clipPolygon(hexCorners(hex, k), clip);
    const area = polygon.length >= 3 ? polygonArea(polygon) : 0;
    if (area < 1e-6) continue;
    cells.push({ hex, polygon, whole: area >= FULL_AREA * k * k - 1e-6 });
  }

  const cellPieces = (cell) => {
    if (cell.whole || p.lattice.closePartials) return { closed: cell.polygon };
    const pieces = openAtCuts(cell.polygon, cell.hex, k);
    return pieces ? { open: pieces } : { closed: cell.polygon };
  };

  const toSegment = (a, b) => ({ a: toMm(a), b: toMm(b), keyA: pointKey(a), keyB: pointKey(b) });

  const cellSegments = (cell) => {
    const { closed, open } = cellPieces(cell);
    const lines = closed ? [[...closed, closed[0]]] : open;
    return lines.flatMap((line) => line.slice(1).map((pt, i) => toSegment(line[i], pt)));
  };

  const cornerSegments = (cell) => {
    const corners = hexCorners(cell.hex, k);
    const fraction = Math.min(0.5, cornerLength / (s - (2 * inset) / SQRT3));
    const segments = [];
    corners.forEach((corner, i) => {
      for (const neighbour of [corners[(i + 1) % 6], corners[(i + 5) % 6]]) {
        const end = [
          corner[0] + (neighbour[0] - corner[0]) * fraction,
          corner[1] + (neighbour[1] - corner[1]) * fraction,
        ];
        const piece = clipSegment(corner, end, clip);
        if (piece) segments.push(toSegment(piece[0], piece[1]));
      }
    });
    return segments;
  };

  // Layer 1: the hexes.
  const hexPaths = [];
  if (valid) {
    if (style === 'corners') {
      const perCell = cells.map(cornerSegments);
      if (simplify) {
        for (const stroke of orderStrokes(chainSegments(perCell.flat()))) {
          hexPaths.push(makePath([polylineSub(stroke)]));
        }
      } else {
        cells.forEach((cell, i) => {
          const subs = chainSegments(perCell[i]).map((stroke) => polylineSub(stroke));
          if (subs.length) hexPaths.push(makePath(subs, { id: hexId(cell.hex) }));
        });
      }
    } else if (simplify) {
      for (const stroke of orderStrokes(chainSegments(cells.flatMap(cellSegments)))) {
        hexPaths.push(makePath([polylineSub(stroke)]));
      }
    } else {
      for (const cell of cells) {
        const { closed, open } = cellPieces(cell);
        const subs = closed
          ? [polylineSub(closed.map(toMm), true)]
          : open.map((line) => polylineSub(line.map(toMm)));
        hexPaths.push(makePath(subs, { id: hexId(cell.hex) }));
      }
    }
  }

  // Layer 2: labels.
  const labelPaths = [];
  const labelConfig = p.labels;
  const labelSize = labelConfig.size ?? Math.round(f * 1.1) / 10;
  const apothem = f / 2 - inset;
  const labelDistance = labelConfig.distance ?? Math.max(0, apothem - labelSize / 2 - 0.09 * f);
  if (labelConfig.enabled && valid) {
    const font = fonts[labelConfig.font];
    if (!font) {
      warnings.push(`Font not loaded: ${labelConfig.font}`);
    } else {
      const eligible = cells.filter((c) => c.whole || labelConfig.labelPartials);
      const labeller = makeLabeller(labelConfig, g, eligible.map((c) => c.hex));
      const bearing = (labelConfig.bearing * Math.PI) / 180;
      const rotation = (labelConfig.rotation * Math.PI) / 180;
      const dx = Math.sin(bearing) * labelDistance;
      const dy = -Math.cos(bearing) * labelDistance;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const missing = new Set();
      let overflowing = 0;
      const fitsHex = (x, y) => {
        const along = Math.abs(pointy ? y : x);
        const across = Math.abs(pointy ? x : y);
        return across <= apothem + 1e-6 && SQRT3 * along + across <= 2 * apothem + 1e-6;
      };
      for (const cell of eligible) {
        if (!isLabelled(cell.hex, labelConfig, g)) continue;
        const text = labeller(cell.hex);
        const laid = layoutText(text, font, labelSize, labelConfig.anchor);
        laid.missing.forEach((char) => missing.add(char));
        if (!laid.subpaths.length) continue;
        const local = (x, y) => [x * cos - y * sin + dx, x * sin + y * cos + dy];
        const { box } = laid;
        const inside = [[box.minX, box.minY], [box.maxX, box.minY], [box.maxX, box.maxY], [box.minX, box.maxY]]
          .every(([x, y]) => fitsHex(...local(x, y)));
        if (!inside) overflowing++;
        const [cx, cy] = toMm([cell.hex.cx, cell.hex.cy]);
        const subpaths = mapPoints(laid.subpaths, (x, y) => {
          const [lx, ly] = local(x, y);
          return [lx + cx, ly + cy];
        });
        labelPaths.push(makePath(subpaths, { id: `label-q${cell.hex.q}-r${cell.hex.r}`, label: text }));
      }
      if (missing.size) warnings.push(`Font lacks: ${[...missing].join(' ')}`);
      if (overflowing) warnings.push(`${overflowing} labels extend past their hex outline.`);
      const repeats = labelPaths.length - new Set(labelPaths.map((path) => path.label)).size;
      if (repeats) warnings.push(`${repeats} labels repeat another hex's label, so this format can't tell those hexes apart.`);
    }
  }

  // Layer 3: hex centres.
  const centrePaths = [];
  if (p.decorators.centre !== 'none' && valid) {
    const radius = p.decorators.centreSize / 2;
    for (const cell of cells) {
      if (!cell.whole) continue;
      const centre = toMm([cell.hex.cx, cell.hex.cy]);
      const subs = p.decorators.centre === 'dot' ? [circleSub(centre, radius)] : crossSubs(centre, radius);
      centrePaths.push(makePath(subs));
    }
  }

  // Layer 4: registration marks, just outside the map corners.
  const registrationPaths = [];
  const mapBox = { x: offset.x, y: offset.y, width: g.size.width, height: g.size.height };
  if (p.decorators.registration) {
    const gap = p.decorators.registrationOffset;
    const half = p.decorators.registrationSize / 2;
    const xs = [mapBox.x - gap, mapBox.x + mapBox.width + gap];
    const ys = [mapBox.y - gap, mapBox.y + mapBox.height + gap];
    for (const y of ys) {
      for (const x of xs) {
        registrationPaths.push(makePath(crossSubs([x, y], half)));
        if (x - half < 0 || y - half < 0 || x + half > g.page.width || y + half > g.page.height) {
          warnings.push('A registration mark falls off the page.');
        }
      }
    }
  }

  // Non-plotting guides: margins, map edge and the theoretical lattice.
  const guidePaths = [];
  if (p.decorators.guides) {
    const { top, right, bottom, left } = p.margins;
    const box = (x, y, w, h) => polylineSub([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
    guidePaths.push(makePath([box(left, top, g.page.width - left - right, g.page.height - top - bottom)], { id: 'guide-margins' }));
    guidePaths.push(makePath([box(mapBox.x, mapBox.y, mapBox.width, mapBox.height)], { id: 'guide-map' }));
    if (inset > 0) {
      const theoretical = { x0: clip.x0 === -Infinity ? -Infinity : rect.x0, x1: clip.x1 === Infinity ? Infinity : rect.x1, y0: clip.y0 === -Infinity ? -Infinity : rect.y0, y1: clip.y1 === Infinity ? Infinity : rect.y1 };
      const segments = hexes.flatMap((hex) => {
        const polygon = clipPolygon(hexCorners(hex), theoretical);
        if (polygon.length < 3) return [];
        return polygon.map((pt, i) => toSegment(pt, polygon[(i + 1) % polygon.length]));
      });
      const subs = chainSegments(segments).map((stroke) => polylineSub(stroke));
      if (subs.length) guidePaths.push(makePath(subs, { id: 'guide-lattice' }));
    }
  }

  const layers = [
    { name: '1 Hexes', paths: hexPaths },
    { name: '2 Labels', paths: labelPaths },
    { name: '3 Centres', paths: centrePaths },
    { name: '4 Registration', paths: registrationPaths },
    { name: '% Guides', paths: guidePaths, guide: true },
  ].filter((layer) => layer.paths.length);

  // Statistics, following the pen through the plotted layers in order.
  let at = [0, 0];
  const totals = { strokes: 0, penDown: 0, penUp: 0 };
  for (const layer of layers) {
    if (layer.guide) continue;
    const result = measure(layer.paths.flatMap((path) => path.polylines), at);
    at = result.end;
    layer.stats = { strokes: result.strokes, penDown: result.penDown, penUp: result.penUp };
    totals.strokes += result.strokes;
    totals.penDown += result.penDown;
    totals.penUp += result.penUp;
  }

  // The plotter software turns a page to fit by default, so either way round will do.
  const { plotter } = p;
  const fits = (width, height) => width <= plotter.width + 1e-6 && height <= plotter.height + 1e-6;
  if (plotter?.width && plotter.height && !fits(g.page.width, g.page.height) && !fits(g.page.height, g.page.width)) {
    const name = plotter.name === 'Custom' ? 'custom plotter' : plotter.name;
    warnings.push(
      `The page (${num(g.page.width)} × ${num(g.page.height)} mm) exceeds the ${name} travel of ${plotter.width} × ${plotter.height} mm, either way round.`,
    );
  }
  const gap = 2 * inset - penWidth;
  if (inset > 0 && gap <= 0) warnings.push('At this inset and pen width, neighbouring hexes touch.');

  return {
    params: p,
    page: g.page,
    layers,
    warnings: [...new Set(warnings)],
    info: {
      columns: g.columns,
      rows: g.rows,
      hexes: cells.length,
      wholeHexes: cells.filter((c) => c.whole).length,
      edge: s,
      flat: f,
      drawnFlat: f - 2 * inset,
      drawnEdge: s - (2 * inset) / SQRT3,
      channel: 2 * inset,
      paperGap: gap,
      labelSize,
      largestSquareCounter: (SQRT3 - 1) * f,
      map: mapBox,
    },
    stats: totals,
  };
}
