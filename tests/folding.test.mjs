import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFoldProjection, containingCollapsedRegion, findFoldRegions, sourceLineToViewLine, sourceOffsetToViewOffset, viewOffsetToSourceOffset } from '../src/folding.js';

const SOURCE = `@startuml
alt Success
  Portal -> Loan: Request
  loop Retry
    Loan -> API: Call
  end
else Failure
  Portal <-- Loan: Error
end
@enduml`;

test('detects nested PlantUML fold regions', () => {
  const regions = findFoldRegions(SOURCE);
  assert.ok(regions.some(r => r.type === 'alt' && r.startLine === 2 && r.endLine === 9));
  assert.ok(regions.some(r => r.type === 'loop' && r.startLine === 4 && r.endLine === 6));
});

test('collapsing a block keeps opener and closer and replaces only its body', () => {
  const projection = buildFoldProjection(SOURCE, new Set([2]));
  assert.match(projection.text, /alt Success/);
  assert.match(projection.text, /lines folded/);
  assert.match(projection.text, /\nend\n@enduml$/);
  assert.doesNotMatch(projection.text, /Portal -> Loan/);
});

test('source/view line mapping points hidden lines to the fold placeholder', () => {
  const projection = buildFoldProjection(SOURCE, new Set([2]));
  assert.equal(sourceLineToViewLine(projection, 2), 2);
  assert.equal(sourceLineToViewLine(projection, 5), 3);
  assert.deepEqual(containingCollapsedRegion(projection, 5), { startLine: 2, endLine: 9 });
});

test('source/view offsets round-trip for visible text', () => {
  const projection = buildFoldProjection(SOURCE, new Set([4]));
  const sourceOffset = SOURCE.indexOf('alt Success') + 4;
  const viewOffset = sourceOffsetToViewOffset(SOURCE, projection, sourceOffset);
  assert.equal(viewOffsetToSourceOffset(SOURCE, projection, viewOffset), sourceOffset);
});
