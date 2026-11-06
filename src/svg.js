// Writes a scene as an Inkscape-layered SVG in millimetres.

const escapeXml = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const mm = (n) => Number(n.toFixed(3));

const LAYER_COLOURS = { guide: '#9ab' };

function pathElement(path) {
  const id = path.id ? ` id="${escapeXml(path.id)}"` : '';
  const label = path.label ? ` inkscape:label="${escapeXml(path.label)}"` : '';
  return `    <path${id}${label} d="${path.d}"/>`;
}

function layerElement(layer, index, penWidth) {
  const colour = layer.guide ? LAYER_COLOURS.guide : (layer.colour ?? '#000');
  const width = layer.guide ? 0.1 : penWidth;
  const style = `fill:none;stroke:${colour};stroke-width:${width};stroke-linecap:round;stroke-linejoin:round`;
  return [
    `  <g id="layer${index + 1}" inkscape:groupmode="layer" inkscape:label="${escapeXml(layer.name)}" style="${style}">`,
    ...layer.paths.map(pathElement),
    '  </g>',
  ].join('\n');
}

export function toSvg(scene) {
  const { page, layers, params } = scene;
  const width = mm(page.width);
  const height = mm(page.height);
  const metadata = params
    ? `  <metadata id="hexmill-params"><![CDATA[${JSON.stringify(params).replaceAll(']]>', ']]]]><![CDATA[>')}]]></metadata>\n`
    : '';
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg"',
    '     xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"',
    `     width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">`,
    `${metadata}${layers.map((layer, i) => layerElement(layer, i, params?.render?.penWidth ?? 0.3)).join('\n')}`,
    '</svg>',
    '',
  ].join('\n');
}

const unescapeXml = (text) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/**
 * Read the parameters back out of a Hex Mill SVG, or null if it has none.
 * Editors reformat markup when they save: Inkscape puts each attribute on its
 * own line, for example. So this accepts any layout of the metadata element,
 * and accepts its content as CDATA or as escaped text.
 */
export function readParams(svgText) {
  const match = /<metadata\b[^>]*\bid\s*=\s*["']hexmill-params["'][^>]*>([\s\S]*?)<\/metadata\s*>/.exec(svgText);
  if (!match) return null;
  const body = match[1];
  const sections = [...body.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map((section) => section[1]);
  return JSON.parse(sections.length ? sections.join('') : unescapeXml(body));
}
