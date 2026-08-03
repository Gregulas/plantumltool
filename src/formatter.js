function newlineStyle(source) {
  return source.includes('\r\n') ? '\r\n' : source.includes('\r') ? '\r' : '\n';
}

function stackTop(stack) {
  return stack[stack.length - 1];
}

function isGenericSequenceBlock(type) {
  return ['alt', 'opt', 'loop', 'par', 'break', 'critical', 'group'].includes(type);
}

function classify(trimmed, stack) {
  const lower = trimmed.toLowerCase();

  // Explicit closers first. They are matched against the nearest compatible
  // formatter block so a stray PlantUML keyword does not destroy indentation.
  if (/^end\s+box\b/.test(lower)) return { close: ['box'] };
  if (/^(?:end\s+note|endnote)\b/.test(lower)) return { close: ['note'] };
  if (/^(?:end\s+legend|endlegend)\b/.test(lower)) return { close: ['legend'] };
  if (/^(?:end\s+ref|endref)\b/.test(lower)) return { close: ['ref'] };
  if (/^(?:end\s+title|endtitle)\b/.test(lower)) return { close: ['title'] };
  if (/^(?:end\s+header|endheader)\b/.test(lower)) return { close: ['header'] };
  if (/^(?:end\s+footer|endfooter)\b/.test(lower)) return { close: ['footer'] };
  if (/^endif\b/.test(lower)) return { close: ['if'] };
  if (/^endwhile\b/.test(lower)) return { close: ['while'] };
  if (/^repeat\s+while\b/.test(lower)) return { close: ['repeat'] };
  if (/^end\s+fork\b/.test(lower)) return { close: ['fork'] };
  if (/^endswitch\b/.test(lower)) return { close: ['switch'] };
  if (/^endsplit\b/.test(lower)) return { close: ['split'] };
  if (/^!endif\b/.test(lower)) return { close: ['!if'] };
  if (/^!endwhile\b/.test(lower)) return { close: ['!while'] };
  if (/^!endfor(?:each)?\b/.test(lower)) return { close: ['!foreach'] };
  if (/^!endprocedure\b/.test(lower)) return { close: ['!procedure'] };

  if (/^}\s*;?\s*$/.test(trimmed)) return { close: ['brace'] };

  // Generic sequence `end` only closes a known sequence block. In activity
  // diagrams a standalone `end` can be a terminal node, so leave it alone when
  // there is no matching block on the formatter stack.
  if (/^end\s*$/.test(lower)) {
    const top = stackTop(stack);
    if (top && isGenericSequenceBlock(top.type)) return { close: [top.type] };
    return {};
  }

  // Mid-block branches render at their owner's indentation, then subsequent
  // content returns one level inside that owner.
  if (/^(?:else|elseif)\b/.test(lower)) return { middle: ['alt', 'par', 'critical', 'if'] };
  if (/^(?:fork\s+again|case\b|!else\b|!elseif\b)/.test(lower)) {
    if (/^fork\s+again\b/.test(lower)) return { middle: ['fork'] };
    if (/^case\b/.test(lower)) return { middle: ['switch'] };
    return { middle: ['!if'] };
  }

  const open = [];

  // Sequence diagram grouping constructs.
  if (/^alt(?:\s|$)/.test(lower)) open.push('alt');
  else if (/^opt(?:\s|$)/.test(lower)) open.push('opt');
  else if (/^loop(?:\s|$)/.test(lower)) open.push('loop');
  else if (/^par(?:\s|$)/.test(lower)) open.push('par');
  else if (/^break(?:\s|$)/.test(lower)) open.push('break');
  else if (/^critical(?:\s|$)/.test(lower)) open.push('critical');
  else if (/^group(?:\s|$)/.test(lower)) open.push('group');
  else if (/^box(?:\s|$)/.test(lower)) open.push('box');

  // Multi-line notes / descriptive blocks. Inline forms containing ':' stay
  // single-line and therefore do not open a formatter block.
  if (/^(?:note|hnote|rnote)\b/.test(lower) && !trimmed.includes(':')) open.push('note');
  else if (/^legend(?:\s|$)/.test(lower) && !/\bendlegend\b/.test(lower)) open.push('legend');
  else if (/^ref\s+over\b/.test(lower) && !trimmed.includes(':')) open.push('ref');
  else if (/^title\s*$/.test(lower)) open.push('title');
  else if (/^header\s*$/.test(lower)) open.push('header');
  else if (/^footer\s*$/.test(lower)) open.push('footer');

  // Activity/control-flow blocks.
  if (/^if\b.*\bthen\b/.test(lower)) open.push('if');
  else if (/^while\b/.test(lower)) open.push('while');
  else if (/^repeat\s*$/.test(lower)) open.push('repeat');
  else if (/^fork\s*$/.test(lower)) open.push('fork');
  else if (/^switch\b/.test(lower)) open.push('switch');
  else if (/^split\s*$/.test(lower)) open.push('split');

  // PlantUML preprocessor blocks.
  if (/^!(?:if|ifdef|ifndef)\b/.test(lower)) open.push('!if');
  else if (/^!while\b/.test(lower)) open.push('!while');
  else if (/^!foreach\b/.test(lower)) open.push('!foreach');
  else if (/^!procedure\b/.test(lower)) open.push('!procedure');

  // Curly-brace bodies (skinparam, class, package, node, namespace, etc.).
  // Ignore braces inside quoted labels by using a deliberately conservative
  // end-of-line check rather than counting every brace character.
  if (/\{\s*$/.test(trimmed) && !/^'.*/.test(trimmed)) open.push('brace');

  return open.length ? { open } : {};
}

function findCompatibleStackIndex(stack, types) {
  if (!types?.length) return -1;
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (types.includes(stack[i].type)) return i;
  }
  return -1;
}

