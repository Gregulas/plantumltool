import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPlantUml, formatPlantUmlEdit } from '../src/formatter.js';

test('formats sequence blocks with nested branches', () => {
  const source = `@startuml\nalt Success\nPortal -> Loan: Request\nelse Failure\nPortal -> Customer: Error\nend\n@enduml`;
  const expected = `@startuml\nalt Success\n  Portal -> Loan: Request\nelse Failure\n  Portal -> Customer: Error\nend\n@enduml`;
  assert.equal(formatPlantUml(source), expected);
});

test('formats braces, box and note bodies', () => {
  const source = `@startuml\nskinparam sequence {\nArrowColor #000000\n}\nbox Web Portal\nparticipant Portal\nnote over Portal\nhello\nend note\nend box\n@enduml`;
  const expected = `@startuml\nskinparam sequence {\n  ArrowColor #000000\n}\nbox Web Portal\n  participant Portal\n  note over Portal\n    hello\n  end note\nend box\n@enduml`;
  assert.equal(formatPlantUml(source), expected);
});

test('formats activity blocks', () => {
  const source = `@startuml\nstart\nif (Eligible?) then (yes)\n:Create offer;\nelse (no)\n:Reject;\nendif\nstop\n@enduml`;
  const expected = `@startuml\nstart\nif (Eligible?) then (yes)\n  :Create offer;\nelse (no)\n  :Reject;\nendif\nstop\n@enduml`;
  assert.equal(formatPlantUml(source), expected);
});

test('does not treat standalone activity end as a formatter block closer', () => {
  const source = `@startuml\nstart\n:Work;\nend\n@enduml`;
  assert.equal(formatPlantUml(source), source);
});

test('preserves caret by logical content offset after indentation changes', () => {
  const source = `@startuml\nalt A\nPortal -> Loan: Request\nend\n@enduml`;
  const caret = source.indexOf('Request') + 3;
  const edit = formatPlantUmlEdit(source, caret, caret);
  assert.equal(edit.text, `@startuml\nalt A\n  Portal -> Loan: Request\nend\n@enduml`);
  assert.equal(edit.text.slice(edit.selectionStart - 3, edit.selectionStart + 4), 'Request');
});
