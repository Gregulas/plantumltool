import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReferenceColors, highlightPlantUml, tokenizePlantUml } from '../src/syntax-highlight.js';

function tokenOf(tokens, text, type) {
  return tokens.find(token => token.text === text && token.type === type);
}

test('highlighter distinguishes object types, references and arrows while message text stays plain', () => {
  const source = `@startuml\nparticipant "Web Portal" as Portal\nparticipant "Loan MS" as Loan\nPortal -> Loan: Create application\n@enduml`;
  const tokens = tokenizePlantUml(source);

  assert.ok(tokenOf(tokens, 'participant', 'objectType'));
  assert.ok(tokenOf(tokens, 'Portal', 'reference'));
  assert.ok(tokenOf(tokens, 'Loan', 'reference'));
  assert.ok(tokenOf(tokens, '->', 'arrow'));
  assert.ok(tokenOf(tokens, ': Create application', 'plain'));
  assert.equal(tokens.some(token => token.type === 'message'), false);
});

test('same object type shares one color while different types use different type colors', () => {
  const source = `participant "Portal" as Portal\nparticipant "Loan" as Loan\ndatabase "DB" as DB\nPortal -> Loan: Request\nLoan -> DB: Store`;
  const tokens = tokenizePlantUml(source);
  const portal = tokens.find(token => token.type === 'reference' && token.text === 'Portal');
  const loan = tokens.find(token => token.type === 'reference' && token.text === 'Loan');
  const db = tokens.find(token => token.type === 'reference' && token.text === 'DB');
  assert.equal(portal.ref, loan.ref);
  assert.notEqual(portal.ref, db.ref);
});

test('reference color is stable between declaration display name, alias and usage', () => {
  const source = `participant "Digital Web Portal" as Portal\nPortal -> Portal: Request`;
  const tokens = tokenizePlantUml(source);
  const portalTokens = tokens.filter(token => token.type === 'reference' && (token.text === 'Portal' || token.text === '"Digital Web Portal"'));
  assert.ok(portalTokens.length >= 2);
  assert.equal(new Set(portalTokens.map(token => token.ref)).size, 1);
});

test('note bodies and inline note prose are not syntax colored', () => {
  const source = `participant Portal\nnote right of Portal\nPortal -> Loan: this is prose, not a relationship\nparticipant Fake\nend note\nnote over Portal: Loan -> DB should stay plain`;
  const tokens = tokenizePlantUml(source);
  const noteBody = tokens.find(token => token.text.includes('Portal -> Loan: this is prose'));
  const fakeBody = tokens.find(token => token.text.includes('participant Fake'));
  const inlineText = tokens.find(token => token.text === ': Loan -> DB should stay plain');
  assert.equal(noteBody?.type, 'plain');
  assert.equal(fakeBody?.type, 'plain');
  assert.equal(inlineText?.type, 'plain');
});

test('comments, directives, colors, strings and diagram markers have separate token types', () => {
  const source = `@startuml\n!theme plain\nskinparam ArrowColor #32BCBB\ntitle "Fleet flow"\n' explanation\n@enduml`;
  const tokens = tokenizePlantUml(source);

  assert.ok(tokens.some(token => token.type === 'marker' && token.text === '@startuml'));
  assert.ok(tokens.some(token => token.type === 'directive' && token.text === '!theme'));
  assert.ok(tokens.some(token => token.type === 'style' && token.text === 'skinparam'));
  assert.ok(tokens.some(token => token.type === 'color' && token.text === '#32BCBB'));
  assert.ok(tokens.some(token => token.type === 'string' && token.text === '"Fleet flow"'));
  assert.ok(tokens.some(token => token.type === 'comment' && token.text === "' explanation"));
});

test('highlighted HTML contains type reference classes and escaped source text', () => {
  const source = `participant "A & B" as AB\nAB -> AB: x < y`;
  const symbols = buildReferenceColors(source);
  assert.ok(symbols.byName.has('AB'));

  const html = highlightPlantUml(source);
  assert.match(html, /tok-reference ref-\d+/);
  assert.match(html, /A &amp; B/);
  assert.match(html, /x &lt; y/);
});

test('tokenization preserves the source exactly', () => {
  const source = `@startuml\nbox "Web Portal" #EAF8F7\n  participant "Portal UI" as Portal\n  Portal -> Loan: Create <application> & validate\n  ' keep this comment\nend box\n@enduml\n`;
  assert.equal(tokenizePlantUml(source).map(token => token.text).join(''), source);
});
