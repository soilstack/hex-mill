// Builds out/gallery.html: a contact sheet of layouts and edge options, for checking by eye.

import { writeFileSync } from 'node:fs';
import { generate, toSvg } from '../src/index.js';
import { loadFonts } from '../test/helpers.js';
const fonts = loadFonts();
const base = { page:{width:130,height:95}, margins:{top:4,right:4,bottom:4,left:4}, plotter:null, decorators:{guides:false} };
const L = (x)=>({solve:'size',columns:7,rows:5,...x});
const cases = [
 ['odd-q default', {lattice:L({layout:'odd-q'})}],
 ['even-q', {lattice:L({layout:'even-q'})}],
 ['odd-r', {lattice:L({layout:'odd-r'})}],
 ['even-r letter-number', {lattice:L({layout:'even-r'}),labels:{preset:'letter-number'}}],
 ['cut both, closed', {lattice:L({cutEnds:true,cutRagged:true})}],
 ['cut both, open', {lattice:L({cutEnds:true,cutRagged:true,closePartials:false})}],
 ['cut both, closed, inset 1', {lattice:L({cutEnds:true,cutRagged:true}),render:{inset:1}}],
 ['cut both, open, inset 1', {lattice:L({cutEnds:true,cutRagged:true,closePartials:false}),render:{inset:1}}],
 ['cut ragged only pointy', {lattice:L({layout:'odd-r',cutRagged:true})}],
 ['short lines', {lattice:L({shortLines:true})}],
 ['corners + cross', {lattice:L({}),render:{style:'corners',cornerLength:3},decorators:{centre:'cross',centreSize:2,guides:false}}],
 ['dots, 18xx, simplify', {lattice:L({}),render:{simplify:true},labels:{preset:'18xx'},decorators:{centre:'dot',centreSize:1,guides:false}}],
];
const cells = cases.map(([t,p])=>{ const s=generate({...base,...p},{fonts}); const svg=toSvg(s).replace(/<\?xml.*?\?>/,'').replace(/<metadata[\s\S]*?<\/metadata>/,'').replace('width="130mm" height="95mm"','width="100%"'); return `<figure style="margin:0;border:1px solid #ccc"><figcaption style="font:12px sans-serif">${t} — ${s.info.hexes} hexes, ${s.stats.strokes} strokes ${s.warnings.join('; ')}</figcaption>${svg}</figure>`;});
writeFileSync(new URL('../out/gallery.html', import.meta.url), `<!doctype html><meta charset=utf-8><title>gallery</title><body style="margin:6px;background:#fff;display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${cells.join('')}`);
