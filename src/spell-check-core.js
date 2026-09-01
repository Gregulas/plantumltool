function commentIndex(line) {
  let quoted = false;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
    else if (char === '"') quoted = !quoted;
    else if (char === "'" && !quoted) return index;
  }
  return line.length;
}

function arrowMessageStart(line) {
  const code = line.slice(0, commentIndex(line));
  if (/^\s*(?:note|legend|title|caption|header|footer|skinparam)\b/i.test(code)) return -1;
  const arrow = code.match(/(?:[o*x]?<{1,2}[-.=o*x|{}]+>{1,2}[o*x]?|[-.=o*x|{}]+>{1,2}[o*x]?|[o*x]?<{1,2}[-.=o*x|{}]+)/);
  if (!arrow) return -1;
  const colon = code.indexOf(':', arrow.index + arrow[0].length);
  return colon < 0 ? -1 : colon + 1;
}

export function proseSegments(source) {
  const text = String(source ?? '');
  const lines = [...text.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)]
    .filter(match => match[0].length || match.index === 0)
    .map(match => ({ text: match[0].replace(/(?:\r\n|\r|\n)$/, ''), offset: match.index }));
  const segments = [];
  let inNote = false;

  lines.forEach(({ text: line, offset }, index) => {
    const trimmed = line.trim();
    if (inNote) {
      if (/^end\s+note\b/i.test(trimmed)) inNote = false;
      else segments.push({ text: line, line: index + 1, column: 1, offset });
    } else {
      const inlineNote = line.match(/^\s*note\b[^:]*:\s*(.*)$/i);
      if (inlineNote) {
        const start = line.length - inlineNote[1].length;
        segments.push({ text: inlineNote[1], line: index + 1, column: start + 1, offset: offset + start });
      } else if (/^\s*note\b/i.test(line)) {
        inNote = true;
      } else {
        const start = arrowMessageStart(line);
        if (start >= 0) segments.push({ text: line.slice(start), line: index + 1, column: start + 1, offset: offset + start });
      }
    }
  });

  return segments;
}

function shouldCheckWord(word) {
  if (word.length < 3 || /\d/.test(word)) return false;
  if (/^[A-Z]{2,}s?$/.test(word) || /[A-Z].*[A-Z]/.test(word.slice(1))) return false;
  return true;
}

export function analyzeProseSpelling(source, checker) {
  const text = String(source ?? '');
  const diagnostics = [];
  const occurrences = new Map();
  for (const segment of proseSegments(source)) {
    // Preserve every character position while hiding PlantUML HTML/Creole tags,
    // so spelling fixes still target the exact source offsets of visible words.
    const visibleText = segment.text.replace(/<[^>]*>/g, tag => ' '.repeat(tag.length));
    for (const match of visibleText.matchAll(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)) {
      const word = match[0];
      if (!shouldCheckWord(word) || checker.correct(word)) continue;
      const suggestions = checker.suggest(word).slice(0, 3);
      const replacement = suggestions[0];
      const normalizedWord = word.toLowerCase();
      const occurrence = (occurrences.get(normalizedWord) || 0) + 1;
      occurrences.set(normalizedWord, occurrence);
      const absoluteStart = segment.offset + match.index;
      const before = text.slice(0, absoluteStart);
      const sourceLine = before.split(/\r\n|\r|\n/).length;
      const lastLineBreak = Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r'));
      const sourceColumn = absoluteStart - lastLineBreak;
      diagnostics.push({
        id: `spell-${sourceLine}-${absoluteStart}-${word.toLowerCase()}`,
        severity: 'warning', source: 'spelling', line: sourceLine,
        word,
        ignoreKey: `${normalizedWord}:${occurrence}`,
        column: sourceColumn,
        range: { start: absoluteStart, end: absoluteStart + word.length },
        message: `Possible spelling mistake: “${word}”.`,
        suggestion: suggestions.length ? `Suggested spelling: ${suggestions.join(', ')}.` : 'Check this word or keep it if it is a project-specific term.',
        detail: 'Spell checking applies only to displayed arrow labels and note text.',
        fix: replacement ? { label: `Change to ${replacement}`, start: absoluteStart, end: absoluteStart + word.length, text: replacement } : null
      });
    }
  }
  return diagnostics;
}
