export function availableScreenBounds(screenInfo = {}) {
  return {
    left: Number(screenInfo.availLeft) || 0,
    top: Number(screenInfo.availTop) || 0,
    width: Math.max(320, Number(screenInfo.availWidth) || Number(screenInfo.width) || 1100),
    height: Math.max(240, Number(screenInfo.availHeight) || Number(screenInfo.height) || 760)
  };
}

export function isNearBounds(windowInfo, bounds, tolerance = 32) {
  return Math.abs(Number(windowInfo?.x) - bounds.left) <= tolerance
    && Math.abs(Number(windowInfo?.y) - bounds.top) <= tolerance
    && Math.abs(Number(windowInfo?.width) - bounds.width) <= tolerance
    && Math.abs(Number(windowInfo?.height) - bounds.height) <= tolerance;
}
