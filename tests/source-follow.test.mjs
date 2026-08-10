import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSourceNavigationIndex } from '../src/source-navigation.js';
import { navigationRecordForLine, sourceLineAtOffset } from '../src/source-follow.js';

test('finds the source line at the editor caret', () => {
  assert.equal(sourceLineAtOffset('one\ntwo\nthree', 5), 2);
  assert.equal(sourceLineAtOffset('one\r\ntwo', 6), 2);
});

test('follows an exact rendered record or the nearest diagram section', () => {
  const source = '@startuml\nparticipant A\nparticipant B\n\nA -> B: request\n\nnote over B\n  Working\nend note\n@enduml';
  const index = buildSourceNavigationIndex(source);
  assert.equal(navigationRecordForLine(index, 5).message, 'request');
  assert.equal(navigationRecordForLine(index, 6).message, 'request');
  assert.equal(navigationRecordForLine(index, 8).type, 'note');
});
