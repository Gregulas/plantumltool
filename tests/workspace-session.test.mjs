import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkspaceSession, storeWorkspaceSession } from '../src/workspace-session.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

test('restores open tabs, unsaved changes, selection, and active tab', () => {
  const storage = memoryStorage();
  const tabs = [
    { id: 'one', source: 'A -> B', filename: 'one.puml', savedSource: 'A -> B', isNewFile: false, selectionStart: 1, selectionEnd: 2, foldedStarts: new Set(), ignoredSpellingOccurrences: new Set(), ignoredSpellingWords: new Set() },
    { id: 'two', source: 'C -> D: changed', filename: 'two.puml', savedSource: 'C -> D', isNewFile: false, selectionStart: 3, selectionEnd: 8, scrollTop: 90, foldedStarts: new Set([2]), ignoredSpellingOccurrences: new Set(['x:1']), ignoredSpellingWords: new Set(['custom']) }
  ];
  assert.equal(storeWorkspaceSession(storage, tabs, 'two', 42), true);
  const restored = loadWorkspaceSession(storage);
  assert.equal(restored.activeIndex, 1);
  assert.equal(restored.savedAt, 42);
  assert.equal(restored.tabs[1].source, 'C -> D: changed');
  assert.equal(restored.tabs[1].savedSource, 'C -> D');
  assert.deepEqual(restored.tabs[1].foldedStarts, [2]);
  assert.deepEqual(restored.tabs[1].ignoredSpellingWords, ['custom']);
});

test('ignores corrupt workspace data', () => {
  const storage = memoryStorage();
  storage.setItem('plantuml-workspace-session-v1', '{bad');
  assert.equal(loadWorkspaceSession(storage), null);
});
