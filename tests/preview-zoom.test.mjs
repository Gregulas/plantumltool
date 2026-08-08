import test from 'node:test';
import assert from 'node:assert/strict';
import { scrollCanvasDimensions, zoomedSvgDimensions } from '../src/preview-zoom.js';

test('returns explicit scaled SVG dimensions for scrollable zoom', () => {
  assert.deepEqual(zoomedSvgDimensions({ width: 800, height: 500 }, 1.5), { width: 1200, height: 750 });
});

test('rejects incomplete or invalid dimensions', () => {
  assert.equal(zoomedSvgDimensions({ width: 0, height: 500 }, 2), null);
  assert.equal(zoomedSvgDimensions({ width: 800, height: 500 }, 0), null);
  assert.equal(zoomedSvgDimensions(null, 2), null);
});

test('sizes the scroll canvas around a wide zoomed diagram and its padding', () => {
  assert.deepEqual(
    scrollCanvasDimensions({ width: 1200, height: 750 }, { width: 640, height: 500 }, { left: 32, right: 32, top: 32, bottom: 32 }),
    { width: 1264, height: 814 }
  );
});

test('keeps the scroll canvas at least as large as its viewport', () => {
  assert.deepEqual(
    scrollCanvasDimensions({ width: 300, height: 200 }, { width: 640, height: 500 }, { left: 32, right: 32, top: 32, bottom: 32 }),
    { width: 640, height: 500 }
  );
});
