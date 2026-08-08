import test from 'node:test';
import assert from 'node:assert/strict';
import { availableScreenBounds, isNearBounds } from '../src/window-sizing.js';

test('uses the current display available area for maximize bounds', () => {
  assert.deepEqual(availableScreenBounds({ availLeft: 1440, availTop: 24, availWidth: 1920, availHeight: 1056 }), {
    left: 1440, top: 24, width: 1920, height: 1056
  });
});

test('recognizes a window resized close to the available display bounds', () => {
  const bounds = { left: 0, top: 25, width: 1440, height: 875 };
  assert.equal(isNearBounds({ x: 0, y: 25, width: 1430, height: 865 }, bounds), true);
  assert.equal(isNearBounds({ x: 200, y: 100, width: 900, height: 600 }, bounds), false);
});
