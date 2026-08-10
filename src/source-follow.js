export function sourceLineAtOffset(source, offset) {
  const safe = Math.min(Math.max(0, Number(offset) || 0), String(source).length);
  return String(source).slice(0, safe).split(/\r\n|\r|\n/).length;
}

export function navigationRecordForLine(index, line) {
  if (!index?.records?.length || !Number.isFinite(line)) return null;
  const exact = index.byLine?.get(line);
  if (exact?.length) return exact.find(record => record.type === 'relationship') || exact[0];
  return index.records.reduce((best, record) => {
    const distance = Math.abs(record.line - line);
    if (!best || distance < best.distance || (distance === best.distance && record.line <= line && best.record.line > line)) {
      return { record, distance };
    }
    return best;
  }, null)?.record || null;
}