export function formatPlantUml(source, { indent = '  ' } = {}) {
  if (!source) return source;

  const newline = newlineStyle(source);
  const hasFinalNewline = /(?:\r\n|\r|\n)$/.test(source);
  const lines = source.split(/\r\n|\r|\n/);
  if (hasFinalNewline) lines.pop();

  const stack = [];
  const formatted = [];

  for (const rawLine of lines) {
    const withoutTrailing = rawLine.replace(/[\t ]+$/g, '');
    const trimmed = withoutTrailing.trimStart();

    if (!trimmed) {
      formatted.push('');
      continue;
    }

    const info = classify(trimmed, stack);
    let outputDepth = stack.length;

    if (info.close) {
      const matchIndex = findCompatibleStackIndex(stack, info.close);
      if (matchIndex >= 0) {
        // Close the matching block plus any formatter-only children nested in
        // it. Valid PlantUML normally closes the top item; this fallback keeps
        // formatting stable even while the user is repairing a block.
        stack.splice(matchIndex);
        outputDepth = stack.length;
      }
    } else if (info.middle) {
      const matchIndex = findCompatibleStackIndex(stack, info.middle);
      if (matchIndex >= 0) outputDepth = matchIndex;
    }

    // @start/@end directives remain flush-left even though the diagram block is
    // tracked so its contents can be indented as one logical unit.
    if (/^@(?:start|end)\w*\b/i.test(trimmed)) outputDepth = 0;

    formatted.push(`${indent.repeat(Math.max(0, outputDepth))}${trimmed}`);

    if (info.open) {
      for (const type of info.open) stack.push({ type });
    }
  }

  return formatted.join(newline) + (hasFinalNewline ? newline : '');
}

function lineInfoAt(source, position) {
  const safe = Math.min(Math.max(0, position), source.length);
  const before = source.slice(0, safe);
  const line = (before.match(/\r\n|\r|\n/g) || []).length;
  const lastLf = Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r'));
  const lineStart = lastLf + 1;
  const lineEndMatch = source.slice(lineStart).match(/\r\n|\r|\n/);
  const lineEnd = lineEndMatch ? lineStart + lineEndMatch.index : source.length;
  const text = source.slice(lineStart, lineEnd);
  const indentLength = text.match(/^[\t ]*/)?.[0].length || 0;
  const column = safe - lineStart;
  return {
    line,
    column,
    contentOffset: Math.max(0, column - indentLength),
    wasInIndent: column <= indentLength
  };
}

function positionForLineInfo(source, info) {
  const lines = source.split(/\r\n|\r|\n/);
  const lineIndex = Math.min(Math.max(0, info.line), Math.max(0, lines.length - 1));
  let start = 0;
  for (let i = 0; i < lineIndex; i += 1) {
    start += lines[i].length;
    const rest = source.slice(start);
    if (rest.startsWith('\r\n')) start += 2;
    else if (rest.startsWith('\n') || rest.startsWith('\r')) start += 1;
  }
  const text = lines[lineIndex] || '';
  const indentLength = text.match(/^[\t ]*/)?.[0].length || 0;
  const column = info.wasInIndent
    ? Math.min(info.column, indentLength)
    : Math.min(text.length, indentLength + info.contentOffset);
  return start + column;
}

export function formatPlantUmlEdit(source, selectionStart, selectionEnd = selectionStart, options = {}) {
  const startInfo = lineInfoAt(source, selectionStart);
  const endInfo = lineInfoAt(source, selectionEnd);
  const text = formatPlantUml(source, options);
  return {
    text,
    selectionStart: positionForLineInfo(text, startInfo),
    selectionEnd: positionForLineInfo(text, endInfo)
  };
}
