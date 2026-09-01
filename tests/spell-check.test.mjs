import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProseSpelling, proseSegments } from '../src/spell-check-core.js';

const checker = {
  correct(word) { return !['recieve', 'aplication', 'statuz'].includes(word.toLowerCase()); },
  suggest(word) { return ({ recieve: ['receive'], aplication: ['application'], statuz: ['status'] })[word.toLowerCase()] || []; }
};

test('checks arrow labels and note prose but not object names', () => {
  const source = `@startuml
participant "Recieve Portal" as RecievePortal
RecievePortal -> LoanMS: Recieve aplication status
note right of LoanMS
  Check the statuz carefully
end note
@enduml`;
  assert.deepEqual(proseSegments(source).map(item => item.text.trim()), ['Recieve aplication status', 'Check the statuz carefully']);
  assert.deepEqual(analyzeProseSpelling(source, checker).map(item => item.message), [
    'Possible spelling mistake: “Recieve”.', 'Possible spelling mistake: “aplication”.', 'Possible spelling mistake: “statuz”.'
  ]);
  assert.deepEqual(analyzeProseSpelling(source, checker).map(item => item.ignoreKey), ['recieve:1', 'aplication:1', 'statuz:1']);
});

test('numbers repeated misspellings for stable single-occurrence ignoring', () => {
  const diagnostics = analyzeProseSpelling('@startuml\nA -> B: aplication\nB -> A: aplication\n@enduml', checker);
  assert.deepEqual(diagnostics.map(item => item.ignoreKey), ['aplication:1', 'aplication:2']);
  assert.ok(diagnostics.every(item => item.word === 'aplication'));
});

test('checks inline notes and creates an exact replacement fix', () => {
  const source = '@startuml\nnote right: Fix aplication status\n@enduml';
  const [diagnostic] = analyzeProseSpelling(source, checker);
  assert.equal(source.slice(diagnostic.fix.start, diagnostic.fix.end), 'aplication');
  assert.equal(diagnostic.fix.text, 'application');
});

test('ignores formatting tags while preserving visible-word fix offsets', () => {
  const source = '@startuml\nA -> B: <color:#169C9A><size:18>Recieve</size></color>\n@enduml';
  const diagnostics = analyzeProseSpelling(source, checker);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].word, 'Recieve');
  assert.equal(source.slice(diagnostics[0].fix.start, diagnostics[0].fix.end), 'Recieve');
});

test('ignores declarations, unlabeled arrows, and acronyms', () => {
  const source = '@startuml\nparticipant Aplication\nAplication -> API\nAplication -> API: Send HTTP API data\n@enduml';
  assert.deepEqual(analyzeProseSpelling(source, checker), []);
});

test('checks text displayed on asynchronous arrows', () => {
  const source = '@startuml\nA ->> B: aplication queued\nB -->> A: statuz received\n@enduml';
  assert.deepEqual(analyzeProseSpelling(source, checker).map(item => item.word), ['aplication', 'statuz']);
});

test('checks text on asynchronous arrows with endpoint decorations', () => {
  const source = '@startuml\nA -->>o B: aplication queued\nB o<<-- A: statuz received\n@enduml';
  assert.deepEqual(analyzeProseSpelling(source, checker).map(item => item.word), ['aplication', 'statuz']);
});

test('reports and fixes the exact multiline note line in CRLF files', () => {
  const lines = Array.from({ length: 152 }, (_, index) => `' filler ${index + 1}`);
  lines.push('note over Portal', '- Enforcement judgment', '- Bounced aplication', '- defaulted communication bells', 'end note', '@enduml');
  const source = lines.join('\r\n');
  const [diagnostic] = analyzeProseSpelling(source, checker);
  assert.equal(diagnostic.line, 155);
  assert.equal(diagnostic.column, 11);
  assert.equal(source.slice(diagnostic.range.start, diagnostic.range.end), 'aplication');
  assert.equal(source.slice(diagnostic.fix.start, diagnostic.fix.end), 'aplication');
});
