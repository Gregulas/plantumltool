const CURSOR = '«cursor»';

const BASE_COMPLETIONS = [
  // File / preprocessor directives
  c('@startuml', '@startuml\n' + CURSOR + '\n@enduml', 'Directive', 'Start a UML diagram'),
  c('@enduml', '@enduml', 'Directive', 'End a UML diagram'),
  c('@startmindmap', '@startmindmap\n' + CURSOR + '\n@endmindmap', 'Directive', 'Start a mind map'),
  c('@startwbs', '@startwbs\n' + CURSOR + '\n@endwbs', 'Directive', 'Start a WBS diagram'),
  c('@startjson', '@startjson\n' + CURSOR + '\n@endjson', 'Directive', 'Start a JSON diagram'),
  c('@startyaml', '@startyaml\n' + CURSOR + '\n@endyaml', 'Directive', 'Start a YAML diagram'),
  c('!include', '!include ' + CURSOR, 'Directive', 'Include a local or library PlantUML resource'),
  c('!include_once', '!include_once ' + CURSOR, 'Directive', 'Include a resource once'),
  c('!define', '!define ' + CURSOR, 'Directive', 'Define a preprocessor variable'),
  c('!undef', '!undef ' + CURSOR, 'Directive', 'Remove a preprocessor definition'),
  c('!ifdef', '!ifdef ' + CURSOR + '\n\n!endif', 'Directive', 'Conditional preprocessing'),
  c('!ifndef', '!ifndef ' + CURSOR + '\n\n!endif', 'Directive', 'Conditional preprocessing'),
  c('!if', '!if ' + CURSOR + '\n\n!endif', 'Directive', 'Conditional preprocessing'),
  c('!else', '!else', 'Directive', 'Preprocessor else branch'),
  c('!endif', '!endif', 'Directive', 'End preprocessor condition'),
  c('!theme', '!theme ' + CURSOR, 'Directive', 'Apply a PlantUML theme'),
  c('title', 'title ' + CURSOR, 'Keyword', 'Diagram title'),
  c('caption', 'caption ' + CURSOR, 'Keyword', 'Diagram caption'),
  c('header', 'header ' + CURSOR, 'Keyword', 'Diagram header'),
  c('footer', 'footer ' + CURSOR, 'Keyword', 'Diagram footer'),
  c('legend', 'legend\n' + CURSOR + '\nendlegend', 'Snippet', 'Add a legend block'),

  // Common declarations
  c('actor', 'actor ' + CURSOR, 'Element', 'Declare an actor'),
  c('participant', 'participant "' + CURSOR + '" as Alias', 'Element', 'Declare a sequence participant with alias'),
  c('boundary', 'boundary "' + CURSOR + '" as Alias', 'Element', 'Declare a boundary participant'),
  c('control', 'control "' + CURSOR + '" as Alias', 'Element', 'Declare a control participant'),
  c('entity', 'entity "' + CURSOR + '" as Alias', 'Element', 'Declare an entity participant'),
  c('database', 'database "' + CURSOR + '" as DB', 'Element', 'Declare a database'),
  c('collections', 'collections "' + CURSOR + '" as Collection', 'Element', 'Declare a collection'),
  c('queue', 'queue "' + CURSOR + '" as Queue', 'Element', 'Declare a queue'),
  c('class', 'class ' + CURSOR + ' {\n  \n}', 'Element', 'Declare a class'),
  c('interface', 'interface ' + CURSOR + ' {\n  \n}', 'Element', 'Declare an interface'),
  c('enum', 'enum ' + CURSOR + ' {\n  \n}', 'Element', 'Declare an enum'),
  c('annotation', 'annotation ' + CURSOR, 'Element', 'Declare an annotation'),
  c('object', 'object ' + CURSOR, 'Element', 'Declare an object'),
  c('component', 'component "' + CURSOR + '" as Component', 'Element', 'Declare a component'),
  c('node', 'node "' + CURSOR + '" as Node {\n  \n}', 'Element', 'Declare a deployment node'),
  c('cloud', 'cloud "' + CURSOR + '" as Cloud', 'Element', 'Declare a cloud'),
  c('artifact', 'artifact "' + CURSOR + '" as Artifact', 'Element', 'Declare an artifact'),
  c('package', 'package "' + CURSOR + '" {\n  \n}', 'Element', 'Declare a package'),
  c('folder', 'folder "' + CURSOR + '" {\n  \n}', 'Element', 'Declare a folder'),
  c('frame', 'frame "' + CURSOR + '" {\n  \n}', 'Element', 'Declare a frame'),
  c('rectangle', 'rectangle "' + CURSOR + '" as Rectangle', 'Element', 'Declare a rectangle'),
  c('usecase', 'usecase "' + CURSOR + '" as UseCase', 'Element', 'Declare a use case'),
  c('state', 'state "' + CURSOR + '" as State', 'Element', 'Declare a state'),

  // Relationships / sequence arrows
  c('->', '-> ' + CURSOR + ': message', 'Arrow', 'Solid line, filled arrow'),
  c('-->', '--> ' + CURSOR + ': response', 'Arrow', 'Dotted line, filled arrow'),
  c('->>', '->> ' + CURSOR + ': async message', 'Arrow', 'Solid line, open arrow'),
  c('-->>', '-->> ' + CURSOR + ': async response', 'Arrow', 'Dotted line, open arrow'),
  c('<-', '<- ' + CURSOR + ': message', 'Arrow', 'Reverse solid arrow'),
  c('<--', '<-- ' + CURSOR + ': response', 'Arrow', 'Reverse dotted arrow'),
  c('<->', '<-> ' + CURSOR, 'Arrow', 'Bidirectional relationship'),
  c('..>', '..> ' + CURSOR, 'Arrow', 'Dotted dependency'),
  c('--|>', '--|> ' + CURSOR, 'Arrow', 'Inheritance / generalization'),
  c('..|>', '..|> ' + CURSOR, 'Arrow', 'Realization'),
  c('--*', '--* ' + CURSOR, 'Arrow', 'Composition'),
  c('--o', '--o ' + CURSOR, 'Arrow', 'Aggregation'),

  // Sequence control flow
  c('alt', 'alt ' + CURSOR + '\n  \nelse alternative\n  \nend', 'Sequence', 'Alternative sequence block'),
  c('opt', 'opt ' + CURSOR + '\n  \nend', 'Sequence', 'Optional sequence block'),
  c('loop', 'loop ' + CURSOR + '\n  \nend', 'Sequence', 'Loop sequence block'),
  c('par', 'par ' + CURSOR + '\n  \nelse parallel branch\n  \nend', 'Sequence', 'Parallel sequence block'),
  c('break', 'break ' + CURSOR + '\n  \nend', 'Sequence', 'Break sequence block'),
  c('critical', 'critical ' + CURSOR + '\n  \nend', 'Sequence', 'Critical sequence block'),
  c('group', 'group ' + CURSOR + '\n  \nend', 'Sequence', 'Group sequence messages'),
  c('else', 'else ' + CURSOR, 'Keyword', 'Else branch'),
  c('end', 'end', 'Keyword', 'End a block'),
  c('activate', 'activate ' + CURSOR, 'Sequence', 'Activate participant lifeline'),
  c('deactivate', 'deactivate ' + CURSOR, 'Sequence', 'Deactivate participant lifeline'),
  c('destroy', 'destroy ' + CURSOR, 'Sequence', 'Destroy a participant'),
  c('create', 'create ' + CURSOR, 'Sequence', 'Create a participant'),
  c('autonumber', 'autonumber', 'Sequence', 'Automatically number sequence messages'),
  c('return', 'return ' + CURSOR, 'Sequence', 'Return message'),
  c('ref', 'ref over ' + CURSOR + '\nReference\nend ref', 'Sequence', 'Sequence reference block'),
  c('note', 'note right of ' + CURSOR + '\n  Note text\nend note', 'Note', 'Add a multi-line note'),
  c('note right', 'note right of ' + CURSOR + ': Note text', 'Note', 'Add a note on the right'),
  c('note left', 'note left of ' + CURSOR + ': Note text', 'Note', 'Add a note on the left'),
  c('note over', 'note over ' + CURSOR + ': Note text', 'Note', 'Add a note over participant(s)'),

  // Activity / state
  c('start', 'start', 'Activity', 'Activity start node'),
  c('stop', 'stop', 'Activity', 'Activity stop node'),
  c('if', 'if (' + CURSOR + '?) then (yes)\n  :Action;\nelse (no)\n  :Alternative;\nendif', 'Activity', 'Conditional activity block'),
  c('elseif', 'elseif (' + CURSOR + '?) then (yes)', 'Activity', 'Additional activity condition'),
  c('endif', 'endif', 'Activity', 'End activity condition'),
  c('while', 'while (' + CURSOR + '?) is (yes)\n  :Action;\nendwhile (no)', 'Activity', 'While loop'),
  c('repeat', 'repeat\n  :' + CURSOR + ';\nrepeat while (condition?) is (yes)', 'Activity', 'Repeat loop'),
  c('fork', 'fork\n  :' + CURSOR + ';\nfork again\n  :Parallel action;\nend fork', 'Activity', 'Parallel activity block'),
  c('partition', 'partition "' + CURSOR + '" {\n  \n}', 'Activity', 'Activity partition'),
  c('detach', 'detach', 'Activity', 'Detach an activity flow'),
  c('[*]', '[*]', 'State', 'State-machine initial/final pseudo-state'),

  // Styling / layout
  c('skinparam', 'skinparam ' + CURSOR, 'Style', 'Set a PlantUML skin parameter'),
  c('skinparam sequence', 'skinparam sequence {\n  ArrowColor #222222\n  ActorBorderColor #32BCBB\n  LifeLineBorderColor #32BCBB\n  ParticipantBorderColor #32BCBB\n  ParticipantBackgroundColor #E9FAFA\n}', 'Snippet', 'Sequence-diagram styling block'),
  c('skinparam componentStyle', 'skinparam componentStyle rectangle', 'Style', 'Use rectangle component style'),
  c('skinparam backgroundColor', 'skinparam backgroundColor ' + CURSOR, 'Style', 'Set diagram background color'),
  c('skinparam shadowing', 'skinparam shadowing false', 'Style', 'Enable or disable shadows'),
  c('skinparam roundcorner', 'skinparam roundcorner 10', 'Style', 'Set rounded corners'),
  c('skinparam dpi', 'skinparam dpi 150', 'Style', 'Set render DPI'),
  c('hide', 'hide ' + CURSOR, 'Style', 'Hide diagram details'),
  c('show', 'show ' + CURSOR, 'Style', 'Show diagram details'),
  c('left to right direction', 'left to right direction', 'Layout', 'Lay out the diagram left-to-right'),
  c('top to bottom direction', 'top to bottom direction', 'Layout', 'Lay out the diagram top-to-bottom'),
  c('together', 'together {\n  ' + CURSOR + '\n}', 'Layout', 'Keep elements together'),
  c('newpage', 'newpage ' + CURSOR, 'Layout', 'Start a new diagram page'),

  // Frequently used skinparam names
  ...['ArrowColor','ArrowFontColor','ArrowFontSize','ActorBorderColor','ActorBackgroundColor','ActorFontColor',
     'LifeLineBorderColor','LifeLineBackgroundColor','ParticipantBorderColor','ParticipantBackgroundColor',
     'ParticipantFontColor','SequenceGroupBorderColor','SequenceGroupBackgroundColor','SequenceGroupHeaderFontColor',
     'ClassBorderColor','ClassBackgroundColor','ClassFontColor','ComponentBorderColor','ComponentBackgroundColor',
     'NoteBorderColor','NoteBackgroundColor','NoteFontColor','DefaultFontName','DefaultFontSize','BackgroundColor']
    .map(name => c(name, name + ' ' + CURSOR, 'SkinParam', `Set ${name}`))
];

