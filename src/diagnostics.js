const TYPO_FIXES = new Map([
  ['particpant', 'participant'],
  ['participent', 'participant'],
  ['componant', 'component'],
  ['compnent', 'component'],
  ['databse', 'database'],
  ['skinparm', 'skinparam'],
  ['activte', 'activate'],
  ['deactivte', 'deactivate'],
  ['endiff', 'endif'],
  ['endwile', 'endwhile'],
  ['endwhilee', 'endwhile'],
  ['endlegand', 'endlegend']
]);

let diagnosticSeq = 0;

function diag({ severity = 'error', line = null, column = 1, message, suggestion = '', detail = '', fix = null, source = 'local' }) {
  return {
    id: `diag-${++diagnosticSeq}`,
    severity,
    line,
    column,
    message,
    suggestion,
    detail,
    fix,
    source
  };
}

function lineOffsets(lines) {
  const offsets = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  return offsets;
}

function withoutComment(line) {
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "'" && !quoted) return line.slice(0, i);
  }
  return line;
}

function quoteState(line) {
  let quoted = false;
  let escaped = false;
  let commentAt = -1;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "'" && !quoted) {
      commentAt = i;
      break;
    }
  }
  return { unterminated: quoted, commentAt };
}

function makeInsertFix(label, offset, text) {
  return { label, start: offset, end: offset, text };
}

function makeReplaceFix(label, start, end, text) {
  return { label, start, end, text };
}

function makeDeleteFix(label, start, end) {
  return { label, start, end, text: '' };
}

function expectedDiagramEnd(startToken) {
  return startToken.replace(/^@start/i, '@end');
}

function appendLine(source, text) {
  const prefix = source.length && !source.endsWith('\n') ? '\n' : '';
  return `${prefix}${text}`;
}

function analyzeDiagramMarkers(source, lines, offsets, diagnostics) {
  const stack = [];

  lines.forEach((raw, index) => {
    const line = withoutComment(raw).trim();
    const startMatch = line.match(/^(@start[a-z0-9_]+)\b/i);
    const endMatch = line.match(/^(@end[a-z0-9_]+)\b/i);

    if (startMatch) {
      stack.push({ token: startMatch[1], line: index + 1 });
      return;
    }

    if (!endMatch) return;
    if (!stack.length) {
      diagnostics.push(diag({
        line: index + 1,
        message: `${endMatch[1]} has no matching @start directive.`,
        suggestion: 'Remove this end directive or add the corresponding start directive above it.',
        fix: makeDeleteFix(`Remove ${endMatch[1]}`, offsets[index] + raw.indexOf(endMatch[1]), offsets[index] + raw.indexOf(endMatch[1]) + endMatch[1].length)
      }));
      return;
    }

    const opened = stack.pop();
    const expected = expectedDiagramEnd(opened.token).toLowerCase();
    if (endMatch[1].toLowerCase() !== expected) {
      const tokenStart = offsets[index] + raw.indexOf(endMatch[1]);
      diagnostics.push(diag({
        line: index + 1,
        message: `${endMatch[1]} does not match ${opened.token} on line ${opened.line}.`,
        suggestion: `Use ${expectedDiagramEnd(opened.token)} to close this diagram.`,
        fix: makeReplaceFix(`Change to ${expectedDiagramEnd(opened.token)}`, tokenStart, tokenStart + endMatch[1].length, expectedDiagramEnd(opened.token))
      }));
    }
  });

  for (const opened of stack.reverse()) {
    const closing = expectedDiagramEnd(opened.token);
    diagnostics.push(diag({
      line: opened.line,
      message: `${opened.token} is not closed.`,
      suggestion: `Add ${closing} at the end of the diagram.`,
      fix: makeInsertFix(`Add ${closing}`, source.length, appendLine(source, closing))
    }));
  }
}

