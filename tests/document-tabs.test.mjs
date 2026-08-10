import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentTab, isDocumentDirty, sourceForSelection } from '../src/document-tabs.js';
import { buildSourceNavigationIndex } from '../src/source-navigation.js';

test('each document tracks its own saved state', () => {
  const saved = createDocumentTab('@startuml\n@enduml', 'saved.puml', { saved: true });
  const fresh = createDocumentTab('@startuml\n@enduml', 'new.puml', { isNew: true });
  assert.equal(isDocumentDirty(saved), false);
  saved.source += '\n';
  assert.equal(isDocumentDirty(saved), true);
  assert.equal(isDocumentDirty(fresh), true);
});

test('selection export includes referenced declarations but selects only requested script', () => {
  const source = `@startuml
participant Portal
participant API
participant Unused
Portal -> API: Submit request
@enduml`;
  const start = source.indexOf('Portal -> API');
  const result = sourceForSelection(source, start, start + 'Portal -> API: Submit request'.length, buildSourceNavigationIndex(source));
  assert.match(result.source, /participant Portal/);
  assert.match(result.source, /participant API/);
  assert.doesNotMatch(result.source, /participant Unused/);
  assert.equal(result.source.slice(result.selectionStart, result.selectionEnd), 'Portal -> API: Submit request');
});

test('selection export preserves global and enclosing actor styles', () => {
  const source = `@startuml
skinparam sequence {
  ParticipantBorderColor #32BCBB
}
box "Web" #EAF8F7
participant "Portal" as Portal <<service>> #ff9f8f
end box
participant API
Portal -> API: Submit request
@enduml`;
  const index = buildSourceNavigationIndex(source);
  const start = source.indexOf('Portal -> API');
  const result = sourceForSelection(source, start, start + 'Portal -> API: Submit request'.length, index);
  assert.match(result.source, /skinparam sequence \{/);
  assert.match(result.source, /box "Web" #EAF8F7/);
  assert.match(result.source, /participant "Portal" as Portal <<service>> #ff9f8f/);
  assert.match(result.source, /end box/);
});
