import test from 'node:test';
import assert from 'node:assert/strict';
import { clearRecentFiles, loadRecentFiles, RECENT_FILES_KEY, storeRecentFile } from '../src/recent-files.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), values };
}

test('recent files persist source snapshots and newest entries come first', () => {
  const storage = memoryStorage();
  let recent = storeRecentFile(storage, [], { filename: 'one.puml', source: '@startuml\n@enduml', openedAt: 1 });
  recent = storeRecentFile(storage, recent, { filename: 'two.puml', source: '@startuml\nA -> B\n@enduml', openedAt: 2 });
  assert.deepEqual(loadRecentFiles(storage).map(item => item.filename), ['two.puml', 'one.puml']);
  assert.match(loadRecentFiles(storage)[0].source, /A -> B/);
  assert.ok(storage.values.has(RECENT_FILES_KEY));
});

test('reopening a filename updates it without creating a duplicate', () => {
  const storage = memoryStorage();
  let recent = storeRecentFile(storage, [], { filename: 'flow.puml', source: 'old', openedAt: 1 });
  recent = storeRecentFile(storage, recent, { filename: 'flow.puml', source: 'new', openedAt: 2 });
  assert.deepEqual(recent, [{ filename: 'flow.puml', source: 'new', openedAt: 2 }]);
  assert.deepEqual(clearRecentFiles(storage), []);
  assert.deepEqual(loadRecentFiles(storage), []);
});
