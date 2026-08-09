import test from 'node:test';
import assert from 'node:assert/strict';
import { detachedPreviewAction, detachedPreviewLifecycle, detachedPreviewState, isDetachedPreviewAction, isDetachedPreviewLifecycle, isDetachedPreviewState } from '../src/detached-preview.js';

test('creates a serializable detached preview update', () => {
  const message = detachedPreviewState({ svg: '<svg></svg>', filename: 'flow.puml', dark: true, status: 'Rendered locally' });
  assert.deepEqual(message, {
    type: 'detached-preview-state', svg: '<svg></svg>', filename: 'flow.puml', theme: 'dark', status: 'Rendered locally'
  });
  assert.equal(isDetachedPreviewState(message), true);
});

test('creates identifiable detached preview interaction messages', () => {
  const action = detachedPreviewAction('detached-preview-navigate', 'preview-42', { recordId: 'record-7' });
  assert.deepEqual(action, { type: 'detached-preview-navigate', previewId: 'preview-42', recordId: 'record-7' });
  assert.equal(isDetachedPreviewAction(action, 'detached-preview-navigate'), true);
  assert.equal(isDetachedPreviewAction(action, 'detached-preview-quick-edit'), false);
});

test('rejects unrelated or malformed preview messages', () => {
  assert.equal(isDetachedPreviewState({ type: 'other' }), false);
  assert.equal(isDetachedPreviewState({ type: 'detached-preview-state', svg: 12, filename: 'x', theme: 'light' }), false);
});

test('creates identifiable detached preview lifecycle messages', () => {
  const ready = detachedPreviewLifecycle('detached-preview-ready', 'preview-42');
  assert.deepEqual(ready, { type: 'detached-preview-ready', previewId: 'preview-42' });
  assert.equal(isDetachedPreviewLifecycle(ready, 'detached-preview-ready'), true);
  assert.equal(isDetachedPreviewLifecycle(ready, 'detached-preview-closed'), false);
  const heartbeat = detachedPreviewLifecycle('detached-preview-heartbeat', 'preview-42');
  assert.deepEqual(heartbeat, { type: 'detached-preview-heartbeat', previewId: 'preview-42' });
  assert.equal(isDetachedPreviewLifecycle(heartbeat, 'detached-preview-heartbeat'), true);
});
