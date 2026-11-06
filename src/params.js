// Default parameters and page handling. All lengths are millimetres.

export const PAPER = {
  A5: [148, 210],
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
  Letter: [215.9, 279.4],
  Legal: [215.9, 355.6],
  Tabloid: [279.4, 431.8],
  'ANSI D': [558.8, 863.6],
};

// Usable pen travel in mm. AxiDraw figures are from Evil Mad Scientist's store
// pages and axidraw_conf.py. The NextDraw 1117 is from Bantam Tools' spec page.
// The 8511 and 2234 are from launch coverage, and match the machines they replaced.
export const PLOTTERS = {
  'NextDraw 8511': { width: 300, height: 218 },
  'NextDraw 1117': { width: 430, height: 297 },
  'NextDraw 2234': { width: 864, height: 594 },
  'AxiDraw SE/A1': { width: 864, height: 594 },
  'AxiDraw SE/A2': { width: 594, height: 432 },
  'AxiDraw SE/A3': { width: 430, height: 297 },
  'AxiDraw SE/A4': { width: 300, height: 218 },
  'AxiDraw V3/A3': { width: 430, height: 297 },
  'AxiDraw V3 XLX': { width: 595, height: 218 },
  'AxiDraw V3': { width: 300, height: 218 },
  'AxiDraw V2': { width: 300, height: 218 },
  'AxiDraw V3/B6': { width: 190, height: 140 },
  'AxiDraw MiniKit': { width: 160, height: 101.6 },
};

export const LABEL_PRESETS = {
  xxyy: '%0c%0r',
  'letter-number': '%C%r',
  '18xx': '%C%h',
  dotted: '%0c.%0r',
  serial: '%0n',
};

export const DEFAULTS = {
  page: { paper: 'A4', orientation: 'landscape', width: null, height: null },
  margins: { top: 10, right: 10, bottom: 10, left: 10 },
  lattice: {
    solve: 'count', // count | size | page
    layout: 'odd-q', // odd-q | even-q | odd-r | even-r
    columns: 10,
    rows: 10,
    measure: 'flat', // flat | edge | corner
    size: 16,
    align: { x: 'center', y: 'center' }, // start | center | end
    cutEnds: false,
    cutRagged: false,
    closePartials: true,
    shortLines: false,
  },
  render: {
    style: 'outline', // outline | corners
    cornerLength: 2,
    inset: 0,
    simplify: false,
    penWidth: 0.3,
  },
  labels: {
    enabled: true,
    preset: 'xxyy',
    format: null, // overrides preset when set
    letters: 'tally', // tally | spreadsheet
    origin: 'ul', // ul | ur | ll | lr
    start: { col: 1, row: 1, serial: 1 },
    step: { col: 1, row: 1 },
    serialOrder: 'row', // row | col
    every: 1,
    labelPartials: false,
    font: 'HersheySans1',
    size: null, // digit height in mm; null derives it from the hex
    distance: null, // mm from hex centre; null places it near the top
    bearing: 0, // degrees clockwise from up
    rotation: 0, // degrees clockwise
    anchor: 'middle', // start | middle | end
  },
  decorators: {
    centre: 'none', // none | dot | cross
    centreSize: 0.6,
    registration: false,
    registrationOffset: 4,
    registrationSize: 5,
    guides: true,
  },
  plotter: { name: 'AxiDraw SE/A3', ...PLOTTERS['AxiDraw SE/A3'] },
};

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function merge(base, over) {
  const out = {};
  for (const [k, v] of Object.entries(base)) out[k] = isObject(v) ? merge(v, {}) : v;
  for (const [k, v] of Object.entries(over ?? {})) {
    out[k] = isObject(v) && isObject(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

/** A fresh copy of the defaults with the given values on top. Shares nothing with DEFAULTS. */
export const withDefaults = (params) => merge(DEFAULTS, params);

/** Page size in mm from a named paper plus orientation, or explicit width and height. */
export function pageSize(page) {
  if (page.width && page.height) return { width: page.width, height: page.height };
  const paper = PAPER[page.paper];
  if (!paper) throw new Error(`Unknown paper size: ${page.paper}`);
  const [short, long] = paper;
  return page.orientation === 'landscape'
    ? { width: long, height: short }
    : { width: short, height: long };
}

/** Edge length `s` from a size stated as flat-to-flat, edge or corner-to-corner. */
export function edgeLength(measure, size) {
  if (measure === 'flat') return size / Math.sqrt(3);
  if (measure === 'edge') return size;
  if (measure === 'corner') return size / 2;
  throw new Error(`Unknown hex measure: ${measure}`);
}
