const ALPHA_HEX = /#([0-9a-f]{6})([0-9a-f]{2})\b/gi;
const PAINT_ATTRIBUTE = /\b(fill|stroke|stop-color|flood-color|lighting-color)=(['"])(#[0-9a-f]{8})\2/gi;
const PAINT_DECLARATION = /\b(fill|stroke|stop-color|flood-color|lighting-color)\s*:\s*(#[0-9a-f]{8})\b/gi;

function splitAlphaHex(value) {
  const match = String(value).match(/^#([0-9a-f]{6})([0-9a-f]{2})$/i);
  if (!match) return null;
  return { color: `#${match[1]}`, alpha: Number.parseInt(match[2], 16) / 255 };
}

function opacityAttribute(property) {
  if (property === 'stop-color') return 'stop-opacity';
  if (property === 'flood-color') return 'flood-opacity';
  return `${property}-opacity`;
}

function opacityText(alpha) {
  return String(Number(alpha.toFixed(4)));
}

export function wordCompatibleSvg(svg) {
  let output = String(svg ?? '');

  output = output.replace(PAINT_ATTRIBUTE, (full, property, quote, value) => {
    const paint = splitAlphaHex(value);
    if (!paint) return full;
    if (paint.alpha === 0 && (property === 'fill' || property === 'stroke')) return `${property}=${quote}none${quote}`;
    if (paint.alpha === 1) return `${property}=${quote}${paint.color}${quote}`;
    return `${property}=${quote}${paint.color}${quote} ${opacityAttribute(property)}=${quote}${opacityText(paint.alpha)}${quote}`;
  });

  output = output.replace(PAINT_DECLARATION, (full, property, value) => {
    const paint = splitAlphaHex(value);
    if (!paint) return full;
    if (paint.alpha === 0 && (property === 'fill' || property === 'stroke')) return `${property}:none`;
    if (paint.alpha === 1) return `${property}:${paint.color}`;
    return `${property}:${paint.color};${opacityAttribute(property)}:${opacityText(paint.alpha)}`;
  });

  // Remove alpha from any remaining eight-digit color tokens used by less
  // common SVG properties. Transparent paint properties are handled above.
  return output.replace(ALPHA_HEX, '#$1');
}