function analyzeQuotes(lines, offsets, diagnostics) {
  lines.forEach((raw, index) => {
    const state = quoteState(raw);
    if (!state.unterminated) return;
    const code = state.commentAt >= 0 ? raw.slice(0, state.commentAt) : raw;
    const insertionPoint = offsets[index] + code.length;
    diagnostics.push(diag({
      line: index + 1,
      column: Math.max(1, code.lastIndexOf('"') + 1),
      message: 'Unterminated double-quoted text.',
      suggestion: 'Close the quoted name or label with a double quote.',
      fix: makeInsertFix('Add closing quote', insertionPoint, '"')
    }));
  });
}

function analyzeBraces(lines, offsets, diagnostics) {
  const stack = [];

  lines.forEach((raw, index) => {
    const code = withoutComment(raw);
    let quoted = false;
    let escaped = false;

    for (let i = 0; i < code.length; i += 1) {
      const ch = code[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        quoted = !quoted;
        continue;
      }
      if (quoted) continue;

      if (ch === '{') {
        stack.push({ line: index + 1, offset: offsets[index] + i });
      } else if (ch === '}') {
        if (stack.length) {
          stack.pop();
        } else {
          diagnostics.push(diag({
            line: index + 1,
            column: i + 1,
            message: 'Closing brace has no matching opening brace.',
            suggestion: 'Remove the extra brace or add the missing opening brace for the intended block.',
            fix: makeDeleteFix('Remove extra }', offsets[index] + i, offsets[index] + i + 1)
          }));
        }
      }
    }
  });

  for (const opened of stack.reverse()) {
    diagnostics.push(diag({
      line: opened.line,
      column: 1,
      message: 'Opening brace is not closed.',
      suggestion: 'Add a closing brace after the contents of this block.',
      fix: closingFix(lines, offsets, '}', 'Add closing }')
    }));
  }
}

function sourceEndOffset(lines) {
  return lines.reduce((sum, line, index) => sum + line.length + (index < lines.length - 1 ? 1 : 0), 0);
}

function closingFix(lines, offsets, closer, label) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (/^\s*@end[a-z0-9_]+\b/i.test(withoutComment(lines[index]))) {
      return makeInsertFix(label, offsets[index], `${closer}\n`);
    }
  }
  const end = sourceEndOffset(lines);
  const prefix = lines.at(-1)?.length ? '\n' : '';
  return makeInsertFix(label, end, `${prefix}${closer}`);
}

