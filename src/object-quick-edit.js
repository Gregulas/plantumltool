const COLOR_TOKEN = /(?:^|\s)(#(?:[0-9A-Fa-f]{3,8}|[A-Za-z][\w-]*))(?=\s|$)/;
const STEREOTYPE_TOKEN = /<<\s*([^<>]+?)\s*>>/;

export function readObjectAppearance(statement) {
  const text = String(statement ?? '');
  return {
    color: text.match(COLOR_TOKEN)?.[1] || '',
    style: text.match(STEREOTYPE_TOKEN)?.[1]?.trim() || ''
  };
}

export function updateObjectAppearance(source, lineNumber, { color = '', style = '' } = {}) {
  const text = String(source ?? '');
  const newline = text.includes('\r\n') ? '\r\n' : text.includes('\r') ? '\r' : '\n';
  const lines = text.split(/\r\n|\r|\n/);
  const index = Number(lineNumber) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= lines.length) return text;

  let line = lines[index];
  const commentIndex = line.indexOf("'");
  const comment = commentIndex >= 0 ? line.slice(commentIndex).trimStart() : '';
  let code = commentIndex >= 0 ? line.slice(0, commentIndex).trimEnd() : line.trimEnd();

  code = code.replace(COLOR_TOKEN, '').replace(STEREOTYPE_TOKEN, '').replace(/\s{2,}/g, ' ').trimEnd();
  const normalizedStyle = String(style).replace(/[<>]/g, '').trim();
  const normalizedColor = String(color).trim();
  if (normalizedStyle) code += ` <<${normalizedStyle}>>`;
  if (normalizedColor) code += ` ${normalizedColor.startsWith('#') ? normalizedColor : `#${normalizedColor}`}`;
  lines[index] = comment ? `${code} ${comment}` : code;
  return lines.join(newline);
}
