// The Hex Mill interface. All geometry comes from generate(), so the preview
// and the exported SVG are drawn from the same scene.

import { parseSvgFont } from '../fonts.js';
import { generate } from '../generate.js';
import { DEFAULTS, LABEL_PRESETS, PAPER, PLOTTERS, withDefaults } from '../params.js';
import { readParams, toSvg } from '../svg.js';

const STORE_KEY = 'hexmill-state';
const MM_PER_INCH = 25.4;

const data = JSON.parse(document.getElementById('app-data').textContent);
const $ = (id) => document.getElementById(id);

/* Fonts: parsed on first use. */

const parsedFonts = new Map();
const fontSources = new Map(data.fonts.map((font) => [font.id, font]));
const uploadedFonts = new Map();

function fontById(id) {
  if (uploadedFonts.has(id)) return uploadedFonts.get(id);
  if (!parsedFonts.has(id) && fontSources.has(id)) {
    parsedFonts.set(id, parseSvgFont(fontSources.get(id).svg));
  }
  return parsedFonts.get(id);
}

/* Stored state. Browser storage can be unavailable, and the page works without it. */

function loadStored() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function store() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ params, units }));
  } catch {
    // Settings simply won't persist.
  }
}

const stored = loadStored();
let params = withDefaults(stored.params);
let units = stored.units === 'in' ? 'in' : 'mm';
let scene = null;

/* Path helpers. */

const getPath = (path) => path.split('.').reduce((object, key) => object?.[key], params);

function setPath(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((object, key) => object[key], params)[last] = value;
}

const toDisplay = (mm) => (units === 'in' ? mm / MM_PER_INCH : mm);
const fromDisplay = (value) => (units === 'in' ? value * MM_PER_INCH : value);
const trim = (value, places) => String(Number(value.toFixed(places)));
const showLength = (mm) => trim(toDisplay(mm), units === 'in' ? 4 : 3);
const withUnit = (mm) => `${trim(toDisplay(mm), units === 'in' ? 3 : 2)} ${units}`;

/* The form, described as data. */

const solving = (mode) => () => params.lattice.solve === mode;
const anyCut = () => params.lattice.cutEnds || params.lattice.cutRagged;
const labelsOn = () => params.labels.enabled;
const paperOptions = [...Object.keys(PAPER).map((name) => [name, name]), ['Custom', 'Custom size']];
const plotterOptions = [...Object.keys(PLOTTERS).map((name) => [name, name]), ['Custom', 'Custom size'], ['None', 'No limit']];

