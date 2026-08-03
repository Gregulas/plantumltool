import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSourceNavigationIndex,
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
