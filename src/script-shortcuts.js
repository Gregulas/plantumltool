function splitShortcutParticipants(value) {
  const participants = [];
  let token = '';
  let quote = '';
  let escaped = false;

  for (const character of String(value || '')) {
    if (escaped) {
      token += character;
      escaped = false;
      continue;
    }
    if (character === '\\' && quote) {
      token += character;
      escaped = true;
      continue;
    }
    if ((character === '"' || character === "'") && (!quote || quote === character)) {
      quote = quote ? '' : character;
      token += character;
      continue;
    }
    if (character === '|' && !quote) {
      participants.push(token.trim());
      token = '';
      continue;
    }
    token += character;
  }
  participants.push(token.trim());
  return quote || participants.some(participant => !participant) ? null : participants;
}

function validParticipant(value) {
  if (/^"(?:[^"\\]|\\.)+"$/.test(value) || /^'(?:[^'\\]|\\.)+'$/.test(value)) return true;
  return /^[A-Za-z_$][\w$.-]*$/.test(value);
}

export function expandSyncCall(value) {
  const participants = splitShortcutParticipants(value);
  if (!participants || participants.length < 2 || !participants.every(validParticipant)) return null;

  const requests = [];
  const responses = [];
  for (let index = 1; index < participants.length; index += 1) {
    const caller = participants[index - 1];
    const callee = participants[index];
    requests.push(`${caller} -> ${callee}`, `activate ${callee}`);
    responses.unshift(`${callee} --> ${caller}`, `deactivate ${callee}`);
  }
  return { lines: [...requests, ...responses], participants };
}

export const SCRIPT_SHORTCUTS = Object.freeze([
  Object.freeze({
    id: 'sync-call',
    keyword: 'sync',
    label: 'Synchronous call chain',
    example: 'Sync caller | service | database',
    expand: expandSyncCall
  })
]);

function lineBounds(source, position) {
  const safe = Math.max(0, Math.min(Number(position) || 0, source.length));
  const previousNewline = source.lastIndexOf('\n', Math.max(0, safe - 1));
  const start = previousNewline < 0 ? 0 : previousNewline + 1;
  const nextNewline = source.indexOf('\n', safe);
  const newlineStart = nextNewline < 0 ? source.length : nextNewline;
  const end = newlineStart > start && source[newlineStart - 1] === '\r' ? newlineStart - 1 : newlineStart;
  return { start, end };
}

export function expandScriptShortcut(source, selectionStart, selectionEnd = selectionStart, shortcuts = SCRIPT_SHORTCUTS) {
  const text = String(source ?? '');
  const startPosition = Math.max(0, Math.min(Number(selectionStart) || 0, text.length));
  const endPosition = Math.max(startPosition, Math.min(Number(selectionEnd) || startPosition, text.length));
  const firstLine = lineBounds(text, startPosition);
  const lastLine = lineBounds(text, endPosition);
  if (firstLine.start !== lastLine.start) return null;

  const line = text.slice(firstLine.start, firstLine.end);
  const indentation = line.match(/^\s*/)?.[0] || '';
  const content = line.slice(indentation.length).trimEnd();

  for (const shortcut of shortcuts || []) {
    const match = content.match(new RegExp(`^${shortcut.keyword}\\s+(.+)$`, 'i'));
    if (!match) continue;
    const expansion = shortcut.expand(match[1]);
    if (!expansion?.lines?.length) return null;
    const newline = text.includes('\r\n') ? '\r\n' : text.includes('\r') ? '\r' : '\n';
    const replacement = expansion.lines.map(item => `${indentation}${item}`).join(newline);
    const caret = firstLine.start + replacement.length;
    return {
      start: firstLine.start,
      end: firstLine.end,
      text: replacement,
      selectionStart: caret,
      selectionEnd: caret,
      shortcutId: shortcut.id,
      label: shortcut.label,
      participants: expansion.participants || []
    };
  }
  return null;
}
