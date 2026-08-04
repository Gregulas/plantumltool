function newlineStyle(source) {
  return String(source).includes('\r\n') ? '\r\n' : String(source).includes('\r') ? '\r' : '\n';
}

function cleanLine(raw) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("'")) return '';
  return trimmed;
}

function compatibleIndex(stack, types) {
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    if (types.includes(stack[i].type)) return i;
  }
  return -1;
}

function sequenceType(value) {
  return ['alt', 'opt', 'loop', 'par', 'break', 'critical', 'group'].includes(value);
}

function openerTypes(line) {
  const lower = line.toLowerCase();
  const types = [];
  if (/^alt(?:\s|$)/.test(lower)) types.push('alt');
  else if (/^opt(?:\s|$)/.test(lower)) types.push('opt');
  else if (/^loop(?:\s|$)/.test(lower)) types.push('loop');
  else if (/^par(?:\s|$)/.test(lower)) types.push('par');
  else if (/^break(?:\s|$)/.test(lower)) types.push('break');
  else if (/^critical(?:\s|$)/.test(lower)) types.push('critical');
  else if (/^group(?:\s|$)/.test(lower)) types.push('group');
  else if (/^box(?:\s|$)/.test(lower)) types.push('box');

  if (/^(?:note|hnote|rnote)\b/.test(lower) && !line.includes(':')) types.push('note');
  else if (/^legend(?:\s|$)/.test(lower) && !/\bendlegend\b/.test(lower)) types.push('legend');
  else if (/^ref\s+over\b/.test(lower) && !line.includes(':')) types.push('ref');
  else if (/^title\s*$/.test(lower)) types.push('title');
  else if (/^header\s*$/.test(lower)) types.push('header');
  else if (/^footer\s*$/.test(lower)) types.push('footer');

  if (/^if\b.*\bthen\b/.test(lower)) types.push('if');
  else if (/^while\b/.test(lower)) types.push('while');
  else if (/^repeat\s*$/.test(lower)) types.push('repeat');
  else if (/^fork\s*$/.test(lower)) types.push('fork');
  else if (/^switch\b/.test(lower)) types.push('switch');
  else if (/^split\s*$/.test(lower)) types.push('split');

  if (/^!(?:if|ifdef|ifndef)\b/.test(lower)) types.push('!if');
  else if (/^!while\b/.test(lower)) types.push('!while');
  else if (/^!foreach\b/.test(lower)) types.push('!foreach');
  else if (/^!procedure\b/.test(lower)) types.push('!procedure');

  if (/\{\s*$/.test(line) && !line.startsWith("'")) types.push('brace');
  return types;
}

function closerTypes(line, stack) {
  const lower = line.toLowerCase();
  if (/^end\s+box\b/.test(lower)) return ['box'];
  if (/^(?:end\s+note|endnote)\b/.test(lower)) return ['note'];
  if (/^(?:end\s+legend|endlegend)\b/.test(lower)) return ['legend'];
  if (/^(?:end\s+ref|endref)\b/.test(lower)) return ['ref'];
  if (/^(?:end\s+title|endtitle)\b/.test(lower)) return ['title'];
  if (/^(?:end\s+header|endheader)\b/.test(lower)) return ['header'];
  if (/^(?:end\s+footer|endfooter)\b/.test(lower)) return ['footer'];
  if (/^endif\b/.test(lower)) return ['if'];
  if (/^endwhile\b/.test(lower)) return ['while'];
  if (/^repeat\s+while\b/.test(lower)) return ['repeat'];
  if (/^(?:end\s+fork|endfork)\b/.test(lower)) return ['fork'];
  if (/^endswitch\b/.test(lower)) return ['switch'];
  if (/^(?:end\s+split|endsplit)\b/.test(lower)) return ['split'];
  if (/^!endif\b/.test(lower)) return ['!if'];
  if (/^!endwhile\b/.test(lower)) return ['!while'];
  if (/^!endfor(?:each)?\b/.test(lower)) return ['!foreach'];
  if (/^!endprocedure\b/.test(lower)) return ['!procedure'];
  if (/^}\s*;?\s*$/.test(line)) return ['brace'];
  if (/^end\s*$/.test(lower)) {
    const top = stack[stack.length - 1];
    return top && sequenceType(top.type) ? [top.type] : [];
  }
  return [];
}

export function findFoldRegions(source) {
  const lines = String(source ?? '').split(/\r\n|\r|\n/);
  const stack = [];
  const regions = [];

  lines.forEach((raw, index) => {
    const line = cleanLine(raw);
    if (!line) return;

    const closers = closerTypes(line, stack);
    if (closers.length) {
      const match = compatibleIndex(stack, closers);
      if (match >= 0) {
        const opened = stack[match];
        stack.splice(match);
        if (index + 1 > opened.startLine + 1) {
          regions.push({
            startLine: opened.startLine,
            endLine: index + 1,
            type: opened.type,
            label: raw.trim()
          });
        }
      }
      return;
    }

    for (const type of openerTypes(line)) stack.push({ type, startLine: index + 1 });
  });

  return regions.sort((a, b) => a.startLine - b.startLine || b.endLine - a.endLine);
}

export function matchingBlockBoundary(source, caretOffset) {
  const text = String(source ?? '');
  const safeOffset = Math.max(0, Math.min(Number(caretOffset) || 0, text.length));
  const line = text.slice(0, safeOffset).split(/\r\n|\r|\n/).length;
  const matches = findFoldRegions(text)
    .filter(region => region.startLine === line || region.endLine === line)
    .sort((a, b) => (a.endLine - a.startLine) - (b.endLine - b.startLine));

  const region = matches[0];
  return region ? {
    activeLine: line,
    startLine: region.startLine,
    endLine: region.endLine,
    type: region.type
  } : null;
}

