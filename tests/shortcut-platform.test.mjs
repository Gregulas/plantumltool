import test from 'node:test';
import assert from 'node:assert/strict';
import { detectShortcutPlatform, formatShortcutLabel } from '../src/shortcut-platform.js';

test('detects Apple platforms and displays Cmd plus Option', () => {
  assert.equal(detectShortcutPlatform({ platform: 'MacIntel' }), 'mac');
  assert.equal(detectShortcutPlatform({ userAgentData: { platform: 'macOS' } }), 'mac');
  assert.equal(formatShortcutLabel('Ctrl/Cmd+Alt+W', 'mac'), 'Cmd+Option+W');
});

test('detects Windows and displays Ctrl plus Alt', () => {
  assert.equal(detectShortcutPlatform({ platform: 'Win32' }), 'windows');
  assert.equal(formatShortcutLabel('Ctrl/Cmd+Alt+W', 'windows'), 'Ctrl+Alt+W');
});

test('uses Linux labels for other desktop platforms', () => {
  assert.equal(detectShortcutPlatform({ platform: 'Linux x86_64' }), 'linux');
  assert.equal(formatShortcutLabel('Ctrl/Cmd+Shift+M', 'linux'), 'Ctrl+Shift+M');
});
