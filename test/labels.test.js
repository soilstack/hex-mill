import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generate, readParams, toSvg } from '../src/index.js';
import { layoutText, parsePathData, parseSvgFont } from '../src/fonts.js';
import { letters } from '../src/numbering.js';
import { loadFonts, near } from './helpers.js';

const fonts = loadFonts();
const texts = (labels, lattice = {}) => {
  const scene = generate(
    {
      labels,
      page: { width: 1000, height: 1000 },
      plotter: null,
      decorators: { guides: false },
      lattice: { solve: 'size', columns: 3, rows: 3, ...lattice },
    },
    { fonts },
  );
  return new Map(scene.layers.find((l) => l.name === '2 Labels').paths.map((p) => [p.id, p.label]));
};

test('all 41 fonts parse, and each has digits and capitals', () => {
  assert.equal(Object.keys(fonts).length, 41);
  for (const [name, font] of Object.entries(fonts)) {
    for (const char of '0123456789AZ') assert.ok(font.glyphs.has(char), `${name} ${char}`);
    assert.ok(font.digitHeight > 0, name);
  }
});

test('tally and spreadsheet letters', () => {
  assert.equal(letters(0), 'A');
  assert.equal(letters(25), 'Z');
  assert.equal(letters(26), 'AA');
  assert.equal(letters(27), 'BB');
  assert.equal(letters(52), 'AAA');
  assert.equal(letters(26, 'spreadsheet'), 'AA');
  assert.equal(letters(27, 'spreadsheet'), 'AB');
  assert.equal(letters(701, 'spreadsheet'), 'ZZ');
  assert.equal(letters(702, 'spreadsheet'), 'AAA');
  assert.equal(letters(-1), '');
});

test('default labels are four-digit column-row from the top left', () => {
  const t = texts({});
  assert.equal(t.get('label-q0-r0'), '0101');
  assert.equal(t.get('label-q2-r1'), '0302');
});

test('zero padding grows with the map', () => {
  const t = texts({}, { columns: 120, rows: 3 });
  assert.equal(t.get('label-q0-r0'), '00101');
  assert.equal(t.get('label-q119-r2'), '12003');
});

test('explicit width overrides the derived one', () => {
  assert.equal(texts({ format: '%03c-%r' }).get('label-q1-r2'), '002-3');
});

test('letter-number preset', () => {
  const t = texts({ preset: 'letter-number' }, { columns: 28 });
  assert.equal(t.get('label-q0-r0'), 'A1');
  assert.equal(t.get('label-q26-r1'), 'AA2');
  assert.equal(t.get('label-q27-r2'), 'BB3');
});

test('18xx numbers step by two along a line and alternate between lines', () => {
  const t = texts({ preset: '18xx' });
  assert.equal(t.get('label-q0-r0'), 'A1');
  assert.equal(t.get('label-q1-r0'), 'B2');
  assert.equal(t.get('label-q2-r0'), 'C1');
  assert.equal(t.get('label-q2-r1'), 'C3');
});

test('origin corners flip the numbering', () => {
  const t = texts({ origin: 'lr' });
  assert.equal(t.get('label-q2-r2'), '0101');
  assert.equal(t.get('label-q0-r0'), '0303');
});

test('start and step apply per axis', () => {
  const t = texts({ start: { col: 10, row: 0 }, step: { col: 2, row: 5 } });
  assert.equal(t.get('label-q1-r2'), '1210');
});

test('serial numbering follows row or column order', () => {
  const rowOrder = texts({ preset: 'serial' });
  assert.equal(rowOrder.get('label-q0-r0'), '0001');
  assert.equal(rowOrder.get('label-q1-r0'), '0002');
  assert.equal(rowOrder.get('label-q0-r1'), '0004');
  const colOrder = texts({ preset: 'serial', serialOrder: 'col' });
  assert.equal(colOrder.get('label-q0-r1'), '0002');
});

test('partial hexes are unlabelled unless asked, and top half hexes number as row 0', () => {
  const lattice = { columns: 4, rows: 3, cutRagged: true };
  assert.ok(!texts({}, lattice).has('label-q1-r-1'));
  assert.equal(texts({ labelPartials: true }, lattice).get('label-q1-r-1'), '0200');
});

test('every nth hex', () => {
  const t = texts({ every: 2 }, { columns: 5, rows: 5 });
  assert.equal(t.size, 9);
  assert.ok(t.has('label-q2-r2'));
  assert.ok(!t.has('label-q1-r0'));
});

