import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generate } from '../src/index.js';
import { DEFAULTS, PLOTTERS, withDefaults } from '../src/params.js';
import { near } from './helpers.js';

const SQRT3 = Math.sqrt(3);
const noLabels = { labels: { enabled: false }, decorators: { guides: false } };
const grid = (lattice, rest = {}) =>
  generate({
    ...noLabels,
    page: { width: 1000, height: 1000 },
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    plotter: null,
    lattice: { solve: 'size', columns: 10, rows: 10, ...lattice },
    ...rest,
  });

const pathsById = (scene) =>
  new Map(scene.layers[0].paths.map((path) => [path.id, path]));

test('map size matches the formulas in the spec', () => {
  const s = 10;
  const f = SQRT3 * s;
  const options = { page: { width: 2000, height: 2000 }, margins: { top: 0, right: 0, bottom: 0, left: 0 } };
  const flat = generate({ ...noLabels, ...options, lattice: { solve: 'page', layout: 'odd-q', columns: 7, rows: 5, measure: 'edge', size: s } });
  assert.ok(near(flat.info.map.width, (1.5 * 7 + 0.5) * s));
  assert.ok(near(flat.info.map.height, (5 + 0.5) * f));
  const pointy = generate({ ...noLabels, ...options, lattice: { solve: 'page', layout: 'odd-r', columns: 7, rows: 5, measure: 'edge', size: s } });
  assert.ok(near(pointy.info.map.width, (7 + 0.5) * f));
  assert.ok(near(pointy.info.map.height, (1.5 * 5 + 0.5) * s));
});

test('the A4 worked example from the review gives 19 × 11', () => {
  const scene = generate({ ...noLabels, lattice: { solve: 'count', size: 16 } });
  assert.equal(scene.info.columns, 19);
  assert.equal(scene.info.rows, 11);
  assert.ok(near(scene.info.map.width, 267.9, 0.05));
  assert.ok(near(scene.info.map.height, 184, 1e-6));
  assert.ok(near(scene.info.map.x, 10 + (277 - scene.info.map.width) / 2));
});

test('solve for size fills the tighter dimension exactly', () => {
  const scene = generate({ ...noLabels, lattice: { solve: 'size', columns: 12, rows: 8 } });
  const { width, height } = scene.info.map;
  assert.ok(near(width, 277) || near(height, 190));
  assert.ok(width <= 277 + 1e-6 && height <= 190 + 1e-6);
  assert.deepEqual(scene.warnings, []);
});

test('solve for page wraps the map plus margins', () => {
  const scene = generate({ ...noLabels, plotter: null, lattice: { solve: 'page', columns: 4, rows: 3, size: 20 } });
  assert.ok(near(scene.page.width, scene.info.map.width + 20));
  assert.ok(near(scene.page.height, scene.info.map.height + 20));
  assert.ok(near(scene.info.map.x, 10));
});

test('hex size can be stated three ways', () => {
  const size = (measure, value) =>
    generate({ ...noLabels, lattice: { solve: 'count', measure, size: value } }).info;
  assert.ok(near(size('flat', 20).edge, 20 / SQRT3));
  assert.ok(near(size('edge', 10).flat, 10 * SQRT3));
  assert.ok(near(size('corner', 20).edge, 10));
});

