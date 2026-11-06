// The examples in gallery/. `params` holds only what each example changes, on
// top of BASE. A test checks that together they cover every parameter.

export const BASE = {
  page: { paper: 'Custom', width: 150, height: 105 },
  margins: { top: 6, right: 6, bottom: 6, left: 6 },
  lattice: { solve: 'size', columns: 7, rows: 5 },
  decorators: { guides: false },
};

const A4 = { paper: 'A4', width: null, height: null };

export const GROUPS = [
  {
    id: 'size',
    title: 'Working out the size',
    intro: 'Page, hex size and hex count can\'t all be set freely, so you fix two and Hex Mill works out the third. All sizes refer to the theoretical lattice and ignore the inset.',
    examples: [
      { name: 'solve-count', title: 'Work out hex count', note: 'A4 and 20 mm hexes are fixed. Hex Mill fits as many as it can.', params: { page: A4, lattice: { solve: 'count', size: 20 } } },
      { name: 'solve-hex-size', title: 'Work out hex size', note: 'A4 and 9 × 6 hexes are fixed. Hex Mill finds the largest hex that fits.', params: { page: A4, lattice: { solve: 'size', columns: 9, rows: 6 } } },
      { name: 'solve-page', title: 'Work out page size', note: '5 × 4 hexes at 22 mm are fixed. The page wraps the map plus its margins.', params: { lattice: { solve: 'page', columns: 5, rows: 4, size: 22 } } },
      { name: 'measure-flat', title: 'Size by flat to flat', note: '20 mm between opposite flat sides.', params: { lattice: { solve: 'count', measure: 'flat', size: 20 } } },
      { name: 'measure-edge', title: 'Size by edge length', note: '20 mm along one edge, so a much larger hex.', params: { lattice: { solve: 'count', measure: 'edge', size: 20 } } },
      { name: 'measure-corner', title: 'Size by corner to corner', note: '20 mm between opposite corners.', params: { lattice: { solve: 'count', measure: 'corner', size: 20 } } },
    ],
  },
  {
    id: 'page',
    title: 'Page, margins and alignment',
    intro: 'The blue guides show the margins and the map edge. When hexes don\'t fill the area inside the margins, alignment decides where the leftover space goes.',
    examples: [
      { name: 'paper-a5-portrait', title: 'Named paper, portrait', note: 'A5 in portrait.', params: { page: { paper: 'A5', orientation: 'portrait', width: null, height: null }, lattice: { solve: 'count', size: 18 } } },
      { name: 'paper-custom', title: 'Custom paper', note: 'A long 200 × 70 mm strip.', params: { page: { paper: 'Custom', width: 200, height: 70 }, lattice: { solve: 'count', size: 18 } } },
      { name: 'margins-uneven', title: 'Different margins per side', note: 'Wide left and top margins, narrow right and bottom.', params: { margins: { top: 22, right: 5, bottom: 5, left: 34 }, lattice: { solve: 'count', size: 16 }, decorators: { guides: true } } },
      { name: 'align-top-left', title: 'Aligned top left', note: 'All leftover space goes to the right and bottom.', params: { lattice: { solve: 'count', size: 26, align: { x: 'start', y: 'start' } }, decorators: { guides: true } } },
      { name: 'align-centre', title: 'Centred', note: 'The default: leftover space is split evenly.', params: { lattice: { solve: 'count', size: 26, align: { x: 'center', y: 'center' } }, decorators: { guides: true } } },
      { name: 'align-bottom-right', title: 'Aligned bottom right', note: 'All leftover space goes to the left and top.', params: { lattice: { solve: 'count', size: 26, align: { x: 'end', y: 'end' } }, decorators: { guides: true } } },
    ],
  },
  {
    id: 'layout',
    title: 'Layouts',
    intro: 'One setting covers orientation and stagger, using the Red Blob Games names. Columns are `q` and rows are `r`, both counted from 0.',
    examples: [
      { name: 'odd-q', title: 'odd-q', note: 'Flat-top. Odd columns are shoved down.', params: { lattice: { layout: 'odd-q' } } },
      { name: 'even-q', title: 'even-q', note: 'Flat-top. Even columns are shoved down.', params: { lattice: { layout: 'even-q' } } },
      { name: 'odd-r', title: 'odd-r', note: 'Pointy-top. Odd rows are shoved right.', params: { lattice: { layout: 'odd-r' } } },
      { name: 'even-r', title: 'even-r', note: 'Pointy-top. Even rows are shoved right.', params: { lattice: { layout: 'even-r' } } },
    ],
  },
  {
    id: 'edges',
    title: 'Map edges',
    intro: 'Hexes can stay whole, or be cut along a straight map edge. Cut hexes are real geometry, not an SVG clip, so a plotter draws them correctly.',
    examples: [
      { name: 'whole', title: 'Whole hexes', note: 'The default, with ragged edges.', params: {} },
      { name: 'short-lines', title: 'Short lines', note: 'Shoved columns lose one hex, which flattens the bottom edge.', params: { lattice: { shortLines: true } } },
      { name: 'cut-ends', title: 'Cut ends', note: 'The first and last columns are cut in half.', params: { lattice: { cutEnds: true } } },
      { name: 'cut-ragged', title: 'Cut ragged sides', note: 'The top and bottom are straight, leaving half-hexes in alternate columns.', params: { lattice: { cutRagged: true } } },
      { name: 'cut-both-closed', title: 'Cut all sides, closed', note: 'Cut hexes are closed along the map edge, giving a straight border.', params: { lattice: { cutEnds: true, cutRagged: true, closePartials: true } } },
      { name: 'cut-both-open', title: 'Cut all sides, open', note: 'Cut hexes are left open, so no border is drawn.', params: { lattice: { cutEnds: true, cutRagged: true, closePartials: false } } },
      { name: 'cut-closed-inset', title: 'Closed, with inset', note: 'The closing line respects the inset like every other edge.', params: { lattice: { cutEnds: true, cutRagged: true, closePartials: true }, render: { inset: 1 } } },
      { name: 'cut-open-inset', title: 'Open, with inset', note: 'Open cuts run right to the map edge.', params: { lattice: { cutEnds: true, cutRagged: true, closePartials: false }, render: { inset: 1 } } },
      { name: 'cut-pointy', title: 'Cut all sides, pointy-top', note: 'The same options work in r layouts.', params: { lattice: { layout: 'odd-r', cutEnds: true, cutRagged: true } } },
    ],
  },
  {
    id: 'drawing',
    title: 'Drawing',
    intro: 'An inset `i` draws each hex smaller than its lattice cell. The channel between neighbours is `2i`, and the visible paper gap is `2i` minus the pen width.',
    examples: [
      { name: 'inset-small', title: 'Inset 0.5 mm', note: 'A 1 mm channel between hexes.', params: { render: { inset: 0.5 } } },
      { name: 'inset-large', title: 'Inset 1.5 mm', note: 'A 3 mm channel between hexes.', params: { render: { inset: 1.5 } } },
      { name: 'simplify', title: 'Simplified', note: 'Duplicate lines removed and the rest chained into the fewest strokes. Compare the pen-down length with the whole-hex example above.', params: { render: { simplify: true } } },
      { name: 'corners', title: 'Corners only', note: 'Short ticks at each corner, 2 mm long by default.', params: { render: { style: 'corners' } } },
      { name: 'corners-long', title: 'Longer corners', note: 'Corner length raised to 3.5 mm.', params: { render: { style: 'corners', cornerLength: 3.5 } } },
      { name: 'pen-width', title: 'Pen width 0.8 mm', note: 'Sets the stroke shown on screen, and the paper gap Hex Mill reports. It doesn\'t change the geometry.', params: { render: { penWidth: 0.8 } } },
    ],
  },
  {
    id: 'numbering',
    title: 'Label numbering',
    intro: 'Each scheme is a format string with `%c` and `%r` for numbers, `%C` and `%R` for letters, `%h` for half-lines and `%n` for serial numbers.',
    examples: [
      { name: 'xxyy', title: 'Column-row', note: 'The classic four-digit form, and the default.', params: { labels: { preset: 'xxyy' } } },
      { name: 'letter-number', title: 'Letter-number', note: 'Lettered columns, numbered rows.', params: { labels: { preset: 'letter-number' } } },
      { name: '18xx', title: '18xx', note: 'Numbers step by two along a column and alternate between columns.', params: { labels: { preset: '18xx' } } },
      { name: 'dotted', title: 'Dotted', note: 'A separator between column and row.', params: { labels: { preset: 'dotted' } } },
      { name: 'serial-rows', title: 'Serial, along rows', note: 'One running count.', params: { labels: { preset: 'serial' } } },
      { name: 'serial-columns', title: 'Serial, down columns', note: 'Counting from 100, down each column.', params: { labels: { preset: 'serial', serialOrder: 'col', start: { serial: 100 } } } },
      { name: 'custom-format', title: 'Custom format', note: 'Literal text works too: here a sheet prefix.', params: { labels: { preset: 'custom', format: 'B-%C%02r' } } },
      { name: 'letters-tally', title: 'Past Z: tally', note: 'Starting at column 25: Y, Z, AA, BB, CC.', params: { labels: { preset: 'letter-number', letters: 'tally', start: { col: 25 } } } },
      { name: 'letters-spreadsheet', title: 'Past Z: spreadsheet', note: 'Starting at column 25: Y, Z, AA, AB, AC.', params: { labels: { preset: 'letter-number', letters: 'spreadsheet', start: { col: 25 } } } },
      { name: 'origin-top-right', title: 'Origin top right', note: 'Columns count from the right.', params: { labels: { origin: 'ur' } } },
      { name: 'origin-bottom-left', title: 'Origin bottom left', note: 'Rows count up from the bottom.', params: { labels: { origin: 'll' } } },
      { name: 'origin-bottom-right', title: 'Origin bottom right', note: 'Both axes are reversed.', params: { labels: { origin: 'lr' } } },
      { name: 'start-step', title: 'Start and step', note: 'Columns count 10, 12, 14. Rows count 5, 10, 15.', params: { labels: { start: { col: 10, row: 5 }, step: { col: 2, row: 5 } } } },
      { name: 'every-second', title: 'Every second hex', note: 'Fewer labels means far fewer pen lifts.', params: { labels: { every: 2 } } },
      { name: 'label-partials', title: 'Label cut hexes', note: 'Off by default. Half-hexes at the top number as row 0.', params: { lattice: { cutRagged: true }, labels: { labelPartials: true, distance: 0 } } },
      { name: 'no-labels', title: 'No labels', note: 'Labels switched off.', params: { labels: { enabled: false } } },
    ],
  },
  {
    id: 'label-style',
    title: 'Label style',
    intro: 'Labels are stroke fonts drawn as plain paths. Size is the height of a digit in mm. Bearing and distance place the label from the hex centre, and rotation turns it.',
    examples: [
      { name: 'font-script', title: 'Hershey Script', note: 'One of 41 built-in fonts.', params: { labels: { font: 'HersheyScript1' } } },
      { name: 'font-gothic', title: 'Hershey Gothic', note: 'A multi-stroke font, so it takes much longer to plot.', params: { labels: { font: 'HersheyGothEnglish' } } },
      { name: 'font-ems', title: 'EMS Tech', note: 'One of the modern EMS fonts.', params: { labels: { font: 'EMSTech' } } },
      { name: 'size-large', title: 'Digit height 3 mm', note: 'The default is about 11% of flat to flat.', params: { labels: { size: 3 } } },
      { name: 'place-centre', title: 'In the centre', note: 'Distance 0.', params: { labels: { distance: 0 } } },
      { name: 'place-bottom', title: 'At the bottom', note: 'Bearing 180°, measured clockwise from up.', params: { labels: { bearing: 180 } } },
      { name: 'rotated', title: 'Rotated', note: 'Rotation 90°, placed on the right with bearing 90°.', params: { labels: { rotation: 90, bearing: 90, distance: 5 } } },
      { name: 'anchor-start', title: 'Anchor start', note: 'The text starts at the placement point.', params: { labels: { anchor: 'start', distance: 0 }, decorators: { centre: 'cross', centreSize: 1.5 } } },
      { name: 'anchor-end', title: 'Anchor end', note: 'The text ends at the placement point.', params: { labels: { anchor: 'end', distance: 0 }, decorators: { centre: 'cross', centreSize: 1.5 } } },
    ],
  },
  {
    id: 'decorators',
    title: 'Decorators',
    intro: 'Each decorator has its own layer, so it can be plotted separately or switched off in Inkscape.',
    examples: [
      { name: 'centre-dots', title: 'Centre dots', note: 'A dot is a tiny real path, so it plots.', params: { decorators: { centre: 'dot' } } },
      { name: 'centre-crosses', title: 'Centre crosses', note: 'Size raised to 2 mm.', params: { decorators: { centre: 'cross', centreSize: 2 } } },
      { name: 'registration', title: 'Registration marks', note: 'Crosses just outside the map corners, for lining up pens or sheets.', params: { margins: { top: 14, right: 14, bottom: 14, left: 14 }, decorators: { registration: true, registrationOffset: 5, registrationSize: 6 } } },
      { name: 'guides', title: 'Guides layer', note: 'Margins, map edge and theoretical lattice. Named with `%`, so AxiDraw never plots it.', params: { render: { inset: 1.5 }, decorators: { guides: true } } },
    ],
  },
  {
    id: 'warnings',
    title: 'Warnings',
    intro: 'These still produce a file, but Hex Mill tells you about the problem.',
    examples: [
      { name: 'warn-travel', title: 'Page exceeds plotter travel', note: 'A3 portrait is too tall for the AxiDraw SE/A3, though landscape fits.', expect: /exceeds the AxiDraw SE\/A3/, params: { page: { paper: 'A3', orientation: 'portrait', width: null, height: null }, lattice: { solve: 'count', size: 30 } } },
      { name: 'warn-nextdraw', title: 'Choosing a plotter', note: 'NextDraw and AxiDraw models are built in. A3 is too big for a NextDraw 8511.', expect: /exceeds the NextDraw 8511/, params: { page: { paper: 'A3', orientation: 'landscape', width: null, height: null }, lattice: { solve: 'count', size: 30 }, plotter: { name: 'NextDraw 8511', width: 300, height: 218 } } },
      { name: 'warn-custom-plotter', title: 'Custom travel limit', note: 'The limit can be set for any other plotter.', expect: /exceeds the custom plotter/, params: { plotter: { name: 'Custom', width: 120, height: 90 } } },
      { name: 'warn-label-overflow', title: 'Labels too big', note: 'Labels that cross the hex outline are counted.', expect: /extend past their hex/, params: { labels: { size: 6 } } },
      { name: 'warn-hexes-touch', title: 'Hexes touch', note: 'A 0.2 mm channel is narrower than a 0.5 mm pen.', expect: /neighbouring hexes touch/, params: { render: { inset: 0.1, penWidth: 0.5 } } },
      { name: 'warn-simplify-inset', title: 'Simplify with an inset', note: 'Inset hexes share no lines, so simplify has nothing to do.', expect: /Simplify only applies/, params: { render: { inset: 1, simplify: true } } },
      { name: 'warn-missing-glyph', title: 'Missing glyph', note: 'Characters the font lacks are skipped and named.', expect: /Font lacks/, params: { labels: { preset: 'custom', format: '%c→%r' } } },
      { name: 'warn-registration', title: 'Registration mark off the page', note: 'The margins are too small for the marks.', expect: /falls off the page/, params: { decorators: { registration: true } } },
    ],
  },
];

/** Settings Hex Mill won't draw. Each is shown with the message it gives. */
export const REFUSED = [
  { title: 'Hex size of 0', params: { lattice: { solve: 'count', size: 0 } } },
  { title: 'Zero columns', params: { lattice: { columns: 0 } } },
  { title: 'Margins wider than the page', params: { margins: { left: 100, right: 100 } } },
  { title: 'Too many hexes', params: { lattice: { solve: 'count', size: 0.5 } } },
  { title: 'Cut ends with only one column', params: { lattice: { columns: 1, cutEnds: true } } },
  { title: 'Inset of half the hex or more', params: { lattice: { solve: 'count', size: 20 }, render: { inset: 10 } } },
  { title: 'Hex larger than the page', params: { lattice: { solve: 'count', size: 200 } } },
];