/** Height of the ink, sampling curves finely and independently of the code under test. */
function inkHeight(subpaths) {
  let top = Infinity;
  let bottom = -Infinity;
  const see = (y) => {
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  };
  for (const sub of subpaths) {
    let y0 = 0;
    for (const seg of sub) {
      if (seg[0] === 'Z') continue;
      if (seg[0] === 'C') {
        for (let t = 0; t <= 1; t += 0.002) {
          const u = 1 - t;
          see(u * u * u * y0 + 3 * u * u * t * seg[2] + 3 * u * t * t * seg[4] + t * t * t * seg[6]);
        }
      }
      y0 = seg[seg.length - 1];
      see(y0);
    }
  }
  return bottom - top;
}

test('digit height is the height of the ink in every font, curved or straight', () => {
  for (const [name, font] of Object.entries(fonts)) {
    const { subpaths } = layoutText('0', font, 3);
    assert.ok(near(inkHeight(subpaths), 3, 0.02), `${name}: ${inkHeight(subpaths)}`);
  }
});

test('anchors align the ink', () => {
  const font = fonts.HersheySans1;
  assert.ok(near(layoutText('12', font, 3, 'start').box.minX, 0));
  assert.ok(near(layoutText('12', font, 3, 'end').box.maxX, 0));
  const { box } = layoutText('12', font, 3, 'middle');
  assert.ok(near(box.minX, -box.maxX));
});

test('missing glyphs are reported', () => {
  const scene = generate({ labels: { format: 'x世%c' }, lattice: { solve: 'count', size: 30 } }, { fonts });
  assert.ok(scene.warnings.some((w) => w.includes('lacks')));
});

test('an oversized label warns', () => {
  const scene = generate({ labels: { size: 12 }, lattice: { size: 16 } }, { fonts });
  assert.ok(scene.warnings.some((w) => w.includes('past their hex')));
});

test('default labels fit inside the hex in both orientations, with and without inset', () => {
  for (const layout of ['odd-q', 'odd-r']) {
    for (const inset of [0, 1]) {
      const scene = generate({ lattice: { layout, size: 16 }, render: { inset } }, { fonts });
      assert.deepEqual(scene.warnings, [], `${layout} inset ${inset}`);
    }
  }
});

test('path data parsing handles relative commands and exponents', () => {
  const [sub] = parsePathData('m 1 2 l 3 4 h 1 v 1e0 z');
  assert.deepEqual(sub, [['M', 1, 2], ['L', 4, 6], ['L', 5, 6], ['L', 5, 7], ['Z']]);
});

test('entity-encoded glyph names decode', () => {
  const font = parseSvgFont('<font id="t" horiz-adv-x="5"><font-face units-per-em="10"/><glyph unicode="&#x22;" d="M0 0L1 1"/><glyph unicode="&amp;" d="M0 0L1 1"/></font>');
  assert.ok(font.glyphs.has('"'));
  assert.ok(font.glyphs.has('&'));
});

test('SVG output is in millimetres with Inkscape layers', () => {
  const scene = generate({ decorators: { centre: 'dot', registration: true, registrationOffset: 2 }, lattice: { size: 30 } }, { fonts });
  const svg = toSvg(scene);
  assert.match(svg, /width="297mm" height="210mm" viewBox="0 0 297 210"/);
  for (const name of ['1 Hexes', '2 Labels', '3 Centres', '4 Registration', '% Guides']) {
    assert.ok(svg.includes(`inkscape:groupmode="layer" inkscape:label="${name}"`), name);
  }
  assert.ok(!svg.includes('clip-path'));
  assert.ok(!svg.includes('<text'));
});

test('parameters round-trip through the SVG', () => {
  const scene = generate({ lattice: { size: 22, layout: 'even-r' }, render: { inset: 0.5 } }, { fonts });
  const restored = readParams(toSvg(scene));
  assert.equal(restored.lattice.size, 22);
  assert.equal(restored.lattice.layout, 'even-r');
  assert.equal(toSvg(generate(restored, { fonts })), toSvg(scene));
});

test('labels count towards the statistics', () => {
  const scene = generate({ lattice: { solve: 'size', columns: 33, rows: 10 }, page: { paper: 'A3' } }, { fonts });
  const labels = scene.layers.find((l) => l.name === '2 Labels');
  assert.ok(labels.stats.strokes >= 4 * 330);
});
