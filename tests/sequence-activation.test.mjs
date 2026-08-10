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

test('asynchronous arrows activate only their direct target', () => {
  for (const arrow of ['-->>', '-->>o']) {
    const asyncSource = `@startuml\nparticipant A\nparticipant B\nparticipant C\nA ${arrow} B: async\nB -> C: later\nC --> B: return\n@enduml`;
    const index = buildSourceNavigationIndex(asyncSource);
    const selected = index.records.find(record => record.message === 'async');
    const action = sequenceActivationAction(asyncSource, index, selected);
    assert.deepEqual(action.events.map(({ command, actor }) => [command, actor]), [['activate', 'B']]);
    const updated = applySequenceActivation(asyncSource, action);
    assert.match(updated, new RegExp(`A ${arrow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} B: async\\nactivate B`));
    assert.doesNotMatch(updated, /activate C/);
  }
});

test('a synchronous call does not treat a nested async arrow as a return', () => {
  const mixed = `@startuml\nparticipant A\nparticipant B\nparticipant C\nA -> B: start\nB -->>o C: notify\nB --> A: done\n@enduml`;
  const index = buildSourceNavigationIndex(mixed);
  const selected = index.records.find(record => record.message === 'start');
  const events = sequenceActivationAction(mixed, index, selected).events;
  assert.deepEqual(events.map(({ command, actor }) => [command, actor]), [
    ['activate', 'B'], ['activate', 'C'], ['deactivate', 'B']
  ]);
});
