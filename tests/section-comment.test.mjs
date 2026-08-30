import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleSectionComment } from '../src/section-comment.js';

function apply(source, edit) {
  return source.slice(0, edit.start) + edit.text + source.slice(edit.end);
}

test('comments every selected line while preserving indentation', () => {
  const source = '@startuml\n  participant Portal\n  Portal -> Loan: Request\n@enduml';
  const start = source.indexOf('participant');
  const end = source.indexOf('\n@enduml');
  const edit = toggleSectionComment(source, start, end);
  assert.equal(apply(source, edit), "@startuml\n  ' participant Portal\n  ' Portal -> Loan: Request\n@enduml");
  assert.equal(edit.commented, true);
});

test('uncomments a fully commented selected section', () => {
  const source = "@startuml\n  ' participant Portal\n  ' Portal -> Loan: Request\n@enduml";
  const edit = toggleSectionComment(source, source.indexOf("' participant"), source.indexOf('\n@enduml'));
  assert.equal(apply(source, edit), '@startuml\n  participant Portal\n  Portal -> Loan: Request\n@enduml');
  assert.equal(edit.commented, false);
});

test('comments blank and uncommented lines without duplicating existing comments', () => {
  const source = "participant Portal\n\n' existing\nPortal -> Loan";
  const edit = toggleSectionComment(source, 0, source.length);
  assert.equal(apply(source, edit), "' participant Portal\n' \n' existing\n' Portal -> Loan");
});

test('excludes the next line when a selection ends at its beginning and preserves CRLF', () => {
  const source = 'participant Portal\r\nPortal -> Loan\r\n@enduml';
  const end = source.indexOf('Portal -> Loan');
  const edit = toggleSectionComment(source, 2, end);
  assert.equal(apply(source, edit), "' participant Portal\r\nPortal -> Loan\r\n@enduml");
});

test('requires a non-empty section selection', () => {
  assert.equal(toggleSectionComment('A -> B', 2, 2), null);
});