const SECTIONS = [
  {
    title: 'Size',
    fields: [
      { path: 'lattice.solve', type: 'segmented', label: 'Work out', wide: true, options: [['count', 'Hex count'], ['size', 'Hex size'], ['page', 'Page size']] },
      { path: 'lattice.layout', type: 'select', label: 'Layout', wide: true, options: [
        ['odd-q', 'odd-q: flat-top, odd columns down'],
        ['even-q', 'even-q: flat-top, even columns down'],
        ['odd-r', 'odd-r: pointy-top, odd rows right'],
        ['even-r', 'even-r: pointy-top, even rows right'],
      ] },
      { path: 'lattice.columns', type: 'integer', label: 'Columns', min: 1, derived: solving('count'), derive: () => scene?.info.columns },
      { path: 'lattice.rows', type: 'integer', label: 'Rows', min: 1, derived: solving('count'), derive: () => scene?.info.rows },
      { path: 'lattice.measure', type: 'select', label: 'Measure hex by', options: [['flat', 'Flat to flat'], ['edge', 'Edge length'], ['corner', 'Corner to corner']] },
      { path: 'lattice.size', type: 'length', label: 'Hex size', min: 0.1, derived: solving('size'), derive: derivedHexSize },
    ],
  },
  {
    title: 'Page',
    fields: [
      { path: 'page.paper', type: 'select', label: 'Paper', options: paperOptions, disabled: solving('page'), onChange: paperChanged },
      { path: 'page.orientation', type: 'select', label: 'Orientation', options: [['landscape', 'Landscape'], ['portrait', 'Portrait']], hidden: () => params.page.paper === 'Custom', disabled: solving('page') },
      { path: 'page.width', type: 'length', label: 'Width', min: 1, hidden: () => params.page.paper === 'Custom' ? false : !solving('page')(), derived: solving('page'), derive: () => scene?.page.width },
      { path: 'page.height', type: 'length', label: 'Height', min: 1, hidden: () => params.page.paper === 'Custom' ? false : !solving('page')(), derived: solving('page'), derive: () => scene?.page.height },
      { path: 'margins.top', type: 'length', label: 'Top margin', min: 0 },
      { path: 'margins.bottom', type: 'length', label: 'Bottom margin', min: 0 },
      { path: 'margins.left', type: 'length', label: 'Left margin', min: 0 },
      { path: 'margins.right', type: 'length', label: 'Right margin', min: 0 },
      { path: 'lattice.align.x', type: 'select', label: 'Align across', options: [['start', 'Left'], ['center', 'Centre'], ['end', 'Right']], disabled: solving('page') },
      { path: 'lattice.align.y', type: 'select', label: 'Align down', options: [['start', 'Top'], ['center', 'Centre'], ['end', 'Bottom']], disabled: solving('page') },
    ],
  },
  {
    title: 'Map edges',
    fields: [
      { path: 'lattice.cutEnds', type: 'check', label: 'Cut first and last lines in half', wide: true },
      { path: 'lattice.cutRagged', type: 'check', label: 'Cut ragged sides straight', wide: true },
      { path: 'lattice.closePartials', type: 'check', label: 'Close cut hexes along the map edge', wide: true, hidden: () => !anyCut() },
      { path: 'lattice.shortLines', type: 'check', label: 'Drop one hex from shoved lines', wide: true, hidden: () => params.lattice.cutRagged },
    ],
  },
  {
    title: 'Drawing',
    fields: [
      { path: 'render.style', type: 'select', label: 'Style', options: [['outline', 'Full outlines'], ['corners', 'Corners only']] },
      { path: 'render.cornerLength', type: 'length', label: 'Corner length', min: 0.1, hidden: () => params.render.style !== 'corners' },
      { path: 'render.inset', type: 'length', label: 'Inset', min: 0 },
      { path: 'render.penWidth', type: 'length', label: 'Pen width', min: 0.01 },
      { path: 'render.simplify', type: 'check', label: 'Simplify: remove duplicate lines', wide: true, disabled: () => params.render.inset !== 0 },
      { type: 'hint', html: () => params.render.inset !== 0 ? 'Simplify needs an inset of 0, because inset hexes share no lines.' : 'Simplify merges the cells, so individual hexes can no longer be selected in Inkscape.' },
    ],
  },
  {
    title: 'Labels',
    fields: [
      { path: 'labels.enabled', type: 'check', label: 'Draw labels', wide: true },
      { path: 'labels.preset', type: 'select', label: 'Scheme', wide: true, hidden: () => !labelsOn(), onChange: presetChanged, options: [
        ['xxyy', 'Column-row: 0102'],
        ['letter-number', 'Letter-number: A1, AA3'],
        ['18xx', '18xx: A1, B2, C3'],
        ['dotted', 'Dotted: 01.02'],
        ['serial', 'Serial: 0001, 0002'],
        ['custom', 'Custom format'],
      ] },
      { path: 'labels.format', type: 'text', label: 'Format', wide: true, hidden: () => !labelsOn() || params.labels.preset !== 'custom' },
      { type: 'hint', hidden: () => !labelsOn() || params.labels.preset !== 'custom', html: () => '<code>%c %r</code> numbers, <code>%C %R</code> letters, <code>%h</code> half-line, <code>%n</code> serial. <code>%02c</code> pads to 2 digits, <code>%0c</code> pads to suit the map.' },
      { path: 'labels.font', type: 'font', label: 'Font', wide: true, hidden: () => !labelsOn() },
      { path: 'labels.size', type: 'length', label: 'Digit height', min: 0.1, nullable: true, hidden: () => !labelsOn(), placeholder: () => scene ? showLength(scene.info.labelSize) : 'auto' },
      { path: 'labels.anchor', type: 'select', label: 'Anchor', hidden: () => !labelsOn(), options: [['start', 'Start'], ['middle', 'Middle'], ['end', 'End']] },
      { path: 'labels.distance', type: 'length', label: 'From centre', min: 0, nullable: true, hidden: () => !labelsOn(), placeholder: () => 'auto' },
      { path: 'labels.bearing', type: 'number', label: 'Bearing °', hidden: () => !labelsOn() },
      { path: 'labels.rotation', type: 'number', label: 'Rotation °', hidden: () => !labelsOn() },
      { path: 'labels.every', type: 'integer', label: 'Label every', min: 1, hidden: () => !labelsOn() },
      { path: 'labels.origin', type: 'select', label: 'Origin', hidden: () => !labelsOn(), options: [['ul', 'Top left'], ['ur', 'Top right'], ['ll', 'Bottom left'], ['lr', 'Bottom right']] },
      { path: 'labels.letters', type: 'select', label: 'Past Z', hidden: () => !labelsOn(), options: [['tally', 'AA, BB, CC'], ['spreadsheet', 'AA, AB, AC']] },
      { path: 'labels.start.col', type: 'integer', label: 'First column', hidden: () => !labelsOn() },
      { path: 'labels.start.row', type: 'integer', label: 'First row', hidden: () => !labelsOn() },
      { path: 'labels.step.col', type: 'integer', label: 'Column step', hidden: () => !labelsOn() },
      { path: 'labels.step.row', type: 'integer', label: 'Row step', hidden: () => !labelsOn() },
      { path: 'labels.serialOrder', type: 'select', label: 'Serial runs', hidden: () => !labelsOn() || params.labels.preset !== 'serial', options: [['row', 'Along rows'], ['col', 'Down columns']] },
      { path: 'labels.labelPartials', type: 'check', label: 'Label cut hexes', wide: true, hidden: () => !labelsOn() || !anyCut() },
    ],
  },
  {
    title: 'Decorators',
    fields: [
      { path: 'decorators.centre', type: 'select', label: 'Hex centres', options: [['none', 'None'], ['dot', 'Dot'], ['cross', 'Cross']] },
      { path: 'decorators.centreSize', type: 'length', label: 'Centre size', min: 0.1, hidden: () => params.decorators.centre === 'none' },
      { path: 'decorators.registration', type: 'check', label: 'Registration marks', wide: true },
      { path: 'decorators.registrationOffset', type: 'length', label: 'Mark offset', min: 0, hidden: () => !params.decorators.registration },
      { path: 'decorators.registrationSize', type: 'length', label: 'Mark size', min: 0.5, hidden: () => !params.decorators.registration },
      { path: 'decorators.border', type: 'check', label: 'Border around the map', wide: true },
      { path: 'decorators.borderShape', type: 'select', label: 'Border shape', options: [['outline', 'Follow the hexes'], ['rectangle', 'Rectangle']], hidden: () => !params.decorators.border },
      { path: 'decorators.borderOffset', type: 'length', label: 'Border offset', min: 0, hidden: () => !params.decorators.border },
      { path: 'decorators.guides', type: 'check', label: 'Guides layer (never plotted)', wide: true },
    ],
  },
  {
    title: 'Plotter',
    fields: [
      { path: 'plotter.name', type: 'select', label: 'Travel limit', wide: true, options: plotterOptions, onChange: plotterChanged },
      { path: 'plotter.width', type: 'length', label: 'Width', min: 1, hidden: () => params.plotter.name !== 'Custom' },
      { path: 'plotter.height', type: 'length', label: 'Height', min: 1, hidden: () => params.plotter.name !== 'Custom' },
    ],
  },
];

