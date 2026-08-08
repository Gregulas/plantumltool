import './styles.css';
import { installUndoRedo } from './undo-redo.js';
import vizGlobalUrl from '@plantuml/core/viz-global.js?url';
import { renderToString } from '@plantuml/core/plantuml.js';
import { createAutocomplete } from './autocomplete.js';
import { analyzePlantUml, rendererDiagnostic, extractSvgRenderError } from './diagnostics.js';
import { buildSourceNavigationIndex, findTextNavigationTarget, plantUmlSvgLineToSourceLine, relocateNavigationTarget, resolveNavigationTarget } from './source-navigation.js';
import { captureEditorView, indentedNewlineEdit, restoreEditorView } from './editor-behavior.js';
import { formatPlantUmlEdit } from './formatter.js';
import { highlightPlantUml } from './syntax-highlight.js';
import { createColorPicker } from './color-picker.js';
import { readObjectAppearance, updateObjectAppearance } from './object-quick-edit.js';
import { buildFoldProjection, containingCollapsedRegion, matchingBlockBoundary, sourceLineToViewLine, sourceOffsetToViewOffset, viewOffsetToSourceOffset } from './folding.js';
import { SHORTCUT_GROUPS, shortcutAction } from './keyboard-shortcuts.js';

const DEFAULT_SOURCE = `@startuml
skinparam backgroundColor white
skinparam sequence {
  ArrowColor #222222
  ActorBorderColor #32BCBB
  LifeLineBorderColor #32BCBB
  ParticipantBorderColor #32BCBB
  ParticipantBackgroundColor #E9FAFA
}

actor Customer
participant "Web Portal" as Portal
participant "Loan MS" as Loan
participant "APIC Gateway" as APIC
participant "Newgen" as NG

Customer -> Portal: Create application
Portal -> Loan: POST /applications
Loan -> APIC: Create application request
APIC -> NG: Forward request
NG --> APIC: Application created
APIC --> Loan: 201 Created
Loan --> Portal: Application ID
Portal --> Customer: Confirmation
@enduml`;

const TEMPLATES = {
  sequence: `@startuml
actor User
participant "Web App" as Web
participant "API" as API
participant "Service" as Svc

User -> Web: Submit request
Web -> API: POST /resource
API -> Svc: Process
Svc --> API: Result
API --> Web: 200 OK
Web --> User: Show result
@enduml`,

  class: `@startuml
class Application {
  +id: UUID
  +status: ApplicationStatus
  +submit()
}

class Customer {
  +customerId: String
  +name: String
}

class Offer {
  +amount: Decimal
  +accept()
}

Customer "1" --> "0..*" Application
Application "1" --> "0..*" Offer
@enduml`,

  component: `@startuml
skinparam componentStyle rectangle

actor Customer
component "Web Portal" as Portal
component "Loan Microservice" as Loan
component "API Gateway" as APIC
component "BPM / LOS" as BPM

database "Application DB" as DB

Customer --> Portal
Portal --> Loan : HTTPS / REST
Loan --> APIC : HTTPS / REST
APIC --> BPM : API
Loan --> DB : Persist state
@enduml`,

  activity: `@startuml
start
:Receive application;
if (Eligible?) then (yes)
  :Create offer;
  if (Customer accepts?) then (yes)
    :Book finance;
  else (no)
    :Close application;
  endif
else (no)
  :Reject application;
endif
stop
@enduml`,

  state: `@startuml
[*] --> Draft
Draft --> Submitted : submit
Submitted --> UnderReview : assign
UnderReview --> Approved : approve
UnderReview --> Rejected : reject
Approved --> Contracted : sign contract
Contracted --> Disbursed : disburse
Rejected --> [*]
Disbursed --> [*]
@enduml`,

  deployment: `@startuml
node "DMZ" {
  node "Web Server" as Web
}

node "Application Zone" {
  node "Loan Service" as Loan
  node "API Gateway" as APIC
}

database "Oracle DB" as DB

Web --> Loan : HTTPS
Loan --> APIC : HTTPS
Loan --> DB : JDBC
@enduml`
};

