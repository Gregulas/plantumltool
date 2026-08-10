import './preview-window.css';
import { APP_VERSION } from './app-version.js';
import { DETACHED_PREVIEW_CHANNEL, detachedPreviewAction, detachedPreviewLifecycle, isDetachedPreviewAction, isDetachedPreviewState } from './detached-preview.js';
import { scrollCanvasDimensions, zoomedSvgDimensions } from './preview-zoom.js';
import { availableScreenBounds, isNearBounds } from './window-sizing.js';
import { detectShortcutPlatform, formatShortcutLabel } from './shortcut-platform.js';

const shortcutPlatform = detectShortcutPlatform(navigator);
const shortcutLabel = value => formatShortcutLabel(value, shortcutPlatform);

document.querySelector('#previewApp').innerHTML = `
  <div class="detached-shell">
    <header>
      <div class="detached-brand"><span>PU</span><div><strong id="detachedFilename">Detached preview</strong><small>Move this window to another display</small></div></div>
      <div class="detached-actions">
        <button id="zoomOut" type="button" aria-label="Zoom out">−</button>
        <button id="zoomReset" type="button">100%</button>
        <button id="zoomIn" type="button" aria-label="Zoom in">+</button>
        <button id="zoomFit" type="button">Fit</button>
        <button id="windowSize" type="button" title="Maximize or restore window (${shortcutLabel('Ctrl/Cmd+Shift+M')})" aria-label="Maximize window">□ <span>Maximize</span></button>
      </div>
    </header>
    <main id="detachedViewport"><div id="detachedCanvas"><div class="waiting"><strong>Waiting for the editor…</strong><span>Keep the PlantUML Studio editor window open.</span></div></div></main>
    <form id="detachedQuickEdit" class="detached-quick-edit" hidden>
      <div><strong id="detachedQuickEditTitle">Quick edit</strong><button id="detachedQuickEditClose" type="button" aria-label="Close quick edit">×</button></div>
      <label>Color <input id="detachedQuickEditColor" type="text" placeholder="#32BCBB or #LightBlue" /></label>
      <label>Style / stereotype <input id="detachedQuickEditStyle" type="text" placeholder="service" /></label>
      <div class="detached-quick-edit-actions"><button id="detachedQuickEditReset" type="button">Clear</button><button type="submit">Apply</button></div>
    </form>
    <div id="detachedSelectionActions" class="detached-selection-actions" hidden><strong>Selected script</strong><button id="detachedSelectionOpenTab" type="button">Open in new tab</button></div>
    <div id="detachedArrowAction" class="detached-arrow-action" hidden><strong id="detachedArrowActionTitle">Sequence call</strong><button id="detachedArrowActivationBtn" type="button">Activate action</button></div>
    <footer><span id="detachedStatus">Connecting…</span><span>PlantUML Studio ${APP_VERSION}</span></footer>
  </div>
`;

const els = {
  viewport: document.querySelector('#detachedViewport'), canvas: document.querySelector('#detachedCanvas'),
  filename: document.querySelector('#detachedFilename'), status: document.querySelector('#detachedStatus'),
  zoomReset: document.querySelector('#zoomReset'), windowSize: document.querySelector('#windowSize'),
  quickEdit: document.querySelector('#detachedQuickEdit'), quickEditTitle: document.querySelector('#detachedQuickEditTitle'),
  quickEditColor: document.querySelector('#detachedQuickEditColor'), quickEditStyle: document.querySelector('#detachedQuickEditStyle')
};
let zoom = 1;
let currentMessage = null;
const previewId = crypto.randomUUID?.() || `preview-${Date.now()}-${Math.random().toString(16).slice(2)}`;
let maximized = false;
let resizingProgrammatically = false;
let restoreBounds = null;
let quickEditRecordId = null;
let quickEditTimer = null;
let quickEditPoint = null;
let activationRecordId = null;
let activationPoint = null;

function scrollToRecord(recordId, behavior = 'smooth') {
  if (!recordId) return;
  const nodes = [...els.canvas.querySelectorAll('[data-source-nav-id]')].filter(node => node.dataset.sourceNavId === recordId);
  const node = nodes
    .map(candidate => ({ candidate, rect: candidate.getBoundingClientRect() }))
    .filter(item => item.rect.width > 1 && item.rect.height > 1)
    .sort((left, right) => left.rect.width * left.rect.height - right.rect.width * right.rect.height)[0]?.candidate;
  if (!node) return;
  const viewport = els.viewport.getBoundingClientRect();
  const bounds = node.getBoundingClientRect();
  els.viewport.scrollTo({
    left: els.viewport.scrollLeft + bounds.left - viewport.left - (viewport.width - bounds.width) / 2,
    top: els.viewport.scrollTop + bounds.top - viewport.top - (viewport.height - bounds.height) / 2,
    behavior
  });
}

