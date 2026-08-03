import { tokenizePlantUml } from './syntax-highlight.js';

const PALETTE = [
  '#000000', '#222222', '#5f6b6d', '#ffffff',
  '#32bcbb', '#169c9a', '#65d9ef', '#7eb8ff',
  '#8ed9a4', '#ffd27d', '#ff9f8f', '#f5a3c7',
  '#b9a5ff', '#d6a2e8', '#e9fafa', '#fff1f0'
];

const NAMED_COLORS = new Map(Object.entries({
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', cyan: '#00ffff',
  aqua: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff', lime: '#00ff00', navy: '#000080',
  teal: '#008080', maroon: '#800000', olive: '#808000', gray: '#808080', grey: '#808080',
  silver: '#c0c0c0', lightblue: '#add8e6', lightgreen: '#90ee90', lightgray: '#d3d3d3',
  lightgrey: '#d3d3d3', darkgray: '#a9a9a9', darkgrey: '#a9a9a9', gold: '#ffd700',
  violet: '#ee82ee', beige: '#f5f5dc', brown: '#a52a2a', coral: '#ff7f50', indigo: '#4b0082'
}));

export function normalizeColorForPicker(value, fallback = '#32bcbb') {
  const raw = String(value ?? '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    const [r, g, b] = raw.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9a-f]{8}$/i.test(raw)) return `#${raw.slice(1, 7)}`.toLowerCase();
  if (/^#[0-9a-f]{4}$/i.test(raw)) {
    const [r, g, b] = raw.slice(1, 4).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const name = raw.replace(/^#/, '').toLowerCase();
  return NAMED_COLORS.get(name) || fallback;
}

export function findColorTokenAt(source, position) {
  const text = String(source ?? '');
  const caret = Math.max(0, Math.min(Number(position) || 0, text.length));
  let offset = 0;

  for (const token of tokenizePlantUml(text)) {
    const start = offset;
    const end = start + token.text.length;
    if (token.type === 'color' && caret >= start && caret <= end) {
      return { start, end, text: token.text, pickerValue: normalizeColorForPicker(token.text) };
    }
    offset = end;
  }
  return null;
}

function caretCoordinates(textarea, position, relativeTo) {
  const mirror = document.createElement('div');
  const style = getComputedStyle(textarea);
  const props = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'textTransform', 'wordSpacing',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'
  ];
  for (const prop of props) mirror.style[prop] = style[prop];
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre';
  mirror.style.overflow = 'hidden';
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.left = `${textarea.offsetLeft}px`;
  mirror.style.top = `${textarea.offsetTop}px`;
  mirror.textContent = textarea.value.slice(0, position);

  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  mirror.appendChild(marker);
  relativeTo.appendChild(mirror);

  const x = marker.offsetLeft - textarea.scrollLeft + textarea.offsetLeft;
  const y = marker.offsetTop - textarea.scrollTop + textarea.offsetTop + (parseFloat(style.lineHeight) || 21);
  mirror.remove();
  return { x, y };
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function createColorPicker({ textarea, host, onChange, onBeforeOpen, onOpen, onClose }) {
  const popup = document.createElement('div');
  popup.className = 'color-picker-popup';
  popup.hidden = true;
  popup.innerHTML = `
    <div class="color-picker-header">
      <div>
        <strong>PlantUML color</strong>
        <span class="color-picker-original"></span>
      </div>
      <button class="color-picker-close" type="button" aria-label="Close color picker">×</button>
    </div>
    <div class="color-picker-main">
      <label class="native-color-wrap" title="Open system color picker">
        <input class="native-color-input" type="color" value="#32bcbb" />
        <span class="native-color-label">Choose color</span>
      </label>
      <div class="color-value-row">
        <span class="color-preview" aria-hidden="true"></span>
        <code class="color-value"></code>
      </div>
      <div class="color-swatches" aria-label="Common colors">
        ${PALETTE.map(color => `<button type="button" class="color-swatch" data-color="${escapeAttr(color)}" title="${escapeAttr(color)}" style="--swatch:${escapeAttr(color)}"></button>`).join('')}
      </div>
    </div>
    <div class="color-picker-footer">Click a swatch or open the system picker · Esc closes</div>
  `;
  host.appendChild(popup);

  const nativeInput = popup.querySelector('.native-color-input');
  const original = popup.querySelector('.color-picker-original');
  const valueLabel = popup.querySelector('.color-value');
  const preview = popup.querySelector('.color-preview');
  let range = null;
  let currentValue = '#32bcbb';

  function close({ restoreFocus = false } = {}) {
    if (popup.hidden) return;
    popup.hidden = true;
    range = null;
    onClose?.();
    if (restoreFocus) textarea.focus({ preventScroll: true });
  }

  function positionPopup() {
    if (popup.hidden || !range) return;
    const coords = caretCoordinates(textarea, range.start, host);
    const width = Math.min(268, Math.max(230, host.clientWidth - 20));
    popup.style.width = `${width}px`;
    const maxLeft = Math.max(8, host.clientWidth - width - 8);
    popup.style.left = `${Math.min(Math.max(58, coords.x), maxLeft)}px`;
    const estimatedHeight = 218;
    const below = coords.y + 7;
    const above = coords.y - estimatedHeight - 25;
    popup.style.top = `${below + estimatedHeight < host.clientHeight ? below : Math.max(8, above)}px`;
  }

  function paintValue(value) {
    currentValue = normalizeColorForPicker(value);
    nativeInput.value = currentValue;
    valueLabel.textContent = currentValue.toUpperCase();
    preview.style.background = currentValue;
  }

  function openForCaret() {
    let token = findColorTokenAt(textarea.value, textarea.selectionStart);
    if (!token) return close();

    // Editing a projected/folded textarea would otherwise update only the view.
    // Expand first, then resolve the color range against the canonical visible source.
    if (onBeforeOpen?.()) token = findColorTokenAt(textarea.value, textarea.selectionStart);
    if (!token) return close();

    range = token;
    original.textContent = token.text;
    paintValue(token.pickerValue);
    popup.hidden = false;
    positionPopup();
    onOpen?.(token);
  }

  function apply(value, { closeAfter = false, focusAfter = false } = {}) {
    if (!range) return false;
    const normalized = normalizeColorForPicker(value);
    textarea.setRangeText(normalized, range.start, range.end, 'end');
    range = { ...range, end: range.start + normalized.length, text: normalized, pickerValue: normalized };
    textarea.setSelectionRange(range.end, range.end);
    original.textContent = normalized;
    paintValue(normalized);
    onChange?.(normalized, { start: range.start, end: range.end });
    if (closeAfter) close({ restoreFocus: focusAfter });
    else positionPopup();
    return true;
  }

  nativeInput.addEventListener('input', () => apply(nativeInput.value));
  nativeInput.addEventListener('change', () => apply(nativeInput.value, { closeAfter: true, focusAfter: true }));

  popup.querySelector('.color-picker-close').addEventListener('click', () => close({ restoreFocus: true }));
  popup.querySelector('.color-swatches').addEventListener('mousedown', event => event.preventDefault());
  popup.querySelector('.color-swatches').addEventListener('click', event => {
    const swatch = event.target.closest('[data-color]');
    if (!swatch) return;
    apply(swatch.dataset.color, { closeAfter: true, focusAfter: true });
  });

  textarea.addEventListener('click', () => queueMicrotask(openForCaret));
  textarea.addEventListener('keyup', event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
      queueMicrotask(openForCaret);
    }
  });
  textarea.addEventListener('input', () => queueMicrotask(openForCaret));
  textarea.addEventListener('scroll', () => {
    if (!popup.hidden) positionPopup();
  });
  textarea.addEventListener('blur', () => setTimeout(() => {
    if (!popup.contains(document.activeElement)) close();
  }, 100));

  document.addEventListener('pointerdown', event => {
    if (popup.hidden || popup.contains(event.target) || event.target === textarea) return;
    close();
  });

  function handleKeydown(event) {
    if (popup.hidden) return false;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return true;
    }
    return false;
  }

  return { openForCaret, close, handleKeydown, get open() { return !popup.hidden; } };
}
