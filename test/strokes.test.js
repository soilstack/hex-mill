import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generate } from '../src/index.js';
import { orderStrokes, pointKey } from '../src/strokes.js';
import { near } from './helpers.js';

const base = {
  labels: { enabled: false },
  decorators: { guides: false },
  page: { width: 2000, height: 2000 },
  plotter: null,
};
const lattice = (columns, rows, extra = {}) => ({
  solve: 'page',
  measure: 'edge',
  size: 10,
  columns,
  rows,
  ...extra,
});

function uniqueEdges(scene) {
  const keys = new Map();
  for (const line of scene.layers[0].paths.flatMap((path) => path.polylines)) {
    for (let i = 1; i < line.length; i++) {
      const a = pointKey(line[i - 1].map((v) => Math.round(v * 1000) / 1000));
      const b = pointKey(line[i].map((v) => Math.round(v * 1000) / 1000));
      const id = a < b ? `${a}|${b}` : `${b}|${a}`;
      keys.set(id, (keys.get(id) ?? 0) + 1);
    }
  }
  return keys;
}

test('simplify matches the figures in the review', () => {
  const closed = generate({ ...base, lattice: lattice(10, 10) });
  const simple = generate({ ...base, lattice: lattice(10, 10), render: { simplify: true } });
  assert.equal(closed.stats.strokes, 100);
  assert.ok(near(closed.stats.penDown, 6000, 0.1));
  assert.ok(near(simple.stats.penDown, 3390, 0.1));
  assert.equal(simple.stats.strokes, 99, 'exactly the mathematical minimum');
});

test('simplify draws every edge exactly once', () => {
  const closed = uniqueEdges(generate({ ...base, lattice: lattice(9, 7) }));
  const simple = uniqueEdges(generate({ ...base, lattice: lattice(9, 7), render: { simplify: true } }));
  assert.equal(simple.size, closed.size);
  assert.ok([...simple.values()].every((count) => count === 1));
});

test('simplify reaches the minimum on larger and cut grids', () => {
  for (const [columns, rows, extra] of [
    [33, 10, {}],
    [40, 30, {}],
    [33, 10, { cutEnds: true, cutRagged: true }],
    [12, 9, { layout: 'even-r' }],
    [12, 9, { layout: 'odd-r', cutEnds: true }],
  ]) {
    const scene = generate({ ...base, lattice: lattice(columns, rows, extra), render: { simplify: true } });
    const degree = new Map();
    for (const key of uniqueEdges(scene).keys()) {
      for (const end of key.split('|')) degree.set(end, (degree.get(end) ?? 0) + 1);
    }
    const odd = [...degree.values()].filter((d) => d % 2 === 1).length;
    assert.equal(scene.stats.strokes, Math.max(1, odd / 2), `${columns}x${rows}`);
  }
});

test('simplified pen-up travel stays below drawing every closed hex twice over', () => {
  const closed = generate({ ...base, lattice: lattice(33, 10) });
  const simple = generate({ ...base, lattice: lattice(33, 10), render: { simplify: true } });
  assert.ok(simple.stats.penDown + simple.stats.penUp < closed.stats.penDown + closed.stats.penUp);
});

test('closed cut hexes form a straight map edge with no overlaps when simplified', () => {
  const scene = generate({ ...base, lattice: lattice(8, 6, { cutEnds: true, cutRagged: true }), render: { simplify: true } });
  assert.ok([...uniqueEdges(scene).values()].every((count) => count === 1));
});

test('simplify is ignored with a warning when there is an inset', () => {
  const scene = generate({ ...base, lattice: lattice(5, 5), render: { simplify: true, inset: 1 } });
  assert.equal(scene.stats.strokes, 25);
  assert.ok(scene.warnings.some((w) => w.includes('Simplify')));
});

test('corner style removes duplicates at the same rate as full outlines', () => {
  const penDown = (render) => generate({ ...base, lattice: lattice(6, 6), render }).stats.penDown;
  const corners = { style: 'corners', cornerLength: 2 };
  const cornerRatio = penDown({ ...corners, simplify: true }) / penDown(corners);
  const outlineRatio = penDown({ simplify: true }) / penDown({});
  assert.ok(near(cornerRatio, outlineRatio, 1e-3));
  const plain = generate({ ...base, lattice: lattice(6, 6), render: corners });
  assert.equal(plain.layers[0].paths[0].polylines.length, 6, 'one stroke per corner');
});

test('stroke ordering visits every stroke once and matches a brute-force nearest search', () => {
  const strokes = [];
  let seed = 7;
  const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  for (let i = 0; i < 300; i++) {
    const x = random() * 500;
    const y = random() * 200;
    strokes.push([[x, y], [x + random() * 9, y + random() * 9]]);
  }
  const ordered = orderStrokes(strokes);
  assert.equal(ordered.length, 300);
  const key = (stroke) => [stroke[0], stroke[1]].map(String).sort().join('|');
  assert.equal(new Set(ordered.map(key)).size, 300);

  const remaining = strokes.slice();
  let at = [0, 0];
  for (const stroke of ordered) {
    const reach = (s) => Math.min(...[s[0], s[1]].map((p) => Math.hypot(p[0] - at[0], p[1] - at[1])));
    const closest = Math.min(...remaining.map(reach));
    assert.ok(near(Math.hypot(stroke[0][0] - at[0], stroke[0][1] - at[1]), closest, 1e-9));
    remaining.splice(remaining.findIndex((s) => key(s) === key(stroke)), 1);
    at = stroke[1];
  }
});