const state = {
  source: localStorage.getItem('plantuml-local-source') || DEFAULT_SOURCE,
  svg: '',
  filename: 'diagram.puml',
  fileHandle: null,
  savedSource: '',
  isNewFile: true,
  zoom: 1,
  dark: localStorage.getItem('plantuml-local-theme') === 'dark',
  live: localStorage.getItem('plantuml-live-render') !== 'false',
  autocomplete: localStorage.getItem('plantuml-autocomplete') !== 'false',
  rendering: false,
  renderSeq: 0,
  localDiagnostics: [],
  rendererDiagnostics: [],
  lastSuccessfulSource: '',
  workspaceSplit: Number(localStorage.getItem('plantuml-workspace-split')) || 48,
  problemsHeight: Number(localStorage.getItem('plantuml-problems-height')) || 190,
  sourceNavigationIndex: null,
  svgSourceLineOffset: 0,
  foldedStarts: new Set(),
  foldProjection: null
};

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">PU</div>
        <h1>PlantUML Studio</h1>
      </div>
      <nav class="menu-bar" aria-label="Application menu">
        <details class="app-menu">
          <summary>File</summary>
          <div class="menu-popover">
            <button id="newBtn" type="button"><span>New</span><kbd>Ctrl/Cmd+N</kbd></button>
            <button id="openBtn" type="button"><span>Open…</span><kbd>Ctrl/Cmd+O</kbd></button>
            <div class="menu-separator"></div>
            <button id="saveBtn" type="button"><span>Save</span><kbd>Ctrl/Cmd+S</kbd></button>
            <button id="saveAsBtn" type="button"><span>Save As…</span><kbd>Ctrl/Cmd+Shift+S</kbd></button>
            <div class="menu-separator"></div>
            <button id="copySvgBtn" type="button"><span>Copy SVG</span><kbd>Ctrl/Cmd+Alt+C</kbd></button>
            <button id="exportSvgBtn" type="button"><span>Export SVG…</span><kbd>Ctrl/Cmd+Alt+S</kbd></button>
            <button id="exportPngBtn" type="button"><span>Export PNG…</span><kbd>Ctrl/Cmd+Alt+P</kbd></button>
          </div>
        </details>
        <details class="app-menu">
          <summary>Edit</summary>
          <div class="menu-popover">
            <button id="undoMenuBtn" type="button"><span>Undo</span><kbd>Ctrl/Cmd+Z</kbd></button>
            <button id="redoMenuBtn" type="button"><span>Redo</span><kbd>Ctrl/Cmd+Y</kbd></button>
            <div class="menu-separator"></div>
            <button id="formatBtn" type="button"><span>Format script</span><kbd>Ctrl/Cmd+Shift+F</kbd></button>
            <button id="foldAllBtn" type="button"><span>Fold all blocks</span><kbd>Ctrl/Cmd+Alt+F</kbd></button>
            <button id="unfoldAllBtn" type="button"><span>Unfold all blocks</span><kbd>Ctrl/Cmd+Alt+U</kbd></button>
          </div>
        </details>
        <details class="app-menu">
          <summary>Diagram</summary>
          <div class="menu-popover">
            <button id="renderMenuBtn" type="button"><span>Render</span><kbd>Ctrl/Cmd+Enter</kbd></button>
            <div class="menu-separator"></div>
            ${Object.keys(TEMPLATES).map((key, index) => `<button type="button" data-template="${key}"><span>New ${key === 'state' ? 'state machine' : key} diagram</span><kbd>Ctrl/Cmd+Alt+${index + 1}</kbd></button>`).join('')}
          </div>
        </details>
        <details class="app-menu">
          <summary>View</summary>
          <div class="menu-popover">
            <button id="zoomOutBtn" type="button"><span>Zoom out</span><kbd>Ctrl/Cmd+-</kbd></button>
            <button id="zoomResetBtn" type="button"><span>Actual size</span><kbd>Ctrl/Cmd+0</kbd></button>
            <button id="zoomInBtn" type="button"><span>Zoom in</span><kbd>Ctrl/Cmd++</kbd></button>
            <button id="fitBtn" type="button"><span>Fit diagram</span><kbd>Ctrl/Cmd+Alt+0</kbd></button>
            <div class="menu-separator"></div>
            <label class="menu-check"><input id="autocompleteToggle" type="checkbox" /><span>Autocomplete</span><kbd>Ctrl/Cmd+Alt+A</kbd></label>
            <label class="menu-check"><input id="liveToggle" type="checkbox" /><span>Live render</span><kbd>Ctrl/Cmd+Alt+L</kbd></label>
            <button id="themeBtn" type="button"><span>Toggle dark theme</span><kbd>Ctrl/Cmd+Alt+T</kbd></button>
          </div>
        </details>
      </nav>
      <div class="top-actions" aria-label="Quick actions">
        <button id="undoBtn" class="icon-btn" type="button" title="Undo" aria-label="Undo">↶</button>
        <button id="redoBtn" class="icon-btn" type="button" title="Redo" aria-label="Redo">↷</button>
        <button id="quickSaveBtn" class="compact-save" type="button" title="Save">Save</button>
        <button id="renderBtn" class="primary compact-action" type="button">Render</button>
        <button id="shortcutInfoBtn" class="icon-btn" type="button" title="Keyboard shortcuts" aria-label="Keyboard shortcuts">?</button>
      </div>
      <input id="fileInput" type="file" accept=".puml,.plantuml,.pu,.txt,text/plain" hidden />
    </header>

    <dialog id="shortcutsDialog" class="shortcuts-dialog" aria-labelledby="shortcutsTitle">
      <div class="shortcuts-heading">
        <div><span class="shortcut-info-mark">?</span><div><h2 id="shortcutsTitle">Keyboard shortcuts</h2><p>Every PlantUML Studio action, at a glance.</p></div></div>
        <button id="shortcutsCloseBtn" class="icon-btn" type="button" aria-label="Close shortcuts">×</button>
      </div>
      <div class="shortcuts-grid">
        ${SHORTCUT_GROUPS.map(group => `<section><h3>${group.title}</h3>${group.items.map(([label, keys]) => `<div class="shortcut-row"><span>${label}</span><kbd>${keys}</kbd></div>`).join('')}</section>`).join('')}
      </div>
    </dialog>

    <main class="workspace">
      <section class="pane editor-pane">
        <div class="editor-wrap">
          <div id="lineNumbers" class="line-numbers" aria-hidden="true"></div>
          <pre id="highlightLayer" class="syntax-layer" aria-hidden="true"><code id="highlightCode"></code></pre>
          <textarea id="editor" spellcheck="false" aria-label="PlantUML source editor"></textarea>
        </div>
        <div id="problemsSplitter" class="problems-splitter" role="separator" aria-label="Resize editor and problems panels" aria-orientation="horizontal" tabindex="0"><span></span></div>
        <section id="problemsPanel" class="problems-panel" aria-label="PlantUML problems">
          <div class="problems-header">
            <button id="problemsToggle" class="problems-toggle" type="button" aria-expanded="true">
              <span>Problems</span>
              <span id="diagnosticCount" class="diagnostic-count ok">0</span>
            </button>
            <span id="diagnosticSummary" class="diagnostic-summary">No syntax problems detected</span>
          </div>
          <div id="problemsList" class="problems-list"></div>
        </section>
        <div class="statusbar">
          <span class="file-identity"><strong id="fileName">diagram.puml</strong><span id="fileStatus" class="file-status unsaved">Unsaved</span></span>
          <span id="sourceStats">0 lines</span>
        </div>
      </section>

      <div id="workspaceSplitter" class="workspace-splitter" role="separator" aria-label="Resize editor and preview panels" aria-orientation="vertical" tabindex="0">
        <span></span>
      </div>

      <section class="pane preview-pane">
        <div id="previewViewport" class="preview-viewport">
          <div id="previewCanvas" class="preview-canvas">
            <div class="empty-state">
              <div class="spinner small"></div>
              <p>Loading local PlantUML engine…</p>
            </div>
          </div>
        </div>

        <form id="objectQuickEdit" class="object-quick-edit" hidden>
          <div class="quick-edit-heading"><strong id="quickEditTitle">Quick edit</strong><button id="quickEditClose" type="button" aria-label="Close quick edit">×</button></div>
          <label>Color <input id="quickEditColor" type="text" placeholder="#32BCBB or #LightBlue" /></label>
          <label>Style / stereotype <input id="quickEditStyle" type="text" placeholder="service" /></label>
          <div class="quick-edit-actions"><button id="quickEditReset" type="button">Clear</button><button class="primary" type="submit">Apply</button></div>
        </form>

        <div id="errorPanel" class="error-panel" hidden>
          <div class="error-panel-heading">
            <span class="error-panel-icon" aria-hidden="true">!</span>
            <div>
              <strong>Current script has errors</strong>
              <span>Preview is keeping the last valid diagram.</span>
            </div>
          </div>
          <details id="errorDetails" class="error-details">
            <summary>Show PlantUML error details</summary>
            <pre id="errorText"></pre>
          </details>
        </div>
        <div class="statusbar">
          <span id="renderStatus">Initializing…</span>
          <span id="navigationStatus" class="navigation-status">Click a diagram element to locate its source</span>
          <span id="engineStatus">@plantuml/core</span>
        </div>
      </section>
    </main>
  </div>
`;

const els = {
  editor: document.querySelector('#editor'),
  lineNumbers: document.querySelector('#lineNumbers'),
  highlightLayer: document.querySelector('#highlightLayer'),
  highlightCode: document.querySelector('#highlightCode'),
  sourceStats: document.querySelector('#sourceStats'),
  fileName: document.querySelector('#fileName'),
  fileStatus: document.querySelector('#fileStatus'),
  fileInput: document.querySelector('#fileInput'),
  liveToggle: document.querySelector('#liveToggle'),
  autocompleteToggle: document.querySelector('#autocompleteToggle'),
  formatBtn: document.querySelector('#formatBtn'),
  foldAllBtn: document.querySelector('#foldAllBtn'),
  unfoldAllBtn: document.querySelector('#unfoldAllBtn'),
  previewViewport: document.querySelector('#previewViewport'),
  previewCanvas: document.querySelector('#previewCanvas'),
  errorPanel: document.querySelector('#errorPanel'),
  errorDetails: document.querySelector('#errorDetails'),
  errorText: document.querySelector('#errorText'),
  renderStatus: document.querySelector('#renderStatus'),
  navigationStatus: document.querySelector('#navigationStatus'),
  zoomResetBtn: document.querySelector('#zoomResetBtn'),
  problemsPanel: document.querySelector('#problemsPanel'),
  problemsToggle: document.querySelector('#problemsToggle'),
  problemsList: document.querySelector('#problemsList'),
  diagnosticCount: document.querySelector('#diagnosticCount'),
  diagnosticSummary: document.querySelector('#diagnosticSummary'),
  workspace: document.querySelector('.workspace'),
  workspaceSplitter: document.querySelector('#workspaceSplitter'),
  editorPane: document.querySelector('.editor-pane'),
  previewPane: document.querySelector('.preview-pane'),
  problemsSplitter: document.querySelector('#problemsSplitter'),
  objectQuickEdit: document.querySelector('#objectQuickEdit'),
  quickEditTitle: document.querySelector('#quickEditTitle'),
  quickEditColor: document.querySelector('#quickEditColor'),
  quickEditStyle: document.querySelector('#quickEditStyle'),
  quickEditClose: document.querySelector('#quickEditClose'),
  quickEditReset: document.querySelector('#quickEditReset')
};

state.foldProjection = buildFoldProjection(state.source, state.foldedStarts);
els.editor.value = state.foldProjection.text;
const editHistory = installUndoRedo(els.editor);
state.savedSource = '';
els.liveToggle.checked = state.live;
els.autocompleteToggle.checked = state.autocomplete;
applyTheme();
updateEditorMeta();

function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Unable to load ${src}`));
    document.head.appendChild(script);
  });
}

