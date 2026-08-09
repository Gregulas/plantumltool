import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSourceNavigationIndex } from '../src/source-navigation.js';
import { applySequenceActivation, sequenceActivationAction } from '../src/sequence-activation.js';

const source = `@startuml
participant A
participant B
participant C
A -> B: start
B -> C: nested
C --> B: nested return
B --> A: done
@enduml`;

test('activates a call and its nested calls until control returns to the caller', () => {
  const index = buildSourceNavigationIndex(source);
  const selected = index.records.find(record => record.message === 'start');
  const action = sequenceActivationAction(source, index, selected);
  assert.equal(action.label, 'Activate action');
  assert.deepEqual(action.events.map(({ command, actor }) => [command, actor]), [
    ['activate', 'B'], ['activate', 'C'], ['deactivate', 'C'], ['deactivate', 'B']
  ]);
  const updated = applySequenceActivation(source, action);
  assert.match(updated, /A -> B: start\nactivate B/);
  assert.match(updated, /B -> C: nested\nactivate C/);
  assert.match(updated, /C --> B: nested return\ndeactivate C/);
  assert.match(updated, /B --> A: done\ndeactivate B/);
});

test('offers deactivation when the generated call scope is already active', () => {
  const index = buildSourceNavigationIndex(source);
  const selected = index.records.find(record => record.message === 'start');
  const activated = applySequenceActivation(source, sequenceActivationAction(source, index, selected));
  const activatedIndex = buildSourceNavigationIndex(activated);
  const current = activatedIndex.records.find(record => record.message === 'start');
  const action = sequenceActivationAction(activated, activatedIndex, current);
  assert.equal(action.label, 'Deactivate action');
  assert.equal(applySequenceActivation(activated, action), source);
});

test('deactivation selected on a return only deactivates at that return', () => {
  const activated = source.replace('A -> B: start', 'A -> B: start\nactivate B');
  const index = buildSourceNavigationIndex(activated);
  const selected = index.records.find(record => record.message === 'done');
  const action = sequenceActivationAction(activated, index, selected);
  assert.equal(action.label, 'Deactivate until this return');
  assert.match(applySequenceActivation(activated, action), /B --> A: done\ndeactivate B/);
});
