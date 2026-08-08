export const SHORTCUT_GROUPS = [
  { title: 'File', items: [
    ['New diagram', 'Ctrl/Cmd+N'], ['Open file', 'Ctrl/Cmd+O'], ['Save', 'Ctrl/Cmd+S'],
    ['Save As', 'Ctrl/Cmd+Shift+S'], ['Copy SVG', 'Ctrl/Cmd+Alt+C'],
    ['Export SVG', 'Ctrl/Cmd+Alt+S'], ['Export PNG', 'Ctrl/Cmd+Alt+P']
  ] },
  { title: 'Edit', items: [
    ['Undo', 'Ctrl/Cmd+Z'], ['Redo', 'Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z'],
    ['Format script', 'Ctrl/Cmd+Shift+F'], ['Fold all', 'Ctrl/Cmd+Alt+F'],
    ['Unfold all', 'Ctrl/Cmd+Alt+U']
  ] },
  { title: 'Diagram', items: [
    ['Render', 'Ctrl/Cmd+Enter'], ['Sequence template', 'Ctrl/Cmd+Alt+1'],
    ['Class template', 'Ctrl/Cmd+Alt+2'], ['Component template', 'Ctrl/Cmd+Alt+3'],
    ['Activity template', 'Ctrl/Cmd+Alt+4'], ['State template', 'Ctrl/Cmd+Alt+5'],
    ['Deployment template', 'Ctrl/Cmd+Alt+6']
  ] },
  { title: 'View', items: [
    ['Zoom in', 'Ctrl/Cmd++'], ['Zoom out', 'Ctrl/Cmd+-'], ['Actual size', 'Ctrl/Cmd+0'],
    ['Fit diagram', 'Ctrl/Cmd+Alt+0'], ['Open detached preview', 'Ctrl/Cmd+Alt+W'], ['Toggle autocomplete', 'Ctrl/Cmd+Alt+A'],
    ['Toggle live render', 'Ctrl/Cmd+Alt+L'], ['Toggle theme', 'Ctrl/Cmd+Alt+T'],
    ['Shortcut info', 'Ctrl/Cmd+Alt+/'], ['About PlantUML Studio', 'Ctrl/Cmd+Alt+I']
  ] }
];

const ALT_CODE_ACTIONS = {
  KeyC: 'copy-svg', KeyS: 'export-svg', KeyP: 'export-png',
  KeyF: 'fold-all', KeyU: 'unfold-all', Digit0: 'fit',
  KeyA: 'toggle-autocomplete', KeyL: 'toggle-live', KeyT: 'toggle-theme', KeyI: 'show-about', KeyW: 'open-detached-preview',
  Slash: 'show-shortcuts', Digit1: 'template-sequence', Digit2: 'template-class',
  Digit3: 'template-component', Digit4: 'template-activity',
  Digit5: 'template-state', Digit6: 'template-deployment'
};

export function shortcutAction(event) {
  if (!(event.ctrlKey || event.metaKey)) return null;
  if (event.altKey) return ALT_CODE_ACTIONS[event.code] || null;

  const key = event.key.toLowerCase();
  if (key === '+' || key === '=') return 'zoom-in';
  if (key === '-') return 'zoom-out';
  if (key === '0') return 'zoom-reset';
  if (key === 'n') return 'new';
  if (key === 'o') return 'open';
  if (key === 's') return event.shiftKey ? 'save-as' : 'save';
  if (key === 'f' && event.shiftKey) return 'format';
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y') return 'redo';
  if (event.key === 'Enter') return 'render';
  return null;
}
