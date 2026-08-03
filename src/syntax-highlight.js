const OBJECT_TYPES = new Set([
  'actor', 'participant', 'boundary', 'control', 'entity', 'database', 'collections', 'queue',
  'component', 'node', 'cloud', 'artifact', 'rectangle', 'usecase', 'state', 'class', 'interface',
  'enum', 'annotation', 'object', 'package', 'folder', 'frame', 'card', 'file', 'storage', 'agent',
  'stack', 'hexagon', 'label', 'person', 'archimate', 'map', 'json'
]);

const FLOW_KEYWORDS = new Set([
  'alt', 'else', 'end', 'opt', 'loop', 'par', 'break', 'critical', 'group',
  'if', 'then', 'elseif', 'endif', 'while', 'endwhile', 'repeat', 'repeatwhile',
  'fork', 'forkagain', 'endfork', 'split', 'splitagain', 'endsplit',
  'switch', 'case', 'endswitch', 'partition', 'box', 'activate', 'deactivate',
  'destroy', 'create', 'return', 'autonumber', 'newpage', 'ref', 'over', 'note',
  'hnote', 'rnote', 'legend', 'title', 'caption', 'header', 'footer', 'left', 'right',
  'top', 'bottom', 'of', 'on', 'link', 'as', 'is', 'start', 'stop', 'detach', 'kill',
  'hide', 'show', 'remove', 'restore', 'together', 'namespace', 'allowmixing', 'page'
]);

const STYLE_KEYWORDS = new Set([
  'skinparam', 'style', 'scale', 'layout', 'linetype', 'rankdir', 'lefttorightdirection',
  'topdown', 'monochrome', 'shadowing'
]);

const DIRECTIVE_RE = /^!(?:include|include_once|define|undef|ifdef|ifndef|else|endif|function|procedure|return|theme|pragma|log|assert|local|global|startsub|endsub)\b/i;
const DIAGRAM_MARKER_RE = /^@(?:start|end)[A-Za-z0-9_]*\b/i;
const COLOR_RE = /^#(?:[0-9A-Fa-f]{3,8}|[A-Za-z][A-Za-z0-9_-]*)\b/;
const ARROW_RE = /^(?:<?(?:[-.=]+|\.{2,})(?:\[[^\]]+\])?[ox*<>|/\\]*>?|[ox*<>|/\\]+(?:[-.=]+|\.{2,})>?)/;
const IDENT_RE = /^[A-Za-z_$][\w$.-]*/;
const NUMBER_RE = /^\b\d+(?:\.\d+)?\b/;

// Colors are keyed by the exact PlantUML object type, not alias identity.
// The palette repeats only after twelve distinct types, so all participants,
// for example, always share one color while actors/databases/classes get their
// own type slot.
const TYPE_PALETTE = new Map([...OBJECT_TYPES].map((kind, index) => [kind, index % 12]));

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function typeColor(kind) {
  if (TYPE_PALETTE.has(kind)) return TYPE_PALETTE.get(kind);
  let hash = 0;
  for (let i = 0; i < kind.length; i += 1) hash = ((hash << 5) - hash + kind.charCodeAt(i)) | 0;
  return Math.abs(hash) % 12;
}

function stripStereotypes(value) {
  return value.replace(/<<[^>]*>>/g, ' ').replace(/\s+/g, ' ').trim();
}

function findCommentStart(line) {
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === "'" && !quoted) return i;
  }
  return -1;
}

function declaredSymbol(line) {
  const commentAt = findCommentStart(line);
  const code = (commentAt >= 0 ? line.slice(0, commentAt) : line).trim();
  const match = code.match(/^(?:abstract\s+)?([A-Za-z_][\w-]*)\b\s*(.*)$/i);
  if (!match || !OBJECT_TYPES.has(match[1].toLowerCase())) return null;

  const kind = match[1].toLowerCase();
  let rest = stripStereotypes(match[2] || '');
  if (!rest || rest.startsWith('{')) return null;

  const aliasMatch = rest.match(/\bas\s+([A-Za-z_$][\w$.-]*)\b/i);
  const quoted = rest.match(/^"([^"]+)"/);
  const bracketed = rest.match(/^\[([^\]]+)\]/);
  const plain = rest.match(/^([A-Za-z_$][\w$.-]*)/);
  const displayName = quoted?.[1] || bracketed?.[1] || plain?.[1] || '';
  const reference = aliasMatch?.[1] || displayName;
  if (!reference) return null;

  return { reference, displayName, kind };
}

export function buildReferenceColors(source) {
  const byName = new Map();
  const canonical = new Map();
  const kindByName = new Map();
  String(source ?? '').split(/\r\n|\r|\n/).forEach(line => {
    const symbol = declaredSymbol(line);
    if (!symbol) return;
    const classIndex = typeColor(symbol.kind);
    canonical.set(symbol.reference, classIndex);
    byName.set(symbol.reference, classIndex);
    kindByName.set(symbol.reference, symbol.kind);
    if (symbol.displayName) {
      byName.set(symbol.displayName, classIndex);
      kindByName.set(symbol.displayName, symbol.kind);
    }
  });
  return { byName, canonical, kindByName };
}