function analyzeBlocks(lines, offsets, diagnostics) {
  const sequence = [];
  const activityIf = [];
  const activityWhile = [];
  const preprocessor = [];
  const note = [];
  const legend = [];
  const reference = [];

  const addMissingClose = (opened, closer, label) => {
    diagnostics.push(diag({
      line: opened.line,
      message: `${label} block is not closed.`,
      suggestion: `Add ${closer} after the block.`,
      fix: closingFix(lines, offsets, closer, `Add ${closer}`)
    }));
  };

  lines.forEach((raw, index) => {
    const code = withoutComment(raw).trim();
    if (!code) return;
    const lineNo = index + 1;

    if (/^!(?:if|ifdef|ifndef)\b/i.test(code)) preprocessor.push({ line: lineNo });
    if (/^!endif\b/i.test(code)) {
      if (preprocessor.length) preprocessor.pop();
      else diagnostics.push(diag({
        line: lineNo,
        message: '!endif has no matching !if/!ifdef/!ifndef.',
        suggestion: 'Remove this !endif or add the missing preprocessor condition.',
        fix: makeDeleteFix('Remove !endif', offsets[index] + raw.indexOf('!endif'), offsets[index] + raw.indexOf('!endif') + 6)
      }));
    }

    if (/^if\s*\(/i.test(code)) activityIf.push({ line: lineNo });
    if (/^endif\b/i.test(code)) {
      if (activityIf.length) activityIf.pop();
      else diagnostics.push(diag({
        line: lineNo,
        message: 'endif has no matching activity if block.',
        suggestion: 'Remove this endif or add the missing if (...) then (...) statement.',
        fix: makeDeleteFix('Remove endif', offsets[index] + raw.toLowerCase().indexOf('endif'), offsets[index] + raw.toLowerCase().indexOf('endif') + 5)
      }));
    }

    if (/^while\s*\(/i.test(code)) activityWhile.push({ line: lineNo });
    if (/^endwhile\b/i.test(code)) {
      if (activityWhile.length) activityWhile.pop();
      else diagnostics.push(diag({
        line: lineNo,
        message: 'endwhile has no matching while block.',
        suggestion: 'Remove this endwhile or add the missing while (...) statement.',
        fix: makeDeleteFix('Remove endwhile', offsets[index] + raw.toLowerCase().indexOf('endwhile'), offsets[index] + raw.toLowerCase().indexOf('endwhile') + 8)
      }));
    }

    if (/^(?:alt|opt|loop|par|break|critical|group)\b/i.test(code)) sequence.push({ line: lineNo, keyword: code.match(/^\w+/)[0] });
    if (/^end\s*$/i.test(code)) {
      if (sequence.length) sequence.pop();
      else diagnostics.push(diag({
        line: lineNo,
        message: 'end has no matching sequence block.',
        suggestion: 'Use end only to close alt, opt, loop, par, break, critical, or group. If this closes a participant box, use end box instead.'
      }));
    }

    if (/^note\b/i.test(code) && !/:\s*\S/.test(code)) note.push({ line: lineNo });
    if (/^end\s+note\b/i.test(code)) {
      if (note.length) note.pop();
      else diagnostics.push(diag({
        line: lineNo,
        message: 'end note has no matching multiline note.',
        suggestion: 'Remove this terminator or add a multiline note block above it.'
      }));
    }

    if (/^legend\b/i.test(code)) legend.push({ line: lineNo });
    if (/^endlegend\b/i.test(code)) {
      if (legend.length) legend.pop();
      else diagnostics.push(diag({ line: lineNo, message: 'endlegend has no matching legend block.', suggestion: 'Remove endlegend or add a legend block above it.' }));
    }

    if (/^ref\s+over\b/i.test(code)) reference.push({ line: lineNo });
    if (/^end\s+ref\b/i.test(code)) {
      if (reference.length) reference.pop();
      else diagnostics.push(diag({ line: lineNo, message: 'end ref has no matching ref over block.', suggestion: 'Remove this terminator or add a ref over block above it.' }));
    }
  });

  sequence.reverse().forEach(opened => addMissingClose(opened, 'end', opened.keyword));
  activityIf.reverse().forEach(opened => addMissingClose(opened, 'endif', 'if'));
  activityWhile.reverse().forEach(opened => addMissingClose(opened, 'endwhile', 'while'));
  preprocessor.reverse().forEach(opened => addMissingClose(opened, '!endif', 'preprocessor condition'));
  note.reverse().forEach(opened => addMissingClose(opened, 'end note', 'note'));
  legend.reverse().forEach(opened => addMissingClose(opened, 'endlegend', 'legend'));
  reference.reverse().forEach(opened => addMissingClose(opened, 'end ref', 'ref'));
}

function analyzeLineRules(lines, offsets, diagnostics) {
  lines.forEach((raw, index) => {
    const code = withoutComment(raw);
    const trimmed = code.trim();
    if (!trimmed) return;
    const lineNo = index + 1;

    const firstTokenMatch = trimmed.match(/^([A-Za-z!@][A-Za-z0-9_!]*)\b/);
    if (firstTokenMatch) {
      const token = firstTokenMatch[1];
      const replacement = TYPO_FIXES.get(token.toLowerCase());
      if (replacement) {
        const tokenIndex = raw.toLowerCase().indexOf(token.toLowerCase());
        diagnostics.push(diag({
          line: lineNo,
          column: tokenIndex + 1,
          message: `Possible PlantUML keyword typo: “${token}”.`,
          suggestion: `Did you mean “${replacement}”?`,
          fix: makeReplaceFix(`Change to ${replacement}`, offsets[index] + tokenIndex, offsets[index] + tokenIndex + token.length, replacement)
        }));
      }
    }

    const aliasMatch = trimmed.match(/^(?:actor|participant|boundary|control|entity|database|collections|queue|component|node|cloud|artifact|rectangle|usecase|state)\b.*\bas\s*$/i);
    if (aliasMatch) {
      diagnostics.push(diag({
        line: lineNo,
        message: 'Declaration uses “as” but no alias is provided.',
        suggestion: 'Add a simple alias after “as”, for example: as Portal.',
        fix: makeInsertFix('Add Alias placeholder', offsets[index] + raw.length, ' Alias')
      }));
    }

    if (/^:[^;]+$/.test(trimmed)) {
      diagnostics.push(diag({
        severity: 'warning',
        line: lineNo,
        message: 'Activity action is missing its terminating semicolon.',
        suggestion: 'End the activity action with “;”.',
        fix: makeInsertFix('Add ;', offsets[index] + code.length, ';')
      }));
    }

    if (/^if\s*\([^)]*\)\s*$/i.test(trimmed)) {
      diagnostics.push(diag({
        line: lineNo,
        message: 'Activity if statement is missing its “then” branch.',
        suggestion: 'Use syntax such as: if (Eligible?) then (yes).',
        fix: makeInsertFix('Add then (yes)', offsets[index] + code.length, ' then (yes)')
      }));
    }

    if (/^[A-Za-z_$][\w$]*\s*(?:-+>|-+>>|\.\.>)\s*:\s*/.test(trimmed)) {
      diagnostics.push(diag({
        line: lineNo,
        message: 'Relationship arrow is missing a target element.',
        suggestion: 'Add the target after the arrow, for example: Portal -> Loan: Request.'
      }));
    }

    if (/^(?:-+>|-+>>|\.\.>)\s*[A-Za-z_$][\w$]*/.test(trimmed)) {
      diagnostics.push(diag({
        line: lineNo,
        message: 'Relationship arrow is missing a source element.',
        suggestion: 'Add the source before the arrow, for example: Portal -> Loan: Request.'
      }));
    }
  });
}


const REFERENCE_DECLARATION_KEYWORDS = [
  'actor', 'participant', 'boundary', 'control', 'entity', 'database', 'collections', 'queue',
  'component', 'node', 'cloud', 'artifact', 'rectangle', 'usecase', 'state', 'class', 'interface',
  'enum', 'annotation', 'object', 'package', 'folder', 'frame', 'card', 'file', 'storage', 'agent',
  'stack', 'hexagon', 'label', 'person', 'archimate'
];

const SPECIAL_REFERENCES = new Set([
  '[*]', 'start', 'stop', 'end', 'fork', 'again', 'detach', 'kill', 'split', 'endsplit'
]);

function normalizeReference(value) {
  const ref = String(value ?? '').trim();
  if (!ref) return '';
  if (ref === '[*]') return ref;
  if ((ref.startsWith('"') && ref.endsWith('"')) || (ref.startsWith('[') && ref.endsWith(']'))) {
    return ref.slice(1, -1).trim();
  }
  return ref;
}

function stripStereotypes(value) {
  return value.replace(/<<[^>]*>>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseDeclaredReference(trimmed) {
  const keywordPattern = REFERENCE_DECLARATION_KEYWORDS.join('|');
  const match = trimmed.match(new RegExp(`^(?:abstract\\s+)?(${keywordPattern})\\b\\s*(.*)$`, 'i'));
  if (!match) return null;

  const kind = match[1].toLowerCase();
  let rest = stripStereotypes(match[2] || '');
  if (kind === 'archimate') rest = rest.replace(/^#[A-Za-z][\w-]*\s+/, '').trim();
  if (!rest || rest.startsWith('{')) return null;

  const aliasMatch = rest.match(/\bas\s+([A-Za-z_$][\w$.-]*)\b/i);
  if (aliasMatch) {
    return {
      reference: aliasMatch[1],
      displayName: rest.replace(/\bas\s+[A-Za-z_$][\w$.-]*\b.*$/i, '').trim(),
      kind
    };
  }

  const quoted = rest.match(/^"([^"]+)"/);
  if (quoted) return { reference: quoted[1], displayName: quoted[1], kind };

  const bracketed = rest.match(/^\[([^\]]+)\]/);
  if (bracketed) return { reference: bracketed[1], displayName: bracketed[1], kind };

  const plain = rest.match(/^([A-Za-z_$][\w$.-]*)/);
  if (plain) return { reference: plain[1], displayName: plain[1], kind };

  return null;
}

function referenceTokenAtEnd(text) {
  let value = text.trim();
  const multiplicity = value.match(/^(.*?)\s+"(?:\d+|[\d.*]+|\d+\.\.\*|\*|\d+\.\.\d+)"\s*$/);
  if (multiplicity) value = multiplicity[1].trim();

  const quoted = value.match(/"([^"]+)"\s*$/);
  if (quoted) return quoted[1];
  const special = value.match(/\[\*\]\s*$/);
  if (special) return '[*]';
  const bracketed = value.match(/\[([^\]]+)\]\s*$/);
  if (bracketed) return bracketed[1];
  const plain = value.match(/([A-Za-z_$][\w$.-]*)\s*$/);
  return plain ? plain[1] : '';
}

