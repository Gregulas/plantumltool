import test from 'node:test';
import assert from 'node:assert/strict';
import { diagramTitle, safeFileStem, suggestedSourceFilename } from '../src/file-naming.js';

test('uses an inline PlantUML title for the suggested source filename', () => {
  const source = '@startuml\ntitle Create new Application - Update SPL\n@enduml';
  assert.equal(diagramTitle(source), 'Create new Application - Update SPL');
  assert.equal(suggestedSourceFilename(source), 'Create new Application - Update SPL.puml');
});

test('supports multiline titles and removes simple PlantUML markup', () => {
  const source = '@startuml\ntitle\n<size:20>**Loan application**</size>\nUpdate flow\nend title\n@enduml';
  assert.equal(diagramTitle(source), 'Loan application Update flow');
});

test('sanitizes characters that are unsafe in filenames', () => {
  assert.equal(safeFileStem('Loan/API: "Create?" <v2>'), 'Loan API Create');
});

test('falls back to the current filename when no diagram title exists', () => {
  assert.equal(suggestedSourceFilename('@startuml\n@enduml', 'existing-flow.plantuml'), 'existing-flow.puml');
});
