export const WORKSPACE_SESSION_KEY = 'plantuml-workspace-session-v1';

function stringList(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
}

function integerList(value) {
  return Array.isArray(value) ? value.map(Number).filter(Number.isInteger) : [];
}

function safeTab(tab) {
  if (!tab || typeof tab.source !== 'string') return null;
  return {
    source: tab.source,
    filename: typeof tab.filename === 'string' && tab.filename ? tab.filename : 'diagram.puml',
    savedSource: typeof tab.savedSource === 'string' ? tab.savedSource : '',
    isNewFile: Boolean(tab.isNewFile),
    selectionStart: Math.max(0, Number(tab.selectionStart) || 0),
    selectionEnd: Math.max(0, Number(tab.selectionEnd) || 0),
    scrollTop: Math.max(0, Number(tab.scrollTop) || 0),
    scrollLeft: Math.max(0, Number(tab.scrollLeft) || 0),
    foldedStarts: integerList(tab.foldedStarts),
    ignoredSpellingOccurrences: stringList(tab.ignoredSpellingOccurrences),
    ignoredSpellingWords: stringList(tab.ignoredSpellingWords)
  };
}

export function loadWorkspaceSession(storage = globalThis.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(WORKSPACE_SESSION_KEY) || 'null');
    if (!parsed || !Array.isArray(parsed.tabs)) return null;
    const tabs = parsed.tabs.slice(0, 24).map(safeTab).filter(Boolean);
    if (!tabs.length) return null;
    return {
      tabs,
      activeIndex: Math.min(tabs.length - 1, Math.max(0, Number(parsed.activeIndex) || 0)),
      savedAt: Number(parsed.savedAt) || 0
    };
  } catch {
    return null;
  }
}

export function storeWorkspaceSession(storage, tabs, activeTabId, savedAt = Date.now()) {
  const serialized = (tabs || []).map(tab => safeTab({
    ...tab,
    foldedStarts: [...(tab.foldedStarts || [])],
    ignoredSpellingOccurrences: [...(tab.ignoredSpellingOccurrences || [])],
    ignoredSpellingWords: [...(tab.ignoredSpellingWords || [])]
  })).filter(Boolean);
  if (!serialized.length) return false;
  const activeIndex = Math.max(0, (tabs || []).findIndex(tab => tab.id === activeTabId));
  try {
    storage?.setItem(WORKSPACE_SESSION_KEY, JSON.stringify({ version: 1, tabs: serialized, activeIndex, savedAt }));
    return true;
  } catch {
    return false;
  }
}

export function clearWorkspaceSession(storage = globalThis.localStorage) {
  try { storage?.removeItem(WORKSPACE_SESSION_KEY); } catch { /* unavailable storage */ }
}
