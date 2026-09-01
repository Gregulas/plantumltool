import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextFormatEdit, textFormatSelectionContext } from '../src/text-formatting.js';

function selection(source, value, occurrence = 0) {
  let start = -1;
  for (let index = 0; index <= occurrence; index += 1) start = source.indexOf(value, start + 1);
  return [start, start + value.length];
}

function apply(source, edit) {
  return source.slice(0, edit.start) + edit.text + source.slice(edit.end);
}

test('wraps selected sequence-arrow label text in PlantUML HTML tags', () => {
  const source = '@startuml\nA -> B: Submit request\n@enduml';
  const edit = createTextFormatEdit(source, ...selection(source, 'Submit'), 'bold');
  assert.equal(edit.valid, true);
  assert.equal(edit.kind, 'arrow-label');
  assert.equal(apply(source, edit), '@startuml\nA -> B: <b>Submit</b> request\n@enduml');
});

test('supports state-transition labels and preserves selected text range', () => {
  const source = 'Draft --> Approved : approve application';
  const edit = createTextFormatEdit(source, ...selection(source, 'approve application'), 'italic');
  assert.equal(apply(source, edit), 'Draft --> Approved : <i>approve application</i>');
  assert.equal(edit.selectionEnd - edit.selectionStart, 'approve application'.length);
});

test('formats single-line note content but not its functional prefix', () => {
  const source = 'note right of Approved : Application approved';
  const edit = createTextFormatEdit(source, ...selection(source, 'Application approved'), 'underline');
  assert.equal(apply(source, edit), 'note right of Approved : <u>Application approved</u>');
  const prefix = createTextFormatEdit(source, ...selection(source, 'Approved', 0), 'bold');
  assert.equal(prefix.valid, false);
});

test('formats text within a multiline note without including note boundaries', () => {
  const source = 'note right of B\n  First line\n  Second line\nend note';
  const edit = createTextFormatEdit(source, ...selection(source, 'First line\n  Second line'), 'strike');
  assert.equal(edit.valid, true);
  assert.equal(apply(source, edit), 'note right of B\n  <s>First line\n  Second line</s>\nend note');
});

test('does not allow the newline before a multiline note terminator into the formatted range', () => {
  const source = 'note right\r\nText\r\nend note';
  const start = source.indexOf('Text');
  const edit = createTextFormatEdit(source, start, source.indexOf('end note'), 'bold');
  assert.equal(edit.valid, false);
});

test('rejects arrow operators and functional declaration aliases', () => {
  const arrow = 'A -> B: Request';
  assert.equal(createTextFormatEdit(arrow, ...selection(arrow, 'A -> B'), 'bold').valid, false);
  const declaration = 'participant "Web Portal" as Web';
  assert.equal(createTextFormatEdit(declaration, ...selection(declaration, 'Web', 1), 'bold').valid, false);
});

test('rejects functional script selected inside a multiline note', () => {
  const source = 'note right\nA -> B: Hidden example\nend note';
  const edit = createTextFormatEdit(source, ...selection(source, 'A -> B: Hidden example'), 'bold');
  assert.equal(edit.valid, false);
  assert.match(edit.reason, /functional/i);
});

test('creates validated color and size tags', () => {
  const source = 'A -> B: Important';
  const bounds = selection(source, 'Important');
  assert.equal(apply(source, createTextFormatEdit(source, ...bounds, 'color', '#12abef')), 'A -> B: <color:#12ABEF>Important</color>');
  assert.equal(apply(source, createTextFormatEdit(source, ...bounds, 'size', '18')), 'A -> B: <size:18>Important</size>');
  assert.equal(createTextFormatEdit(source, ...bounds, 'color', 'red').valid, false);
  assert.equal(createTextFormatEdit(source, ...bounds, 'size', '80').valid, false);
});

test('replaces an enclosing text color instead of nesting color tags', () => {
  const source = 'A -> B: <color:#112233>Important text</color>';
  const edit = createTextFormatEdit(source, ...selection(source, 'Important text'), 'color', '#abcdef');
  assert.equal(edit.valid, true);
  assert.equal(apply(source, edit), 'A -> B: <color:#ABCDEF>Important text</color>');
  assert.equal(edit.selectionEnd - edit.selectionStart, 'Important text'.length);
});

