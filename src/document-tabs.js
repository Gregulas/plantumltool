let nextTabId = 1;

export function createDocumentTab(source, filename = 'diagram.puml', options = {}) {
  return {
    id: `tab-${nextTabId++}`,
    source: String(source ?? ''),
    filename: String(filename || 'diagram.puml'),
    fileHandle: options.fileHandle || null,
    savedSource: options.saved ? String(source ?? '') : '',
    isNewFile: options.isNew ?? !options.saved,
    svg: '',
    lastSuccessfulSource: '',
    sourceNavigationIndex: null,
    svgSourceLineOffset: 0,
    localDiagnostics: [],
    rendererDiagnostics: [],
    ignoredSpellingOccurrences: new Set(),
    ignoredSpellingWords: new Set(),
    foldedStarts: new Set(),
    foldProjection: null,
    selectionStart: Number(options.selectionStart) || 0,
    selectionEnd: Number(options.selectionEnd) || 0,
    scrollTop: 0,
    scrollLeft: 0
  };
}

export function isDocumentDirty(tab) {
  return Boolean(tab?.isNewFile || tab?.source !== tab?.savedSource);
}

function lineRange(source, start, end) {
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const before = String(source).slice(0, start);
  const startLine = before.replace(/\r\n?/g, '\n').split('\n').length;
  const selected = String(source).slice(start, end).replace(/\r\n?/g, '\n');
  const endLine = startLine + selected.split('\n').length - 1;
  return { lines, startLine, endLine };
}

export function sourceForSelection(source, start, end, navigationIndex) {
  const text = String(source ?? '');
  const safeStart = Math.max(0, Math.min(Number(start) || 0, text.length));
  const safeEnd = Math.max(safeStart, Math.min(Number(end) || 0, text.length));
  if (safeStart === safeEnd) return null;
  const { lines, startLine, endLine } = lineRange(text, safeStart, safeEnd);
  const selectedLines = lines.slice(startLine - 1, endLine);
  const selectedText = selectedLines.join('\n').replace(/^\s*@(?:start|end)uml\s*$/gim, '').trim();
  if (!selectedText) return null;

  const declarations = (navigationIndex?.records || []).filter(record => record.type === 'element' && !record.implicit);
  const selectedRecords = (navigationIndex?.records || []).filter(record => record.line >= startLine && record.line <= endLine);
  const references = new Set();
  for (const record of selectedRecords) {
    if (record.source) references.add(record.source);
    if (record.target) references.add(record.target);
    if (record.reference) references.add(record.reference);
  }
  for (const declaration of declarations) {
    const token = declaration.reference || declaration.label;
    if (token && new RegExp(`(?:^|[^A-Za-z0-9_$.-])${String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^A-Za-z0-9_$.-])`, 'i').test(selectedText)) references.add(declaration.reference);
  }

  const definitionLines = declarations
    .filter(record => references.has(record.reference) && (record.line < startLine || record.line > endLine))
    .sort((a, b) => a.line - b.line)
    .map(record => record.statement.trimEnd());
  const prefix = ['@startuml', ...definitionLines];
  if (definitionLines.length) prefix.push('');
  const output = [...prefix, selectedText, '@enduml'].join('\n');
  const selectionStart = prefix.join('\n').length + 1;
  return { source: output, selectionStart, selectionEnd: selectionStart + selectedText.length, startLine, endLine };
}
