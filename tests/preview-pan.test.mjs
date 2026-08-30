import test from 'node:test';
import assert from 'node:assert/strict';
import { isPreviewPanStart, previewPanScroll } from '../src/preview-pan.js';

function target({ excluded = false } = {}) {
  const node = {};
  node.closest = () => excluded ? node : null;
  return node;
}

function viewport(containedTarget) {
  return { contains: candidate => candidate === containedTarget };
}

test('starts background panning with the primary left pointer', () => {
  const background = target();
  assert.equal(isPreviewPanStart({ button: 0, isPrimary: true, target: background }, viewport(background)), true);
});

test('does not pan when the pointer starts on a rendered object', () => {
  const object = target({ excluded: true });
  assert.equal(isPreviewPanStart({ button: 0, isPrimary: true, target: object }, viewport(object)), false);
});

test('does not pan with a secondary button or pointer', () => {
  const background = target();
  const surface = viewport(background);
  assert.equal(isPreviewPanStart({ button: 2, isPrimary: true, target: background }, surface), false);
  assert.equal(isPreviewPanStart({ button: 0, isPrimary: false, target: background }, surface), false);
});

test('moves the scroll position opposite to the held canvas', () => {
  const start = { clientX: 100, clientY: 80, scrollLeft: 420, scrollTop: 260 };
  assert.deepEqual(previewPanScroll(start, { clientX: 70, clientY: 120 }), { left: 450, top: 220 });
});
