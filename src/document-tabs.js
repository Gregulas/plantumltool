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
    ignoredSpellingOccurrences: new Set(options.ignoredSpellingOccurrences || []),
    ignoredSpellingWords: new Set(options.ignoredSpellingWords || []),
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

function definitionContextLines(lines, declarations, references, beforeLine) {
  const included = new Set();
  const boxes = [];
  const boxStack = [];
  let styleBlock = null;
  for (let index = 0; index < beforeLine - 1; index += 1) {
    const trimmed = lines[index].trim();
    if (styleBlock != null) {
      included.add(index);
      if (/^<\/style>/i.test(trimmed) || (styleBlock === 'skinparam' && trimmed === '}')) styleBlock = null;
      continue;
    }
    if (/^<style>/i.test(trimmed)) {
      styleBlock = 'style';
      included.add(index);
    } else if (/^skinparam\b.*\{\s*$/i.test(trimmed)) {
      styleBlock = 'skinparam';
      included.add(index);
    } else if (/^(?:!include|!theme|!define|skinparam\b|hide\b|show\b|autonumber\b|scale\b)/i.test(trimmed)) {
      included.add(index);
    }
    if (/^box\b/i.test(trimmed)) boxStack.push(index);
    else if (/^end\s+box\b/i.test(trimmed) && boxStack.length) boxes.push({ start: boxStack.pop(), end: index });
  }

  for (const record of declarations.filter(item => references.has(item.reference) && item.line < beforeLine)) {
    const index = record.line - 1;
    included.add(index);
    const box = boxes.find(item => index > item.start && index < item.end);
    if (box) {
      included.add(box.start);
      included.add(box.end);
    }
  }
  return [...included].sort((a, b) => a - b).map(index => lines[index]);
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

  const definitionLines = definitionContextLines(lines, declarations, references, startLine);
  const prefix = ['@startuml', ...definitionLines];
  if (definitionLines.length) prefix.push('');
  const output = [...prefix, selectedText, '@enduml'].join('\n');
  const selectionStart = prefix.join('\n').length + 1;
  return { source: output, selectionStart, selectionEnd: selectionStart + selectedText.length, startLine, endLine };
}