function clearSelectionOverlay() {
  els.canvas.querySelector('.detached-selection-screen-overlay')?.remove();
  document.querySelector('#detachedSelectionActions').hidden = true;
}

function refreshSelectionOverlay() {
  clearSelectionOverlay();
  const selectedIds = new Set(currentMessage?.selectionRecordIds || []);
  if (!selectedIds.size) return;
  const bestByRecord = new Map();
  for (const node of els.canvas.querySelectorAll('[data-source-nav-id]')) {
    const id = node.dataset.sourceNavId;
    if (!selectedIds.has(id)) continue;
    const rect = node.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    const classes = node.getAttribute('class') || '';
    const nativeLine = ['data-source-line', 'data-line', 'data-line-number', 'data-sourceLine'].some(name => node.hasAttribute(name));
    const semanticGroup = node.tagName.toLowerCase() === 'g' && /message|participant|entity|class|component|actor|node|cluster|state|object|usecase|note|group|divider|delay/i.test(classes);
    const rank = nativeLine ? 100 : semanticGroup ? 80 : node.tagName.toLowerCase() === 'text' ? 40 : 10;
    const candidate = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, rank, area: rect.width * rect.height };
    const current = bestByRecord.get(id);
    if (!current || candidate.rank > current.rank || (candidate.rank === current.rank && candidate.area > current.area)) bestByRecord.set(id, candidate);
  }
  const bounds = [...bestByRecord.values()];
  if (!bounds.length) return;
  const canvasBounds = els.canvas.getBoundingClientRect();
  const left = Math.min(...bounds.map(item => item.left)) - 7;
  const top = Math.min(...bounds.map(item => item.top)) - 6;
  const right = Math.max(...bounds.map(item => item.right)) + 7;
  const bottom = Math.max(...bounds.map(item => item.bottom)) + 6;
  const overlay = document.createElement('div');
  overlay.className = 'detached-selection-screen-overlay';
  overlay.style.left = `${left - canvasBounds.left}px`;
  overlay.style.top = `${top - canvasBounds.top}px`;
  overlay.style.width = `${right - left}px`;
  overlay.style.height = `${bottom - top}px`;
  overlay.addEventListener('pointerenter', () => {
    document.querySelector('#detachedSelectionActions').hidden = false;
  });
  els.canvas.appendChild(overlay);
}

function sendAction(type, payload = {}) {
  const message = detachedPreviewAction(type, previewId, payload);
  channel?.postMessage(message);
  window.opener?.postMessage(message, location.origin);
}

function closeQuickEdit() {
  clearTimeout(quickEditTimer);
  els.quickEdit.hidden = true;
  quickEditRecordId = null;
}

function receiveAction(message) {
  if (message.previewId !== previewId && message.previewId !== 'all') return;
  if (isDetachedPreviewAction(message, 'detached-preview-focus')) {
    scrollToRecord(message.recordId);
    return;
  }
  if (isDetachedPreviewAction(message, 'detached-preview-activation-data')) {
    activationRecordId = message.recordId;
    const menu = document.querySelector('#detachedArrowAction');
    const point = activationPoint || { x: 80, y: 80 };
    document.querySelector('#detachedArrowActionTitle').textContent = message.title || 'Sequence call';
    document.querySelector('#detachedArrowActivationBtn').textContent = message.label || 'Activate action';
    menu.style.left = `${Math.min(window.innerWidth - 220, Math.max(12, point.x))}px`;
    menu.style.top = `${Math.min(window.innerHeight - 120, Math.max(60, point.y))}px`;
    menu.hidden = false;
    return;
  }
  if (!isDetachedPreviewAction(message, 'detached-preview-quick-edit-data')) return;
  quickEditRecordId = message.recordId;
  els.quickEditTitle.textContent = `Quick edit • ${message.title || 'diagram object'}`;
  els.quickEditColor.value = message.color || '';
  els.quickEditStyle.value = message.style || '';
  const point = quickEditPoint || { x: 80, y: 80 };
  els.quickEdit.style.left = `${Math.min(window.innerWidth - 292, Math.max(12, point.x + 14))}px`;
  els.quickEdit.style.top = `${Math.min(window.innerHeight - 220, Math.max(62, point.y + 14))}px`;
  els.quickEdit.hidden = false;
}