function referenceTokenAtStart(text) {
  let value = text.trim();
  // Ignore leading class-diagram multiplicity such as "0..*".
  value = value.replace(/^"(?:\d+|[\d.*]+|\d+\.\.\*|\*|\d+\.\.\d+)"\s*/, '').trim();

  const quoted = value.match(/^"([^"]+)"/);
  if (quoted) return quoted[1];
  const special = value.match(/^\[\*\]/);
  if (special) return '[*]';
  const bracketed = value.match(/^\[([^\]]+)\]/);
  if (bracketed) return bracketed[1];
  const plain = value.match(/^([A-Za-z_$][\w$.-]*)/);
  return plain ? plain[1] : '';
}

function relationshipReferences(trimmed) {
  // Avoid treating arrows embedded in activity text, notes, titles, or styling as element relationships.
  if (/^(?::|note\b|legend\b|title\b|caption\b|header\b|footer\b|skinparam\b)/i.test(trimmed)) return [];
  // Covers common sequence, class, component, deployment and state arrows.
  const arrow = trimmed.match(/(?:<{1,2}[-.=o*|]+>{1,2}|[-.=o*|]+>{1,2}|<{1,2}[-.=o*|]+|--|\.\.)/);
  if (!arrow) return [];

  const left = trimmed.slice(0, arrow.index);
  const right = trimmed.slice(arrow.index + arrow[0].length);
  const source = referenceTokenAtEnd(left);
  const target = referenceTokenAtStart(right);
  return [source, target].filter(Boolean);
}

