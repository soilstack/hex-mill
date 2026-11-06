// SVG 1.1 stroke fonts. Browsers don't render these, so we parse the glyph
// outlines ourselves and emit plain paths. Uses no DOM, so it also runs in Node.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, body) => {
    if (body[0] !== '#') return ENTITIES[body] ?? whole;
    const hex = body[1] === 'x' || body[1] === 'X';
    return String.fromCodePoint(parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10));
  });
}

function attributes(text) {
  const out = {};
  for (const m of text.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

const ARGS = { M: 2, L: 2, H: 1, V: 1, C: 6, Q: 4, Z: 0 };

/** Parse path data into subpaths of absolute M, L, C and Z segments. */
export function parsePathData(d) {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  const subpaths = [];
  let sub = null;
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let i = 0;
  let command = null;
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++];
    const upper = command.toUpperCase();
    if (!(upper in ARGS)) throw new Error(`Unsupported path command: ${command}`);
    const relative = command !== upper;
    const n = tokens.slice(i, i + ARGS[upper]).map(Number);
    i += ARGS[upper];
    const ox = relative ? x : 0;
    const oy = relative ? y : 0;
    if (upper === 'M') {
      x = n[0] + ox;
      y = n[1] + oy;
      startX = x;
      startY = y;
      sub = [['M', x, y]];
      subpaths.push(sub);
      command = relative ? 'l' : 'L';
    } else if (upper === 'L') {
      x = n[0] + ox;
      y = n[1] + oy;
      sub.push(['L', x, y]);
    } else if (upper === 'H') {
      x = n[0] + ox;
      sub.push(['L', x, y]);
    } else if (upper === 'V') {
      y = n[0] + oy;
      sub.push(['L', x, y]);
    } else if (upper === 'C') {
      sub.push(['C', n[0] + ox, n[1] + oy, n[2] + ox, n[3] + oy, n[4] + ox, n[5] + oy]);
      x = n[4] + ox;
      y = n[5] + oy;
    } else if (upper === 'Q') {
      const cx = n[0] + ox;
      const cy = n[1] + oy;
      const ex = n[2] + ox;
      const ey = n[3] + oy;
      sub.push([
        'C',
        x + (2 / 3) * (cx - x), y + (2 / 3) * (cy - y),
        ex + (2 / 3) * (cx - ex), ey + (2 / 3) * (cy - ey),
        ex, ey,
      ]);
      x = ex;
      y = ey;
    } else {
      sub.push(['Z']);
      x = startX;
      y = startY;
    }
  }
  return subpaths;
}

/** Sample a subpath into a polyline, following curves rather than their control points. */
export function flatten(sub, steps = 16) {
  const line = [];
  for (const seg of sub) {
    if (seg[0] === 'M' || seg[0] === 'L') {
      line.push([seg[1], seg[2]]);
    } else if (seg[0] === 'Z') {
      line.push(line[0]);
    } else {
      const [x0, y0] = line[line.length - 1];
      const [, x1, y1, x2, y2, x3, y3] = seg;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        line.push([
          u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ]);
      }
    }
  }
  return line;
}

/** The bounds of the ink. Control points overshoot curves, so curves are sampled. */
function bounds(subpaths) {
  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const sub of subpaths) {
    for (const [x, y] of flatten(sub)) {
      box.minX = Math.min(box.minX, x);
      box.maxX = Math.max(box.maxX, x);
      box.minY = Math.min(box.minY, y);
      box.maxY = Math.max(box.maxY, y);
    }
  }
  return box;
}

export function parseSvgFont(xml) {
  const fontTag = /<font\b([^>]*)>/.exec(xml);
  if (!fontTag) throw new Error('No <font> element found');
  const font = attributes(fontTag[1]);
  const face = attributes(/<font-face\b([^>]*)>/.exec(xml)?.[1] ?? '');
  const defaultAdvance = Number(font['horiz-adv-x']) || 0;
  const glyphs = new Map();
  for (const m of xml.matchAll(/<glyph\b([^>]*?)\/?>/g)) {
    const a = attributes(m[1]);
    if (a.unicode === undefined) continue;
    const char = decode(a.unicode);
    if ([...char].length !== 1) continue;
    glyphs.set(char, {
      advance: Number(a['horiz-adv-x'] ?? defaultAdvance),
      subpaths: a.d ? parsePathData(a.d) : [],
    });
  }
  const parsed = {
    id: font.id,
    family: face['font-family'] ?? font.id,
    unitsPerEm: Number(face['units-per-em']) || 1000,
    glyphs,
  };
  const reference = glyphs.get('0') ?? glyphs.get('H');
  const box = reference ? bounds(reference.subpaths) : null;
  parsed.digitHeight = box ? box.maxY - box.minY : parsed.unitsPerEm * 0.7;
  parsed.digitBottom = box ? box.minY : 0;
  return parsed;
}

/** Map every coordinate of a set of subpaths through a function. */
export function mapPoints(subpaths, fn) {
  return subpaths.map((sub) =>
    sub.map((seg) => {
      const out = [seg[0]];
      for (let i = 1; i + 1 < seg.length; i += 2) out.push(...fn(seg[i], seg[i + 1]));
      return out;
    }),
  );
}

/**
 * Lay out text as subpaths centred vertically on y = 0, in millimetres with y
 * down. `height` is the height of a digit. Returns the characters the font lacks.
 */
export function layoutText(text, font, height, anchor = 'middle') {
  const scale = height / font.digitHeight;
  const missing = [];
  const placed = [];
  let pen = 0;
  for (const char of text) {
    const glyph = font.glyphs.get(char);
    if (!glyph) {
      missing.push(char);
      continue;
    }
    const at = pen;
    placed.push(...mapPoints(glyph.subpaths, (x, y) => [x + at, y]));
    pen += glyph.advance;
  }
  const box = bounds(placed);
  const shift = anchor === 'start' ? box.minX : anchor === 'end' ? box.maxX : (box.minX + box.maxX) / 2;
  const middle = font.digitBottom + font.digitHeight / 2;
  const subpaths = mapPoints(placed, (x, y) => [(x - shift) * scale, -(y - middle) * scale]);
  return { subpaths, box: placed.length ? bounds(subpaths) : null, missing };
}