export function buildFoldProjection(source, collapsedStarts = new Set()) {
  const text = String(source ?? '');
  const newline = newlineStyle(text);
  const lines = text.split(/\r\n|\r|\n/);
  const regions = findFoldRegions(text);
  const byStart = new Map(regions.map(region => [region.startLine, region]));
  const viewLines = [];
  const lineMap = [];
  const hiddenByMarker = new Map();

  let sourceLine = 1;
  while (sourceLine <= lines.length) {
    const region = byStart.get(sourceLine);
    const shouldCollapse = region && collapsedStarts.has(region.startLine) && region.endLine > region.startLine + 1;

    viewLines.push(lines[sourceLine - 1] ?? '');
    lineMap.push({ sourceLine, kind: 'source', foldStart: region?.startLine || null, foldEnd: region?.endLine || null });

    if (shouldCollapse) {
      const hiddenCount = region.endLine - region.startLine - 1;
      const indent = (lines[sourceLine - 1].match(/^\s*/)?.[0] || '') + '  ';
      const marker = `${indent}' ⋯ ${hiddenCount} line${hiddenCount === 1 ? '' : 's'} folded ⋯ [PU-FOLD:${region.startLine}:${region.endLine}]`;
      viewLines.push(marker);
      hiddenByMarker.set(marker, lines.slice(region.startLine, region.endLine - 1));
      lineMap.push({ sourceLine: region.startLine, kind: 'placeholder', foldStart: region.startLine, foldEnd: region.endLine, marker });
      sourceLine = region.endLine;
      continue;
    }

    sourceLine += 1;
  }

  return { text: viewLines.join(newline), lineMap, regions, newline, hiddenByMarker };
}

export function reconstructFoldedSource(projectedText, projection) {
  if (!projection?.hiddenByMarker?.size) return { source: String(projectedText ?? ''), collapsedStarts: new Set(), intact: true };
  const lines = String(projectedText ?? '').split(/\r\n|\r|\n/);
  const out = [];
  const collapsedStarts = new Set();
  let found = 0;

  for (const line of lines) {
    const hidden = projection.hiddenByMarker.get(line);
    if (!hidden) {
      out.push(line);
      continue;
    }
    found += 1;
    // The marker follows its opening line, so out.length is the 1-based
    // opening source line after any edits above the folded region.
    collapsedStarts.add(Math.max(1, out.length));
    out.push(...hidden);
  }

  return {
    source: out.join(projection.newline || '\n'),
    collapsedStarts,
    intact: found === projection.hiddenByMarker.size
  };
}

function lineStarts(text) {
  const starts = [0];
  const re = /\r\n|\r|\n/g;
  let match;
  while ((match = re.exec(text))) starts.push(match.index + match[0].length);
  return starts;
}

function offsetInfo(text, offset) {
  const starts = lineStarts(text);
  const safe = Math.max(0, Math.min(offset, text.length));
  let lineIndex = 0;
  for (let i = 0; i < starts.length; i += 1) {
    if (starts[i] <= safe) lineIndex = i;
    else break;
  }
  return { lineIndex, column: safe - starts[lineIndex] };
}

export function viewOffsetToSourceOffset(source, projection, viewOffset) {
  if (!projection?.lineMap?.length) return viewOffset;
  const info = offsetInfo(projection.text, viewOffset);
  const map = projection.lineMap[Math.min(info.lineIndex, projection.lineMap.length - 1)];
  const sourceLines = String(source).split(/\r\n|\r|\n/);
  const starts = lineStarts(String(source));
  if (map.kind === 'placeholder') {
    const openerIndex = Math.max(0, map.foldStart - 1);
    return starts[openerIndex] + (sourceLines[openerIndex]?.length || 0);
  }
  const sourceIndex = Math.max(0, map.sourceLine - 1);
  return starts[sourceIndex] + Math.min(info.column, sourceLines[sourceIndex]?.length || 0);
}

export function sourceOffsetToViewOffset(source, projection, sourceOffset) {
  if (!projection?.lineMap?.length) return sourceOffset;
  const info = offsetInfo(String(source), sourceOffset);
  const sourceLine = info.lineIndex + 1;
  const starts = lineStarts(projection.text);
  let viewIndex = projection.lineMap.findIndex(map => map.kind === 'source' && map.sourceLine === sourceLine);
  if (viewIndex >= 0) {
    const viewLine = projection.text.split(/\r\n|\r|\n/)[viewIndex] || '';
    return starts[viewIndex] + Math.min(info.column, viewLine.length);
  }

  // Hidden source line: put the caret on the owning placeholder.
  viewIndex = projection.lineMap.findIndex(map => map.kind === 'placeholder' && sourceLine > map.foldStart && sourceLine < map.foldEnd);
  if (viewIndex >= 0) return starts[viewIndex];
  return Math.min(sourceOffset, projection.text.length);
}

export function sourceLineToViewLine(projection, sourceLine) {
  const direct = projection?.lineMap?.findIndex(map => map.kind === 'source' && map.sourceLine === sourceLine) ?? -1;
  if (direct >= 0) return direct + 1;
  const placeholder = projection?.lineMap?.findIndex(map => map.kind === 'placeholder' && sourceLine > map.foldStart && sourceLine < map.foldEnd) ?? -1;
  return placeholder >= 0 ? placeholder + 1 : null;
}

export function containingCollapsedRegion(projection, sourceLine) {
  const marker = projection?.lineMap?.find(map => map.kind === 'placeholder' && sourceLine > map.foldStart && sourceLine < map.foldEnd);
  return marker ? { startLine: marker.foldStart, endLine: marker.foldEnd } : null;
}
