const DECLARATION_KEYWORDS = [
  'actor', 'participant', 'boundary', 'control', 'entity', 'database', 'collections', 'queue',
  'component', 'node', 'cloud', 'artifact', 'rectangle', 'usecase', 'state', 'class', 'interface',
  'enum', 'annotation', 'object', 'package', 'folder', 'frame', 'card', 'file', 'storage', 'agent',
  'stack', 'hexagon', 'label', 'person', 'archimate'
];

const SPECIAL_REFERENCES = new Set(['[*]', 'start', 'stop', 'end', 'fork', 'again', 'detach', 'kill', 'split', 'endsplit']);

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

function stripStereotypes(value) {
  return value.replace(/<<[^>]*>>/g, ' ').replace(/\s+/g, ' ').trim();
}


export function plantUmlSvgLineToSourceLine(value, wrapperLineOffset = 0) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  const offset = Number.isInteger(wrapperLineOffset) ? wrapperLineOffset : Number(wrapperLineOffset) || 0;
  // PlantUML SVG source positions are zero-based, while the editor/navigation
  // index is one-based. If normalizeSource() inserted an @startuml wrapper,
  // remove that synthetic line from the visible editor position as well.
  return Math.max(1, parsed + 1 - offset);
}

export function canonicalNavigationText(value) {
  return String(value ?? '')
    .replace(/\\n/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, '')
    .replace(/["'`]/g, '')
    .toLowerCase()
    .trim();
}

function cleanDisplay(value) {
  const trimmed = String(value ?? '').trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseDeclaration(trimmed) {
  const keywordPattern = DECLARATION_KEYWORDS.join('|');
  const match = trimmed.match(new RegExp(`^(?:abstract\\s+)?(${keywordPattern})\\b\\s*(.*)$`, 'i'));
  if (!match) return null;

  const kind = match[1].toLowerCase();
  let rest = stripStereotypes(match[2] || '');
  if (kind === 'archimate') rest = rest.replace(/^#[A-Za-z][\w-]*\s+/, '').trim();
  if (!rest || rest.startsWith('{')) return null;
  rest = rest.replace(/\s+#(?:[A-Za-z]+|[0-9A-Fa-f]{3,8})\b.*$/, '').trim();
  rest = rest.replace(/\s+order\s+\d+\b.*$/i, '').trim();

  // Alias first: participant P as "Portal"
  let aliasFirst = rest.match(/^([A-Za-z_$][\w$.-]*)\s+as\s+"([^"]+)"/i);
  if (aliasFirst) return { kind, reference: aliasFirst[1], label: aliasFirst[2] };
  aliasFirst = rest.match(/^([A-Za-z_$][\w$.-]*)\s+as\s+\[([^\]]+)\]/i);
  if (aliasFirst) return { kind, reference: aliasFirst[1], label: aliasFirst[2] };

  // Display first: participant "Portal" as P / component [Portal] as P
  let displayFirst = rest.match(/^"([^"]+)"\s+as\s+([A-Za-z_$][\w$.-]*)/i);
  if (displayFirst) return { kind, reference: displayFirst[2], label: displayFirst[1] };
  displayFirst = rest.match(/^\[([^\]]+)\]\s+as\s+([A-Za-z_$][\w$.-]*)/i);
  if (displayFirst) return { kind, reference: displayFirst[2], label: displayFirst[1] };

  // Plain alias form: participant Portal as P
  const plainAlias = rest.match(/^([^\s{]+)\s+as\s+([A-Za-z_$][\w$.-]*)/i);
  if (plainAlias) return { kind, reference: plainAlias[2], label: cleanDisplay(plainAlias[1]) };

  const quoted = rest.match(/^"([^"]+)"/);
  if (quoted) return { kind, reference: quoted[1], label: quoted[1] };
  const bracketed = rest.match(/^\[([^\]]+)\]/);
  if (bracketed) return { kind, reference: bracketed[1], label: bracketed[1] };
  const plain = rest.match(/^([A-Za-z_$][\w$.-]*)/);
  if (plain) return { kind, reference: plain[1], label: plain[1] };
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
  const plain = value.match(/([A-Za-z_$][\w$.-]*|\[\*\])\s*$/);
  return plain ? plain[1] : '';
}

