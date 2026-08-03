const MAX_HISTORY = 200;
const MERGE_WINDOW_MS = 700;

function findEditor() {
  const candidates = [...document.querySelectorAll('textarea')];
  return candidates.find((element) =>
    /plantuml|source|editor/i.test([
      element.id,
      element.name,
      element.className,
      element.getAttribute('aria-label'),
      element.placeholder,
    ].filter(Boolean).join(' ')),
  ) || candidates[0] || null;
}

function snapshot(editor) {
  return {
    value: editor.value,
    selectionStart: editor.selectionStart,
    selectionEnd: editor.selectionEnd,
    selectionDirection: editor.selectionDirection || 'none',
    scrollTop: editor.scrollTop,
    scrollLeft: editor.scrollLeft,
  };
}

function sameSnapshot(left, right) {
  return left.value === right.value
    && left.selectionStart === right.selectionStart
    && left.selectionEnd === right.selectionEnd;
}

function createHistory(editor) {
  let entries = [snapshot(editor)];
  let index = 0;
  let applying = false;
  let lastInputAt = 0;
  let lastInputType = '';

  const listeners = new Set();
  const notify = () => listeners.forEach((listener) => listener({
    canUndo: index > 0,
    canRedo: index < entries.length - 1,
  }));

  function commit({ force = false, inputType = '' } = {}) {
    if (applying) return;

    const next = snapshot(editor);
    const current = entries[index];
    if (sameSnapshot(current, next)) return;

    const now = Date.now();
    const isTyping = inputType === 'insertText' || inputType === 'deleteContentBackward';
    const canMerge = !force
      && isTyping
      && inputType === lastInputType
      && now - lastInputAt < MERGE_WINDOW_MS
      && index === entries.length - 1;

    if (canMerge) {
      entries[index] = next;
    } else {
      entries = entries.slice(0, index + 1);
      entries.push(next);
      if (entries.length > MAX_HISTORY) entries.shift();
      index = entries.length - 1;
    }

    lastInputAt = now;
    lastInputType = inputType;
    notify();
  }

  function apply(nextIndex) {
    if (nextIndex < 0 || nextIndex >= entries.length || nextIndex === index) return;

    applying = true;
    index = nextIndex;
    const state = entries[index];
    editor.value = state.value;
    editor.setSelectionRange(
      state.selectionStart,
      state.selectionEnd,
      state.selectionDirection,
    );
    editor.scrollTop = state.scrollTop;
    editor.scrollLeft = state.scrollLeft;
    editor.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'historyUndo',
      data: null,
    }));
    editor.focus();
    applying = false;
    lastInputAt = 0;
    lastInputType = '';
    notify();
  }

  editor.addEventListener('input', (event) => {
    if (applying || event.inputType === 'historyUndo' || event.inputType === 'historyRedo') return;
    commit({ inputType: event.inputType || '', force: !event.isTrusted });
  });

  return {
    undo: () => apply(index - 1),
    redo: () => apply(index + 1),
    canUndo: () => index > 0,
    canRedo: () => index < entries.length - 1,
    checkpoint: () => commit({ force: true }),
    reset() {
      entries = [snapshot(editor)];
      index = 0;
      lastInputAt = 0;
      lastInputType = '';
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener({ canUndo: index > 0, canRedo: index < entries.length - 1 });
      return () => listeners.delete(listener);
    },
  };
}

function makeButton(label, title, icon) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'history-button';
  button.textContent = icon;
  button.title = title;
  button.setAttribute('aria-label', label);
  return button;
}

function installStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .history-controls {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    .history-button {
      min-width: 2rem;
      min-height: 2rem;
      padding: 0.3rem 0.55rem;
      border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
      border-radius: 0.35rem;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .history-button:hover:not(:disabled) {
      background: color-mix(in srgb, currentColor 10%, transparent);
    }
    .history-button:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
    .history-button:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
  `;
  document.head.append(style);
}

function installControls(editor, history) {
  const controls = document.createElement('span');
  controls.className = 'history-controls';
  controls.setAttribute('aria-label', 'Edit history');

  const undoButton = makeButton('Undo', 'Undo (Ctrl/Cmd+Z)', '↶');
  const redoButton = makeButton('Redo', 'Redo (Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z)', '↷');
  controls.append(undoButton, redoButton);

  const toolbar = document.querySelector('[role="toolbar"], .toolbar, .app-toolbar, header');
  if (toolbar) {
    toolbar.append(controls);
  } else {
    editor.parentElement?.insertBefore(controls, editor);
  }

  undoButton.addEventListener('click', history.undo);
  redoButton.addEventListener('click', history.redo);
  history.subscribe(({ canUndo, canRedo }) => {
    undoButton.disabled = !canUndo;
    redoButton.disabled = !canRedo;
  });
}

function installKeyboardShortcuts(editor, history) {
  editor.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

    const key = event.key.toLowerCase();
    const undo = key === 'z' && !event.shiftKey;
    const redo = key === 'y' || (key === 'z' && event.shiftKey);
    if (!undo && !redo) return;

    event.preventDefault();
    if (undo) history.undo();
    else history.redo();
  });
}

function initialize() {
  const editor = findEditor();
  if (!editor) {
    console.warn('Undo/redo was not initialized because no source textarea was found.');
    return;
  }

  installStyles();
  const history = createHistory(editor);
  installControls(editor, history);
  installKeyboardShortcuts(editor, history);

  // Expose integration hooks for Open, New, template, format, and quick-fix actions.
  // Call checkpoint() after a programmatic edit, or reset() after loading a document.
  window.plantUmlEditHistory = history;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}
