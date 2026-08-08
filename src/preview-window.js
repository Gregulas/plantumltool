import './preview-window.css';
import { APP_VERSION } from './app-version.js';
import { DETACHED_PREVIEW_CHANNEL, isDetachedPreviewState } from './detached-preview.js';
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
    <footer><span id="detachedStatus">Connecting…</span><span>PlantUML Studio ${APP_VERSION}</span></footer>
  </div>
`;

const els = {
  viewport: document.querySelector('#detachedViewport'), canvas: document.querySelector('#detachedCanvas'),
  filename: document.querySelector('#detachedFilename'), status: document.querySelector('#detachedStatus'),
  zoomReset: document.querySelector('#zoomReset'), windowSize: document.querySelector('#windowSize')
};
let zoom = 1;
let currentMessage = null;
let maximized = false;
let resizingProgrammatically = false;
let restoreBounds = null;

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
    els.canvas.innerHTML = message.svg;
    const svg = els.canvas.querySelector('svg');
    svg?.removeAttribute('width');
    svg?.removeAttribute('height');
    applyZoom();
  }
}

const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(DETACHED_PREVIEW_CHANNEL) : null;
channel?.addEventListener('message', event => receive(event.data));
window.addEventListener('message', event => {
  if (event.origin === location.origin) receive(event.data);
});

function requestState() {
  const ready = { type: 'detached-preview-ready' };
  channel?.postMessage(ready);
  window.opener?.postMessage(ready, location.origin);
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
window.addEventListener('beforeunload', () => channel?.close());
requestState();
setTimeout(requestState, 250);