function applyZoom() {
  const svg = els.canvas.querySelector('svg');
  if (!svg) return;
  const dimensions = zoomedSvgDimensions(svg.viewBox?.baseVal, zoom);
  if (!dimensions) return;
  svg.style.width = `${dimensions.width}px`;
  svg.style.height = `${dimensions.height}px`;
  const canvas = scrollCanvasDimensions(dimensions, { width: els.viewport.clientWidth, height: els.viewport.clientHeight }, { left: 32, right: 32, top: 32, bottom: 32 });
  els.canvas.style.width = `${canvas.width}px`;
  els.canvas.style.height = `${canvas.height}px`;
  els.zoomReset.textContent = `${Math.round(zoom * 100)}%`;
  requestAnimationFrame(refreshSelectionOverlay);
}

function setZoom(next) {
  zoom = Math.min(4, Math.max(.2, next));
  applyZoom();
}

function fit() {
  const svg = els.canvas.querySelector('svg');
  const box = svg?.viewBox?.baseVal;
  if (!box?.width || !box?.height) return;
  setZoom(Math.min((els.viewport.clientWidth - 64) / box.width, (els.viewport.clientHeight - 64) / box.height, 1.5));
}

function receive(message) {
  if (!isDetachedPreviewState(message)) return;
  currentMessage = message;
  document.documentElement.dataset.theme = message.theme;
  els.filename.textContent = message.filename;
  els.status.textContent = message.status || 'Synchronized with editor';
  document.title = `${message.filename} • Detached Preview`;
  if (message.svg) {
    clearSelectionOverlay();
    els.canvas.innerHTML = message.svg;
    const svg = els.canvas.querySelector('svg');
    svg?.removeAttribute('width');
    svg?.removeAttribute('height');
    applyZoom();
    requestAnimationFrame(() => scrollToRecord(message.focusRecordId, 'auto'));
  } else {
    clearSelectionOverlay();
  }
}

const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(DETACHED_PREVIEW_CHANNEL) : null;
channel?.addEventListener('message', event => { receive(event.data); receiveAction(event.data); });
window.addEventListener('message', event => {
  if (event.origin === location.origin) { receive(event.data); receiveAction(event.data); }
});

function requestState() {
  const ready = detachedPreviewLifecycle('detached-preview-ready', previewId);
  channel?.postMessage(ready);
  window.opener?.postMessage(ready, location.origin);
}

function sendHeartbeat() {
  const heartbeat = detachedPreviewLifecycle('detached-preview-heartbeat', previewId);
  channel?.postMessage(heartbeat);
  window.opener?.postMessage(heartbeat, location.origin);
}

const heartbeatTimer = setInterval(sendHeartbeat, 500);

function notifyClosed() {
  clearInterval(heartbeatTimer);
  const closed = detachedPreviewLifecycle('detached-preview-closed', previewId);
  channel?.postMessage(closed);
  window.opener?.postMessage(closed, location.origin);
  channel?.close();
}

function setMaximizeButton() {
  els.windowSize.querySelector('span').textContent = maximized ? 'Restore' : 'Maximize';
  els.windowSize.setAttribute('aria-label', maximized ? 'Restore window' : 'Maximize window');
}

function toggleMaximize() {
  if (maximized && restoreBounds) {
    resizingProgrammatically = true;
    window.moveTo(restoreBounds.x, restoreBounds.y);
    window.resizeTo(restoreBounds.width, restoreBounds.height);
    maximized = false;
    setMaximizeButton();
    setTimeout(() => { resizingProgrammatically = false; applyZoom(); }, 180);
    return;
  }

  restoreBounds = { x: window.screenX, y: window.screenY, width: window.outerWidth, height: window.outerHeight };
  const bounds = availableScreenBounds(window.screen);
  resizingProgrammatically = true;
  window.moveTo(bounds.left, bounds.top);
  window.resizeTo(bounds.width, bounds.height);
  setTimeout(() => {
    resizingProgrammatically = false;
    maximized = isNearBounds({ x: window.screenX, y: window.screenY, width: window.outerWidth, height: window.outerHeight }, bounds);
    setMaximizeButton();
    els.status.textContent = maximized ? 'Maximized — double-click the header to restore' : 'Use the browser window controls to maximize this window';
    applyZoom();
  }, 180);
}

