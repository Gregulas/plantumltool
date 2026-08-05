import test from 'node:test';
import assert from 'node:assert/strict';
import { readObjectAppearance, updateObjectAppearance } from '../src/object-quick-edit.js';

test('reads and updates declaration color and stereotype style', () => {
  const source = '@startuml\ncomponent "API" as API <<service>> #LightBlue\n@enduml';
  assert.deepEqual(readObjectAppearance(source.split('\n')[1]), { color: '#LightBlue', style: 'service' });
  assert.equal(
    updateObjectAppearance(source, 2, { color: '#32BCBB', style: 'boundary' }),
    '@startuml\ncomponent "API" as API <<boundary>> #32BCBB\n@enduml'
  );
});

test('preserves comments and line endings', () => {
  const source = '@startuml\r\nclass User #red \' important\r\n@enduml';
  assert.equal(
    updateObjectAppearance(source, 2, { color: '#blue', style: '' }),
    '@startuml\r\nclass User #blue \' important\r\n@enduml'
  );
});
