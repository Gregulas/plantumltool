import test from 'node:test';
import assert from 'node:assert/strict';
import { findColorTokenAt, isTypedColorTrigger, normalizeColorForPicker, openNativeColorPicker, selectedRgbColor } from '../src/color-picker.js';

test('finds an actual PlantUML hex color at the caret', () => {
  const source = 'skinparam sequence {\n  ArrowColor #32BCBB\n}';
  const position = source.indexOf('#32BCBB') + 3;
  const token = findColorTokenAt(source, position);
  assert.equal(token?.text, '#32BCBB');
  assert.equal(token?.pickerValue, '#32bcbb');
});

test('supports named PlantUML color tokens and maps common names for the picker', () => {
  const source = 'skinparam backgroundColor #LightBlue';
  const position = source.indexOf('#LightBlue') + 2;
  const token = findColorTokenAt(source, position);
  assert.equal(token?.text, '#LightBlue');
  assert.equal(token?.pickerValue, '#add8e6');
});

test('does not treat color-like text after an arrow message colon as editable syntax color', () => {
  const source = 'Portal -> Loan: customer entered #32BCBB as text';
  const position = source.indexOf('#32BCBB') + 3;
  assert.equal(findColorTokenAt(source, position), null);
});

test('does not treat color-like text inside note bodies as editable syntax color', () => {
  const source = 'note over Portal\nCustomer said #32BCBB\nend note';
  const position = source.indexOf('#32BCBB') + 3;
  assert.equal(findColorTokenAt(source, position), null);
});

test('normalizes short and alpha hex colors for the native picker', () => {
  assert.equal(normalizeColorForPicker('#abc'), '#aabbcc');
  assert.equal(normalizeColorForPicker('#abcdef80'), '#abcdef');
});

test('opens the native picker explicitly and falls back to click', () => {
  let shown = 0;
  let clicked = 0;
  assert.equal(openNativeColorPicker({ showPicker() { shown += 1; }, click() { clicked += 1; } }), 'showPicker');
  assert.equal(shown, 1);
  assert.equal(clicked, 0);

  assert.equal(openNativeColorPicker({ showPicker() { throw new Error('unsupported'); }, click() { clicked += 1; } }), 'click');
  assert.equal(clicked, 1);
});

test('only a directly typed hash triggers automatic color picking', () => {
  assert.equal(isTypedColorTrigger({ inputType: 'insertText', data: '#' }), true);
  assert.equal(isTypedColorTrigger({ inputType: 'insertText', data: 'a' }), false);
  assert.equal(isTypedColorTrigger({ inputType: 'insertFromPaste', data: '#' }), false);
});

test('recognizes only a fully selected RGB color including its hash', () => {
  const source = 'ArrowColor #32BCBB';
  const start = source.indexOf('#');
  assert.deepEqual(selectedRgbColor(source, start, start + 7), {
    start,
    end: start + 7,
    text: '#32BCBB',
    pickerValue: '#32bcbb'
  });
  assert.equal(selectedRgbColor(source, start + 1, start + 7), null);
  assert.equal(selectedRgbColor('Color #abc', 6, 10), null);
  assert.equal(selectedRgbColor('Color #LightBlue', 6, 16), null);
});
