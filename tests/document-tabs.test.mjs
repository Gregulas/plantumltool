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
