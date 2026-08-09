import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePlantUml, rendererDiagnostic, extractSvgRenderError } from '../src/diagnostics.js';

test('valid sequence diagram has no local diagnostics', () => {
  const source = `@startuml
actor Customer
participant "Portal" as Portal
participant "Loan" as Loan
alt success
Portal -> Loan: Request
Loan --> Portal: 201 Created
else failure
Loan --> Portal: 400 Bad Request
end
@enduml`;
  assert.deepEqual(analyzePlantUml(source), []);
});

test('detects common typo and offers replacement', () => {
  const diagnostics = analyzePlantUml('@startuml\nparticpant "Portal" as P\n@enduml');
  const typo = diagnostics.find(item => item.message.includes('keyword typo'));
  assert.ok(typo);
  assert.equal(typo.fix.text, 'participant');
});

test('detects missing sequence terminator and inserts before enduml', () => {
  const source = '@startuml\nalt success\nA -> B: Test\n@enduml';
  const diagnostics = analyzePlantUml(source);
  const block = diagnostics.find(item => item.message.includes('alt block is not closed'));
  assert.ok(block);
  assert.equal(block.fix.text, 'end\n');
  assert.equal(source.slice(block.fix.start), '@enduml');
});

test('detects missing brace and unterminated quote', () => {
  const source = '@startuml\nskinparam sequence {\nparticipant "Portal\n@enduml';
  const diagnostics = analyzePlantUml(source);
  assert.ok(diagnostics.some(item => item.message.includes('Opening brace is not closed')));
  assert.ok(diagnostics.some(item => item.message.includes('Unterminated double-quoted text')));
});

test('detects activity semicolon and missing arrow endpoint', () => {
  const source = '@startuml\n:Validate request\nPortal -> : Request\n@enduml';
  const diagnostics = analyzePlantUml(source);
  assert.ok(diagnostics.some(item => item.message.includes('terminating semicolon')));
  assert.ok(diagnostics.some(item => item.message.includes('missing a target')));
});


test('renderer errors use readable summary and preserve full detail', () => {
  const raw = 'Syntax Error? (Assumed diagram type: sequence) at line 12\nThis is a very detailed parser message that should remain available.';
  const diagnostic = rendererDiagnostic(raw, '@startuml\n@enduml');
  assert.ok(diagnostic);
  assert.equal(diagnostic.line, 12);
  assert.equal(diagnostic.message, 'PlantUML syntax error near line 12.');
  assert.equal(diagnostic.detail, raw);
});

test('classifies browser diagram size limits as rendering capacity errors', () => {
  const raw = 'java.lang.RuntimeException: Diagram too large for browser rendering: 1348x4132 (max 4096)';
  const diagnostic = rendererDiagnostic(raw, '@startuml\n@enduml');
  assert.equal(diagnostic.source, 'render-limit');
  assert.equal(diagnostic.line, null);
  assert.equal(diagnostic.message, 'Diagram is too large for browser rendering (1348 × 4132; maximum dimension 4096).');
  assert.match(diagnostic.suggestion, /split it into smaller diagrams/i);
  assert.equal(diagnostic.detail, raw);
});


test('warns when the same reference is declared twice', () => {
  const source = `@startuml
participant "Portal" as Portal
component "Duplicate Portal" as Portal
Portal -> Portal: Test
@enduml`;
  const diagnostics = analyzePlantUml(source);
  const duplicate = diagnostics.find(item => item.message.includes('defined more than once'));
  assert.ok(duplicate);
  assert.equal(duplicate.severity, 'warning');
  assert.equal(duplicate.source, 'semantic');
  assert.equal(duplicate.line, 3);
  assert.match(duplicate.detail, /First definition \(line 2\)/);
});

test('warns for a used reference that is not declared anywhere in the script', () => {
  const source = `@startuml
participant "Portal" as Portal
Portal -> Loan: Create application
@enduml`;
  const diagnostics = analyzePlantUml(source);
  const missing = diagnostics.find(item => item.message.includes('Loan') && item.message.includes('not defined'));
  assert.ok(missing);
  assert.equal(missing.severity, 'warning');
  assert.equal(missing.source, 'semantic');
  assert.equal(missing.line, 3);
});

test('does not warn when a referenced element is declared later in the script', () => {
  const source = `@startuml
Portal -> Loan: Create application
participant "Portal" as Portal
participant "Loan MS" as Loan
@enduml`;
  const diagnostics = analyzePlantUml(source);
  assert.equal(diagnostics.filter(item => item.source === 'semantic').length, 0);
});

test('reference warnings do not mistake activity action text for a relationship', () => {
  const source = `@startuml
start
:Map A -> B;
stop
@enduml`;
  const diagnostics = analyzePlantUml(source);
  assert.equal(diagnostics.filter(item => item.source === 'semantic').length, 0);
});

test('accepts state pseudo-objects and ArchiMate declarations as valid references', () => {
  const stateDiagnostics = analyzePlantUml('@startuml\nstate Ready\n[*] --> Ready\nReady --> [*]\n@enduml');
  assert.equal(stateDiagnostics.filter(item => item.source === 'semantic').length, 0);

  const archimateDiagnostics = analyzePlantUml('@startuml\narchimate #Technology "Architecture Service" as Service\nService --> Service\n@enduml');
  assert.equal(archimateDiagnostics.filter(item => item.source === 'semantic').length, 0);
});

test('does not treat asynchronous arrow endpoint decorations as references', () => {
  const source = `@startuml
participant Portal
participant API
Portal -->>o API: Queued request
API o<<-- Portal: Callback response
@enduml`;
  assert.equal(analyzePlantUml(source).filter(item => item.source === 'semantic').length, 0);
});


test('unmatched standalone end is a blocking error, not a warning', () => {
  const source = `@startuml
box "Web Portal"
participant "Portal" as Portal
end
@enduml`;
  const diagnostics = analyzePlantUml(source);
  const unmatched = diagnostics.find(item => item.message.includes('end has no matching sequence block'));
  assert.ok(unmatched);
  assert.equal(unmatched.severity, 'error');
  assert.match(unmatched.suggestion, /end box/i);
});

test('detects PlantUML parser error SVG that does not contain Syntax Error', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">
    <text>actor "Customer" as Customer</text>
    <text>end</text>
    <text>Cannot create group (Assumed diagram type: sequence)</text>
  </svg>`;
  const error = extractSvgRenderError(svg);
  assert.ok(error);
  assert.match(error.message, /Cannot create group/i);
});

test('does not classify an ordinary successful SVG as an error diagram', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><text>Error Handling Service</text><text>A -> B</text></svg>`;
  assert.equal(extractSvgRenderError(svg), null);
});
