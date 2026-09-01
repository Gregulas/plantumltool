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
const DECLARATION_KEYWORDS = 'actor|participant|boundary|control|entity|database|collections|queue|component|node|cloud|artifact|rectangle|usecase|state|class|interface|enum|annotation|object|package|folder|frame|card|file|storage|agent';
const STRUCTURAL_LINE_PATTERN = new RegExp(`^\\s*(?:@(?:start|end)\\w*|!(?:include|define|function|procedure|if|else|endif)\\b|(?:${DECLARATION_KEYWORDS})\\b|(?:activate|deactivate|create|destroy|autonumber)\\b|[{}])`, 'i');
const SEQUENCE_GROUP_PATTERN = /^(\s*(?:alt|else|opt|loop|par|break|critical|group)\b\s*)(.*?)(\s*)$/i;

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

function pushTrimmedRange(ranges, line, relativeStart, relativeEnd, kind) {
  let start = Math.max(0, relativeStart);
  let end = Math.min(line.text.length, relativeEnd);
  while (start < end && /\s/.test(line.text[start])) start += 1;
  while (end > start && /\s/.test(line.text[end - 1])) end -= 1;
  if (start < end) ranges.push({ start: line.start + start, end: line.start + end, kind });
}

function pushDisplayAliasRange(ranges, line) {
  const keyword = `(?:abstract\\s+)?(?:${DECLARATION_KEYWORDS})`;
  const patterns = [
    new RegExp(`^(\\s*${keyword}\\b\\s*)"([^"]+)"\\s+as\\s+[^\\s{]+`, 'i'),
    new RegExp(`^(\\s*${keyword}\\b\\s*)\\[([^\\]]+)\\]\\s+as\\s+[^\\s{]+`, 'i'),
    new RegExp(`^(\\s*${keyword}\\b\\s+[^\\s{]+\\s+as\\s*)"([^"]+)"`, 'i'),
    new RegExp(`^(\\s*${keyword}\\b\\s+[^\\s{]+\\s+as\\s*)\\[([^\\]]+)\\]`, 'i')
  ];
  for (const pattern of patterns) {
    const match = line.text.match(pattern);
    if (!match) continue;
    const start = match[1].length + 1;
    ranges.push({ start: line.start + start, end: line.start + start + match[2].length, kind: 'display-name' });
    return true;
  }
  return false;
}

function blockEndWithoutTrailingNewline(source, bodyStart, blockEnd) {
  const body = source.slice(bodyStart, blockEnd);
  return blockEnd - (body.match(/(?:\r\n|\r|\n)$/)?.[0]?.length || 0);
}

function formatRanges(source) {
  const ranges = [];
  let openNote = null;
  let openTextBlock = null;

  for (const line of sourceLines(source)) {
    if (openTextBlock) {
      if (openTextBlock.endPattern.test(line.text)) {
        ranges.push({
          start: openTextBlock.bodyStart,
          end: blockEndWithoutTrailingNewline(source, openTextBlock.bodyStart, line.start),
          kind: 'display-block'
        });
        openTextBlock = null;
      }
      continue;
    }

    if (openNote) {
      if (NOTE_END_PATTERN.test(line.text)) {
        ranges.push({
          start: openNote.bodyStart,
          end: blockEndWithoutTrailingNewline(source, openNote.bodyStart, line.start),
          kind: 'note'
        });
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

    const blockStart = line.text.match(/^\s*(title|header|footer)\s*$/i)
      || line.text.match(/^\s*(legend)(?:\s+(?:left|right|center))?\s*$/i);
    if (blockStart) {
      const token = blockStart[1].toLowerCase();
      openTextBlock = {
        bodyStart: line.end,
        endPattern: token === 'legend' ? /^\s*end\s*legend\b|^\s*endlegend\b/i : new RegExp(`^\\s*end\\s*${token}\\b|^\\s*end${token}\\b`, 'i')
      };
      continue;
    }

    const inlineText = line.text.match(/^(\s*(?:title|caption|header|footer)\b\s+)(.*?)(\s*)$/i);
    if (inlineText) {
      pushTrimmedRange(ranges, line, inlineText[1].length, inlineText[1].length + inlineText[2].length, 'display-label');
      continue;
    }

    const sequenceGroup = line.text.match(SEQUENCE_GROUP_PATTERN);
    if (sequenceGroup && sequenceGroup[2].trim()) {
      pushTrimmedRange(ranges, line, sequenceGroup[1].length, sequenceGroup[1].length + sequenceGroup[2].length, 'group-label');
      continue;
    }

    const separator = line.text.match(/^(\s*==+\s*)(.*?)(\s*==+\s*)$/)
      || line.text.match(/^(\s*\.{3,}\s*)(.*?)(\s*\.{3,}\s*)$/);
    if (separator && separator[2].trim()) {
      pushTrimmedRange(ranges, line, separator[1].length, separator[1].length + separator[2].length, 'separator-label');
      continue;
    }

    const activity = line.text.match(/^(\s*:\s*)(.*?)(\s*;\s*)$/);
    if (activity && activity[2].trim()) {
      pushTrimmedRange(ranges, line, activity[1].length, activity[1].length + activity[2].length, 'activity-label');
      continue;
    }

    const page = line.text.match(/^(\s*newpage\b\s+)(.*?)(\s*)$/i);
    if (page && page[2].trim()) {
      pushTrimmedRange(ranges, line, page[1].length, page[1].length + page[2].length, 'page-label');
      continue;
    }

    if (/^\s*ref\b/i.test(line.text)) {
      const colon = separatorColon(line.text);
      if (colon >= 0) pushTrimmedRange(ranges, line, colon + 1, line.text.length, 'reference-label');
      continue;
    }

    const box = line.text.match(/^\s*box\b[^"\r\n]*"([^"]+)"/i);
    if (box) {
      const start = line.text.indexOf(box[1], box.index);
      ranges.push({ start: line.start + start, end: line.start + start + box[1].length, kind: 'display-label' });
      continue;
    }

    if (pushDisplayAliasRange(ranges, line)) continue;

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

function containsFunctionalScript(text, kind) {
  if (kind !== 'note') return false;
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
  if (containsFunctionalScript(selected, range.kind)) {
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
