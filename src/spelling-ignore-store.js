export const SPELLING_IGNORES_KEY = 'plantuml-spelling-ignores-v1';

function designKey(filename) {
  return String(filename || '').trim().toLowerCase();
}

function readAll(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(SPELLING_IGNORES_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function stringList(value) {
  return Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string' && item))] : [];
}

export function loadSpellingIgnores(storage = globalThis.localStorage, filename = '') {
  const entry = readAll(storage)[designKey(filename)] || {};
  return {
    occurrences: stringList(entry.occurrences),
    words: stringList(entry.words).map(word => word.toLowerCase())
  };
}

export function storeSpellingIgnores(storage, filename, { occurrences = [], words = [] } = {}) {
  const key = designKey(filename);
  if (!key) return false;
  const all = readAll(storage);
  all[key] = {
    occurrences: stringList([...occurrences]),
    words: stringList([...words].map(word => String(word).toLowerCase()))
  };
  try {
    storage?.setItem(SPELLING_IGNORES_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}
