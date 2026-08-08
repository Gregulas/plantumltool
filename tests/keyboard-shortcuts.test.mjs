import test from 'node:test';
import assert from 'node:assert/strict';
import { zoomShortcutAction } from '../src/keyboard-shortcuts.js';

test('maps standard Ctrl/Cmd zoom shortcuts', () => {
  assert.equal(zoomShortcutAction({ ctrlKey: true, metaKey: false, altKey: false, key: '+' }), 'in');
  assert.equal(zoomShortcutAction({ ctrlKey: true, metaKey: false, altKey: false, key: '=' }), 'in');
  assert.equal(zoomShortcutAction({ ctrlKey: false, metaKey: true, altKey: false, key: '-' }), 'out');
  assert.equal(zoomShortcutAction({ ctrlKey: false, metaKey: true, altKey: false, key: '0' }), 'reset');
});

test('ignores unmodified and Alt-modified zoom keys', () => {
  assert.equal(zoomShortcutAction({ ctrlKey: false, metaKey: false, altKey: false, key: '+' }), null);
  assert.equal(zoomShortcutAction({ ctrlKey: true, metaKey: false, altKey: true, key: '-' }), null);
});