function derivedHexSize() {
  if (!scene) return undefined;
  const { edge, flat } = scene.info;
  return { flat, edge, corner: edge * 2 }[params.lattice.measure];
}

function paperChanged() {
  if (params.page.paper === 'Custom') {
    const { width, height } = scene?.page ?? { width: 297, height: 210 };
    params.page.width = width;
    params.page.height = height;
  } else {
    params.page.width = null;
    params.page.height = null;
  }
}

function presetChanged() {
  if (params.labels.preset === 'custom') {
    params.labels.format ||= LABEL_PRESETS.xxyy;
  } else {
    params.labels.format = null;
  }
}

function plotterChanged() {
  const preset = PLOTTERS[params.plotter.name];
  if (preset) Object.assign(params.plotter, preset);
  else if (params.plotter.name === 'None') Object.assign(params.plotter, { width: null, height: null });
  else Object.assign(params.plotter, { width: params.plotter.width ?? 430, height: params.plotter.height ?? 297 });
}

/* Building the form. */

const refreshers = [];

function makeSelect(spec, id) {
  const select = document.createElement('select');
  select.id = id;
  for (const [value, text] of spec.options) select.add(new Option(text, value));
  return select;
}

function fillFontSelect(select) {
  select.replaceChildren();
  const groups = [['Hershey', 'Hershey'], ['EMS', 'EMS']];
  for (const [group, title] of groups) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = title;
    for (const font of data.fonts.filter((f) => f.group === group)) {
      optgroup.append(new Option(font.family, font.id));
    }
    select.append(optgroup);
  }
  if (uploadedFonts.size) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = 'Loaded';
    for (const [id, font] of uploadedFonts) optgroup.append(new Option(font.family, id));
    select.append(optgroup);
  }
  select.append(new Option('Load a font file…', '__load'));
}

