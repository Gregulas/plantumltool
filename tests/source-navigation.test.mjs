import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSourceNavigationIndex,
  findTextNavigationTarget,
  plantUmlSvgLineToSourceLine,
  relocateNavigationTarget,
  resolveNavigationTarget
} from '../src/source-navigation.js';

test('maps a participant SVG label to its declaration', () => {
  const source = `@startuml\nparticipant "Web Portal" as Portal\nparticipant "Loan MS" as Loan\nPortal -> Loan: Create application\n@enduml`;
  const index = buildSourceNavigationIndex(source);
  const target = resolveNavigationTarget(index, {
    classNames: 'participant participant-head',
    attributes: { 'data-participant': 'Portal' },
    texts: ['Web Portal'],
    clickedText: 'Web Portal'
  });
  assert.equal(target?.line, 2);
  assert.equal(target?.reference, 'Portal');
});

test('maps a sequence message to the exact relationship line', () => {
  const source = `@startuml\nparticipant A\nparticipant B\nA -> B: First request\nA -> B: Second request\n@enduml`;
  const index = buildSourceNavigationIndex(source);
  const target = resolveNavigationTarget(index, {
    classNames: 'message',
    attributes: { 'data-participant-1': 'A', 'data-participant-2': 'B' },
    clickedText: 'Second request',
    texts: ['Second request']
  });
  assert.equal(target?.line, 5);
  assert.equal(target?.message, 'Second request');
});

test('maps asynchronous sequence arrows to their exact relationship lines', () => {
  const source = `@startuml
participant Portal
participant API
Portal ->> API: Submit asynchronously
API -->> Portal: Accepted response
Portal <<-- API: Callback notification
@enduml`;
  const index = buildSourceNavigationIndex(source);
  const relationships = index.records.filter(record => record.type === 'relationship');
  assert.deepEqual(relationships.map(record => ({ line: record.line, source: record.source, target: record.target, message: record.message })), [
    { line: 4, source: 'Portal', target: 'API', message: 'Submit asynchronously' },
    { line: 5, source: 'API', target: 'Portal', message: 'Accepted response' },
    { line: 6, source: 'Portal', target: 'API', message: 'Callback notification' }
  ]);
  const target = resolveNavigationTarget(index, {
    classNames: 'message',
    attributes: { 'data-participant-1': 'API', 'data-participant-2': 'Portal' },
    clickedText: 'Accepted response',
    texts: ['Accepted response']
  });
  assert.equal(target?.line, 5);
});

test('maps inline and multiline note text to its exact source line', () => {
  const source = `@startuml
participant Portal
note right of Portal
First explanatory comment
Portal -> API: example text inside the note
Final explanatory comment
end note
note over Portal: Inline explanatory comment
@enduml`;
  const index = buildSourceNavigationIndex(source);
  const notes = index.records.filter(record => record.type === 'note');
  assert.deepEqual(notes.map(record => ({ line: record.line, label: record.label })), [
    { line: 4, label: 'First explanatory comment' },
    { line: 5, label: 'Portal -> API: example text inside the note' },
    { line: 6, label: 'Final explanatory comment' },
    { line: 8, label: 'Inline explanatory comment' }
  ]);
  assert.equal(index.records.some(record => record.type === 'relationship' && record.line === 5), false);
  assert.equal(findTextNavigationTarget(source, ['Final explanatory comment'])?.line, 6);
  assert.equal(findTextNavigationTarget(source, ['Inline explanatory comment'])?.line, 8);
});

test('maps class members to their member source lines', () => {
  const source = `@startuml\nclass Application {\n  +id: UUID\n  +submit()\n}\n@enduml`;
  const index = buildSourceNavigationIndex(source);
  const target = resolveNavigationTarget(index, {
    classNames: 'entity',
    clickedText: '+submit()',
    texts: ['Application', '+id: UUID', '+submit()']
  });
  assert.equal(target?.type, 'member');
  assert.equal(target?.line, 4);
});

test('relocates a rendered element after lines are inserted in the editor', () => {
  const rendered = buildSourceNavigationIndex(`@startuml\nparticipant "Loan MS" as Loan\n@enduml`).records.find(record => record.reference === 'Loan');
  const relocated = relocateNavigationTarget(rendered, `@startuml\ntitle Example\n\nparticipant "Loan MS" as Loan\n@enduml`);
  assert.equal(relocated?.line, 4);
});

test('implicit state is mapped to its first relationship use', () => {
  const source = `@startuml\n[*] --> Draft\nDraft --> Submitted : submit\n@enduml`;
  const index = buildSourceNavigationIndex(source);
  const target = resolveNavigationTarget(index, {
    classNames: 'entity state',
    attributes: { 'data-entity': 'Submitted' },
    clickedText: 'Submitted',
    texts: ['Submitted']
  });
  assert.equal(target?.reference, 'Submitted');
  assert.equal(target?.line, 3);
});

test('generic rendered text can fall back to a matching source line', async () => {
  const { findTextNavigationTarget } = await import('../src/source-navigation.js');
  const source = `@startwbs\n* Architecture\n** Loan Services\n@endwbs`;
  const target = findTextNavigationTarget(source, ['Loan Services']);
  assert.equal(target?.line, 3);
  assert.equal(target?.type, 'text');
});


test('converts PlantUML zero-based SVG source lines to one-based editor lines', () => {
  assert.equal(plantUmlSvgLineToSourceLine('0'), 1);
  assert.equal(plantUmlSvgLineToSourceLine('4'), 5);
  assert.equal(plantUmlSvgLineToSourceLine('4', 1), 4);
});

test('native SVG source metadata resolves the clicked implementation line, not the previous line', () => {
  const source = `@startuml\nparticipant A\nparticipant B\nA -> B: First request\nA -> B: Second request\n@enduml`;
  const index = buildSourceNavigationIndex(source);
  const sourceLine = plantUmlSvgLineToSourceLine('4'); // PlantUML metadata is zero-based.
  const target = resolveNavigationTarget(index, { sourceLine, clickedText: 'Second request' });
  assert.equal(target?.line, 5);
  assert.equal(target?.message, 'Second request');
});