function quotedToken(text, symbols) {
  const inner = text.slice(1, -1);
  const ref = symbols.byName.get(inner);
  return ref == null ? { type: 'string', text } : { type: 'reference', text, ref };
}

function findMessageColon(line) {
  let quoted = false;
  let escaped = false;
  let sawArrow = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (quoted) continue;
    const rest = line.slice(i);
    const arrow = rest.match(ARROW_RE);
    if (arrow) {
      sawArrow = true;
      i += arrow[0].length - 1;
      continue;
    }
    if (ch === ':' && sawArrow) return i;
  }
  return -1;
}

function findInlineNoteColon(line) {
  if (!/^\s*(?:note|hnote|rnote)\b/i.test(line)) return -1;
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ':' && !quoted) return i;
  }
  return -1;
}

function tokenizeCode(code, symbols) {
  const tokens = [];
  let i = 0;
  while (i < code.length) {
    const rest = code.slice(i);
    let match;

    if ((match = rest.match(/^\s+/))) {
      tokens.push({ type: 'plain', text: match[0] });
    } else if ((match = rest.match(/^"(?:\\.|[^"\\])*"/))) {
      tokens.push(quotedToken(match[0], symbols));
    } else if ((match = rest.match(DIAGRAM_MARKER_RE))) {
      tokens.push({ type: 'marker', text: match[0] });
    } else if ((match = rest.match(DIRECTIVE_RE))) {
      tokens.push({ type: 'directive', text: match[0] });
    } else if ((match = rest.match(COLOR_RE))) {
      tokens.push({ type: 'color', text: match[0] });
    } else if ((match = rest.match(ARROW_RE))) {
      tokens.push({ type: 'arrow', text: match[0] });
    } else if ((match = rest.match(/^<<[^>]*>>/))) {
      tokens.push({ type: 'stereotype', text: match[0] });
    } else if ((match = rest.match(IDENT_RE))) {
      const word = match[0];
      const lower = word.toLowerCase();
      const ref = symbols.byName.get(word);
      if (OBJECT_TYPES.has(lower)) tokens.push({ type: 'objectType', text: word });
      else if (FLOW_KEYWORDS.has(lower)) tokens.push({ type: 'keyword', text: word });
      else if (STYLE_KEYWORDS.has(lower)) tokens.push({ type: 'style', text: word });
      else if (ref != null) tokens.push({ type: 'reference', text: word, ref });
      else tokens.push({ type: 'plain', text: word });
    } else if ((match = rest.match(NUMBER_RE))) {
      tokens.push({ type: 'number', text: match[0] });
    } else if (/^[{}()[\]]/.test(rest)) {
      tokens.push({ type: 'delimiter', text: rest[0] });
    } else {
      tokens.push({ type: 'plain', text: rest[0] });
    }
    i += tokens[tokens.length - 1].text.length;
  }
  return tokens;
}

function isMultilineNoteStart(line) {
  const trimmed = line.trim();
  return /^(?:note|hnote|rnote)\b/i.test(trimmed) && findInlineNoteColon(trimmed) < 0 && !/^(?:end\s+note|endnote)\b/i.test(trimmed);
}

function isNoteEnd(line) {
  return /^\s*(?:end\s+note|endnote)\b/i.test(line);
}

export function tokenizePlantUml(source) {
  const text = String(source ?? '');
  const symbols = buildReferenceColors(text);
  const lines = text.split(/(\r\n|\r|\n)/);
  const tokens = [];
  let inNoteBody = false;

  for (const part of lines) {
    if (/^(?:\r\n|\r|\n)$/.test(part)) {
      tokens.push({ type: 'plain', text: part });
      continue;
    }

    if (inNoteBody && !isNoteEnd(part)) {
      // Note content is prose, not PlantUML syntax. Keep it visually neutral.
      tokens.push({ type: 'plain', text: part });
      continue;
    }

    if (isNoteEnd(part)) inNoteBody = false;

    const commentAt = findCommentStart(part);
    const codeAndText = commentAt >= 0 ? part.slice(0, commentAt) : part;
    const comment = commentAt >= 0 ? part.slice(commentAt) : '';
    const arrowMessageAt = findMessageColon(codeAndText);
    const noteTextAt = findInlineNoteColon(codeAndText);
    const plainTextAt = arrowMessageAt >= 0 ? arrowMessageAt : noteTextAt;

    if (plainTextAt >= 0) {
      tokens.push(...tokenizeCode(codeAndText.slice(0, plainTextAt), symbols));
      // The colon and everything after it is explanatory text. Do not syntax-color it.
      tokens.push({ type: 'plain', text: codeAndText.slice(plainTextAt) });
    } else {
      tokens.push(...tokenizeCode(codeAndText, symbols));
    }
    if (comment) tokens.push({ type: 'comment', text: comment });

    if (isMultilineNoteStart(part)) inNoteBody = true;
  }

  return tokens;
}

export function highlightPlantUml(source) {
  return tokenizePlantUml(source).map(token => {
    const escaped = escapeHtml(token.text);
    if (token.type === 'plain') return escaped;
    if (token.type === 'reference') return `<span class="tok tok-reference ref-${token.ref}">${escaped}</span>`;
    return `<span class="tok tok-${token.type}">${escaped}</span>`;
  }).join('');
}
