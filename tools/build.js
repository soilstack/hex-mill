// Bundles the source modules and all fonts into one offline HTML file.
// No dependencies: each module becomes a function in a tiny module registry.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...path) => readFileSync(join(root, ...path), 'utf8');

const MODULES = ['params', 'lattice', 'strokes', 'numbering', 'fonts', 'generate', 'svg', 'ui/app'];

function bundleModule(name) {
  let source = read('src', `${name}.js`);
  const exported = [];
  source = source.replace(
    /^import\s*\{([^}]*)\}\s*from\s*'([^']+)';$/gm,
    (_, names, path) => `const {${names}} = modules[${JSON.stringify(basename(path, '.js'))}];`,
  );
  source = source.replace(/^export (async function|function|const|let|class) (\w+)/gm, (_, kind, id) => {
    exported.push(id);
    return `${kind} ${id}`;
  });
  const key = JSON.stringify(basename(name));
  return `modules[${key}] = (() => {\n${source}\nreturn { ${exported.join(', ')} };\n})();`;
}

function loadFonts() {
  const fonts = [];
  for (const group of ['Hershey', 'EMS']) {
    const folder = join('vendor', 'svg-fonts', 'fonts', group);
    for (const file of readdirSync(join(root, folder)).sort()) {
      if (!file.endsWith('.svg')) continue;
      const svg = read(folder, file);
      const family = /font-family="([^"]*)"/.exec(svg)?.[1] ?? file;
      fonts.push({ id: file.replace('.svg', ''), family, group, svg });
    }
  }
  return fonts;
}

const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const data = {
  fonts: loadFonts(),
  ofl: read('vendor', 'svg-fonts', 'fonts', 'EMS', 'OFL.txt'),
  version: JSON.parse(read('package.json')).version,
};
const script = `(() => {\n'use strict';\nconst modules = {};\n${MODULES.map(bundleModule).join('\n')}\n})();`;

const html = read('src', 'ui', 'template.html')
  .replace('/*__STYLE__*/', () => read('src', 'ui', 'style.css'))
  .replace('/*__DATA__*/', () => safeJson(data))
  .replace('/*__SCRIPT__*/', () => script.replace(/<\/script/gi, '<\\/script'));

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'hexmill.html'), html);
console.log(`dist/hexmill.html: ${(html.length / 1e6).toFixed(2)} MB, ${data.fonts.length} fonts`);
