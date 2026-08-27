import test from 'node:test';
import assert from 'node:assert/strict';
import { wordCompatibleSvg } from '../src/svg-export.js';

test('converts fully transparent SVG paint to none for Microsoft Word', () => {
  const source = '<svg><rect fill="#00000000" stroke="#11223300" /></svg>';
  const result = wordCompatibleSvg(source);
  assert.equal(result, '<svg><rect fill="none" stroke="none" /></svg>');
});

test('converts alpha colors to six-digit colors plus SVG opacity', () => {
  const source = '<svg><rect fill="#33669980" stroke="#AABBCCFF" /></svg>';
  const result = wordCompatibleSvg(source);
  assert.match(result, /fill="#336699" fill-opacity="0\.502"/);
  assert.match(result, /stroke="#AABBCC"/);
  assert.doesNotMatch(result, /#[0-9A-Fa-f]{8}/);
});

test('normalizes alpha paint inside SVG style declarations', () => {
  const source = '<svg><style>.box{fill:#00000000;stroke:#12345680}</style></svg>';
  const result = wordCompatibleSvg(source);
  assert.match(result, /fill:none/);
  assert.match(result, /stroke:#123456;stroke-opacity:0\.502/);
});
