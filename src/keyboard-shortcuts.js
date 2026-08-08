export function zoomShortcutAction(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  if (event.key === '+' || event.key === '=') return 'in';
  if (event.key === '-') return 'out';
  if (event.key === '0') return 'reset';
  return null;
}
