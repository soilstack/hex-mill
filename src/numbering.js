// Hex labels: turns a hex's column and row into text using a format string.

import { LABEL_PRESETS, POINTY_LABEL_PRESETS } from './params.js';

const TOKEN = /%(0?)(\d*)([crCRhn%])/g;

/** Letters for a zero-based index: tally gives AA, BB; spreadsheet gives AA, AB. */
export function letters(index, style = 'tally') {
  if (index < 0) return '';
  if (style === 'tally') {
    const letter = String.fromCharCode(65 + (index % 26));
    return letter.repeat(Math.floor(index / 26) + 1);
  }
  let out = '';
  for (let n = index; n >= 0; n = Math.floor(n / 26) - 1) {
    out = String.fromCharCode(65 + (n % 26)) + out;
  }
  return out;
}

export const labelFormat = (labels, pointy = false) => {
  if (labels.format) return labels.format;
  const format = (pointy ? POINTY_LABEL_PRESETS[labels.preset] : undefined) ?? LABEL_PRESETS[labels.preset];
  if (!format) throw new Error(`Unknown label preset: ${labels.preset}`);
  return format;
};

const digits = (n) => String(Math.abs(Math.trunc(n))).length;

/**
 * Build a function that labels a hex.
 * `hexes` is every hex that will be labelled, as { q, r, shoved }. `pointy`
 * says which axis the half-line numbers of `%h` run along.
 */
export function makeLabeller(labels, grid, hexes) {
  const { columns, rows, pointy } = grid;
  const format = labelFormat(labels, pointy);
  const { origin, start, step } = labels;
  const fromRight = origin[1] === 'r';
  const fromBottom = origin[0] === 'l';

  const place = ({ q, r }) => ({
    col: fromRight ? columns - 1 - q : q,
    row: fromBottom ? rows - 1 - r : r,
  });
  const colValue = (p) => start.col + step.col * p.col;
  const rowValue = (p) => start.row + step.row * p.row;
  const halfValue = (hex, p) =>
    2 * (pointy ? p.col : p.row) + (hex.shoved ? 1 : 0) + (pointy ? start.col : start.row);

  const placed = hexes.map((hex) => ({ hex, p: place(hex) }));
  const serials = new Map();
  const sorted = placed.slice().sort((m, n) =>
    labels.serialOrder === 'col'
      ? m.p.col - n.p.col || m.p.row - n.p.row
      : m.p.row - n.p.row || m.p.col - n.p.col,
  );
  sorted.forEach(({ hex }, i) => serials.set(hex, start.serial + i));

  const widest = (values, minimum) => Math.max(minimum, ...values.map(digits));
  const autoWidth = {
    c: widest(placed.map(({ p }) => colValue(p)), 2),
    r: widest(placed.map(({ p }) => rowValue(p)), 2),
    h: widest(placed.map(({ hex, p }) => halfValue(hex, p)), 2),
    n: widest([...serials.values()], 4),
  };

  const number = (value, zero, width, kind) => {
    if (!zero) return String(value).padStart(Number(width) || 0, ' ').trimStart();
    const size = width === '' ? autoWidth[kind] : Number(width);
    const sign = value < 0 ? '-' : '';
    return sign + String(Math.abs(value)).padStart(size, '0');
  };

  return (hex) => {
    const p = place(hex);
    return format.replace(TOKEN, (_, zero, width, kind) => {
      switch (kind) {
        case '%': return '%';
        case 'c': return number(colValue(p), zero, width, 'c');
        case 'r': return number(rowValue(p), zero, width, 'r');
        case 'h': return number(halfValue(hex, p), zero, width, 'h');
        case 'n': return number(serials.get(hex), zero, width, 'n');
        case 'C': return letters(colValue(p) - 1, labels.letters);
        default: return letters(rowValue(p) - 1, labels.letters);
      }
    });
  };
}

/** True if a hex falls on the label frequency grid. */
export function isLabelled(hex, labels, grid) {
  const every = Math.max(1, labels.every);
  if (every === 1) return true;
  const col = labels.origin[1] === 'r' ? grid.columns - 1 - hex.q : hex.q;
  const row = labels.origin[0] === 'l' ? grid.rows - 1 - hex.r : hex.r;
  return col % every === 0 && row % every === 0;
}
