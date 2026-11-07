# Plot test

These checks cover what can't be tested without Inkscape and the AxiDraw.

Build the files with `npm run plot-test`. They appear in `out/`.

## In Inkscape only

No plotter needed. Check 6 below is also Inkscape-only.

These checks and check 6 passed on Inkscape 1.4.4 on 2026-11-06. Check 6 first failed because of a bug in Hex Mill's reader, now fixed. The saved file is kept as a test in `test/fixtures`.

1. Open `out/plot-test.svg` in Inkscape.
2. Open **Document Properties**. The page should be 297 × 210 mm, with a scale of 1.
3. Open the **Layers** panel. You should see six layers, named below.
4. Measure something: select a hex in the `1 Scale` layer. Its height should show as 20 mm plus the stroke width, or exactly 20 mm with the geometric bounding box.
5. Open a map from `dist/hexmill.html` in Inkscape, and click a single hex. It should select on its own, with an id like `hex-q3-r2` in the XML editor (Ctrl+Shift+X).
6. Move a few hexes to a new layer and give them a different stroke colour, the way you'd do pen assignment. Confirm nothing about the file gets in the way.

| Layer | Contents |
|---|---|
| `1 Scale` | Ruler, 20 mm hexes and all captions |
| `2 Inset pen A` | Even columns of the inset ladder |
| `3 Inset pen B` | Odd columns of the inset ladder |
| `4 Labels` | Label sizes in three fonts |
| `5 Closed hexes` | 30 hexes as closed paths |
| `6 Simplified hexes` | The same grid with duplicate lines removed |

## On the AxiDraw

Load A4 paper, then plot each layer on its own, by number, from the **Layers** tab of the AxiDraw extension. Write down what you find.

**1. Scale.** Plot layer 1, then measure with a good ruler.
- Is the ruler exactly 200 mm?
- Are the hexes exactly 20 mm flat to flat?

**2. Layer numbers.** Plot layer 3 alone by number.
- Is it found, and does it start drawing straight away?

Layer 3 used to be named `!3 Inset pen B`. A `!` makes the plotter pause before a layer, and the number after it still counts, according to the NextDraw 1.5.0 source. But the pause also fires when that layer is plotted alone, so plotting layer 3 by number stopped before drawing anything. A full plot's time estimate also ended at the pause. Pen changes here are made by plotting each layer on its own instead.

**3. Inset gap.** Plot layers 2 and 3 with two different pens.
- What is the smallest inset where the two colours stay cleanly apart?
- Does the second pen line up with the first?

**4. Label size.** Plot layer 4.
- What is the smallest size you can read comfortably, in each font?
- At what size do characters start to fill in with your pen?

**5. Plot time.** Plot layers 5 and 6 separately, and time each one.
- How long does each take?
- Is the simplified version visibly cleaner?

The simplified grid has 29 strokes and 0.64 m of drawing, against 30 strokes and 1.04 m for closed hexes.

**6. Parameters survive Inkscape.** Open `out/sample-map.svg`, save it from Inkscape under a new name, and keep that file. I'll check that the parameters can still be read from it.

## What to report back

- Your answers to the checks above
- Your pen, and its approximate line width
- The saved file from check 6

These results set the default inset, label size and pen width, and show whether the layer naming needs to change.
