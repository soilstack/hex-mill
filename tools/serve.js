// A tiny static server for previewing dist/ and out/ during development.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = join(dirname(fileURLToPath(import.meta.url)), '..');
const roots = [join(project, 'dist'), join(project, 'out')];
const types = { '.html': 'text/html', '.svg': 'image/svg+xml' };
const port = Number(process.argv[2]) || 8123;

createServer(async (request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, 'http://x').pathname));
  const file = path === '\\' || path === '/' ? 'hexmill.html' : path;
  for (const root of roots) {
    try {
      const body = await readFile(join(root, file));
      response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
      response.end(body);
      return;
    } catch {
      // Try the next folder.
    }
  }
  response.writeHead(404);
  response.end('Not found');
}).listen(port, '127.0.0.1', () => console.log(`Serving dist/ and out/ on http://localhost:${port}`));
