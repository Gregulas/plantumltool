import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GUEST_PROFILE_ID, PROFILE_REGISTRY_KEY, createUserProfile, deleteUserProfile,
  initializeUserProfiles, listUserProfiles, selectUserProfile
} from '../src/user-profiles.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

test('guest mode keeps profile data in memory only', () => {
  const browser = memoryStorage();
  const context = initializeUserProfiles(browser);
  assert.equal(context.isGuest, true);
  assert.equal(context.needsSelection, true);
  context.storage.setItem('plantuml-local-source', 'temporary');
  assert.equal(context.storage.getItem('plantuml-local-source'), 'temporary');
  assert.equal(browser.values.size, 0);
});

test('named profiles isolate data using scoped browser keys', () => {
  const browser = memoryStorage();
  const first = createUserProfile(browser, 'Architecture', { id: 'architecture' });
  const second = createUserProfile(browser, 'Personal', { id: 'personal' });
  assert.equal(selectUserProfile(browser, first.id), true);
  const firstContext = initializeUserProfiles(browser);
  firstContext.storage.setItem('plantuml-local-source', 'A -> B');
  selectUserProfile(browser, second.id);
  const secondContext = initializeUserProfiles(browser);
  assert.equal(secondContext.storage.getItem('plantuml-local-source'), null);
  secondContext.storage.setItem('plantuml-local-source', 'C -> D');
  selectUserProfile(browser, first.id);
  assert.equal(initializeUserProfiles(browser).storage.getItem('plantuml-local-source'), 'A -> B');
});

test('legacy browser data migrates once into a default profile', () => {
  const browser = memoryStorage({ 'plantuml-local-source': '@startuml\nA -> B\n@enduml' });
  const context = initializeUserProfiles(browser);
  assert.equal(context.profile.id, 'default');
  assert.equal(context.storage.getItem('plantuml-local-source'), '@startuml\nA -> B\n@enduml');
  assert.equal(browser.getItem('plantuml-local-source'), null);
  assert.ok(browser.getItem(PROFILE_REGISTRY_KEY));
});

test('deleting a profile removes its scoped data and returns active use to guest', () => {
  const browser = memoryStorage();
  const profile = createUserProfile(browser, 'Work', { id: 'work' });
  selectUserProfile(browser, profile.id);
  initializeUserProfiles(browser).storage.setItem('recent', 'secret');
  assert.equal(deleteUserProfile(browser, profile.id), true);
  assert.equal(listUserProfiles(browser).length, 0);
  assert.equal(initializeUserProfiles(browser).profile.id, GUEST_PROFILE_ID);
  assert.equal([...browser.values.keys()].some(key => key.includes('work:recent')), false);
});
