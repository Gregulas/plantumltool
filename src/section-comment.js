function lineStartAt(source, position) {
  const newline = source.lastIndexOf('\n', Math.max(0, position) - 1);
  return newline < 0 ? 0 : newline + 1;
}

function lineContentEndAt(source, position) {
  const newline = source.indexOf('\n', position);
  if (newline < 0) return source.length;
  return newline > 0 && source[newline - 1] === '\r' ? newline - 1 : newline;
}

function isLineStart(source, position) {
  return position === 0 || source[position - 1] === '\n';
}

function commentLine(line) {
  if (/^\s*'/.test(line)) return line;
  return line.replace(/^(\s*)/, "$1' ");
}

function uncommentLine(line) {
  return line.replace(/^(\s*)' ?/, '$1');
}

export function toggleSectionComment(source, selectionStart, selectionEnd) {
  const text = String(source ?? '');
  const start = Math.max(0, Math.min(Number(selectionStart) || 0, text.length));
  const end = Math.max(start, Math.min(Number(selectionEnd) || 0, text.length));
  if (start === end) return null;

  const rangeStart = lineStartAt(text, start);
  const lastSelectedPosition = end > start && isLineStart(text, end) ? end - 1 : end;
  const lastLineStart = lineStartAt(text, Math.max(start, lastSelectedPosition));
  const rangeEnd = lineContentEndAt(text, lastLineStart);
  const block = text.slice(rangeStart, rangeEnd);
  const parts = block.split(/(\r\n|\r|\n)/);
  const lineIndexes = parts.map((part, index) => index % 2 === 0 ? index : -1).filter(index => index >= 0);
  const uncomment = lineIndexes.every(index => /^\s*'/.test(parts[index]));

  for (const index of lineIndexes) parts[index] = uncomment ? uncommentLine(parts[index]) : commentLine(parts[index]);
  const replacement = parts.join('');
  return {
    start: rangeStart,
    end: rangeEnd,
    text: replacement,
    selectionStart: rangeStart,
    selectionEnd: rangeStart + replacement.length,
    commented: !uncomment
  };
}
