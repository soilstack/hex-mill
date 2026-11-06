// Builds gallery/: one real Hex Mill SVG per example, plus two index pages.
// Run `npm run gallery` after changing the examples or the geometry.

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generate, toSvg } from '../src/index.js';
import { merge } from '../src/params.js';
import { loadFonts } from '../test/helpers.js';
import { BASE, GROUPS, REFUSED } from './gallery-examples.js';

export const galleryDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'gallery');

const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Inline `code` in a note, as HTML. */
const noteHtml = (text) => escapeHtml(text).replace(/`([^`]+)`/g, '<code>$1</code>');

const fileName = (example) => `${example.name}.svg`;
const settings = (example) => JSON.stringify(example.params);

/**
 * Adds white paper behind the drawing, so the image reads on a dark page.
 * A layer named with % is never plotted, so the file still plots as normal.
 */
function withPaper(svg, page) {
  const paper = `  <g id="paper" inkscape:groupmode="layer" inkscape:label="% Paper"><rect width="${page.width}" height="${page.height}" style="fill:#fff;stroke:#bbb;stroke-width:0.2"/></g>\n`;
  return svg.replace('  <g id="layer1"', `${paper}  <g id="layer1"`);
}

export function buildExample(example, fonts) {
  const scene = generate(merge(BASE, example.params), { fonts });
  return { scene, svg: withPaper(toSvg(scene), scene.page) };
}

export function refusalMessage(item, fonts) {
  try {
    const scene = generate(merge(BASE, item.params), { fonts });
    return scene.warnings[0] ?? null;
  } catch (problem) {
    return problem.message;
  }
}

function summary({ info, stats }) {
  const metres = (stats.penDown / 1000).toFixed(2);
  return `${info.columns} × ${info.rows}, ${info.hexes} hexes, ${stats.strokes} strokes, ${metres} m pen down`;
}

const INTRO = `Every parameter Hex Mill offers, shown one at a time. Each image is a real SVG from Hex Mill, so you can open it in Inkscape, plot it, or load it into \`hexmill.html\` to see its settings.

Only the changes from the base example are listed under each image. The base is a 150 × 105 mm page with 6 mm margins and a 7 × 5 grid, with everything else at its default.

The one addition is a \`% Paper\` layer holding a white page, so the images read on a dark background. AxiDraw never plots layers named with \`%\`.

These files are generated. To rebuild them, run \`npm run gallery\`.`;

function readme(built, refused) {
  const parts = ['# Hex Mill gallery', '', INTRO, ''];
  parts.push('## Contents', '');
  for (const group of GROUPS) parts.push(`- [${group.title}](#${group.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')})`);
  parts.push('- [Refused settings](#refused-settings)', '');
  for (const group of GROUPS) {
    parts.push(`## ${group.title}`, '', group.intro, '');
    for (const example of group.examples) {
      const { scene } = built.get(example);
      parts.push(`### ${example.title}`, '', example.note, '');
      parts.push(`<img src="${fileName(example)}" alt="${escapeHtml(example.title)}" width="480">`, '');
      parts.push(summary(scene), '');
      if (scene.warnings.length) parts.push(...scene.warnings.map((text) => `> ${text}`), '');
      parts.push(`\`${settings(example)}\``, '');
    }
  }
  parts.push('## Refused settings', '', 'Hex Mill won\'t draw these, and says why.', '');
  parts.push('| Setting | Message |', '|---|---|');
  for (const { title, message } of refused) parts.push(`| ${title} | ${message} |`);
  parts.push('');
  return parts.join('\n');
}

function indexHtml(built, refused) {
  const groups = GROUPS.map((group) => {
    const figures = group.examples.map((example) => {
      const { scene } = built.get(example);
      const warnings = scene.warnings.map((text) => `<p class="warn">${escapeHtml(text)}</p>`).join('');
      return `<figure>
<a href="${fileName(example)}"><img src="${fileName(example)}" alt="${escapeHtml(example.title)}" loading="lazy"></a>
<figcaption><h3>${escapeHtml(example.title)}</h3><p>${noteHtml(example.note)}</p>${warnings}<p class="stats">${escapeHtml(summary(scene))}</p><code>${escapeHtml(settings(example))}</code></figcaption>
</figure>`;
    });
    return `<section><h2>${escapeHtml(group.title)}</h2><p>${noteHtml(group.intro)}</p><div class="grid">${figures.join('\n')}</div></section>`;
  });
  const rows = refused.map(({ title, message }) => `<tr><td>${escapeHtml(title)}</td><td>${escapeHtml(message)}</td></tr>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hex Mill gallery</title>
<style>
:root { color-scheme: light dark; --bg: #f1efea; --card: #fbfaf7; --text: #24231f; --muted: #6d6a61; --line: #d9d5cc; --warn: #6b4a08; --warn-bg: #fbf0d9; }
@media (prefers-color-scheme: dark) { :root { --bg: #1c1c1a; --card: #242422; --text: #e9e7e1; --muted: #a19e94; --line: #42413c; --warn: #f0d48f; --warn-bg: #3d3115; } }
* { box-sizing: border-box; }
body { margin: 0 auto; max-width: 1300px; padding: 20px 16px 48px; background: var(--bg); color: var(--text); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
h1 { margin: 0 0 6px; font-size: 24px; }
h2 { margin: 36px 0 4px; font-size: 18px; }
h3 { margin: 0 0 2px; font-size: 14px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-top: 12px; }
figure { margin: 0; padding: 10px; background: var(--card); border: 1px solid var(--line); border-radius: 8px; min-width: 0; }
figure img { display: block; width: 100%; height: 220px; object-fit: contain; background: #e6e3dc; border-radius: 4px; }
figcaption { margin-top: 8px; }
figcaption p { margin: 0 0 4px; }
.stats { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.warn { padding: 3px 6px; color: var(--warn); background: var(--warn-bg); border-radius: 4px; font-size: 12px; }
figcaption code { display: block; color: var(--muted); font-size: 11px; overflow-wrap: anywhere; }
table { border-collapse: collapse; margin-top: 10px; }
td { padding: 4px 16px 4px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
</style>
</head>
<body>
<h1>Hex Mill gallery</h1>
<p>Every parameter Hex Mill offers, shown one at a time. Each image is a real SVG, so you can open it in Inkscape, plot it, or load it into <code>hexmill.html</code> to see its settings. Only the changes from a 150 × 105 mm, 7 × 5 base example are listed.</p>
${groups.join('\n')}
<section><h2>Refused settings</h2><p>Hex Mill won't draw these, and says why.</p><table>${rows}</table></section>
</body>
</html>
`;
}

/** Everything in gallery/, as a map of file name to contents. */
export function buildGallery() {
  const fonts = loadFonts();
  const built = new Map();
  const files = new Map();
  for (const group of GROUPS) {
    for (const example of group.examples) {
      const result = buildExample(example, fonts);
      built.set(example, result);
      files.set(fileName(example), result.svg);
    }
  }
  const refused = REFUSED.map((item) => ({ title: item.title, message: refusalMessage(item, fonts) }));
  files.set('README.md', readme(built, refused));
  files.set('index.html', indexHtml(built, refused));
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(galleryDir, { recursive: true });
  for (const file of readdirSync(galleryDir)) rmSync(join(galleryDir, file));
  const files = buildGallery();
  for (const [name, contents] of files) writeFileSync(join(galleryDir, name), contents);
  console.log(`gallery/: ${files.size - 2} examples`);
}