function splitLines(source) {
  return source.split(/\r\n|\r|\n/);
}

function hasCollapsedFolds() {
  return state.foldedStarts.size > 0;
}

function canonicalSource() {
  return hasCollapsedFolds() ? state.source : els.editor.value;
}

function sourceSelectionFromView() {
  const projection = state.foldProjection || buildFoldProjection(state.source, state.foldedStarts);
  if (!hasCollapsedFolds()) return { start: els.editor.selectionStart, end: els.editor.selectionEnd };
  return {
    start: viewOffsetToSourceOffset(state.source, projection, els.editor.selectionStart),
    end: viewOffsetToSourceOffset(state.source, projection, els.editor.selectionEnd)
  };
}

function applyFoldProjection({ sourceSelection = null, preserveScroll = true } = {}) {
  const scrollTop = els.editor.scrollTop;
  const scrollLeft = els.editor.scrollLeft;
  state.foldProjection = buildFoldProjection(state.source, state.foldedStarts);
  els.editor.value = state.foldProjection.text;
  if (sourceSelection) {
    const start = sourceOffsetToViewOffset(state.source, state.foldProjection, sourceSelection.start);
    const end = sourceOffsetToViewOffset(state.source, state.foldProjection, sourceSelection.end);
    els.editor.setSelectionRange(start, end);
  }
  if (preserveScroll) {
    els.editor.scrollTop = scrollTop;
    els.editor.scrollLeft = scrollLeft;
  }
  updateSyntaxHighlight();
  renderDiagnostics();
  syncScroll();
}

function unfoldAllPreserveCaret() {
  if (!hasCollapsedFolds()) return false;
  const sourceSelection = sourceSelectionFromView();
  const scrollTop = els.editor.scrollTop;
  const scrollLeft = els.editor.scrollLeft;
  state.foldedStarts.clear();
  state.foldProjection = buildFoldProjection(state.source, state.foldedStarts);
  els.editor.value = state.source;
  els.editor.setSelectionRange(sourceSelection.start, sourceSelection.end);
  els.editor.scrollTop = scrollTop;
  els.editor.scrollLeft = scrollLeft;
  updateSyntaxHighlight();
  renderDiagnostics();
  syncScroll();
  return true;
}

function toggleFoldAtSourceLine(sourceLine) {
  const base = buildFoldProjection(state.source, new Set());
  const region = base.regions.find(item => item.startLine === sourceLine);
  if (!region) return false;
  const selection = sourceSelectionFromView();
  if (state.foldedStarts.has(sourceLine)) state.foldedStarts.delete(sourceLine);
  else state.foldedStarts.add(sourceLine);
  applyFoldProjection({ sourceSelection: selection });
  els.renderStatus.textContent = state.foldedStarts.has(sourceLine) ? `Collapsed block at line ${sourceLine}` : `Expanded block at line ${sourceLine}`;
  return true;
}

function normalizeSource(source) {
  const text = source.trim();
  if (!text) return '';
  if (/^@start\w+/m.test(text)) return source;
  return `@startuml\n${source}\n@enduml`;
}

function renderPlantUml(source, options = {}) {
  return new Promise((resolve, reject) => {
    renderToString(
      splitLines(source),
      svg => resolve(svg),
      message => reject(new Error(String(message))),
      options
    );
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyWorkspaceSplit(percent = state.workspaceSplit) {
  const safe = clamp(Number(percent) || 48, 25, 75);
  state.workspaceSplit = safe;
  els.workspace.style.setProperty('--editor-panel-size', `${safe}%`);
  els.workspaceSplitter?.setAttribute('aria-valuenow', String(Math.round(safe)));
  els.workspaceSplitter?.setAttribute('aria-valuemin', '25');
  els.workspaceSplitter?.setAttribute('aria-valuemax', '75');
  localStorage.setItem('plantuml-workspace-split', String(safe));
}

function applyProblemsHeight(height = state.problemsHeight) {
  const paneHeight = els.editorPane?.clientHeight || window.innerHeight;
  const maxHeight = Math.max(120, Math.min(420, paneHeight - 190));
  const safe = clamp(Number(height) || 190, 90, maxHeight);
  state.problemsHeight = safe;
  els.editorPane.style.setProperty('--problems-panel-height', `${safe}px`);
  els.problemsSplitter?.setAttribute('aria-valuenow', String(Math.round(safe)));
  els.problemsSplitter?.setAttribute('aria-valuemin', '90');
  els.problemsSplitter?.setAttribute('aria-valuemax', String(Math.round(maxHeight)));
  localStorage.setItem('plantuml-problems-height', String(safe));
}

function startDrag(event, { axis, onMove, onEnd }) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  document.body.classList.add(axis === 'x' ? 'resizing-columns' : 'resizing-rows');

  const move = moveEvent => onMove(moveEvent);
  const end = endEvent => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', end);
    document.body.classList.remove('resizing-columns', 'resizing-rows');
    onEnd?.(endEvent);
  };

  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
}

function hasBlockingLocalErrors() {
  return state.localDiagnostics.some(item => item.severity === 'error');
}

function keepLastValidPreview(reason = 'Invalid script') {
  if (state.svg) {
    els.renderStatus.textContent = `${reason} — showing last valid diagram`;
    els.previewCanvas.classList.add('preview-stale');
    els.previewCanvas.dataset.previewState = 'last-valid';
  } else {
    els.renderStatus.textContent = reason;
    els.previewCanvas.innerHTML = `<div class="empty-state"><p>${escapeHtml(reason)}. Fix the script to create the first valid diagram.</p></div>`;
  }
}

let debounceTimer;
function scheduleRender() {
  if (!state.live) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => doRender(), 350);
}

async function doRender() {
  const rawSource = canonicalSource();
  const source = normalizeSource(rawSource);

  // Local syntax errors are known without invoking the PlantUML renderer.
  // Keep the last successful diagram visible until the source is valid again.
  if (hasBlockingLocalErrors()) {
    keepLastValidPreview('Syntax errors');
    hideError();
    renderDiagnostics();
    return false;
  }

  if (!source) {
    state.rendererDiagnostics = [];
    keepLastValidPreview('No source to render');
    hideError();
    renderDiagnostics();
    return false;
  }

  const seq = ++state.renderSeq;
  state.rendering = true;
  els.renderStatus.textContent = state.svg ? 'Validating changes…' : 'Rendering…';
  document.querySelector('#renderBtn').disabled = true;

  try {
    // Render into memory first. The preview is only replaced after the result
    // is confirmed not to be PlantUML's syntax-error SVG.
    const candidateSvg = await renderPlantUml(source, { dark: state.dark });
    if (seq !== state.renderSeq) return false;

    const svgError = extractSvgRenderError(candidateSvg);
    if (svgError) {
      const normalizedAddedWrapper = rawSource.trim() && source !== rawSource;
      const adjustedLine = svgError.line && normalizedAddedWrapper ? Math.max(1, svgError.line - 1) : svgError.line;
      const diagnostic = rendererDiagnostic(svgError.message, rawSource, adjustedLine);
      if (diagnostic && adjustedLine) diagnostic.line = adjustedLine;
      state.rendererDiagnostics = diagnostic ? [diagnostic] : [];
      showError(svgError.message);
      keepLastValidPreview('PlantUML error');
      renderDiagnostics();
      return false;
    }

    state.svg = candidateSvg;
    state.lastSuccessfulSource = rawSource;
    state.sourceNavigationIndex = buildSourceNavigationIndex(rawSource);
    state.svgSourceLineOffset = rawSource.trim() && source !== rawSource ? 1 : 0;
    state.rendererDiagnostics = [];
    els.previewCanvas.innerHTML = candidateSvg;
    els.previewCanvas.classList.remove('preview-stale');
    delete els.previewCanvas.dataset.previewState;
    prepareSvg();
    hideError();
    els.renderStatus.textContent = 'Rendered locally';
    renderDiagnostics();
    return true;
  } catch (error) {
    if (seq !== state.renderSeq) return false;
    const message = error?.message || String(error);
    const normalizedAddedWrapper = rawSource.trim() && source !== rawSource;
    let diagnostic = rendererDiagnostic(message, rawSource);
    if (diagnostic?.line && normalizedAddedWrapper) diagnostic.line = Math.max(1, diagnostic.line - 1);
    state.rendererDiagnostics = diagnostic ? [diagnostic] : [];
    showError(message);
    keepLastValidPreview('Render validation failed');
    renderDiagnostics();
    return false;
  } finally {
    if (seq === state.renderSeq) {
      state.rendering = false;
      document.querySelector('#renderBtn').disabled = false;
    }
  }
}

