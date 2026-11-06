import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { readParams } from '../src/index.js';
import { DEFAULTS } from '../src/params.js';
import { GROUPS, REFUSED } from '../tools/gallery-examples.js';
import { buildExample, buildGallery, galleryDir, refusalMessage } from '../tools/gallery.js';
import { loadFonts } from './helpers.js';

const fonts = loadFonts();
const examples = GROUPS.flatMap((group) => group.examples);

function leaves(object, prefix = '') {
  return Object.entries(object ?? {}).flatMap(([key, value]) =>
    value !== null && typeof value === 'object' ? leaves(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

test('the examples between them demonstrate every parameter', () => {
  const shown = new Set(examples.flatMap((example) => leaves(example.params)));
  assert.deepEqual(leaves(DEFAULTS).filter((path) => !shown.has(path)), []);
});

test('example names are unique', () => {
  assert.equal(new Set(examples.map((example) => example.name)).size, examples.length);
});

test('each example warns only when it is meant to', () => {
  for (const example of examples) {
    const { warnings } = buildExample(example, fonts).scene;
    if (example.expect) assert.ok(warnings.some((w) => example.expect.test(w)), `${example.name}: ${warnings}`);
    else assert.deepEqual(warnings, [], example.name);
  }
});

test('each example draws something and keeps its settings', () => {
  for (const example of examples) {
    const { scene, svg } = buildExample(example, fonts);
    assert.ok(scene.stats.strokes > 0, example.name);
    assert.deepEqual(readParams(svg), scene.params, example.name);
  }
});

test('each refused setting gives a message', () => {
  for (const item of REFUSED) assert.ok(refusalMessage(item, fonts), item.title);
});

test('gallery/ matches the examples', () => {
  const expected = buildGallery();
  assert.deepEqual(readdirSync(galleryDir).sort(), [...expected.keys()].sort());
  const normalise = (text) => text.replace(/\r\n/g, '\n');
  for (const [name, contents] of expected) {
    assert.equal(normalise(readFileSync(join(galleryDir, name), 'utf8')), normalise(contents), `${name} is stale: run npm run gallery`);
  }
});
