import test from 'node:test';
import assert from 'node:assert/strict';
import { SHORTCUT_GROUPS, shortcutAction } from '../src/keyboard-shortcuts.js';

const event = (key, options = {}) => ({
  key, code: options.code || '', ctrlKey: options.ctrlKey ?? true,
  metaKey: options.metaKey ?? false, altKey: options.altKey ?? false,
  shiftKey: options.shiftKey ?? false
});

test('maps standard file, editing, rendering, and zoom shortcuts', () => {
  assert.equal(shortcutAction(event('n')), 'new');
  assert.equal(shortcutAction(event('s', { shiftKey: true })), 'save-as');
  assert.equal(shortcutAction(event('z', { shiftKey: true })), 'redo');
  assert.equal(shortcutAction(event('Enter')), 'render');
  assert.equal(shortcutAction(event('=')), 'zoom-in');
  assert.equal(shortcutAction(event('-')), 'zoom-out');
  assert.equal(shortcutAction(event('0')), 'zoom-reset');
  assert.equal(shortcutAction(event("'", { code: 'Quote' })), 'toggle-section-comment');
  assert.equal(shortcutAction(event('e', { shiftKey: true })), 'expand-script-shortcut');
});

test('maps alternate shortcuts by physical key code', () => {
  assert.equal(shortcutAction(event('ç', { altKey: true, code: 'KeyC' })), 'copy-svg');
  assert.equal(shortcutAction(event('¡', { altKey: true, code: 'Digit1' })), 'template-sequence');
  assert.equal(shortcutAction(event('?', { altKey: true, code: 'Slash', metaKey: true, ctrlKey: false })), 'show-shortcuts');
});

test('ignores keys without Ctrl or Command and documents every action', () => {
  assert.equal(shortcutAction(event('+', { ctrlKey: false })), null);
  assert.equal(SHORTCUT_GROUPS.reduce((count, group) => count + group.items.length, 0), 32);
  assert.ok(SHORTCUT_GROUPS.some(group => group.items.some(item => item[0] === 'Show suggestions' && item[1] === 'Autocomplete')));
});
