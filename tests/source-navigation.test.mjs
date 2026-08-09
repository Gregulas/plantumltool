import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSourceNavigationIndex,
  canonicalNavigationText,
  findTextNavigationTarget,
  plantUmlSvgLineToSourceLine,
  registerNavigationRecord,
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

test('keeps endpoint decorations inside asynchronous arrow operators', () => {
  const source = `@startuml
participant Portal
participant API
Portal -->>o API: Queued request
API o<<-- Portal: Callback response
@enduml`;
  const relationships = buildSourceNavigationIndex(source).records.filter(record => record.type === 'relationship');
  assert.deepEqual(relationships.map(record => ({ source: record.source, target: record.target, message: record.message })), [
    { source: 'Portal', target: 'API', message: 'Queued request' },
    { source: 'API', target: 'Portal', message: 'Callback response' }
  ]);
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

test('indexes every sequence section, delay, and page separator in source order', () => {
  const source = `@startuml
participant A
participant B
== Repeated phase ==
A -> B: First message
... Waiting period ...
== Repeated phase ==
B -> A: Second message
... Waiting period ...
newpage Final page
@enduml`;
  const separators = buildSourceNavigationIndex(source).records
    .filter(record => ['divider', 'delay', 'page-separator'].includes(record.type));
  assert.deepEqual(separators.map(record => ({ type: record.type, line: record.line, label: record.label })), [
    { type: 'divider', line: 4, label: 'Repeated phase' },
    { type: 'delay', line: 6, label: 'Waiting period' },
    { type: 'divider', line: 7, label: 'Repeated phase' },
    { type: 'delay', line: 9, label: 'Waiting period' },
    { type: 'page-separator', line: 10, label: 'Final page' }
  ]);
});

test('normalizes formatted note and separator text for rendered matching', () => {
  assert.equal(canonicalNavigationText('**Important phase**'), canonicalNavigationText('Important phase'));
  assert.equal(canonicalNavigationText('<b>Bold comment</b>'), canonicalNavigationText('Bold comment'));
  assert.equal(canonicalNavigationText('Mixed **bold words** here'), canonicalNavigationText('Mixed bold words here'));
});

test('registers native SVG source-line records for detached navigation', () => {
  const index = buildSourceNavigationIndex('@startuml\nnote over A\n**Bold comment**\nend note\n@enduml');
  const nativeRecord = { id: 'nav-3-0', type: 'source-line', line: 3, label: 'Bold comment', statement: '**Bold comment**' };
  assert.equal(index.byId.has(nativeRecord.id), false);
  assert.equal(registerNavigationRecord(index, nativeRecord), true);
  assert.equal(index.byId.get(nativeRecord.id), nativeRecord);
});

test('indexes every supported declared object type', () => {
  const kinds = [
    'actor', 'participant', 'boundary', 'control', 'entity', 'database', 'collections', 'queue',
    'component', 'node', 'cloud', 'artifact', 'rectangle', 'usecase', 'state', 'class', 'interface',
    'enum', 'annotation', 'object', 'package', 'folder', 'frame', 'card', 'file', 'storage', 'agent',
    'stack', 'hexagon', 'label', 'person'
  ];
  const declarations = kinds.map((kind, index) => `${kind} "Object ${index}" as Object${index}`);
  declarations.push('archimate #Technology "Architecture Service" as ArchitectureService');
  const index = buildSourceNavigationIndex(`@startuml\n${declarations.join('\n')}\n@enduml`);
  const elements = index.records.filter(record => record.type === 'element' && !record.implicit);
  assert.equal(elements.length, 32);
  assert.deepEqual(elements.map(record => record.kind), [...kinds, 'archimate']);
  assert.equal(elements.at(-1).reference, 'ArchitectureService');
  assert.equal(elements.at(-1).label, 'Architecture Service');
});

test('keeps state start and end pseudo-objects as special references', () => {
  const index = buildSourceNavigationIndex('@startuml\n[*] --> Ready\nReady --> [*]\n@enduml');
  const relationships = index.records.filter(record => record.type === 'relationship');
  assert.deepEqual(relationships.map(record => [record.source, record.target]), [['[*]', 'Ready'], ['Ready', '[*]']]);
  assert.equal(index.records.some(record => record.type === 'element' && record.reference === '[*]'), false);
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