function prepareSvg() {
  const svg = els.previewCanvas.querySelector('svg');
  if (!svg) return;
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.maxWidth = 'none';
  svg.style.height = 'auto';
  decorateSvgNavigation(svg);
  applyZoom();
}

const SVG_LINE_ATTRIBUTES = ['data-source-line', 'data-line', 'data-line-number', 'data-sourceLine'];
const SVG_REFERENCE_ATTRIBUTES = [
  'data-entity', 'data-participant', 'data-qualified-name', 'data-name',
  'data-participant-1', 'data-participant-2', 'data-entity-1', 'data-entity-2',
  'data-source', 'data-target'
];

function sourceLineFromSvgElement(element) {
  let current = element;
  while (current && current !== els.previewCanvas) {
    for (const name of SVG_LINE_ATTRIBUTES) {
      const value = current.getAttribute?.(name);
      if (value != null && /^\d+$/.test(value)) {
        return plantUmlSvgLineToSourceLine(value, state.svgSourceLineOffset);
      }
    }
    current = current.parentElement;
  }
  return null;
}

function svgNavigationDescriptor(element) {
  if (!element || !(element instanceof Element)) return {};
  const svg = element.closest('svg');
  const attributes = {};
  const classNames = [];
  const texts = [];
  const clickedTextNode = element.closest('text');
  let current = element;
  let depth = 0;

  while (current && current !== svg && depth < 7) {
    const classes = current.getAttribute?.('class');
    if (classes) classNames.push(classes);
    for (const name of SVG_REFERENCE_ATTRIBUTES) {
      const value = current.getAttribute?.(name);
      if (value && !attributes[name]) attributes[name] = value;
    }

    if (current.tagName?.toLowerCase() === 'g') {
      const textNodes = [...current.querySelectorAll('text')];
      if (textNodes.length <= 10) {
        for (const textNode of textNodes) {
          const text = textNode.textContent?.trim();
          if (text && !texts.includes(text)) texts.push(text);
        }
      }
    }
    current = current.parentElement;
    depth += 1;
  }

  return {
    sourceLine: sourceLineFromSvgElement(element),
    attributes,
    classNames: classNames.join(' '),
    texts,
    clickedText: clickedTextNode?.textContent?.trim() || ''
  };
}

function markSvgNavigationNode(node, record) {
  if (!node || !record) return;
  node.dataset.sourceNavId = record.id;
  node.classList.add('source-navigable');
  node.setAttribute('aria-label', `Go to PlantUML source line ${record.line}`);
}

function decorateSvgNavigation(svg) {
  const index = state.sourceNavigationIndex;
  if (!index?.records?.length) return;

  // PlantUML versions that emit source-line metadata get exact navigation first.
  for (const node of svg.querySelectorAll('[data-source-line], [data-line], [data-line-number]')) {
    const record = resolveNavigationTarget(index, svgNavigationDescriptor(node));
    if (record) markSvgNavigationNode(node, record);
  }

  // Groups normally represent participants/entities/messages/links and make the
  // shape itself clickable, not only its text label. Avoid root groups that
  // contain most of the diagram, because they are too ambiguous.
  for (const group of svg.querySelectorAll('g')) {
    if (group.dataset.sourceNavId) continue;
    const textCount = group.querySelectorAll('text').length;
    const hasReferenceMetadata = SVG_REFERENCE_ATTRIBUTES.some(name => group.hasAttribute(name));
    const semanticClass = /participant|entity|message|link|edge|arrow|transition|class|component|actor|node|state|object|usecase/i.test(group.getAttribute('class') || '');
    if (textCount > 10 && !hasReferenceMetadata && !semanticClass) continue;
    const descriptor = svgNavigationDescriptor(group);
    const record = resolveNavigationTarget(index, descriptor)
      || findTextNavigationTarget(index.source, descriptor.texts || []);
    if (record) markSvgNavigationNode(group, record);
  }

  // Text is resolved independently so a method/field inside a class can jump
  // to the member line instead of always jumping to the class declaration.
  // The text fallback also covers less-structured PlantUML families such as
  // WBS/mindmap-style labels when the rendered wording exists in the source.
  for (const text of svg.querySelectorAll('text')) {
    const descriptor = svgNavigationDescriptor(text);
    const record = resolveNavigationTarget(index, descriptor)
      || findTextNavigationTarget(index.source, [descriptor.clickedText]);
    if (record) markSvgNavigationNode(text, record);
  }
}

function renderedNavigationRecordFromEvent(event) {
  const index = state.sourceNavigationIndex;
  if (!index) return null;
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return null;
  const marked = target.closest('[data-source-nav-id]');
  if (marked && els.previewCanvas.contains(marked)) {
    const record = index.byId.get(marked.dataset.sourceNavId);
    if (record) return record;
  }
  const descriptor = svgNavigationDescriptor(target);
  const resolved = resolveNavigationTarget(index, descriptor);
  if (resolved) return resolved;
  return findTextNavigationTarget(index.source, [descriptor.clickedText, ...(descriptor.texts || [])]);
}