document.querySelector('#zoomOut').addEventListener('click', () => setZoom(zoom - .1));
document.querySelector('#zoomIn').addEventListener('click', () => setZoom(zoom + .1));
document.querySelector('#zoomReset').addEventListener('click', () => setZoom(1));
document.querySelector('#zoomFit').addEventListener('click', fit);
els.canvas.addEventListener('click', event => {
  const marked = event.target instanceof Element ? event.target.closest('[data-source-nav-id]') : null;
  if (!marked) return;
  event.preventDefault();
  sendAction('detached-preview-navigate', { recordId: marked.dataset.sourceNavId });
  els.status.textContent = 'Opened source location in the editor window';
});
els.canvas.addEventListener('contextmenu', event => {
  const marked = event.target instanceof Element ? event.target.closest('[data-source-nav-id]') : null;
  if (!marked) return;
  event.preventDefault();
  activationPoint = { x: event.clientX, y: event.clientY };
  sendAction('detached-preview-activation-request', { recordId: marked.dataset.sourceNavId });
});
els.canvas.addEventListener('pointerover', event => {
  if (event.target instanceof Element && event.target.closest('.detached-selection-screen-overlay')) {
    document.querySelector('#detachedSelectionActions').hidden = false;
    return;
  }
  const marked = event.target instanceof Element ? event.target.closest('[data-source-nav-id]') : null;
  if (!marked) return;
  clearTimeout(quickEditTimer);
  quickEditPoint = { x: event.clientX, y: event.clientY };
  quickEditTimer = setTimeout(() => sendAction('detached-preview-quick-edit-request', { recordId: marked.dataset.sourceNavId }), 450);
});
els.canvas.addEventListener('pointerout', event => {
  const from = event.target instanceof Element ? event.target.closest('[data-source-nav-id]') : null;
  const to = event.relatedTarget instanceof Element ? event.relatedTarget.closest('[data-source-nav-id]') : null;
  if (from && from === to) return;
  clearTimeout(quickEditTimer);
});
els.quickEdit.addEventListener('submit', event => {
  event.preventDefault();
  if (!quickEditRecordId) return;
  sendAction('detached-preview-quick-edit-apply', { recordId: quickEditRecordId, color: els.quickEditColor.value, style: els.quickEditStyle.value });
  els.status.textContent = 'Object appearance update sent to editor';
  closeQuickEdit();
});
document.querySelector('#detachedQuickEditClose').addEventListener('click', closeQuickEdit);
document.querySelector('#detachedQuickEditReset').addEventListener('click', () => { els.quickEditColor.value = ''; els.quickEditStyle.value = ''; });
document.querySelector('#detachedSelectionOpenTab').addEventListener('click', () => {
  sendAction('detached-preview-open-selection-tab');
  document.querySelector('#detachedSelectionActions').hidden = true;
  els.status.textContent = 'Opened selection in a new editor tab';
});
document.querySelector('#detachedArrowActivationBtn').addEventListener('click', () => {
  if (activationRecordId) sendAction('detached-preview-activation-apply', { recordId: activationRecordId });
  document.querySelector('#detachedArrowAction').hidden = true;
  activationRecordId = null;
  els.status.textContent = 'Activation update sent to editor';
});
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('.detached-arrow-action')) document.querySelector('#detachedArrowAction').hidden = true;
});
els.windowSize.addEventListener('click', toggleMaximize);
document.querySelector('header').addEventListener('dblclick', event => {
  if (!event.target.closest('button')) toggleMaximize();
});
els.viewport.addEventListener('wheel', event => {
  if (!(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
  setZoom(zoom + (event.deltaY < 0 ? .1 : -.1));
}, { passive: false });
window.addEventListener('resize', () => {
  if (maximized && !resizingProgrammatically) {
    maximized = false;
    setMaximizeButton();
  }
  applyZoom();
});
window.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'm') {
    event.preventDefault();
    toggleMaximize();
  }
});
window.addEventListener('beforeunload', notifyClosed);
requestState();
sendHeartbeat();
setTimeout(requestState, 250);
