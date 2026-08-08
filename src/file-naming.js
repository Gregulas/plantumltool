function cleanTitleText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[\[[^\]]+\s+([^\]]+)\]\]/g, '$1')
    .replace(/[*_~`]+/g, '')
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function diagramTitle(source) {
  const lines = String(source || '').split(/\r\n|\r|\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*title(?:\s+(.*))?\s*$/i);
    if (!match) continue;
    if (match[1]?.trim()) return cleanTitleText(match[1]);

    const titleLines = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (/^\s*end\s+title\s*$/i.test(lines[next])) break;
      titleLines.push(lines[next]);
    }
    return cleanTitleText(titleLines.join(' '));
  }
  return '';
}

export function safeFileStem(value, fallback = 'diagram') {
  const stem = cleanTitleText(value)
    .replace(/[\\/:*?"<>|%\u0000-\u001f]/g, ' ')
    .replace(/^\.+|[.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .replace(/[.\s]+$/g, '');
  return stem || fallback;
}

export function suggestedSourceFilename(source, currentFilename = 'diagram.puml') {
  const currentStem = String(currentFilename || '').replace(/\.(puml|plantuml|pu|txt)$/i, '');
  return `${safeFileStem(diagramTitle(source), safeFileStem(currentStem))}.puml`;
}