function additionalUsedReferences(trimmed) {
  const refs = [];
  let match = trimmed.match(/^(?:activate|deactivate|destroy|create)\s+([A-Za-z_$][\w$.-]*|"[^"]+")/i);
  if (match) refs.push(normalizeReference(match[1]));

  match = trimmed.match(/^note\s+(?:left|right)\s+of\s+([A-Za-z_$][\w$.-]*|"[^"]+")/i);
  if (match) refs.push(normalizeReference(match[1]));

  match = trimmed.match(/^(?:note|ref)\s+over\s+(.+?)(?:\s*:\s*.*)?$/i);
  if (match) {
    for (const part of match[1].split(',')) {
      const token = normalizeReference(part.trim());
      if (/^[A-Za-z_$][\w$.-]*$/.test(token) || token.includes(' ')) refs.push(token);
    }
  }

  return refs.filter(Boolean);
}

function analyzeReferences(lines, diagnostics) {
  const declarations = new Map();
  const used = [];

  lines.forEach((raw, index) => {
    const trimmed = withoutComment(raw).trim();
    if (!trimmed || trimmed.startsWith('@') || trimmed.startsWith('!')) return;

    const declaration = parseDeclaredReference(trimmed);
    if (declaration?.reference) {
      const ref = normalizeReference(declaration.reference);
      if (ref) {
        if (declarations.has(ref)) {
          const first = declarations.get(ref);
          diagnostics.push(diag({
            severity: 'warning',
            source: 'semantic',
            line: index + 1,
            message: `Reference “${ref}” is defined more than once.`,
            suggestion: `Rename this reference or remove the duplicate declaration. The first definition is on line ${first.line}.`,
            detail: `Duplicate reference: ${ref}\nFirst definition (line ${first.line}): ${first.text}\nDuplicate definition (line ${index + 1}): ${trimmed}`
          }));
        } else {
          declarations.set(ref, { line: index + 1, text: trimmed, kind: declaration.kind });
        }
      }
      return;
    }

    for (const ref of relationshipReferences(trimmed)) {
      used.push({ reference: normalizeReference(ref), line: index + 1, text: trimmed, usage: 'relationship' });
    }
    for (const ref of additionalUsedReferences(trimmed)) {
      used.push({ reference: normalizeReference(ref), line: index + 1, text: trimmed, usage: 'statement' });
    }
  });

  const warned = new Set();
  for (const use of used) {
    const ref = use.reference;
    if (!ref || SPECIAL_REFERENCES.has(ref.toLowerCase()) || declarations.has(ref)) continue;

    const key = `${use.line}|${ref}`;
    if (warned.has(key)) continue;
    warned.add(key);

    diagnostics.push(diag({
      severity: 'warning',
      source: 'semantic',
      line: use.line,
      message: `Reference “${ref}” is used but not defined in this script.`,
      suggestion: `Declare “${ref}” explicitly, or check the reference spelling if it should point to an existing element.`,
      detail: `Undefined reference: ${ref}\nUsed on line ${use.line}: ${use.text}\nNo declaration for “${ref}” was found anywhere in the current script.`
    }));
  }
}

export function analyzePlantUml(source) {
  const normalized = String(source ?? '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const offsets = lineOffsets(lines);
  const diagnostics = [];

  analyzeDiagramMarkers(normalized, lines, offsets, diagnostics);
  analyzeQuotes(lines, offsets, diagnostics);
  analyzeBraces(lines, offsets, diagnostics);
  analyzeBlocks(lines, offsets, diagnostics);
  analyzeLineRules(lines, offsets, diagnostics);
  analyzeReferences(lines, diagnostics);

  const unique = new Map();
  for (const item of diagnostics) {
    const key = [item.severity, item.line, item.column, item.message].join('|');
    if (!unique.has(key)) unique.set(key, item);
  }

  return [...unique.values()].sort((a, b) => {
    const severityRank = { error: 0, warning: 1, info: 2 };
    return (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9)
      || (a.line ?? Number.MAX_SAFE_INTEGER) - (b.line ?? Number.MAX_SAFE_INTEGER)
      || a.column - b.column;
  });
}

function readableRendererMessage(text, line) {
  const normalized = text
    .replace(/\s*[·|]\s*/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/syntax\s+error/i.test(normalized)) {
    return line ? `PlantUML syntax error near line ${line}.` : 'PlantUML syntax error.';
  }
  if (/unknown|not found|cannot find/i.test(normalized)) {
    return line ? `PlantUML could not resolve something near line ${line}.` : 'PlantUML could not resolve a referenced element or directive.';
  }
  if (/cannot|invalid|illegal|unexpected/i.test(normalized)) {
    return line ? `PlantUML rejected the syntax near line ${line}.` : 'PlantUML rejected part of the diagram syntax.';
  }

  const firstLine = text.split(/\r?\n/).map(part => part.trim()).find(Boolean) || normalized;
  return firstLine.length > 170 ? `${firstLine.slice(0, 167)}…` : firstLine;
}

export function rendererDiagnostic(message, source, fallbackLine = null) {
  const text = String(message ?? '').trim();
  if (!text) return null;
  const lineMatch = text.match(/\bline\s*(?:[:#]?\s*)(\d+)\b/i)
    || text.match(/\b(?:at|on)\s+(\d+)\b/i);
  const line = lineMatch ? Number(lineMatch[1]) : fallbackLine;

  const isRenderLimit = /diagram too large for browser rendering/i.test(text);
  let suggestion = 'Review the reported line and the line immediately before it; PlantUML parser errors are often caused by an unclosed block, quote, or malformed relationship.';
  if (isRenderLimit) suggestion = 'This diagram exceeds the expanded local rendering capacity. Split it into smaller diagrams or use PlantUML newpage sections.';
  if (/syntax error/i.test(text)) suggestion = 'Check the reported line for a misspelled keyword, malformed arrow, missing block terminator, or unclosed quote.';
  if (/cannot|unknown|not found/i.test(text)) suggestion = 'Check the referenced name, include, directive, or keyword spelling.';

  const sizeMatch = text.match(/diagram too large for browser rendering:\s*(\d+)x(\d+)\s*\(max\s*(\d+)\)/i);
  const readableMessage = sizeMatch
    ? `Diagram is too large for browser rendering (${sizeMatch[1]} × ${sizeMatch[2]}; maximum dimension ${sizeMatch[3]}).`
    : readableRendererMessage(text, line);

  return diag({
    source: isRenderLimit ? 'render-limit' : 'renderer',
    line,
    message: readableMessage,
    detail: text,
    suggestion
  });
}

function decodeBasicEntities(value) {
  return String(value ?? '')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

function visibleSvgText(svg) {
  const raw = String(svg ?? '');
  if (!raw) return '';

  try {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
      const text = [...doc.querySelectorAll('text')]
        .map(node => node.textContent?.trim())
        .filter(Boolean)
        .join(' · ');
      if (text) return text;
    }
  } catch {
    // Fall through to the lightweight text extraction below.
  }

  return decodeBasicEntities(
    raw
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

const PLANTUML_ERROR_SVG_PATTERNS = [
  /\bsyntax\s+error\b/i,
  /\bcannot\s+create\s+group\b/i,
  /\bassumed\s+diagram\s+type\s*:/i,
  /\bunexpected\s+(?:token|keyword|end|character)\b/i,
  /\billegal\s+(?:syntax|character|argument)\b/i,
  /\bplantuml\s+(?:syntax|parser|render)\s+error\b/i
];

/**
 * PlantUML can report parser failures in two different ways: by invoking the
 * renderer error callback, or by returning an SVG that visually contains the
 * parser error. The latter must never be committed as the live preview.
 */
export function extractSvgRenderError(svg) {
  const raw = String(svg ?? '');
  if (!raw) return null;

  // Fast pre-check against raw SVG avoids parsing every successful diagram.
  if (!PLANTUML_ERROR_SVG_PATTERNS.some(pattern => pattern.test(raw))) return null;

  const text = visibleSvgText(raw);
  if (!PLANTUML_ERROR_SVG_PATTERNS.some(pattern => pattern.test(text))) return null;

  const lineMatch = text.match(/\bline\s*(?:[:#]?\s*)(\d+)\b/i);
  return {
    message: text || 'PlantUML reported a rendering/parser error.',
    line: lineMatch ? Number(lineMatch[1]) : null
  };
}

// Backward-compatible name used by earlier builds/tests.
export function extractSvgSyntaxError(svg) {
  return extractSvgRenderError(svg);
}