test('stagger follows Red Blob naming', () => {
  const centre = (layout, id) => {
    const scene = grid({ layout, columns: 3, rows: 3 });
    const [line] = pathsById(scene).get(id).polylines;
    const xs = line.map((p) => p[0]);
    const ys = line.map((p) => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  };
  // odd-q shoves odd columns down, so q1 sits lower than q0.
  assert.ok(centre('odd-q', 'hex-q1-r0')[1] > centre('odd-q', 'hex-q0-r0')[1]);
  // even-q shoves even columns down, so q0 sits lower than q1.
  assert.ok(centre('even-q', 'hex-q0-r0')[1] > centre('even-q', 'hex-q1-r0')[1]);
  // odd-r shoves odd rows right, so r1 sits further right than r0.
  assert.ok(centre('odd-r', 'hex-q0-r1')[0] > centre('odd-r', 'hex-q0-r0')[0]);
  // even-r shoves even rows right, so r0 sits further right than r1.
  assert.ok(centre('even-r', 'hex-q0-r0')[0] > centre('even-r', 'hex-q0-r1')[0]);
});

test('q layouts are flat-top and r layouts are pointy-top', () => {
  const extent = (layout) => {
    const scene = grid({ layout, columns: 3, rows: 3 });
    const [line] = pathsById(scene).get('hex-q0-r0').polylines;
    const xs = line.map((p) => p[0]);
    const ys = line.map((p) => p[1]);
    return (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
  };
  assert.ok(extent('odd-q') > 1);
  assert.ok(extent('odd-r') < 1);
});

test('inset shrinks each hex as the review describes', () => {
  const scene = generate({ ...noLabels, lattice: { solve: 'count', size: 10 }, render: { inset: 1, penWidth: 0.3 } });
  assert.ok(near(scene.info.drawnFlat, 8));
  assert.ok(near(scene.info.drawnEdge, 10 / SQRT3 - 2 / SQRT3));
  assert.ok(near(scene.info.channel, 2));
  assert.ok(near(scene.info.paperGap, 1.7));
  const [line] = scene.layers[0].paths[0].polylines;
  const ys = line.map((p) => p[1]);
  assert.ok(near(Math.max(...ys) - Math.min(...ys), 8, 0.002));
});

test('inset does not change the lattice or map size', () => {
  const lattice = { solve: 'count', size: 16 };
  const plain = generate({ ...noLabels, lattice });
  const inset = generate({ ...noLabels, lattice, render: { inset: 2 } });
  assert.equal(plain.info.columns, inset.info.columns);
  assert.deepEqual(plain.info.map, inset.info.map);
});

test('an inset of half the hex or more is rejected', () => {
  const scene = generate({ ...noLabels, lattice: { size: 10 }, render: { inset: 5 } });
  assert.ok(scene.warnings.some((w) => w.includes('Inset')));
  assert.equal(scene.layers.length, 0);
});

test('Squad Leader style board has half hexes at both ends and alternate column ends', () => {
  const scene = grid({ columns: 33, rows: 10, layout: 'odd-q', cutEnds: true, cutRagged: true });
  const { info } = scene;
  // 33 columns, half the width of the first and last cut off.
  assert.ok(near(info.map.width / info.map.height, (32 * 1.5) / (10 * SQRT3)));
  const paths = pathsById(scene);
  assert.ok(paths.has('hex-q1-r-1'), 'shoved column has a half hex at the top');
  assert.ok(paths.has('hex-q1-r9'), 'and at the bottom');
  assert.ok(!paths.has('hex-q0-r-1'));
  // Whole hexes: 31 inner columns; 16 plain with 10 whole, 15... counted exactly below.
  let whole = 0;
  for (let q = 1; q <= 31; q++) whole += q % 2 === 1 ? 9 : 10;
  assert.equal(info.wholeHexes, whole);
});

test('closing a cut hex draws the map edge; leaving it open does not', () => {
  const lattice = { columns: 4, rows: 3, cutEnds: true };
  const closed = grid({ ...lattice, closePartials: true });
  const open = grid({ ...lattice, closePartials: false });
  const onLeftEdge = (scene) => scene.layers[0].paths.flatMap((path) => path.polylines).some((line) =>
    line.some((p, i) => i > 0 && near(p[0], scene.info.map.x, 1e-3) && near(line[i - 1][0], scene.info.map.x, 1e-3)),
  );
  assert.ok(onLeftEdge(closed));
  assert.ok(!onLeftEdge(open));
});

test('an open cut keeps real hex edges that lie along the map edge', () => {
  const scene = grid({ columns: 4, rows: 3, cutRagged: true, closePartials: false });
  const top = scene.info.map.y;
  const hit = pathsById(scene).get('hex-q0-r0').polylines.flat().filter((p) => near(p[1], top, 1e-3));
  assert.equal(hit.length, 2, 'the whole hex in column 0 keeps its top edge');
});

test('a closed cut with inset stays inset from the map edge', () => {
  const scene = grid({ columns: 4, rows: 3, cutEnds: true, closePartials: true, measure: 'flat' }, { render: { inset: 1 } });
  const minX = Math.min(...scene.layers[0].paths.flatMap((path) => path.polylines.flat().map((p) => p[0])));
  assert.ok(near(minX, scene.info.map.x + 1, 0.002));
});

test('short lines drop one hex from each shoved column', () => {
  const scene = grid({ columns: 4, rows: 5, layout: 'odd-q', shortLines: true });
  assert.equal(scene.info.hexes, 5 + 4 + 5 + 4);
  assert.ok(near(scene.info.map.height / scene.info.edge, 5 * SQRT3));
});

test('every layout and edge combination stays within the map', () => {
  for (const layout of ['odd-q', 'even-q', 'odd-r', 'even-r']) {
    for (const cutEnds of [false, true]) {
      for (const cutRagged of [false, true]) {
        for (const shortLines of [false, true]) {
          const scene = grid({ layout, columns: 6, rows: 5, cutEnds, cutRagged, shortLines });
          const { map } = scene.info;
          for (const path of scene.layers[0].paths) {
            for (const [x, y] of path.polylines.flat()) {
              assert.ok(x >= map.x - 0.001 && x <= map.x + map.width + 0.001, `${layout} x`);
              assert.ok(y >= map.y - 0.001 && y <= map.y + map.height + 0.001, `${layout} y`);
            }
          }
        }
      }
    }
  }
});

test('the plotter travel warning accepts A3 either way round, since the plotter turns it', () => {
  const warn = (paper, orientation) =>
    generate({ ...noLabels, page: { paper, orientation }, lattice: { size: 20 } }).warnings;
  assert.deepEqual(warn('A3', 'landscape'), []);
  assert.deepEqual(warn('A3', 'portrait'), []);
  assert.ok(warn('A2', 'landscape').some((w) => w.includes('AxiDraw SE/A3')));
  assert.ok(warn('A2', 'portrait').some((w) => w.includes('AxiDraw SE/A3')));
});

test('a custom plotter taller than it is wide accepts a landscape page', () => {
  const warn = (width, height) =>
    generate({ ...noLabels, page: { paper: 'A4' }, lattice: { size: 20 }, plotter: { name: 'Custom', width, height } }).warnings;
  assert.deepEqual(warn(218, 300), []);
  assert.ok(warn(200, 300).some((w) => w.includes('custom plotter')));
});

test('changing resolved parameters never changes the defaults', () => {
  const first = withDefaults({});
  first.lattice.size = 99;
  first.lattice.align.x = 'end';
  first.labels.start.col = 7;
  const second = withDefaults({ lattice: { columns: 3 } });
  second.margins.top = 50;
  assert.equal(DEFAULTS.lattice.size, 16);
  assert.equal(DEFAULTS.lattice.align.x, 'center');
  assert.equal(DEFAULTS.labels.start.col, 1);
  assert.equal(DEFAULTS.margins.top, 10);
  assert.equal(withDefaults({}).lattice.size, 16);
});

test('plotter presets cover the NextDraw and AxiDraw ranges', () => {
  assert.deepEqual(PLOTTERS['NextDraw 8511'], { width: 300, height: 218 });
  assert.deepEqual(PLOTTERS['NextDraw 1117'], { width: 430, height: 297 });
  assert.deepEqual(PLOTTERS['NextDraw 2234'], { width: 864, height: 594 });
  assert.deepEqual(PLOTTERS['AxiDraw SE/A2'], { width: 594, height: 432 });
  assert.deepEqual(PLOTTERS['AxiDraw V3 XLX'], { width: 595, height: 218 });
  assert.deepEqual(PLOTTERS['AxiDraw MiniKit'], { width: 160, height: 101.6 });
  assert.equal(Object.keys(PLOTTERS).length, 13);
  assert.equal(DEFAULTS.plotter.name, 'AxiDraw SE/A3');
});

test('each plotter accepts paper it fits and warns about paper it does not', () => {
  const warnings = (paper, name) =>
    generate({ ...noLabels, page: { paper }, lattice: { size: 40 }, plotter: { name, ...PLOTTERS[name] } }).warnings;
  assert.deepEqual(warnings('A1', 'NextDraw 2234'), []);
  assert.ok(warnings('A1', 'NextDraw 1117').some((w) => w.includes('NextDraw 1117')));
  assert.deepEqual(warnings('A3', 'NextDraw 1117'), []);
  assert.ok(warnings('A3', 'NextDraw 8511').some((w) => w.includes('NextDraw 8511')));
  assert.deepEqual(warnings('A4', 'NextDraw 8511'), []);
  assert.deepEqual(warnings('ANSI D', 'NextDraw 2234'), []);
});

test('a plotter with no stated size gives no travel warning', () => {
  const scene = generate({ ...noLabels, page: { paper: 'A2' }, plotter: { name: 'None', width: null, height: null }, lattice: { size: 20 } });
  assert.deepEqual(scene.warnings, []);
});

test('impossible input is refused with a clear message', () => {
  const attempt = (params) => () => generate({ ...noLabels, ...params });
  assert.throws(attempt({ lattice: { size: 0 } }), /Hex size/);
  assert.throws(attempt({ lattice: { size: Number.NaN } }), /Hex size/);
  assert.throws(attempt({ lattice: { solve: 'size', columns: 0 } }), /Columns and rows/);
  assert.throws(attempt({ lattice: { solve: 'size', rows: 2.5 } }), /Columns and rows/);
  assert.throws(attempt({ margins: { left: 200, right: 200 } }), /margins/);
  assert.throws(attempt({ lattice: { size: 0.2 } }), /limit/);
  assert.throws(attempt({ lattice: { solve: 'size', columns: 1, cutEnds: true } }), /two lines/);
});

test('the largest square counter matches the review', () => {
  const scene = generate({ ...noLabels, lattice: { size: 20.3 } });
  assert.ok(near(scene.info.largestSquareCounter, 14.86, 0.01));
});
