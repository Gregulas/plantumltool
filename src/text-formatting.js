const FORMAT_DEFINITIONS = Object.freeze({
  bold: Object.freeze({ label: 'Bold', open: '<b>', close: '</b>' }),
  italic: Object.freeze({ label: 'Italic', open: '<i>', close: '</i>' }),
  underline: Object.freeze({ label: 'Underline', open: '<u>', close: '</u>' }),
  strike: Object.freeze({ label: 'Strike-through', open: '<s>', close: '</s>' }),
  monospace: Object.freeze({ label: 'Monospace', open: '<font:monospaced>', close: '</font>' })
});

const ARROW_PATTERN = /(?:[o*x]?<{1,2}[-.=o*x|{}]+>{1,2}[o*x]?|[-.=o*x|{}]+>{1,2}[o*x]?|[o*x]?<{1,2}[-.=o*x|{}]+|--|\.\.)/i;
const NOTE_START_PATTERN = /^\s*(?:note|hnote|rnote)\b/i;
const NOTE_END_PATTERN = /^\s*(?:end\s+note|endnote)\b/i;
const NON_RELATIONSHIP_PATTERN = /^\s*(?::|legend\b|title\b|caption\b|header\b|footer\b|skinparam\b|!|@|')/i;
const STRUCTURAL_LINE_PATTERN = /^\s*(?:@(?:start|end)\w*|!(?:include|define|function|procedure|if|else|endif)\b|(?:actor|participant|boundary|control|entity|database|collections|queue|component|node|cloud|artifact|rectangle|usecase|state|class|interface|enum|annotation|object|package|folder|frame|card|file|storage|agent)\b|(?:activate|deactivate|create|destroy|return|autonumber|group|alt|else|opt|loop|par|break|critical|end|if|elseif|endif|while|endwhile|repeat|fork|split|start|stop)\b|(?:note|hnote|rnote|legend|title|caption|header|footer|skinparam)\b|[{}])/i;

function sourceLines(source) {
  const lines = [];
  const pattern = /.*?(?:\r\n|\r|\n|$)/g;
  let match;
  while ((match = pattern.exec(source))) {
    if (!match[0] && match.index === source.length) break;
    const raw = match[0];
    const text = raw.replace(/(?:\r\n|\r|\n)$/, '');
    lines.push({
      start: match.index,
      contentEnd: match.index + text.length,
      end: match.index + raw.length,
      text
    });
  }
  if (!lines.length) lines.push({ start: 0, contentEnd: 0, end: 0, text: '' });
  return lines;
}

function separatorColon(text, from = 0) {
  let quoted = false;
  let escaped = false;
  let squareDepth = 0;
  for (let index = from; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if (char === '[') squareDepth += 1;
    else if (char === ']' && squareDepth) squareDepth -= 1;
    else if (char === ':' && squareDepth === 0) return index;
  }
  return -1;
}

function formatRanges(source) {
  const ranges = [];
  let openNote = null;

  for (const line of sourceLines(source)) {
    if (openNote) {
      if (NOTE_END_PATTERN.test(line.text)) {
        const body = source.slice(openNote.bodyStart, line.start);
        const trailingNewline = body.match(/(?:\r\n|\r|\n)$/)?.[0]?.length || 0;
        ranges.push({ start: openNote.bodyStart, end: line.start - trailingNewline, kind: 'note' });
        openNote = null;
      }
      continue;
    }

    if (NOTE_START_PATTERN.test(line.text)) {
      const colon = separatorColon(line.text);
      if (colon >= 0) {
        ranges.push({
          start: line.start + colon + 1,
          end: line.contentEnd,
          kind: 'note'
        });
      } else {
        openNote = { bodyStart: line.end };
      }
      continue;
    }

    if (NON_RELATIONSHIP_PATTERN.test(line.text)) continue;
    const arrow = line.text.match(ARROW_PATTERN);
    if (!arrow) continue;
    const colon = separatorColon(line.text, arrow.index + arrow[0].length);
    if (colon < 0) continue;
    ranges.push({
      start: line.start + colon + 1,
      end: line.contentEnd,
      kind: 'arrow-label'
    });
  }

  return ranges;
}

function containsFunctionalScript(text) {
  if (ARROW_PATTERN.test(text)) return true;
  if (/[{}]/.test(text)) return true;
  return text.replace(/\r\n?/g, '\n').split('\n').some(line => STRUCTURAL_LINE_PATTERN.test(line));
}

function formatTags(format, value) {
  if (FORMAT_DEFINITIONS[format]) return FORMAT_DEFINITIONS[format];
  if (format === 'color' && /^#[0-9a-f]{6}$/i.test(String(value || ''))) {
    return { label: 'Text color', open: `<color:${value.toUpperCase()}>`, close: '</color>' };
  }
  if (format === 'size' && /^\d{1,2}$/.test(String(value || ''))) {
    const size = Number(value);
    if (size >= 8 && size <= 48) return { label: 'Text size', open: `<size:${size}>`, close: '</size>' };
  }
  return null;
}

export function textFormatSelectionContext(source, selectionStart, selectionEnd) {
  const text = String(source ?? '');
  const start = Number(selectionStart);
  const end = Number(selectionEnd);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > text.length || start >= end) {
    return { valid: false, reason: 'Select text inside a note or arrow label.' };
  }

  const selected = text.slice(start, end);
  if (!selected.trim()) return { valid: false, reason: 'Select visible text to format.' };
  const range = formatRanges(text).find(item => start >= item.start && end <= item.end);
  if (!range) return { valid: false, reason: 'Formatting is limited to note text and arrow labels.' };
  if (containsFunctionalScript(selected)) {
    return { valid: false, reason: 'The selection contains functional PlantUML script.' };
  }
  return { valid: true, kind: range.kind, start, end, selected };
}

export function createTextFormatEdit(source, selectionStart, selectionEnd, format, value = '') {
  const context = textFormatSelectionContext(source, selectionStart, selectionEnd);
  if (!context.valid) return context;
  const tags = formatTags(format, value);
  if (!tags) return { valid: false, reason: 'Unsupported text-formatting option.' };

  return {
    valid: true,
    kind: context.kind,
    label: tags.label,
    start: context.start,
    end: context.end,
    text: `${tags.open}${context.selected}${tags.close}`,
    selectionStart: context.start + tags.open.length,
    selectionEnd: context.start + tags.open.length + context.selected.length
  };
}

export { FORMAT_DEFINITIONS };