function buildField(spec, index) {
  const id = `field-${index}`;
  const isDisabled = () => Boolean(spec.disabled?.() || spec.derived?.());

  if (spec.type === 'hint') {
    const hint = document.createElement('p');
    hint.className = 'hint';
    refreshers.push(() => {
      hint.hidden = Boolean(spec.hidden?.());
      hint.innerHTML = spec.html();
    });
    return hint;
  }

  const wrapper = document.createElement(spec.type === 'segmented' ? 'div' : 'label');
  wrapper.className = `field${spec.wide ? ' wide' : ''}${spec.type === 'check' ? ' check' : ''}`;
  const caption = document.createElement('span');
  caption.textContent = spec.label;

  if (spec.type === 'segmented') {
    const group = document.createElement('div');
    group.className = 'segmented';
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-label', spec.label);
    const radios = spec.options.map(([value, text]) => {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = id;
      radio.value = value;
      const face = document.createElement('span');
      face.textContent = text;
      label.append(radio, face);
      group.append(label);
      radio.addEventListener('change', () => {
        setPath(spec.path, value);
        update();
      });
      return radio;
    });
    wrapper.append(caption, group);
    refreshers.push(() => {
      for (const radio of radios) radio.checked = radio.value === getPath(spec.path);
    });
    return wrapper;
  }

  if (spec.type === 'check') {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.addEventListener('change', () => {
      setPath(spec.path, input.checked);
      update();
    });
    wrapper.append(input, caption);
    refreshers.push(() => {
      wrapper.hidden = Boolean(spec.hidden?.());
      input.checked = Boolean(getPath(spec.path));
      input.disabled = isDisabled();
    });
    return wrapper;
  }

  if (spec.type === 'select' || spec.type === 'font') {
    const select = makeSelect({ options: spec.options ?? [] }, id);
    if (spec.type === 'font') fillFontSelect(select);
    select.addEventListener('change', () => {
      if (select.value === '__load') {
        select.value = getPath(spec.path);
        $('font-file').click();
        return;
      }
      setPath(spec.path, select.value);
      spec.onChange?.();
      update();
    });
    wrapper.append(caption, select);
    refreshers.push(() => {
      wrapper.hidden = Boolean(spec.hidden?.());
      if (spec.type === 'font' && select.dataset.fonts !== String(uploadedFonts.size)) {
        fillFontSelect(select);
        select.dataset.fonts = uploadedFonts.size;
      }
      select.value = getPath(spec.path);
      select.disabled = isDisabled();
    });
    return wrapper;
  }

  const input = document.createElement('input');
  input.id = id;
  const textual = spec.type === 'text';
  input.type = textual ? 'text' : 'number';
  if (!textual) input.step = 'any';
  if (spec.type === 'integer') input.step = '1';
  // Leaving a field restores the value in use, if what was typed wasn't accepted.
  input.addEventListener('change', () => update());
  input.addEventListener('input', () => {
    if (textual) {
      setPath(spec.path, input.value);
      update({ keepFocused: input });
      return;
    }
    if (input.value === '') {
      if (spec.nullable) {
        setPath(spec.path, null);
        update({ keepFocused: input });
      }
      return;
    }
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    if (spec.type === 'integer' && !Number.isInteger(value)) return;
    const stored = spec.type === 'length' ? fromDisplay(value) : value;
    if (spec.min !== undefined && stored < spec.min) return;
    setPath(spec.path, stored);
    update({ keepFocused: input });
  });
  wrapper.append(caption, input);
  refreshers.push(({ keepFocused } = {}) => {
    wrapper.hidden = Boolean(spec.hidden?.());
    input.disabled = isDisabled();
    if (spec.min !== undefined) input.min = spec.type === 'length' ? toDisplay(spec.min) : spec.min;
    if (spec.placeholder) input.placeholder = spec.placeholder();
    if (keepFocused === input) return;
    const value = spec.derived?.() ? spec.derive?.() : getPath(spec.path);
    if (value === null || value === undefined) input.value = '';
    else if (spec.type === 'length') input.value = showLength(value);
    else input.value = value;
  });
  return wrapper;
}