function readableDiagramLabel(value) {
  return String(value ?? '')
    .replace(/\\n/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function describeNavigationRecord(record) {
  if (!record) return 'diagram element';
  if (record.type === 'relationship') {
    return readableDiagramLabel(record.message) || `${readableDiagramLabel(record.source)} → ${readableDiagramLabel(record.target)}`;
  }
  if (record.type === 'member') return readableDiagramLabel(record.memberLabel || record.label || record.reference);
  return readableDiagramLabel(record.label || record.reference || record.message || record.kind) || 'diagram element';
}

function navigateFromDiagram(event) {
  const renderedRecord = renderedNavigationRecordFromEvent(event);
  if (!renderedRecord) return false;

  event.preventDefault();
  event.stopPropagation();

  const currentRecord = relocateNavigationTarget(renderedRecord, canonicalSource());
  if (currentRecord) {
    jumpToLine(currentRecord.line, 1, { selectLine: true });
    els.navigationStatus.textContent = `${describeNavigationRecord(currentRecord)} • line ${currentRecord.line}`;
    els.navigationStatus.classList.remove('navigation-stale');
    return true;
  }

  // The visible SVG can be the last-known-good diagram while the current source
  // is invalid. If the clicked item was deleted/renamed, show its last valid
  // location rather than pretending a current mapping exists.
  jumpToLine(renderedRecord.line, 1, { selectLine: true });
  els.navigationStatus.textContent = `${describeNavigationRecord(renderedRecord)} • last rendered line ${renderedRecord.line}`;
  els.navigationStatus.classList.add('navigation-stale');
  return true;
}

function applyZoom() {
  const svg = els.previewCanvas.querySelector('svg');
  if (svg) {
    svg.style.width = `${state.zoom * 100}%`;
  }
  els.zoomResetBtn.textContent = `${Math.round(state.zoom * 100)}%`;
}

function setZoom(next) {
  state.zoom = Math.min(4, Math.max(0.2, next));
  applyZoom();
}

function fitDiagram() {
  const svg = els.previewCanvas.querySelector('svg');
  if (!svg) return;

  const viewBox = svg.viewBox?.baseVal;
  if (!viewBox || !viewBox.width || !viewBox.height) {
    setZoom(1);
    return;
  }

  const availableWidth = Math.max(100, els.previewViewport.clientWidth - 64);
  const availableHeight = Math.max(100, els.previewViewport.clientHeight - 64);
  const scale = Math.min(availableWidth / viewBox.width, availableHeight / viewBox.height, 1.5);
  setZoom(scale);
}

function showError(message) {
  els.errorText.textContent = message;
  els.errorDetails.open = false;
  els.errorPanel.hidden = false;
}

function hideError() {
  els.errorPanel.hidden = true;
  els.errorDetails.open = false;
  els.errorText.textContent = '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function allDiagnostics() {
  const merged = [...state.rendererDiagnostics, ...state.localDiagnostics];
  const seen = new Set();
  return merged.filter(item => {
    const key = `${item.severity}|${item.line ?? ''}|${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function updateLineNumbers(lineCount) {
  const diagnosticByLine = new Map();
  for (const item of allDiagnostics()) {
    if (!item.line) continue;
    const current = diagnosticByLine.get(item.line);
    if (!current || (current === 'warning' && item.severity === 'error')) {
      diagnosticByLine.set(item.line, item.severity);
    }
  }

  const projection = state.foldProjection || buildFoldProjection(state.source, state.foldedStarts);
  const regionStarts = new Set(projection.regions.map(region => region.startLine));
  els.lineNumbers.innerHTML = Array.from({ length: lineCount }, (_, index) => {
    const map = projection.lineMap[index] || { sourceLine: index + 1, kind: 'source' };
    const sourceLine = map.sourceLine || index + 1;
    let severity = diagnosticByLine.get(sourceLine);
    if (map.kind === 'placeholder') {
      const hidden = allDiagnostics().find(item => item.line && item.line > map.foldStart && item.line < map.foldEnd);
      if (hidden) severity = hidden.severity;
    }
    const className = severity ? ` line-number-${severity}` : '';
    if (map.kind === 'placeholder') {
      return `<span class="line-number fold-placeholder${className}" data-line="${sourceLine}"><span class="fold-spacer"></span><span class="line-label">…</span></span>`;
    }
    const foldable = regionStarts.has(sourceLine);
    const collapsed = state.foldedStarts.has(sourceLine);
    return `<span class="line-number${className}" data-line="${sourceLine}">${foldable ? `<button class="fold-toggle${collapsed ? ' collapsed' : ''}" type="button" data-fold-line="${sourceLine}" title="${collapsed ? 'Expand' : 'Collapse'} block at line ${sourceLine}" aria-label="${collapsed ? 'Expand' : 'Collapse'} block at line ${sourceLine}">${collapsed ? '▸' : '▾'}</button>` : '<span class="fold-spacer"></span>'}<span class="line-label">${sourceLine}</span></span>`;
  }).join('');
}

function renderDiagnostics() {
  const items = allDiagnostics();
  const errorCount = items.filter(item => item.severity === 'error').length;
  const warningCount = items.filter(item => item.severity === 'warning').length;

  els.diagnosticCount.textContent = String(items.length);
  els.diagnosticCount.className = `diagnostic-count ${errorCount ? 'has-errors' : warningCount ? 'has-warnings' : 'ok'}`;
  els.diagnosticSummary.textContent = errorCount
    ? `${errorCount} error${errorCount === 1 ? '' : 's'}${warningCount ? ` • ${warningCount} warning${warningCount === 1 ? '' : 's'}` : ''}`
    : warningCount
      ? `${warningCount} warning${warningCount === 1 ? '' : 's'}`
      : 'No syntax problems detected';

  if (!items.length) {
    els.problemsList.innerHTML = '<div class="problems-empty">✓ PlantUML syntax checks are clear.</div>';
  } else {
    const sourceLines = splitLines(canonicalSource());
    els.problemsList.innerHTML = items.map(item => {
      const location = item.line ? `Line ${item.line}${item.column ? `:${item.column}` : ''}` : 'Diagram';
      const severityLabel = item.severity === 'error' ? 'Error' : item.severity === 'warning' ? 'Warning' : 'Info';
      const sourceLabel = item.source === 'renderer' ? 'PlantUML parser' : item.source === 'semantic' ? 'Reference check' : 'Local syntax check';
      const sourceLine = item.line ? sourceLines[item.line - 1] : '';
      const detail = item.detail || item.message;

      return `
        <article class="diagnostic diagnostic-${escapeHtml(item.severity)}" data-diagnostic-id="${escapeHtml(item.id)}">
          <div class="diagnostic-row">
            <button class="diagnostic-main" type="button" data-action="jump" data-id="${escapeHtml(item.id)}" title="Jump to ${escapeHtml(location)}">
              <span class="diagnostic-icon" aria-hidden="true">${item.severity === 'error' ? '×' : item.severity === 'warning' ? '!' : 'i'}</span>
              <span class="diagnostic-copy">
                <span class="diagnostic-meta"><b>${escapeHtml(severityLabel)}</b><span>${escapeHtml(location)}</span><span>${escapeHtml(sourceLabel)}</span></span>
                <strong>${escapeHtml(item.message)}</strong>
                ${item.suggestion ? `<small><b>Suggestion:</b> ${escapeHtml(item.suggestion)}</small>` : ''}
              </span>
            </button>
            ${item.fix ? `<button class="quick-fix" type="button" data-action="fix" data-id="${escapeHtml(item.id)}">⚡ ${escapeHtml(item.fix.label)}</button>` : ''}
          </div>
          <details class="diagnostic-details">
            <summary><span class="details-closed">Show details</span><span class="details-open">Hide details</span></summary>
            <div class="diagnostic-detail-body">
              ${sourceLine ? `<div class="diagnostic-detail-section"><span class="detail-label">Source line</span><pre class="source-line"><code>${escapeHtml(sourceLine)}</code></pre></div>` : ''}
              <div class="diagnostic-detail-section">
                <span class="detail-label">Full diagnostic</span>
                <pre>${escapeHtml(detail)}</pre>
              </div>
              ${item.suggestion ? `<div class="diagnostic-detail-section"><span class="detail-label">Suggested action</span><p>${escapeHtml(item.suggestion)}</p></div>` : ''}
            </div>
          </details>
        </article>
      `;
    }).join('');
  }

  const lineCount = splitLines(els.editor.value).length;
  updateLineNumbers(lineCount);
}

function runLocalDiagnostics() {
  state.localDiagnostics = analyzePlantUml(canonicalSource());
  renderDiagnostics();
}

function updateSyntaxHighlight() {
  if (!els.highlightCode) return;
  const highlightedLines = highlightPlantUml(els.editor.value).split('\n');
  const match = matchingBlockBoundary(els.editor.value, els.editor.selectionStart);
  if (match) {
    for (const line of [match.startLine, match.endLine]) {
      const index = line - 1;
      if (index >= 0 && index < highlightedLines.length) {
        highlightedLines[index] = `<span class="matching-block-boundary" data-block-type="${match.type}">${highlightedLines[index] || ' '}</span>`;
      }
    }
  }
  els.highlightCode.innerHTML = highlightedLines.join('\n');
  els.highlightLayer?.closest('.editor-wrap')?.classList.add('syntax-highlighted');
  if (els.highlightLayer) {
    els.highlightLayer.scrollTop = els.editor.scrollTop;
    els.highlightLayer.scrollLeft = els.editor.scrollLeft;
  }
}

function isSourceDirty() {
  return state.isNewFile || canonicalSource() !== state.savedSource;
}

function updateFileStatus() {
  const dirty = isSourceDirty();
  els.fileName.textContent = state.filename || 'diagram.puml';
  els.fileStatus.textContent = dirty ? (state.isNewFile ? 'New • Save required' : 'Modified • Save required') : 'Saved';
  els.fileStatus.classList.toggle('unsaved', dirty);
  els.fileStatus.classList.toggle('saved', !dirty);
  document.title = `${dirty ? '● ' : ''}${state.filename || 'diagram.puml'} • PlantUML Local Studio`;
}

function updateEditorMeta() {
  // Diagnostics rebuild the Problems and line-number DOM. Keep the textarea's
  // caret/selection and viewport exactly where the user left them while that
  // synchronous UI work happens.
  const editorView = captureEditorView(els.editor);
  if (!hasCollapsedFolds()) state.source = els.editor.value;
  state.foldProjection = buildFoldProjection(state.source, state.foldedStarts);
  const source = state.source;
  const lineCount = splitLines(source).length;
  const charCount = source.length;
  const folded = state.foldedStarts.size;
  els.sourceStats.textContent = `${lineCount} lines • ${charCount.toLocaleString()} chars${folded ? ` • ${folded} folded` : ''}`;
  localStorage.setItem('plantuml-local-source', source);
  updateFileStatus();
  updateSyntaxHighlight();
  runLocalDiagnostics();
  restoreEditorView(els.editor, editorView);
  syncScroll();
}

function jumpToLine(line, column = 1, options = {}) {
  if (!line) return;
  const hidden = containingCollapsedRegion(state.foldProjection, line);
  if (hidden) {
    state.foldedStarts.delete(hidden.startLine);
    applyFoldProjection({ preserveScroll: false });
  }

  const source = state.source;
  const matches = [...source.matchAll(/.*?(?:\r\n|\r|\n|$)/g)].filter(match => match[0].length || match.index === 0);
  const lineEntries = matches.map(match => ({
    start: match.index,
    text: match[0].replace(/(?:\r\n|\r|\n)$/, '')
  }));
  const safeLine = Math.min(Math.max(1, line), Math.max(1, lineEntries.length));
  const entry = lineEntries[safeLine - 1] || { start: 0, text: '' };
  const columnOffset = Math.min(Math.max(0, column - 1), entry.text.length);
  const sourceStart = options.selectLine ? entry.start : entry.start + columnOffset;
  const sourceEnd = options.selectLine ? entry.start + entry.text.length : sourceStart;
  const projection = state.foldProjection || buildFoldProjection(state.source, state.foldedStarts);
  const start = sourceOffsetToViewOffset(state.source, projection, sourceStart);
  const end = sourceOffsetToViewOffset(state.source, projection, sourceEnd);
  els.editor.focus();
  els.editor.setSelectionRange(start, end);
  const viewLine = sourceLineToViewLine(projection, safeLine) || safeLine;
  const lineHeight = parseFloat(getComputedStyle(els.editor).lineHeight) || 21;
  els.editor.scrollTop = Math.max(0, (viewLine - 1) * lineHeight - els.editor.clientHeight * 0.35);
  syncScroll();
}

function applyDiagnosticFix(item) {
  if (!item?.fix) return;
  unfoldAllPreserveCaret();
  const { start, end, text } = item.fix;
  if (![start, end].every(Number.isInteger)) return;
  const source = state.source;
  if (start < 0 || end < start || end > source.length) return;
  els.editor.setRangeText(text, start, end, 'end');
  state.rendererDiagnostics = [];
  updateEditorMeta();
  scheduleRender();
  els.editor.focus();
}

function syncScroll() {
  els.lineNumbers.scrollTop = els.editor.scrollTop;
  if (els.highlightLayer) {
    els.highlightLayer.scrollTop = els.editor.scrollTop;
    els.highlightLayer.scrollLeft = els.editor.scrollLeft;
  }
}

function downloadBlob(content, mime, filename) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function baseName() {
  return (state.filename || 'diagram.puml').replace(/\.(puml|plantuml|pu|txt)$/i, '') || 'diagram';
}

async function writeSourceToHandle(handle) {
  const writable = await handle.createWritable();
  await writable.write(canonicalSource());
  await writable.close();
  state.fileHandle = handle;
  state.filename = handle.name || state.filename;
  state.savedSource = canonicalSource();
  state.isNewFile = false;
  updateFileStatus();
  els.renderStatus.textContent = `Saved ${state.filename}`;
}

async function saveSource() {
  try {
    if (state.fileHandle) return await writeSourceToHandle(state.fileHandle);
    return await saveSourceAs();
  } catch (error) {
    if (error?.name !== 'AbortError') showError(`Save failed. ${error?.message || error}`);
  }
}

async function saveSourceAs() {
  try {
    if ('showSaveFilePicker' in window) {
      const handle = await window.showSaveFilePicker({
        suggestedName: state.filename || 'diagram.puml',
        types: [{ description: 'PlantUML source', accept: { 'text/plain': ['.puml', '.plantuml', '.pu', '.txt'] } }]
      });
      return await writeSourceToHandle(handle);
    }
    downloadBlob(canonicalSource(), 'text/plain;charset=utf-8', `${baseName()}.puml`);
    state.savedSource = canonicalSource();
    state.isNewFile = false;
    updateFileStatus();
    els.renderStatus.textContent = 'Downloaded source (browser cannot overwrite files directly)';
  } catch (error) {
    if (error?.name !== 'AbortError') showError(`Save As failed. ${error?.message || error}`);
  }
}

async function openSourceFile() {
  try {
    if ('showOpenFilePicker' in window) {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: 'PlantUML source', accept: { 'text/plain': ['.puml', '.plantuml', '.pu', '.txt'] } }]
      });
      const file = await handle.getFile();
      replaceSource(await file.text(), file.name, { fileHandle: handle, saved: true });
      return;
    }
    els.fileInput.click();
  } catch (error) {
    if (error?.name !== 'AbortError') showError(`Open failed. ${error?.message || error}`);
  }
}

function exportSvg() {
  if (!state.svg) return showError('Render a diagram before exporting SVG.');
  downloadBlob(state.svg, 'image/svg+xml;charset=utf-8', `${baseName()}.svg`);
}

async function exportPng() {
  if (!state.svg) return showError('Render a diagram before exporting PNG.');

  try {
    els.renderStatus.textContent = 'Creating PNG…';
    const svgBlob = new Blob([state.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Unable to convert the SVG to PNG.'));
      img.src = url;
    });

    const scale = 2;
    const width = Math.max(1, Math.ceil(img.naturalWidth * scale));
    const height = Math.max(1, Math.ceil(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!state.dark) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);

    const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!pngBlob) throw new Error('Unable to create PNG data.');
    downloadBlob(pngBlob, 'image/png', `${baseName()}.png`);
    els.renderStatus.textContent = 'PNG exported';
  } catch (error) {
    showError(error?.message || String(error));
    els.renderStatus.textContent = 'PNG export failed';
  }
}

async function copySvg() {
  if (!state.svg) return showError('Render a diagram before copying SVG.');
  try {
    await navigator.clipboard.writeText(state.svg);
    els.renderStatus.textContent = 'SVG copied';
  } catch {
    showError('Clipboard access was blocked by the browser. Use Export SVG instead.');
  }
}

function applyTheme() {
  document.documentElement.dataset.theme = state.dark ? 'dark' : 'light';
  localStorage.setItem('plantuml-local-theme', state.dark ? 'dark' : 'light');
}

const autocomplete = createAutocomplete({
  textarea: els.editor,
  host: document.querySelector('.editor-wrap'),
  enabled: state.autocomplete,
  onBeforeChange: () => editHistory.checkpoint(),
  onChange: () => {
    editHistory.checkpoint();
    state.rendererDiagnostics = [];
    updateEditorMeta();
    scheduleRender();
  }
});

const colorPicker = createColorPicker({
  textarea: els.editor,
  host: document.querySelector('.editor-wrap'),
  onBeforeOpen: () => hasCollapsedFolds() ? unfoldAllPreserveCaret() : false,
  onOpen: () => autocomplete.close(),
  onChange: () => {
    state.rendererDiagnostics = [];
    updateEditorMeta();
    scheduleRender();
    els.renderStatus.textContent = 'Color updated';
  }
});

function replaceSource(source, filename = 'diagram.puml', { fileHandle = null, saved = false, isNew = false } = {}) {
  colorPicker.close();
  state.source = source;
  state.foldedStarts.clear();
  state.foldProjection = buildFoldProjection(source, state.foldedStarts);
  els.editor.value = state.foldProjection.text;
  state.rendererDiagnostics = [];
  els.navigationStatus.textContent = 'Click a diagram element to locate its source';
  els.navigationStatus.classList.remove('navigation-stale');
  state.filename = filename;
  state.fileHandle = fileHandle;
  state.savedSource = saved ? source : '';
  state.isNewFile = isNew || !saved;
  editHistory.reset();
  updateFileStatus();
  updateEditorMeta();
  scheduleRender();
}

function formatSource() {
  colorPicker.close();
  unfoldAllPreserveCaret();
  const source = state.source;
  const scrollTop = els.editor.scrollTop;
  const scrollLeft = els.editor.scrollLeft;
  const edit = formatPlantUmlEdit(source, els.editor.selectionStart, els.editor.selectionEnd);

  if (edit.text === source) {
    els.renderStatus.textContent = 'Script already formatted';
    els.editor.focus({ preventScroll: true });
    return false;
  }

  els.editor.value = edit.text;
  state.source = edit.text;
  state.foldProjection = buildFoldProjection(state.source, state.foldedStarts);
  els.editor.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  els.editor.scrollTop = scrollTop;
  els.editor.scrollLeft = scrollLeft;
  state.rendererDiagnostics = [];
  updateEditorMeta();
  els.editor.scrollTop = scrollTop;
  els.editor.scrollLeft = scrollLeft;
  syncScroll();
  els.renderStatus.textContent = 'Script formatted';
  els.editor.focus({ preventScroll: true });
  scheduleRender();
  return true;
}

els.editor.addEventListener('input', () => {
  if (!hasCollapsedFolds()) state.source = els.editor.value;
  state.rendererDiagnostics = [];
  updateEditorMeta();
  scheduleRender();
});
els.editor.addEventListener('scroll', syncScroll);
els.editor.addEventListener('click', updateSyntaxHighlight);
els.editor.addEventListener('keyup', event => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) updateSyntaxHighlight();
});
els.editor.addEventListener('select', updateSyntaxHighlight);
els.editor.addEventListener('keydown', event => {
  const editingKey = event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Enter' || event.key === 'Tab' || (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey);
  if (editingKey && hasCollapsedFolds()) unfoldAllPreserveCaret();
  if (colorPicker.handleKeydown(event)) return;
  if ((event.ctrlKey || event.metaKey) && event.code === 'Space') colorPicker.close();
  if (autocomplete.handleKeydown(event)) return;

  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    formatSource();
    return;
  }

  if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    const edit = indentedNewlineEdit(els.editor.value, els.editor.selectionStart, els.editor.selectionEnd);
    els.editor.setRangeText(edit.text, edit.start, edit.end, 'end');
    els.editor.setSelectionRange(edit.caret, edit.caret);
    state.rendererDiagnostics = [];
    updateEditorMeta();
    scheduleRender();
    return;
  }

  if (event.key === 'Tab') {
    event.preventDefault();
    const start = els.editor.selectionStart;
    const end = els.editor.selectionEnd;
    els.editor.setRangeText('  ', start, end, 'end');
    state.rendererDiagnostics = [];
    updateEditorMeta();
    scheduleRender();
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && event.shiftKey) {
    event.preventDefault();
    saveSourceAs();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveSource();
  }

  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    doRender();
  }
});


els.editor.addEventListener('paste', () => { if (hasCollapsedFolds()) unfoldAllPreserveCaret(); });
els.editor.addEventListener('cut', () => { if (hasCollapsedFolds()) unfoldAllPreserveCaret(); });

document.querySelector('#renderBtn').addEventListener('click', doRender);
els.formatBtn.addEventListener('click', formatSource);
els.foldAllBtn.addEventListener('click', () => {
  state.source = canonicalSource();
  const all = buildFoldProjection(state.source, new Set()).regions;
  state.foldedStarts = new Set(all.map(region => region.startLine));
  applyFoldProjection({ sourceSelection: sourceSelectionFromView() });
  els.renderStatus.textContent = `${state.foldedStarts.size} blocks collapsed`;
});
els.unfoldAllBtn.addEventListener('click', () => {
  const count = state.foldedStarts.size;
  unfoldAllPreserveCaret();
  els.renderStatus.textContent = count ? 'All blocks expanded' : 'No blocks are collapsed';
});
document.querySelector('#newBtn').addEventListener('click', () => replaceSource('@startuml\n\n@enduml', 'diagram.puml', { isNew: true }));
document.querySelector('#openBtn').addEventListener('click', openSourceFile);
document.querySelector('#saveBtn').addEventListener('click', () => saveSource());
document.querySelector('#saveAsBtn').addEventListener('click', saveSourceAs);
document.querySelector('#quickSaveBtn').addEventListener('click', () => saveSource());
document.querySelector('#exportSvgBtn').addEventListener('click', exportSvg);
document.querySelector('#exportPngBtn').addEventListener('click', exportPng);
document.querySelector('#copySvgBtn').addEventListener('click', copySvg);
document.querySelector('#renderMenuBtn').addEventListener('click', doRender);
document.querySelector('#zoomOutBtn').addEventListener('click', () => setZoom(state.zoom - 0.1));
document.querySelector('#zoomInBtn').addEventListener('click', () => setZoom(state.zoom + 0.1));
document.querySelector('#zoomResetBtn').addEventListener('click', () => setZoom(1));
document.querySelector('#fitBtn').addEventListener('click', fitDiagram);

els.lineNumbers.addEventListener('click', event => {
  const control = event.target.closest('[data-fold-line]');
  if (!control) return;
  toggleFoldAtSourceLine(Number(control.dataset.foldLine));
});

els.problemsToggle.addEventListener('click', () => {
  const collapsed = els.problemsPanel.classList.toggle('collapsed');
  els.problemsToggle.setAttribute('aria-expanded', String(!collapsed));
});

els.problemsList.addEventListener('click', event => {
  const control = event.target.closest('[data-action][data-id]');
  if (!control) return;
  const item = allDiagnostics().find(diagnostic => diagnostic.id === control.dataset.id);
  if (!item) return;
  if (control.dataset.action === 'fix') {
    applyDiagnosticFix(item);
    return;
  }
  if (control.dataset.action === 'jump') jumpToLine(item.line, item.column);
});

els.workspaceSplitter.addEventListener('pointerdown', event => {
  const rect = els.workspace.getBoundingClientRect();
  startDrag(event, {
    axis: 'x',
    onMove: moveEvent => {
      const percent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      applyWorkspaceSplit(percent);
    },
    onEnd: () => setTimeout(() => state.zoom < 1 && applyZoom(), 0)
  });
});

els.workspaceSplitter.addEventListener('dblclick', () => applyWorkspaceSplit(48));

els.workspaceSplitter.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  applyWorkspaceSplit(state.workspaceSplit + (event.key === 'ArrowRight' ? 2 : -2));
});

els.problemsSplitter.addEventListener('pointerdown', event => {
  const rect = els.editorPane.getBoundingClientRect();
  startDrag(event, {
    axis: 'y',
    onMove: moveEvent => {
      const height = rect.bottom - moveEvent.clientY - 29;
      applyProblemsHeight(height);
    }
  });
});

els.problemsSplitter.addEventListener('dblclick', () => applyProblemsHeight(190));

els.problemsSplitter.addEventListener('keydown', event => {
  if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  applyProblemsHeight(state.problemsHeight + (event.key === 'ArrowUp' ? 20 : -20));
});

document.querySelector('#themeBtn').addEventListener('click', () => {
  state.dark = !state.dark;
  applyTheme();
  if (state.svg) doRender();
});

els.autocompleteToggle.addEventListener('change', () => {
  state.autocomplete = els.autocompleteToggle.checked;
  localStorage.setItem('plantuml-autocomplete', String(state.autocomplete));
  autocomplete.setEnabled(state.autocomplete);
});

els.liveToggle.addEventListener('change', () => {
  state.live = els.liveToggle.checked;
  localStorage.setItem('plantuml-live-render', String(state.live));
  if (state.live) doRender();
});

document.querySelectorAll('[data-template]').forEach(button => {
  button.addEventListener('click', () => {
    const key = button.dataset.template;
    if (key && TEMPLATES[key]) replaceSource(TEMPLATES[key], `${key}.puml`, { isNew: true });
  });
});

const appMenus = [...document.querySelectorAll('.app-menu')];
function closeMenus(except = null) {
  appMenus.forEach(menu => { if (menu !== except) menu.open = false; });
}

appMenus.forEach(menu => {
  menu.addEventListener('toggle', () => { if (menu.open) closeMenus(menu); });
  menu.querySelector('.menu-popover').addEventListener('click', event => {
    if (event.target.closest('button')) menu.open = false;
  });
});

document.addEventListener('pointerdown', event => {
  if (!event.target.closest('.app-menu')) closeMenus();
});

const shortcutsDialog = document.querySelector('#shortcutsDialog');
function showShortcuts() {
  closeMenus();
  if (!shortcutsDialog.open) shortcutsDialog.showModal();
}

function toggleSetting(input) {
  input.checked = !input.checked;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function runShortcut(action) {
  const template = action?.startsWith('template-') ? action.slice('template-'.length) : null;
  if (template && TEMPLATES[template]) return replaceSource(TEMPLATES[template], `${template}.puml`, { isNew: true });
  const actions = {
    new: () => replaceSource('@startuml\n\n@enduml', 'diagram.puml', { isNew: true }),
    open: openSourceFile,
    save: saveSource,
    'save-as': saveSourceAs,
    undo: editHistory.undo,
    redo: editHistory.redo,
    format: formatSource,
    render: doRender,
    'copy-svg': copySvg,
    'export-svg': exportSvg,
    'export-png': exportPng,
    'fold-all': () => document.querySelector('#foldAllBtn').click(),
    'unfold-all': () => document.querySelector('#unfoldAllBtn').click(),
    'zoom-in': () => setZoom(state.zoom + 0.1),
    'zoom-out': () => setZoom(state.zoom - 0.1),
    'zoom-reset': () => setZoom(1),
    fit: fitDiagram,
    'toggle-autocomplete': () => toggleSetting(els.autocompleteToggle),
    'toggle-live': () => toggleSetting(els.liveToggle),
    'toggle-theme': () => document.querySelector('#themeBtn').click(),
    'show-shortcuts': showShortcuts
  };
  return actions[action]?.();
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeMenus();
    return;
  }
  if (event.defaultPrevented) return;
  const action = shortcutAction(event);
  if (!action) return;
  event.preventDefault();
  runShortcut(action);
});

document.querySelector('#shortcutInfoBtn').addEventListener('click', showShortcuts);
document.querySelector('#shortcutsCloseBtn').addEventListener('click', () => shortcutsDialog.close());
shortcutsDialog.addEventListener('click', event => {
  if (event.target === shortcutsDialog) shortcutsDialog.close();
});

els.fileInput.addEventListener('change', async () => {
  const file = els.fileInput.files?.[0];
  if (!file) return;
  const text = await file.text();
  replaceSource(text, file.name, { saved: true });
  els.fileInput.value = '';
});

let quickEditRecord = null;
let quickEditTimer = null;

function closeObjectQuickEdit() {
  clearTimeout(quickEditTimer);
  els.objectQuickEdit.hidden = true;
  quickEditRecord = null;
}

function showObjectQuickEdit(event, record) {
  if (!record || record.type !== 'element') return closeObjectQuickEdit();
  const current = relocateNavigationTarget(record, canonicalSource()) || record;
  const line = splitLines(canonicalSource())[current.line - 1] || current.statement || '';
  const appearance = readObjectAppearance(line);
  quickEditRecord = current;
  els.quickEditTitle.textContent = `Quick edit • ${describeNavigationRecord(current)}`;
  els.quickEditColor.value = appearance.color;
  els.quickEditStyle.value = appearance.style;
  const viewportRect = els.previewPane.getBoundingClientRect();
  els.objectQuickEdit.style.left = `${Math.min(viewportRect.width - 280, Math.max(12, event.clientX - viewportRect.left + 14))}px`;
  els.objectQuickEdit.style.top = `${Math.min(viewportRect.height - 190, Math.max(52, event.clientY - viewportRect.top + 14))}px`;
  els.objectQuickEdit.hidden = false;
}

function scheduleObjectQuickEdit(event, record) {
  clearTimeout(quickEditTimer);
  if (!record || record.type !== 'element') return;
  const point = { clientX: event.clientX, clientY: event.clientY };
  quickEditTimer = setTimeout(() => showObjectQuickEdit(point, record), 450);
}

els.objectQuickEdit.addEventListener('submit', event => {
  event.preventDefault();
  if (!quickEditRecord) return;
  const current = relocateNavigationTarget(quickEditRecord, canonicalSource()) || quickEditRecord;
  const updated = updateObjectAppearance(canonicalSource(), current.line, {
    color: els.quickEditColor.value,
    style: els.quickEditStyle.value
  });
  if (updated === canonicalSource()) return closeObjectQuickEdit();
  editHistory.checkpoint();
  unfoldAllPreserveCaret();
  els.editor.value = updated;
  state.source = updated;
  state.foldProjection = buildFoldProjection(updated, state.foldedStarts);
  editHistory.checkpoint();
  state.rendererDiagnostics = [];
  updateEditorMeta();
  scheduleRender();
  els.renderStatus.textContent = 'Object appearance updated';
  closeObjectQuickEdit();
});

els.quickEditClose.addEventListener('click', closeObjectQuickEdit);
els.quickEditReset.addEventListener('click', () => {
  els.quickEditColor.value = '';
  els.quickEditStyle.value = '';
});
els.objectQuickEdit.addEventListener('pointerenter', () => clearTimeout(quickEditTimer));
els.objectQuickEdit.addEventListener('pointerleave', () => { quickEditTimer = setTimeout(closeObjectQuickEdit, 300); });

els.previewCanvas.addEventListener('click', navigateFromDiagram);
els.previewCanvas.addEventListener('pointerover', event => {
  const record = renderedNavigationRecordFromEvent(event);
  if (!record) return;
  scheduleObjectQuickEdit(event, record);
  els.navigationStatus.textContent = `Click to edit ${describeNavigationRecord(record)} • line ${record.line}`;
});
els.previewCanvas.addEventListener('pointerout', event => {
  const from = event.target instanceof Element ? event.target.closest('[data-source-nav-id]') : null;
  const to = event.relatedTarget instanceof Element ? event.relatedTarget.closest('[data-source-nav-id]') : null;
  if (from && from === to) return;
  clearTimeout(quickEditTimer);
  if (!els.objectQuickEdit.matches(':hover')) quickEditTimer = setTimeout(closeObjectQuickEdit, 300);
  if (!els.navigationStatus.classList.contains('navigation-stale')) {
    els.navigationStatus.textContent = 'Click a diagram element to locate its source';
  }
});

els.previewViewport.addEventListener('wheel', event => {
  if (!(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  setZoom(state.zoom + (event.deltaY < 0 ? 0.1 : -0.1));
}, { passive: false });

window.addEventListener('resize', () => {
  applyProblemsHeight(state.problemsHeight);
  if (state.zoom < 1) applyZoom();
});

window.addEventListener('beforeunload', event => {
  if (!isSourceDirty()) return;
  event.preventDefault();
  event.returnValue = '';
});

async function init() {
  try {
    els.renderStatus.textContent = 'Loading Viz.js…';
    await loadClassicScript(vizGlobalUrl);
    els.renderStatus.textContent = 'Engine ready';
    await doRender();
    // Always start a fresh page load at actual size. Fit-to-view remains
    // available as an explicit user action from the preview toolbar.
    setZoom(1);
  } catch (error) {
    showError(`PlantUML engine failed to initialize. ${error?.message || error}`);
    els.renderStatus.textContent = 'Engine initialization failed';
  }
}

applyWorkspaceSplit();
applyProblemsHeight();
init();
