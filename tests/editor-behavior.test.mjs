import test from 'node:test';
import assert from 'node:assert/strict';
import { indentedNewlineEdit, lineIndentAt, preferredNewline } from '../src/editor-behavior.js';

test('Enter keeps the current PlantUML indentation level', () => {
  const source = '@startuml\n  Portal -> Loan: Request\n@enduml';
  const caret = source.indexOf('\n@enduml');
  const edit = indentedNewlineEdit(source, caret);
  assert.equal(edit.text, '\n  ');
  assert.equal(edit.caret, caret + 3);
});

test('Enter at top-level starts the next line at column one', () => {
  const source = '@startuml\nparticipant Portal\n@enduml';
  const caret = source.indexOf('\n@enduml');
  const edit = indentedNewlineEdit(source, caret);
  assert.equal(edit.text, '\n');
});

test('indent is derived from the current line even when caret is mid-line', () => {
  const source = '    Portal -> Loan: Request';
  assert.equal(lineIndentAt(source, source.indexOf('Loan')), '    ');
});

test('CRLF files keep their line-ending style when Enter is pressed', () => {
  const source = '@startuml\r\n\tPortal -> Loan: Request\r\n@enduml';
  const caret = source.indexOf('\r\n@enduml');
  const edit = indentedNewlineEdit(source, caret);
  assert.equal(preferredNewline(source), '\r\n');
  assert.equal(edit.text, '\r\n\t');
});
