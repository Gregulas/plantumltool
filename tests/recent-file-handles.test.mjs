import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureFileHandlePermission } from '../src/recent-file-handles.js';

test('accepts an already granted recent file handle', async () => {
  let requested = false;
  const handle = {
    async queryPermission(options) {
      assert.deepEqual(options, { mode: 'readwrite' });
      return 'granted';
    },
    async requestPermission() {
      requested = true;
      return 'granted';
    }
  };
  assert.equal(await ensureFileHandlePermission(handle), true);
  assert.equal(requested, false);
});

test('requests write permission when a persisted handle needs it', async () => {
  const handle = {
    async queryPermission() { return 'prompt'; },
    async requestPermission(options) {
      assert.deepEqual(options, { mode: 'readwrite' });
      return 'granted';
    }
  };
  assert.equal(await ensureFileHandlePermission(handle), true);
});

test('rejects a recent file handle when write permission is denied', async () => {
  const handle = {
    async queryPermission() { return 'denied'; },
    async requestPermission() { return 'denied'; }
  };
  assert.equal(await ensureFileHandlePermission(handle), false);
  assert.equal(await ensureFileHandlePermission(null), false);
});
