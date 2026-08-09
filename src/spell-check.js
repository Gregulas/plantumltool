import nspell from 'nspell';
import aff from '../node_modules/dictionary-en/index.aff?raw';
import dic from '../node_modules/dictionary-en/index.dic?raw';
import { analyzeProseSpelling as analyzeWithChecker } from './spell-check-core.js';

const spell = nspell(aff, dic);
for (const word of ['PlantUML', 'API', 'APIs', 'UI', 'URL', 'URLs', 'JSON', 'HTTP', 'HTTPS', 'database', 'middleware']) spell.add(word);
const correctnessCache = new Map();
const suggestionCache = new Map();
const cachedSpell = {
  correct(word) {
    const key = word.toLowerCase();
    if (!correctnessCache.has(key)) correctnessCache.set(key, spell.correct(word));
    return correctnessCache.get(key);
  },
  suggest(word) {
    const key = word.toLowerCase();
    if (!suggestionCache.has(key)) suggestionCache.set(key, spell.suggest(word));
    return suggestionCache.get(key);
  }
};

export function analyzeProseSpelling(source) {
  return analyzeWithChecker(source, cachedSpell);
}
