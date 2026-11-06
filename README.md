# Hex Mill

Hex Mill makes blank hex grids for tactical wargames, as SVG files ready for Inkscape and a pen plotter such as the AxiDraw.

It's a single HTML file that runs offline. Download [`dist/hexmill.html`](dist/hexmill.html) and open it in a browser.

## What it does

- **Sizing:** set the page and hex size, and it works out how many hexes fit. Or fix the count and work out the hex size or page size.
- **Layouts:** flat-top or pointy-top, with either stagger (`odd-q`, `even-q`, `odd-r`, `even-r`).
- **Map edges:** ragged whole hexes, or hexes cut straight along the map edge, closed or left open.
- **Inset:** draw each hex smaller than its lattice cell, so neighbouring hexes can be plotted in different colours without touching.
- **Simplify:** remove duplicate lines and chain the rest into the fewest possible pen strokes.
- **Labels:** stroke-font labels in common wargame numbering schemes, or your own format. All 41 fonts are built in, and you can load more.
- **Decorators:** centre dots or crosses, corner-only grids and registration marks.
- **Plot statistics:** strokes, pen-down length and pen-up travel for each layer.

Each SVG is sized in millimetres, uses Inkscape layers, and stores its settings, so you can load it back into Hex Mill later.

## Development

Hex Mill needs Node.js 20 or later, and has no dependencies.

```bash
npm test
```

```bash
npm run build
```

`npm run build` bundles the source in `src/` and the fonts in `vendor/` into `dist/hexmill.html`.

`SPEC.md` describes the design, and `PLOT-TEST.md` lists the checks that need Inkscape and a plotter.

## Credits

The stroke fonts come from the [Evil Mad Scientist svg-fonts collection](https://gitlab.com/oskay/svg-fonts). They're included unmodified, under the SIL Open Font License or the Hershey Fonts licence, and each font's notice is in its file and in the app's Credits panel.

The offset coordinate names follow [Red Blob Games](https://www.redblobgames.com/grids/hexagons/). The label format idea comes from [mkhexgrid](https://www.nomic.net/~uckelman/mkhexgrid/).

## Licence

The code is under the MIT licence: see [LICENSE](LICENSE). The fonts in `vendor/svg-fonts` keep their own licences.
