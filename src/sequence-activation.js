function lineEnding(source) {
  return source.includes('\r\n') ? '\r\n' : '\n';
}

function directive(line) {
  const match = line.trim().match(/^(activate|deactivate)\s+([A-Za-z_$][\w$.-]*)\b/i);
  return match ? { command: match[1].toLowerCase(), actor: match[2] } : null;
}

function matchingDirective(lines, afterIndex, command, actor) {
  for (let i = afterIndex + 1; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;
    const parsed = directive(lines[i]);
    return parsed?.command === command && parsed.actor === actor ? i : -1;
  }
  return -1;
}

function activationDepth(lines, throughIndex, actor) {
  let depth = 0;
  for (let i = 0; i <= throughIndex; i += 1) {
    const parsed = directive(lines[i]);
    if (!parsed || parsed.actor !== actor) continue;
    depth += parsed.command === 'activate' ? 1 : -1;
  }
  return Math.max(0, depth);
}

function arrowKind(record) {
  const arrow = record.arrow || '';
  if (arrow.includes('>>')) return 'async';
  if (/(?:--|\.\.)/.test(arrow)) return 'return';
  return 'call';
}

function scopedCalls(records, selected) {
  const start = records.findIndex(record => record.id === selected.id);
  if (start < 0) return [];
  const stack = [selected.source, selected.target];
  const events = [{ command: 'activate', actor: selected.target, line: selected.line }];
  for (let i = start + 1; i < records.length; i += 1) {
    const record = records[i];
    const top = stack.at(-1);
    const caller = stack.at(-2);
    const kind = arrowKind(record);
    if (kind === 'async' && record.source === top) {
      events.push({ command: 'activate', actor: record.target, line: record.line });
      continue;
    }
    if (kind === 'call' && record.source === top) {
      stack.push(record.target);
      events.push({ command: 'activate', actor: record.target, line: record.line });
      continue;
    }
    if (kind === 'return' && record.source === top && record.target === caller) {
      events.push({ command: 'deactivate', actor: record.source, line: record.line });
      stack.pop();
      if (stack.length === 1) break;
    }
  }
  return events;
}

export function sequenceActivationAction(source, index, selectedRecord) {
  if (!selectedRecord || selectedRecord.type !== 'relationship') return null;
  const lines = String(source).split(/\r\n|\r|\n/);
  const relationships = index.records.filter(record => record.type === 'relationship');
  const lineIndex = selectedRecord.line - 1;

  const selectedKind = arrowKind(selectedRecord);
  if (selectedKind === 'return') {
    const active = activationDepth(lines, lineIndex, selectedRecord.source) > 0;
    return {
      mode: active ? 'deactivate-return' : 'activate-return',
      label: active ? 'Deactivate until this return' : 'Activate action',
      actor: selectedRecord.source,
      line: selectedRecord.line
    };
  }

  if (selectedKind === 'async') {
    const existingLine = matchingDirective(lines, lineIndex, 'activate', selectedRecord.target);
    return {
      mode: existingLine >= 0 ? 'deactivate-scope' : 'activate-scope',
      label: existingLine >= 0 ? 'Deactivate action' : 'Activate action',
      events: [{ command: 'activate', actor: selectedRecord.target, line: selectedRecord.line }],
      existingLines: [existingLine]
    };
  }

  const events = scopedCalls(relationships, selectedRecord);
  const existingLines = events.map(event => matchingDirective(lines, event.line - 1, event.command, event.actor));
  const complete = events.length > 0 && existingLines.every(value => value >= 0);
  return {
    mode: complete ? 'deactivate-scope' : 'activate-scope',
    label: complete ? 'Deactivate action' : 'Activate action',
    events,
    existingLines
  };
}

export function applySequenceActivation(source, action) {
  if (!action) return source;
  const ending = lineEnding(source);
  const lines = String(source).split(/\r\n|\r|\n/);
  if (action.mode === 'deactivate-scope') {
    [...new Set(action.existingLines.filter(index => index >= 0))].sort((a, b) => b - a).forEach(index => lines.splice(index, 1));
    return lines.join(ending);
  }
  if (action.mode === 'activate-scope') {
    const additions = action.events
      .filter(event => matchingDirective(lines, event.line - 1, event.command, event.actor) < 0)
      .sort((a, b) => b.line - a.line);
    additions.forEach(event => lines.splice(event.line, 0, `${event.command} ${event.actor}`));
    return lines.join(ending);
  }
  const command = action.mode === 'deactivate-return' ? 'deactivate' : 'activate';
  if (matchingDirective(lines, action.line - 1, command, action.actor) < 0) lines.splice(action.line, 0, `${command} ${action.actor}`);
  return lines.join(ending);
}
