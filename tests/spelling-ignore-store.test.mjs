import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSpellingIgnores, SPELLING_IGNORES_KEY, storeSpellingIgnores } from '../src/spelling-ignore-store.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}

test('persists ignored spelling choices for the same design file', () => {
  const storage = memoryStorage();
  assert.equal(storeSpellingIgnores(storage, 'Application.puml', {
    occurrences: new Set(['recieve:1']),
    words: new Set(['Statuz'])
  }), true);
  assert.deepEqual(loadSpellingIgnores(storage, 'application.PUML'), {
    occurrences: ['recieve:1'],
    words: ['statuz']
  });
  assert.ok(storage.values.has(SPELLING_IGNORES_KEY));
});

test('keeps spelling ignore lists independent between design files', () => {
  const storage = memoryStorage();
  storeSpellingIgnores(storage, 'one.puml', { words: ['customword'] });
  storeSpellingIgnores(storage, 'two.puml', { occurrences: ['mistke:1'] });
  assert.deepEqual(loadSpellingIgnores(storage, 'one.puml'), { occurrences: [], words: ['customword'] });
  assert.deepEqual(loadSpellingIgnores(storage, 'two.puml'), { occurrences: ['mistke:1'], words: [] });
});

test('recovers safely from invalid persisted spelling data', () => {
  const storage = memoryStorage();
  storage.setItem(SPELLING_IGNORES_KEY, '{invalid');
  assert.deepEqual(loadSpellingIgnores(storage, 'flow.puml'), { occurrences: [], words: [] });
});
