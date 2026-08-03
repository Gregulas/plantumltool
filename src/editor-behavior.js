export function captureEditorView(textarea) {
  return {
    selectionStart: textarea.selectionStart ?? 0,
    selectionEnd: textarea.selectionEnd ?? 0,
    selectionDirection: textarea.selectionDirection || 'none',
    scrollTop: textarea.scrollTop || 0,
    scrollLeft: textarea.scrollLeft || 0,
    focused: textarea.ownerDocument?.activeElement === textarea
  };
}

export function restoreEditorView(textarea, snapshot, { restoreFocus = true } = {}) {
  if (!snapshot) return;
  const length = textarea.value.length;
  const start = Math.min(Math.max(0, snapshot.selectionStart ?? 0), length);
  const end = Math.min(Math.max(start, snapshot.selectionEnd ?? start), length);

  if (restoreFocus && snapshot.focused && textarea.ownerDocument?.activeElement !== textarea) {
    textarea.focus({ preventScroll: true });
  }

  textarea.setSelectionRange(start, end, snapshot.selectionDirection || 'none');
  textarea.scrollTop = snapshot.scrollTop || 0;
  textarea.scrollLeft = snapshot.scrollLeft || 0;
}

export function lineIndentAt(source, position) {
  const safe = Math.min(Math.max(0, position), source.length);
  const before = source.slice(0, safe);
  const lineStart = Math.max(before.lastIndexOf('\n') + 1, before.lastIndexOf('\r') + 1);
  const linePrefix = source.slice(lineStart, safe);
  return linePrefix.match(/^[\t ]*/)?.[0] || '';
}

export function preferredNewline(source) {
  return source.includes('\r\n') ? '\r\n' : '\n';
}

export function indentedNewlineEdit(source, selectionStart, selectionEnd = selectionStart) {
  const start = Math.min(Math.max(0, selectionStart), source.length);
  const end = Math.min(Math.max(start, selectionEnd), source.length);
  const indent = lineIndentAt(source, start);
  const text = `${preferredNewline(source)}${indent}`;
  return {
    start,
    end,
    text,
    caret: start + text.length
  };
}
