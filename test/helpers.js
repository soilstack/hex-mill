import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSvgFont } from '../src/index.js';

const fontRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'svg-fonts', 'fonts');

export function loadFonts() {
  const fonts = {};
  for (const folder of ['EMS', 'Hershey']) {
    for (const file of readdirSync(join(fontRoot, folder))) {
      if (!file.endsWith('.svg')) continue;
      fonts[file.replace('.svg', '')] = parseSvgFont(readFileSync(join(fontRoot, folder, file), 'utf8'));
    }
  }
  return fonts;
}

export const near = (actual, expected, tolerance = 1e-6) => Math.abs(actual - expected) <= tolerance;
