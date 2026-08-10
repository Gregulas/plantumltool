export const RECENT_FILES_KEY = 'plantuml-recent-files-v1';

export function loadRecentFiles(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage?.getItem(RECENT_FILES_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter(item => typeof item?.filename === 'string' && typeof item?.source === 'string')
      .map(item => ({ filename: item.filename, source: item.source, openedAt: Number(item.openedAt) || 0 }))
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function storeRecentFile(storage, recentFiles, { filename, source, openedAt = Date.now() }) {
  const next = [
    { filename: String(filename || 'diagram.puml'), source: String(source ?? ''), openedAt },
    ...recentFiles.filter(item => item.filename !== filename)
  ].slice(0, 8);
  while (next.length) {
    try {
      storage?.setItem(RECENT_FILES_KEY, JSON.stringify(next));
      return next;
    } catch {
      next.pop();
    }
  }
  return [];
}

export function clearRecentFiles(storage = globalThis.localStorage) {
  try { storage?.removeItem(RECENT_FILES_KEY); } catch { /* storage may be unavailable */ }
  return [];
}
