# Hex Mill specification

A browser tool that generates blank hex grids as SVG for Inkscape and an AxiDraw pen plotter. It ships as one HTML file that works offline. The source documents are the Hex Mill Brief and its review, which live in the Obsidian vault. This file records the decisions from both.

## Scope

In scope: blank hex grids, with labels and small decorators.

Not in scope: terrain, image underlays, counters, assigning cells to pens, raster export, tiling across sheets. All cells go in one layer. Colour work happens in Inkscape, and so does PNG/JPEG export.

Audience: built for the author, in a state that can be published.

## Nomenclature

| Term | Meaning |
|---|---|
| `s` | Edge length |
| `f` | Flat-to-flat distance, `f = √3·s` |
| `i` | Inset, measured perpendicular to each edge |
| `q` | Column index, from 0 |
| `r` | Row index, from 0 |

Drawn flat-to-flat is `f − 2i`. Drawn edge is `s − 2i/√3`. The channel between neighbours is `2i`. The paper gap is `2i − pen width`.

Layouts use the Red Blob Games names, and one setting covers both orientation and stagger:

| Layout | Hexes | Stagger |
|---|---|---|
| `odd-q` | Flat-top, flat sides at column ends | Odd columns shoved down |
| `even-q` | Flat-top, flat sides at column ends | Even columns shoved down |
| `odd-r` | Pointy-top, flat sides at row ends | Odd rows shoved right |
| `even-r` | Pointy-top, flat sides at row ends | Even rows shoved right |

## Lattice

All page constraints refer to the theoretical lattice and ignore the inset.

A solve mode decides which value is derived:

| Mode | You set | Tool derives |
|---|---|---|
| `count` | Page, hex size | Columns and rows |
| `size` | Page, columns and rows | Largest hex that fits |
| `page` | Hex size, columns and rows | Page size |

Hex size can be stated as flat-to-flat, edge length or corner-to-corner. Everything is stored in mm, and the interface can show mm or inches. Leftover space is split by the alignment setting, which defaults to centred. Margins are set per side. A map is limited to 20,000 hexes, to keep the page responsive.

## Map edges

There is no rectangle decorator. A straight map edge comes from cutting hexes instead:

- `cutEnds`: the first and last staggered lines are cut in half through their centres.
- `cutRagged`: the ragged sides are cut straight, leaving half-hexes on alternate lines.
- `closePartials`: on, a cut hex is closed along the map edge, and that closing line respects the inset. Off, a cut hex is left open.
- `shortLines`: shoved lines lose one hex, for whole-hex maps with flatter edges.

Cut hexes are real computed geometry, never an SVG `clip-path`.

## Rendering

- Each hex is its own closed path, with a stable id, so it can be selected in Inkscape.
- `simplify`, available only at `i = 0`, removes duplicate edges and chains the rest into the fewest possible strokes. It's off by default, because it removes the individual cells.
- Style is either full outlines or corners only.
- Plot statistics are always reported: strokes, pen-down length and pen-up travel.

## Labels

Stroke fonts only, drawn as plain paths. All 41 fonts from the `svg-fonts` repository are embedded unmodified, with their licences credited. More can be loaded through a file picker.

Format tokens, with an optional width such as `%02c`:

| Token | Meaning |
|---|---|
| `%c` `%r` | Column and row number |
| `%C` `%R` | Column and row letters |
| `%h` | Half-line number, for 18xx maps |
| `%n` | Serial number |
| `%%` | A literal `%` |

`%0c` means zero-padded to a width derived from the map, at least 2 digits (4 for `%0n`).

| Preset | Format | Example |
|---|---|---|
| `xxyy` (default) | `%0c%0r` | `0102` |
| `letter-number` | `%C%r` | `A1`, `AA3` |
| `18xx` | `%C%h` | `A1`, `B2`, `C3` |
| `dotted` | `%0c.%0r` | `01.02` |
| `serial` | `%0n` | `0001` |

Other settings and their defaults:

- Letters past Z: `tally` (AA, BB) or `spreadsheet` (AA, AB). Default `tally`.
- Origin corner `ul`, `ur`, `ll` or `lr`. Default `ul`.
- Start value and step per axis. Default start 1, step 1.
- Label every nth hex. Default every hex.
- Partial hexes: unlabelled by default.
- Size is the height of the digit `0`, in mm, because declared font metrics are unreliable. Default about `0.11·f`.
- Placement is distance and bearing from the centre, plus rotation. Default is near the top of the hex, upright and centred.

## Decorators

Centre dots or crosses, corner-only grids and registration marks. A dot is a small real path, since a zero-length path may not plot.

## SVG output

- `width` and `height` in mm, with a `viewBox` in mm, so one user unit is one millimetre.
- Top-level Inkscape layers: `1 Hexes`, `2 Labels`, `3 Centres`, `4 Registration`, `% Guides`. Empty layers are left out.
- The full parameter set is stored in `<metadata>` so a map can be reloaded.

## Plotter

The target is the AxiDraw SE/A3, with 430 × 297 mm of travel. The tool warns if the page exceeds this. Other plotters can be entered as a custom size.

## Licence

MIT for the code, plus the bundled font notices.