test('recolors an existing color range inside another text format without nesting colors', () => {
  const source = 'A -> B: <b><color:#112233>Important</color></b>';
  const edit = createTextFormatEdit(source, ...selection(source, 'Important'), 'color', '#00aa88');
  assert.equal(apply(source, edit), 'A -> B: <b><color:#00AA88>Important</color></b>');
  assert.equal((apply(source, edit).match(/<color:/g) || []).length, 1);
});

test('supports monospace formatting and quoted participant names containing colons', () => {
  const source = '"Web: Portal" -> API: POST /applications';
  const edit = createTextFormatEdit(source, ...selection(source, 'POST /applications'), 'monospace');
  assert.equal(edit.valid, true);
  assert.equal(apply(source, edit), '"Web: Portal" -> API: <font:monospaced>POST /applications</font>');
});

test('requires a non-empty selection wholly contained in one supported text area', () => {
  const source = 'A -> B: Request\nB --> A: Response';
  assert.equal(textFormatSelectionContext(source, 0, 0).valid, false);
  assert.equal(textFormatSelectionContext(source, source.indexOf('Request'), source.indexOf('Response') + 8).valid, false);
});

test('does not mistake formatted title or directive text for an arrow label', () => {
  const directive = '!define EXAMPLE A --> B: label';
  assert.equal(createTextFormatEdit(directive, ...selection(directive, 'label'), 'bold').valid, false);
});

test('formats alt, else, par, loop, and other sequence group labels', () => {
  for (const [keyword, label] of [
    ['alt', 'Approved path'], ['else', 'Rejected path'], ['par', 'Send notifications'],
    ['loop', 'For each item'], ['opt', 'Optional audit'], ['break', 'Request failed'],
    ['critical', 'Commit transaction'], ['group', 'External services']
  ]) {
    const source = `${keyword} ${label}`;
    const edit = createTextFormatEdit(source, ...selection(source, label), 'bold');
    assert.equal(edit.valid, true, `${keyword} label should be formattable`);
    assert.equal(apply(source, edit), `${keyword} <b>${label}</b>`);
  }
});

test('formats sequence separators, delays, references, pages, and activity labels', () => {
  const examples = [
    ['== Authentication phase ==', 'Authentication phase'],
    ['... Waiting for callback ...', 'Waiting for callback'],
    ['ref over Portal, API : OAuth callback', 'OAuth callback'],
    ['newpage Final results', 'Final results'],
    [':Process application;', 'Process application']
  ];
  for (const [source, label] of examples) {
    const edit = createTextFormatEdit(source, ...selection(source, label), 'italic');
    assert.equal(edit.valid, true, `${source} should expose its display label`);
    assert.ok(apply(source, edit).includes(`<i>${label}</i>`));
  }
});

test('formats inline and multiline title-family display text', () => {
  const title = 'title Release -- status: ready';
  const inline = createTextFormatEdit(title, ...selection(title, 'Release -- status: ready'), 'underline');
  assert.equal(inline.valid, true);
  assert.equal(apply(title, inline), 'title <u>Release -- status: ready</u>');

  const block = 'title\nQuarterly architecture review\nend title';
  const multiline = createTextFormatEdit(block, ...selection(block, 'Quarterly architecture review'), 'bold');
  assert.equal(multiline.valid, true);
});

test('formats aliased display names without touching their functional references', () => {
  const displayFirst = 'participant "Web Portal" as Portal';
  const firstEdit = createTextFormatEdit(displayFirst, ...selection(displayFirst, 'Web Portal'), 'bold');
  assert.equal(apply(displayFirst, firstEdit), 'participant "<b>Web Portal</b>" as Portal');

  const aliasFirst = 'participant Portal as "Web Portal"';
  const secondEdit = createTextFormatEdit(aliasFirst, ...selection(aliasFirst, 'Web Portal'), 'italic');
  assert.equal(apply(aliasFirst, secondEdit), 'participant Portal as "<i>Web Portal</i>"');

  assert.equal(createTextFormatEdit(displayFirst, ...selection(displayFirst, 'Portal', 1), 'bold').valid, false);
});
