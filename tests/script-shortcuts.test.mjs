import test from 'node:test';
import assert from 'node:assert/strict';
import { SCRIPT_SHORTCUTS, expandScriptShortcut, expandSyncCall } from '../src/script-shortcuts.js';

function apply(source, edit) {
  return source.slice(0, edit.start) + edit.text + source.slice(edit.end);
}

test('expands a two-participant synchronous call with activation lifecycle', () => {
  const source = '@startuml\nSync par1 | par2\n@enduml';
  const edit = expandScriptShortcut(source, source.indexOf('par1'));
  assert.equal(apply(source, edit), '@startuml\npar1 -> par2\nactivate par2\npar2 --> par1\ndeactivate par2\n@enduml');
  assert.equal(edit.shortcutId, 'sync-call');
  assert.deepEqual(edit.participants, ['par1', 'par2']);
});

test('chains requests left-to-right and responses right-to-left', () => {
  const expansion = expandSyncCall('A | B | C | D');
  assert.deepEqual(expansion.lines, [
    'A -> B', 'activate B',
    'B -> C', 'activate C',
    'C -> D', 'activate D',
    'D --> C', 'deactivate D',
    'C --> B', 'deactivate C',
    'B --> A', 'deactivate B'
  ]);
});

test('preserves indentation and surrounding CRLF line endings', () => {
  const source = '@startuml\r\n  sYnC Portal | API | DB\r\n@enduml';
  const edit = expandScriptShortcut(source, source.indexOf('Portal'));
  assert.equal(apply(source, edit), '@startuml\r\n  Portal -> API\r\n  activate API\r\n  API -> DB\r\n  activate DB\r\n  DB --> API\r\n  deactivate DB\r\n  API --> Portal\r\n  deactivate API\r\n@enduml');
});

test('supports quoted participant names and pipes inside quotes', () => {
  const expansion = expandSyncCall('"Web | Portal" | API');
  assert.deepEqual(expansion.participants, ['"Web | Portal"', 'API']);
  assert.equal(expansion.lines[0], '"Web | Portal" -> API');
});

test('rejects incomplete or invalid synchronous shortcuts', () => {
  assert.equal(expandSyncCall('OnlyOne'), null);
  assert.equal(expandSyncCall('A | | B'), null);
  assert.equal(expandSyncCall('A | has spaces'), null);
  assert.equal(expandScriptShortcut('A -> B', 2), null);
});

test('shortcut registry accepts future definitions without editor changes', () => {
  const custom = [{ id: 'ping', keyword: 'ping', label: 'Ping', expand: value => ({ lines: [`note ${value}`], participants: [] }) }];
  const edit = expandScriptShortcut('ping right', 3, 3, custom);
  assert.equal(edit.text, 'note right');
  assert.equal(SCRIPT_SHORTCUTS[0].id, 'sync-call');
});