function c(label, insertText, kind, detail, priority = 50) {
  return { label, insertText, kind, detail, priority };
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function declaredSymbols(source) {
  const symbols = new Set();
  const declaration = /^\s*(?:actor|participant|boundary|control|entity|database|collections|queue|class|interface|enum|annotation|object|component|node|cloud|artifact|rectangle|usecase|state)\s+(?:"[^"]+"|'[^']+'|[^\s{]+)(?:\s+as\s+([A-Za-z_$][\w$]*))?/gim;
  let match;
  while ((match = declaration.exec(source))) {
    if (match[1]) {
      symbols.add(match[1]);
      continue;
    }
    const full = match[0];
    const afterType = full.replace(/^\s*\w+\s+/, '').trim();
    const simple = afterType.match(/^([A-Za-z_$][\w$]*)/);
    if (simple) symbols.add(simple[1]);
  }
  return [...symbols].map(label => c(label, label, 'Symbol', 'Declared in this diagram', 100));
}

function completionRange(text, caret) {
  const before = text.slice(0, caret);
  const match = before.match(/(?:^|[\s([{:;,])([@!A-Za-z0-9_$.#<>|*o.\\/-]*)$/);
  if (!match) return { start: caret, query: '' };
  return { start: caret - match[1].length, query: match[1] };
}

function score(item, query, context) {
  if (!query) return item.priority || 0;
  const q = query.toLowerCase();
  const label = item.label.toLowerCase();
  const insert = item.insertText.toLowerCase();
  let value = -1;
  if (label === q) value = 1000;
  else if (label.startsWith(q)) value = 800 - label.length;
  else if (label.split(/\s+/).some(part => part.startsWith(q))) value = 600 - label.length;
  else if (label.includes(q)) value = 400 - label.length;
  else if (insert.startsWith(q)) value = 300 - insert.length;
  if (value < 0) return value;
  if (item.kind === 'Symbol' && /(?:->|-->|<-|<--|\.\.>|--)/.test(context.lineBefore)) value += 220;
  if (item.kind === 'Directive' && q.startsWith('!')) value += 180;
  if ((item.kind === 'Style' || item.kind === 'SkinParam') && /skinparam/i.test(context.lineBefore)) value += 160;
  return value + (item.priority || 0);
}

function caretCoordinates(textarea, position, relativeTo) {
  const div = document.createElement('div');
  const style = getComputedStyle(textarea);
  const props = [
    'fontFamily','fontSize','fontWeight','fontStyle','letterSpacing','lineHeight','textTransform','wordSpacing',
    'paddingTop','paddingRight','paddingBottom','paddingLeft','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth'
  ];
  for (const prop of props) div.style[prop] = style[prop];
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.overflowWrap = 'normal';
  div.style.wordBreak = 'normal';
  div.style.width = `${textarea.clientWidth}px`;
  div.style.height = 'auto';
  div.style.left = `${textarea.offsetLeft}px`;
  div.style.top = `${textarea.offsetTop}px`;

  const before = textarea.value.slice(0, position);
  div.textContent = before;
  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  div.appendChild(marker);
  relativeTo.appendChild(div);

  const x = marker.offsetLeft - textarea.scrollLeft + textarea.offsetLeft;
  const y = marker.offsetTop - textarea.scrollTop + textarea.offsetTop + parseFloat(style.lineHeight || '20');
  div.remove();
  return { x, y };
}

export function createAutocomplete({ textarea, host, onBeforeChange, onChange, enabled = true }) {
  const popup = document.createElement('div');
  popup.className = 'autocomplete-popup';
  popup.hidden = true;
  popup.innerHTML = `
    <div class="autocomplete-header">
      <span>PlantUML suggestions</span>
      <kbd>Ctrl Space</kbd>
    </div>
    <div class="autocomplete-list" role="listbox"></div>
    <div class="autocomplete-footer">↑↓ navigate · Enter/Tab insert · Esc close</div>
  `;
  host.appendChild(popup);

  const list = popup.querySelector('.autocomplete-list');
  let isEnabled = enabled;
  let items = [];
  let selected = 0;
  let range = { start: 0, query: '' };

  function close() {
    popup.hidden = true;
    items = [];
    selected = 0;
  }

  function contextAtCaret() {
    const caret = textarea.selectionStart;
    const before = textarea.value.slice(0, caret);
    const lineStart = before.lastIndexOf('\n') + 1;
    return { caret, lineBefore: before.slice(lineStart), before };
  }

  function candidates(query, context) {
    const sourceItems = [...declaredSymbols(textarea.value), ...BASE_COMPLETIONS];
    const seen = new Set();
    return sourceItems
      .map(item => ({ item, score: score(item, query, context) }))
      .filter(entry => entry.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .map(entry => entry.item)
      .filter(item => {
        const key = `${item.label}\u0000${item.insertText}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 12);
  }

  function render() {
    list.innerHTML = items.map((item, index) => `
      <button class="autocomplete-item${index === selected ? ' selected' : ''}" type="button" role="option" data-index="${index}" aria-selected="${index === selected}">
        <span class="autocomplete-kind kind-${item.kind.toLowerCase()}">${escapeHtml(item.kind)}</span>
        <span class="autocomplete-copy">
          <strong>${escapeHtml(item.label)}</strong>
          <small>${escapeHtml(item.detail || '')}</small>
        </span>
      </button>
    `).join('');
    list.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  }

  function positionPopup() {
    const coords = caretCoordinates(textarea, textarea.selectionStart, host);
    const popupWidth = Math.min(430, Math.max(300, host.clientWidth - 24));
    popup.style.width = `${popupWidth}px`;
    const maxLeft = Math.max(8, host.clientWidth - popupWidth - 8);
    popup.style.left = `${Math.min(Math.max(58, coords.x), maxLeft)}px`;

    const estimatedHeight = Math.min(360, 65 + items.length * 48);
    const below = coords.y + 8;
    const above = coords.y - estimatedHeight - 24;
    popup.style.top = `${below + estimatedHeight < host.clientHeight ? below : Math.max(8, above)}px`;
  }

  function open({ explicit = false } = {}) {
    if (!isEnabled) return close();
    const context = contextAtCaret();
    range = completionRange(textarea.value, context.caret);
    const query = range.query;

    if (!explicit) {
      const interesting = query.length >= 2 || /^[!@-]/.test(query) || /(?:->|-->|<-|<--|\.\.>)\s*[A-Za-z_$]*$/.test(context.lineBefore);
      if (!interesting) return close();
    }

    items = candidates(query, context);
    selected = 0;
    if (!items.length) return close();
    popup.hidden = false;
    render();
    positionPopup();
  }

  function refresh() {
    if (popup.hidden) return open();
    open({ explicit: true });
  }

  function accept(index = selected) {
    const item = items[index];
    if (!item) return false;
    const caret = textarea.selectionStart;
    const selectedEnd = textarea.selectionEnd;
    const raw = item.insertText;
    const markerIndex = raw.indexOf(CURSOR);
    const insertion = raw.replace(CURSOR, '');
    onBeforeChange?.();
    textarea.setRangeText(insertion, range.start, selectedEnd, 'end');
    const newCaret = range.start + (markerIndex >= 0 ? markerIndex : insertion.length);
    textarea.setSelectionRange(newCaret, newCaret);
    close();
    textarea.focus();

    onChange?.();
    return true;
  }

  function move(delta) {
    if (popup.hidden || !items.length) return false;
    selected = (selected + delta + items.length) % items.length;
    render();
    return true;
  }

  list.addEventListener('mousedown', event => {
    const button = event.target.closest('.autocomplete-item');
    if (!button) return;
    event.preventDefault();
    accept(Number(button.dataset.index));
  });

  textarea.addEventListener('input', () => {
    if (!isEnabled) return;
    queueMicrotask(() => popup.hidden ? open() : refresh());
  });

  textarea.addEventListener('click', close);
  textarea.addEventListener('blur', () => setTimeout(() => {
    if (!popup.matches(':hover')) close();
  }, 120));
  textarea.addEventListener('scroll', () => {
    if (!popup.hidden) positionPopup();
  });

  function handleKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
      event.preventDefault();
      open({ explicit: true });
      return true;
    }
    if (popup.hidden) return false;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      return move(1);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      return move(-1);
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      return accept();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return true;
    }
    return false;
  }

  return {
    handleKeydown,
    open: () => open({ explicit: true }),
    close,
    setEnabled(value) {
      isEnabled = Boolean(value);
      if (!isEnabled) close();
    },
    get enabled() { return isEnabled; }
  };
}