function referenceTokenAtStart(text) {
  let value = text.trim();
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

function parseRelationship(trimmed) {
  if (/^(?::|note\b|legend\b|title\b|caption\b|header\b|footer\b|skinparam\b|!|@)/i.test(trimmed)) return null;
  // Relationship operators across sequence, class, component, state and deployment diagrams.
  const arrow = trimmed.match(/(?:[o*x]?<{1,2}[-.=o*x|{}]+>{1,2}[o*x]?|[-.=o*x|{}]+>{1,2}[o*x]?|[o*x]?<{1,2}[-.=o*x|{}]+|--|\.\.)/);
  if (!arrow) return null;
  const left = trimmed.slice(0, arrow.index);
  const right = trimmed.slice(arrow.index + arrow[0].length);
  const source = referenceTokenAtEnd(left);
  const target = referenceTokenAtStart(right);
  if (!source || !target) return null;
  const colon = right.indexOf(':');
  const label = colon >= 0 ? right.slice(colon + 1).trim() : '';
  return { source, target, label, arrow: arrow[0] };
}

function recordKeys(record) {
  const values = [record.reference, record.label, record.source, record.target, record.message, record.memberLabel];
  return [...new Set(values.map(canonicalNavigationText).filter(Boolean))];
}

function makeRecord(base, sequence) {
  const record = { ...base, id: `nav-${base.line}-${sequence}` };
  record.keys = recordKeys(record);
  return record;
}

function braceDelta(text) {
  let delta = 0;
  let quoted = false;
  let escaped = false;
  for (const ch of text) {
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
    if (ch === '{') delta += 1;
    if (ch === '}') delta -= 1;
  }
  return delta;
}

export function buildSourceNavigationIndex(source) {
  const normalizedSource = String(source ?? '').replace(/\r\n?/g, '\n');
  const lines = normalizedSource.split('\n');
  const records = [];
  const declarations = new Map();
  let sequence = 0;
  let activeContainer = null;
  let activeNote = false;

  lines.forEach((raw, index) => {
    const line = index + 1;
    const code = withoutComment(raw);
    const trimmed = code.trim();

    if (activeNote) {
      const noteText = raw.trim();
      if (/^(?:end\s+note|endnote)\b/i.test(noteText)) {
        activeNote = false;
        return;
      }
      if (noteText) {
        records.push(makeRecord({
          type: 'note',
          kind: 'note',
          label: noteText,
          line,
          statement: raw
        }, ++sequence));
      }
      return;
    }

    if (!trimmed) return;

    if (/^(?:note|hnote|rnote)\b/i.test(trimmed) && !/:\s*\S/.test(trimmed)) {
      activeNote = true;
      return;
    }

    const declaration = parseDeclaration(trimmed);
    if (declaration) {
      const record = makeRecord({
        type: 'element',
        kind: declaration.kind,
        reference: declaration.reference,
        label: declaration.label,
        line,
        statement: raw
      }, ++sequence);
      records.push(record);
      const refKey = canonicalNavigationText(declaration.reference);
      if (refKey && !declarations.has(refKey)) declarations.set(refKey, record);

      if (trimmed.includes('{') && braceDelta(trimmed) > 0) {
        activeContainer = { record, depth: braceDelta(trimmed) };
      }
      return;
    }

    if (activeContainer) {
      const delta = braceDelta(trimmed);
      // Treat visible class/object/enum members as their own navigation destinations.
      if (!/^\s*[{}]\s*$/.test(trimmed) && !parseRelationship(trimmed)) {
        const memberText = trimmed.replace(/[{}]\s*$/, '').trim();
        if (memberText) {
          records.push(makeRecord({
            type: 'member',
            kind: `${activeContainer.record.kind}-member`,
            reference: activeContainer.record.reference,
            label: activeContainer.record.label,
            memberLabel: memberText,
            line,
            statement: raw
          }, ++sequence));
        }
      }
      activeContainer.depth += delta;
      if (activeContainer.depth <= 0) activeContainer = null;
    }

    const relationship = parseRelationship(trimmed);
    if (relationship) {
      records.push(makeRecord({
        type: 'relationship',
        kind: 'relationship',
        source: relationship.source,
        target: relationship.target,
        message: relationship.label,
        line,
        statement: raw
      }, ++sequence));
      return;
    }

    const activity = trimmed.match(/^:([^;]+);/);
    if (activity) {
      records.push(makeRecord({
        type: 'activity',
        kind: 'activity',
        label: activity[1].trim(),
        line,
        statement: raw
      }, ++sequence));
      return;
    }

    const note = trimmed.match(/^(?:note|hnote|rnote)\b.*?:\s*(.+)$/i);
    if (note) {
      records.push(makeRecord({
        type: 'note',
        kind: 'note',
        label: note[1].trim(),
        line,
        statement: raw
      }, ++sequence));
      return;
    }

    // Sequence dividers render as labelled boxes, for example
    // "== Initial offer ==". Index them explicitly so repeated words in later
    // messages cannot steal diagram-to-source navigation.
    const divider = trimmed.match(/^==+\s*(.*?)\s*==+$/);
    if (divider?.[1]) {
      records.push(makeRecord({
        type: 'divider',
        kind: 'sequence-divider',
        label: divider[1].trim(),
        line,
        statement: raw
      }, ++sequence));
    }
  });

  // Elements such as states can be created implicitly by their first relationship.
  for (const relation of records.filter(record => record.type === 'relationship')) {
    for (const ref of [relation.source, relation.target]) {
      const key = canonicalNavigationText(ref);
      if (!key || SPECIAL_REFERENCES.has(String(ref).toLowerCase()) || declarations.has(key)) continue;
      const implicit = makeRecord({
        type: 'element',
        kind: 'implicit',
        reference: ref,
        label: ref,
        line: relation.line,
        statement: relation.statement,
        implicit: true
      }, ++sequence);
      declarations.set(key, implicit);
      records.push(implicit);
    }
  }

  const byId = new Map(records.map(record => [record.id, record]));
  const byLine = new Map();
  for (const record of records) {
    if (!byLine.has(record.line)) byLine.set(record.line, []);
    byLine.get(record.line).push(record);
  }
  return { source: normalizedSource, lines, records, byId, byLine };
}

function descriptorValues(descriptor) {
  const attrs = Object.values(descriptor?.attributes || {}).map(canonicalNavigationText).filter(Boolean);
  const texts = (descriptor?.texts || []).map(canonicalNavigationText).filter(Boolean);
  const clickedText = canonicalNavigationText(descriptor?.clickedText);
  return { attrs: new Set(attrs), texts: new Set(texts), clickedText };
}

function relationshipSignature(record) {
  return `${canonicalNavigationText(record.source)}>${canonicalNavigationText(record.target)}:${canonicalNavigationText(record.message)}`;
}

export function resolveNavigationTarget(index, descriptor = {}) {
  if (!index?.records?.length) return null;
  const explicitLine = Number(descriptor.sourceLine);
  if (Number.isFinite(explicitLine) && explicitLine > 0) {
    const lineRecords = index.byLine.get(explicitLine);
    if (lineRecords?.length === 1) return lineRecords[0];
    if (lineRecords?.length > 1) {
      const nested = resolveNavigationTarget({ ...index, records: lineRecords, byLine: new Map() }, { ...descriptor, sourceLine: null });
      return nested || lineRecords[0];
    }
    // Native PlantUML source metadata is authoritative even for statements the
    // semantic index does not classify. Preserve the exact line instead of
    // falling through to ambiguous rendered-text matching.
    const statement = index.lines?.[explicitLine - 1];
    if (statement != null) {
      return makeRecord({
        type: 'source-line',
        kind: 'source-line',
        label: descriptor.clickedText || statement.trim(),
        line: explicitLine,
        statement
      }, 0);
    }
  }

  const { attrs, texts, clickedText } = descriptorValues(descriptor);
  const classText = String(descriptor.classNames || '').toLowerCase();
  const relationshipHint = /message|link|edge|arrow|transition/.test(classText);
  const elementHint = /participant|entity|class|component|actor|node|cluster|state|object|usecase/.test(classText);
  const attrSource = canonicalNavigationText(descriptor.attributes?.['data-participant-1'] || descriptor.attributes?.['data-entity-1'] || descriptor.attributes?.['data-source']);
  const attrTarget = canonicalNavigationText(descriptor.attributes?.['data-participant-2'] || descriptor.attributes?.['data-entity-2'] || descriptor.attributes?.['data-target']);

  let best = null;
  let bestScore = 0;
  for (const record of index.records) {
    let score = 0;
    if (relationshipHint) score += record.type === 'relationship' ? 42 : -18;
    if (elementHint) score += record.type === 'element' ? 38 : record.type === 'member' ? 10 : -8;

    const keys = record.keys || recordKeys(record);
    for (const key of keys) {
      if (attrs.has(key)) score += 145;
      if (texts.has(key)) score += 82;
      if (clickedText && clickedText === key) score += 165;
    }

    if (record.type === 'relationship') {
      const sourceKey = canonicalNavigationText(record.source);
      const targetKey = canonicalNavigationText(record.target);
      if (attrSource && attrTarget && sourceKey === attrSource && targetKey === attrTarget) score += 230;
      else {
        if (attrSource && sourceKey === attrSource) score += 65;
        if (attrTarget && targetKey === attrTarget) score += 65;
      }
      const messageKey = canonicalNavigationText(record.message);
      if (clickedText && messageKey && clickedText === messageKey) score += 135;
    }

    if (record.type === 'member' && clickedText && canonicalNavigationText(record.memberLabel) === clickedText) score += 220;
    if (record.type === 'divider' && clickedText && canonicalNavigationText(record.label) === clickedText) score += 260;

    if (score > bestScore) {
      bestScore = score;
      best = record;
    }
  }
  return bestScore >= 75 ? best : null;
}


export function findTextNavigationTarget(source, candidates = []) {
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
  const wanted = [...new Set(candidates.map(value => String(value ?? '').trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length);

  for (const displayText of wanted) {
    const key = canonicalNavigationText(displayText);
    if (!key) continue;
    const matches = [];
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index];
      const code = withoutComment(raw).trim();
      if (!code || /^@(?:start|end)/i.test(code)) continue;
      const lineKey = canonicalNavigationText(code);
      if (!lineKey.includes(key)) continue;
      let score = key.length;
      if (lineKey === key) score += 100;
      if (code.includes(`"${displayText}"`) || code.includes(`[${displayText}]`)) score += 80;
      if (new RegExp(`(?:^|[^A-Za-z0-9_$.-])${displayText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^A-Za-z0-9_$.-])`, 'i').test(code)) score += 40;
      matches.push({ line: index + 1, raw, score });
    }
    if (matches.length) {
      matches.sort((a, b) => b.score - a.score || a.line - b.line);
      const best = matches[0];
      return makeRecord({
        type: 'text',
        kind: 'text',
        label: displayText,
        line: best.line,
        statement: best.raw
      }, 0);
    }
  }
  return null;
}

export function relocateNavigationTarget(renderedRecord, currentSource) {
  if (!renderedRecord) return null;
  const current = buildSourceNavigationIndex(currentSource);
  const sameStatement = current.records.filter(record => record.statement.trim() === renderedRecord.statement.trim());
  if (sameStatement.length === 1) return sameStatement[0];

  let candidates = current.records.filter(record => record.type === renderedRecord.type);
  if (renderedRecord.type === 'text') {
    return findTextNavigationTarget(currentSource, [renderedRecord.label]);
  }
  if (renderedRecord.type === 'relationship') {
    const sig = relationshipSignature(renderedRecord);
    candidates = candidates.filter(record => relationshipSignature(record) === sig);
  } else if (renderedRecord.type === 'member') {
    const member = canonicalNavigationText(renderedRecord.memberLabel);
    const ref = canonicalNavigationText(renderedRecord.reference);
    candidates = candidates.filter(record => canonicalNavigationText(record.memberLabel) === member && canonicalNavigationText(record.reference) === ref);
  } else {
    const ref = canonicalNavigationText(renderedRecord.reference);
    const label = canonicalNavigationText(renderedRecord.label);
    candidates = candidates.filter(record => (ref && canonicalNavigationText(record.reference) === ref) || (label && canonicalNavigationText(record.label) === label));
  }

  if (!candidates.length) return null;
  return candidates.sort((a, b) => Math.abs(a.line - renderedRecord.line) - Math.abs(b.line - renderedRecord.line))[0];
}
