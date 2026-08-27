import test from 'node:test';
import assert from 'node:assert/strict';
import { autocompleteShortcutLabel, detectShortcutPlatform, formatShortcutLabel, isAutocompleteShortcut } from '../src/shortcut-platform.js';

test('detects Apple platforms and displays Cmd plus Option', () => {
  assert.equal(detectShortcutPlatform({ platform: 'MacIntel' }), 'mac');
  assert.equal(detectShortcutPlatform({ userAgentData: { platform: 'macOS' } }), 'mac');
  assert.equal(formatShortcutLabel('Ctrl/Cmd+Alt+W', 'mac'), 'Cmd+Option+W');
  assert.equal(autocompleteShortcutLabel('mac'), 'Option+Space');
  assert.equal(isAutocompleteShortcut({ code: 'Space', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false }, 'mac'), true);
});

test('detects Windows and displays Ctrl plus Alt', () => {
  assert.equal(detectShortcutPlatform({ platform: 'Win32' }), 'windows');
  assert.equal(formatShortcutLabel('Ctrl/Cmd+Alt+W', 'windows'), 'Ctrl+Alt+W');
  assert.equal(formatShortcutLabel('Autocomplete', 'windows'), 'Ctrl+Space');
  assert.equal(isAutocompleteShortcut({ code: 'Space', altKey: false, ctrlKey: true, metaKey: false, shiftKey: false }, 'windows'), true);
  assert.equal(isAutocompleteShortcut({ code: 'Space', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false }, 'windows'), false);
});

test('uses Linux labels for other desktop platforms', () => {
  assert.equal(detectShortcutPlatform({ platform: 'Linux x86_64' }), 'linux');
  assert.equal(formatShortcutLabel('Ctrl/Cmd+Shift+M', 'linux'), 'Ctrl+Shift+M');
  assert.equal(autocompleteShortcutLabel('linux'), 'Ctrl+Space');
});
