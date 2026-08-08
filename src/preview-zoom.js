export function zoomedSvgDimensions(viewBox, zoom) {
  const width = Number(viewBox?.width);
  const height = Number(viewBox?.height);
  const scale = Number(zoom);
  if (!(width > 0) || !(height > 0) || !(scale > 0)) return null;
  return { width: width * scale, height: height * scale };
}

export function scrollCanvasDimensions(svg, viewport, padding = {}) {
  const horizontalPadding = (Number(padding.left) || 0) + (Number(padding.right) || 0);
  const verticalPadding = (Number(padding.top) || 0) + (Number(padding.bottom) || 0);
  return {
    width: Math.max(Number(viewport?.width) || 0, (Number(svg?.width) || 0) + horizontalPadding),
    height: Math.max(Number(viewport?.height) || 0, (Number(svg?.height) || 0) + verticalPadding)
  };
}