function buildForm() {
  const form = $('controls');
  let index = 0;
  for (const section of SECTIONS) {
    const details = document.createElement('details');
    details.open = section.title !== 'Plotter' && section.title !== 'Decorators';
    const summary = document.createElement('summary');
    summary.textContent = section.title;
    const fields = document.createElement('div');
    fields.className = 'fields';
    for (const spec of section.fields) fields.append(buildField(spec, index++));
    details.append(summary, fields);
    form.append(details);
  }
  form.addEventListener('submit', (event) => event.preventDefault());
}

/* Preview. */

const svg = $('preview');
let view = null;
let viewPage = '';

function fitView() {
  const pad = Math.max(scene.page.width, scene.page.height) * 0.03;
  view = {
    x: -pad,
    y: -pad,
    width: scene.page.width + 2 * pad,
    height: scene.page.height + 2 * pad,
  };
  applyView();
}

function applyView() {
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
}

function drawPreview() {
  const { page, layers } = scene;
  const pen = params.render.penWidth;
  const parts = [
    `<rect width="${page.width}" height="${page.height}" fill="#fff" stroke="#0003" stroke-width="0.2" vector-effect="non-scaling-stroke"/>`,
  ];
  for (const layer of layers) {
    const d = layer.paths.map((path) => path.d).join('');
    const style = layer.guide
      ? 'stroke="#7f9fbf" stroke-width="0.8" vector-effect="non-scaling-stroke"'
      : `stroke="#111" stroke-width="${pen}"`;
    parts.push(`<path d="${d}" fill="none" ${style} stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  svg.innerHTML = parts.join('');
  const key = `${page.width}x${page.height}`;
  if (key !== viewPage || !view) {
    viewPage = key;
    fitView();
  }
}

function zoom(factor, point) {
  const centre = point ?? { x: view.x + view.width / 2, y: view.y + view.height / 2 };
  view = {
    x: centre.x - (centre.x - view.x) * factor,
    y: centre.y - (centre.y - view.y) * factor,
    width: view.width * factor,
    height: view.height * factor,
  };
  applyView();
}

function svgPoint(event) {
  const matrix = svg.getScreenCTM()?.inverse();
  if (!matrix) return null;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
  return { x: point.x, y: point.y };
}

function bindViewport() {
  const viewport = $('viewport');
  viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (view) zoom(event.deltaY > 0 ? 1.15 : 1 / 1.15, svgPoint(event));
  }, { passive: false });
  let drag = null;
  viewport.addEventListener('pointerdown', (event) => {
    if (!view) return;
    drag = { start: svgPoint(event) };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('dragging');
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const now = svgPoint(event);
    view.x -= now.x - drag.start.x;
    view.y -= now.y - drag.start.y;
    applyView();
  });
  const end = () => {
    drag = null;
    viewport.classList.remove('dragging');
  };
  viewport.addEventListener('pointerup', end);
  viewport.addEventListener('pointercancel', end);
  $('zoom-in').addEventListener('click', () => view && zoom(1 / 1.3));
  $('zoom-out').addEventListener('click', () => view && zoom(1.3));
  $('zoom-fit').addEventListener('click', () => scene && fitView());
}

/* Readouts. */

const escapeHtml = (text) =>
  String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const metres = (mm) => (mm >= 1000 ? `${(mm / 1000).toFixed(2)} m` : `${Math.round(mm)} mm`);

function showNotices(error) {
  const notices = [
    ...(error ? [`<div class="notice error">${escapeHtml(error)}</div>`] : []),
    ...(scene?.warnings ?? []).map((text) => `<div class="notice">${escapeHtml(text)}</div>`),
  ];
  $('notices').innerHTML = notices.join('');
}

function showReadout() {
  const { info, layers, stats } = scene;
  const rows = layers
    .filter((layer) => layer.stats)
    .map(({ name, stats: s }) => `<tr><td>${escapeHtml(name)}</td><td>${s.strokes.toLocaleString('en')}</td><td>${metres(s.penDown)}</td><td>${metres(s.penUp)}</td></tr>`)
    .join('');
  const inset = params.render.inset > 0
    ? `<dt>Drawn flat to flat</dt><dd>${withUnit(info.drawnFlat)}</dd>
       <dt>Drawn edge</dt><dd>${withUnit(info.drawnEdge)}</dd>
       <dt>Channel</dt><dd>${withUnit(info.channel)}</dd>
       <dt>Paper gap</dt><dd>${withUnit(info.paperGap)}</dd>`
    : '';
  const whole = info.wholeHexes === info.hexes ? '' : ` (${info.wholeHexes.toLocaleString('en')} whole)`;
  $('readout').innerHTML = `
    <dl>
      <dt>Grid</dt><dd>${info.columns} × ${info.rows}</dd>
      <dt>Hexes</dt><dd>${info.hexes.toLocaleString('en')}${whole}</dd>
      <dt>Map</dt><dd>${withUnit(info.map.width)} × ${withUnit(info.map.height)}</dd>
    </dl>
    <dl>
      <dt>Flat to flat</dt><dd>${withUnit(info.flat)}</dd>
      <dt>Edge</dt><dd>${withUnit(info.edge)}</dd>
      <dt>Largest square counter</dt><dd>${withUnit(info.largestSquareCounter)}</dd>
    </dl>
    ${inset ? `<dl>${inset}</dl>` : ''}
    <table>
      <thead><tr><th>Layer</th><th>Strokes</th><th>Pen down</th><th>Pen up</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Total</td><td>${stats.strokes.toLocaleString('en')}</td><td>${metres(stats.penDown)}</td><td>${metres(stats.penUp)}</td></tr></tfoot>
    </table>`;
}

/* The update loop. */

function generateScene() {
  const font = fontById(params.labels.font);
  return generate(params, { fonts: font ? { [params.labels.font]: font } : {} });
}

function update(options = {}) {
  let error = null;
  try {
    scene = generateScene();
    drawPreview();
    showReadout();
  } catch (problem) {
    error = problem.message;
  }
  $('save-svg').disabled = Boolean(error);
  showNotices(error);
  for (const refresh of refreshers) refresh(options);
  store();
}

/* Files. */

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fileStem = () => `hexmill-${scene.info.columns}x${scene.info.rows}`;

function applyLoaded(loaded) {
  params = withDefaults(loaded);
  view = null;
  update();
}

function bindActions() {
  $('save-svg').addEventListener('click', () => {
    if (scene) download(`${fileStem()}.svg`, toSvg(scene), 'image/svg+xml');
  });
  $('save-params').addEventListener('click', () => {
    download(`${scene ? fileStem() : 'hexmill'}.json`, JSON.stringify(params, null, 2), 'application/json');
  });
  $('load').addEventListener('click', () => $('load-file').click());
  $('load-file').addEventListener('change', async (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const loaded = file.name.toLowerCase().endsWith('.svg') ? readParams(text) : JSON.parse(text);
      if (!loaded) throw new Error('That SVG has no Hex Mill settings in it.');
      applyLoaded(loaded);
    } catch (problem) {
      showNotices(`Couldn't load ${file.name}: ${problem.message}`);
    }
  });
  $('font-file').addEventListener('change', async (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;
    try {
      const font = parseSvgFont(await file.text());
      const id = `file:${file.name}`;
      uploadedFonts.set(id, font);
      params.labels.font = id;
      update();
    } catch (problem) {
      showNotices(`Couldn't load ${file.name}: ${problem.message}`);
    }
  });
  $('reset').addEventListener('click', () => applyLoaded({}));
  $('credits').addEventListener('click', () => {
    const body = $('credits-body');
    if (!body.childElementCount) {
      const notice = (title, text) => {
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = title;
        const pre = document.createElement('pre');
        pre.textContent = text;
        details.append(summary, pre);
        return details;
      };
      for (const font of data.fonts) {
        const text = /<metadata>([\s\S]*?)<\/metadata>/.exec(font.svg)?.[1].trim() ?? 'See the font file.';
        body.append(notice(font.family, text));
      }
      body.append(notice('SIL Open Font License', data.ofl));
    }
    $('credits-dialog').showModal();
  });
  for (const button of document.querySelectorAll('[data-units]')) {
    button.addEventListener('click', () => {
      units = button.dataset.units;
      showUnits();
      update();
    });
  }
}

function showUnits() {
  for (const button of document.querySelectorAll('[data-units]')) {
    button.setAttribute('aria-pressed', String(button.dataset.units === units));
  }
}

buildForm();
bindViewport();
bindActions();
showUnits();
update();

// Exposed for automated checks only.
window.hexMill = { getScene: () => scene, getParams: () => params, defaults: DEFAULTS };
