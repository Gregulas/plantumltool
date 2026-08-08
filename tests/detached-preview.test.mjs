import test from 'node:test';
import assert from 'node:assert/strict';
import { detachedPreviewState, isDetachedPreviewState } from '../src/detached-preview.js';

test('creates a serializable detached preview update', () => {
  const message = detachedPreviewState({ svg: '<svg></svg>', filename: 'flow.puml', dark: true, status: 'Rendered locally' });
  assert.deepEqual(message, {
    type: 'detached-preview-state', svg: '<svg></svg>', filename: 'flow.puml', theme: 'dark', status: 'Rendered locally'
  });
  assert.equal(isDetachedPreviewState(message), true);
});

test('rejects unrelated or malformed preview messages', () => {
  assert.equal(isDetachedPreviewState({ type: 'other' }), false);
  assert.equal(isDetachedPreviewState({ type: 'detached-preview-state', svg: 12, filename: 'x', theme: 'light' }), false);
});
