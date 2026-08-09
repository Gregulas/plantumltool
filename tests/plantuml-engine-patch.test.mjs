import test from 'node:test';
import assert from 'node:assert/strict';
import { patchPlantUmlBrowserLimit, PLANTUML_BROWSER_RENDER_LIMIT } from '../src/plantuml-engine-patch.js';

test('raises the pinned PlantUML browser dimension guard', () => {
  const engineFragment = 'if(!(p>4096.0)){q=o.bB0;if(!(q>4096.0)){render()}} throw " (max 4096)"';
  const patched = patchPlantUmlBrowserLimit(engineFragment);
  assert.match(patched, new RegExp(`p>${PLANTUML_BROWSER_RENDER_LIMIT}\\.0`));
  assert.match(patched, new RegExp(`q>${PLANTUML_BROWSER_RENDER_LIMIT}\\.0`));
  assert.match(patched, new RegExp(`max ${PLANTUML_BROWSER_RENDER_LIMIT}`));
  assert.equal(patchPlantUmlBrowserLimit(patched), patched);
});
