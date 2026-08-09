import { readFile, writeFile } from 'node:fs/promises';
import { patchPlantUmlBrowserLimit } from '../src/plantuml-engine-patch.js';

const enginePath = new URL('../node_modules/@plantuml/core/plantuml.js', import.meta.url);
const source = await readFile(enginePath, 'utf8');
const patched = patchPlantUmlBrowserLimit(source);
if (patched !== source) await writeFile(enginePath, patched);
