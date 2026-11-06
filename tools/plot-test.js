// Builds out/plot-test.svg: one A4 landscape sheet for checking scale, layer
// handling, inset gaps, label legibility and plot time on the real AxiDraw.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, toSvg } from '../src/index.js';
import { layoutText, mapPoints } from '../src/fonts.js';
import { makePath, polylineSub } from '../src/generate.js';
import { measure } from '../src/strokes.js';
import { loadFonts } from '../test/helpers.js';

const fonts = loadFonts();
const SHEET = { width: 297, height: 210 };

/** Text with its left end at (x, y), where y is the middle of the digits. */
function text(string, x, y, size = 2, fontName = 'HersheySans1') {
  const laid = layoutText(string, fonts[fontName], size, 'start');
  return makePath(mapPoints(laid.subpaths, (px, py) => [px + x, py + y]));
}

/** A hex block with its top-left corner at (x, y). */
function block(x, y, lattice, render = {}) {
  return generate(
    {
      labels: { enabled: false },
      decorators: { guides: false },
      plotter: null,
      margins: { left: x, top: y, right: 0, bottom: 0 },
      lattice: { solve: 'page', layout: 'odd-q', align: { x: 'start', y: 'start' }, ...lattice },
      render,
    },
    { fonts },
  );
}

const hexPaths = (scene) => scene.layers[0].paths;
const column = (path) => Number(/hex-q(\d+)/.exec(path.id)[1]);

// Scale: a 200 mm ruler, and a block of 20 mm hexes.
const scale = [];
const ruler = [[[10, 18], [210, 18]]];
for (let mm = 0; mm <= 200; mm += 10) {
  ruler.push([[10 + mm, 18], [10 + mm, mm % 50 === 0 ? 13 : 15]]);
}
scale.push(makePath(ruler.map((line) => polylineSub(line))));
scale.push(text('Ruler: 200 mm, ticks every 10 mm', 215, 16));
scale.push(text('Hexes: 20 mm flat to flat', 10, 25));
const scaleBlock = block(10, 29, { columns: 4, rows: 3, size: 20 });
scale.push(...hexPaths(scaleBlock));

// Inset ladder: alternate columns go to separate layers, for two pens.
const penA = [];
const penB = [];
const insets = [0.2, 0.3, 0.4, 0.5, 0.75, 1];
insets.forEach((inset, i) => {
  const x = 95 + (i % 3) * 50;
  const y = 29 + Math.floor(i / 3) * 37;
  scale.push(text(`Inset ${inset} mm, channel ${2 * inset} mm`, x, y - 3));
  for (const path of hexPaths(block(x, y, { columns: 4, rows: 2, size: 12 }, { inset }))) {
    (column(path) % 2 === 0 ? penA : penB).push(path);
  }
});

// Label sizes in three fonts.
const labels = [];
const sizes = [1, 1.5, 2, 2.5, 3, 4];
['HersheySans1', 'EMSReadability', 'TwinSans'].forEach((font, row) => {
  const y = 118 + row * 14;
  labels.push(text(font, 10, y - 6));
  let x = 10;
  for (const size of sizes) {
    labels.push(text('0123 A7', x, y, size, font));
    x += size * 6.2 + 4;
  }
});
let captionX = 10;
for (const size of sizes) {
  labels.push(text(`${size} mm`, captionX, 158));
  captionX += size * 6.2 + 4;
}

// Closed hexes against simplified, to compare real plot time.
const grid = { columns: 6, rows: 5, size: 10 };
const closed = block(150, 122, grid);
const simplified = block(215, 122, grid, { simplify: true });
const report = (scene) =>
  `${scene.stats.strokes} strokes, ${(scene.stats.penDown / 1000).toFixed(2)} m`;
scale.push(text('Closed hexes', 150, 112));
scale.push(text(report(closed), 150, 116));
scale.push(text('Simplified', 215, 112));
scale.push(text(report(simplified), 215, 116));

const layers = [
  { name: '1 Scale', paths: scale },
  { name: '2 Inset pen A', paths: penA },
  { name: '!3 Inset pen B', paths: penB, colour: '#c33' },
  { name: '4 Labels', paths: labels },
  { name: '5 Closed hexes', paths: hexPaths(closed) },
  { name: '6 Simplified hexes', paths: hexPaths(simplified) },
];

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'out');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'plot-test.svg'), toSvg({ page: SHEET, layers }));

for (const layer of layers) {
  const stats = measure(layer.paths.flatMap((path) => path.polylines));
  console.log(
    `${layer.name.padEnd(20)} ${String(stats.strokes).padStart(5)} strokes  ` +
      `${(stats.penDown / 1000).toFixed(2)} m down  ${(stats.penUp / 1000).toFixed(2)} m up`,
  );
}
const all = layers.flatMap((layer) => layer.paths.flatMap((path) => path.polylines.flat()));
const xs = all.map((p) => p[0]);
const ys = all.map((p) => p[1]);
console.log(`Extent: x ${Math.min(...xs).toFixed(1)}–${Math.max(...xs).toFixed(1)}, y ${Math.min(...ys).toFixed(1)}–${Math.max(...ys).toFixed(1)} on a ${SHEET.width} × ${SHEET.height} sheet`);

// A normal map from the default settings, for checking parameters survive Inkscape.
const sample = generate({ lattice: { size: 20 }, decorators: { centre: 'dot' } }, { fonts });
writeFileSync(join(outDir, 'sample-map.svg'), toSvg(sample));
console.log(`Sample map: ${sample.info.columns} × ${sample.info.rows} hexes, ${sample.stats.strokes} strokes`);
