export const PLANTUML_BROWSER_RENDER_LIMIT = 16384;

export function patchPlantUmlBrowserLimit(code, limit = PLANTUML_BROWSER_RENDER_LIMIT) {
  const source = String(code ?? '');
  const currentGuard = 'p>4096.0)){q=o.bB0;if(!(q>4096.0)';
  const patchedGuard = `p>${limit}.0)){q=o.bB0;if(!(q>${limit}.0)`;

  if (source.includes(patchedGuard)) return source;
  if (!source.includes(currentGuard) || !source.includes('" (max 4096)"')) {
    throw new Error('The installed @plantuml/core layout does not match the supported 1.2026.6 browser-limit patch.');
  }

  return source
    .replace(currentGuard, patchedGuard)
    .replaceAll('" (max 4096)"', `" (max ${limit})"`);
}
