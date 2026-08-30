const DEFAULT_EXCLUDED_SELECTOR = [
  '[data-source-nav-id]',
  '.source-selection-screen-overlay',
  '.detached-selection-screen-overlay',
  '.selection-actions',
  '.detached-selection-actions',
  '.arrow-action-menu',
  '.detached-arrow-action',
  'button',
  'a',
  'input',
  'select',
  'textarea',
  '[role="button"]'
].join(', ');

export function isPreviewPanStart(event, viewport, excludedSelector = DEFAULT_EXCLUDED_SELECTOR) {
  if (!event || event.button !== 0 || event.isPrimary === false) return false;
  const target = event.target;
  if (!target || typeof target.closest !== 'function') return false;
  if (typeof viewport?.contains === 'function' && !viewport.contains(target)) return false;
  const excluded = target.closest(excludedSelector);
  return !excluded || (typeof viewport?.contains === 'function' && !viewport.contains(excluded));
}

export function previewPanScroll(start, point) {
  return {
    left: start.scrollLeft - (point.clientX - start.clientX),
    top: start.scrollTop - (point.clientY - start.clientY)
  };
}

export function installPreviewPanning(viewport, { excludedSelector = DEFAULT_EXCLUDED_SELECTOR } = {}) {
  let gesture = null;
  let suppressClick = false;

  function finish(event) {
    if (!gesture || (event?.pointerId != null && event.pointerId !== gesture.pointerId)) return;
    suppressClick = gesture.dragged;
    const pointerId = gesture.pointerId;
    gesture = null;
    viewport.classList.remove('is-grabbing');
    if (viewport.hasPointerCapture?.(pointerId)) viewport.releasePointerCapture(pointerId);
  }

  viewport.addEventListener('pointerdown', event => {
    if (!isPreviewPanStart(event, viewport, excludedSelector)) return;
    gesture = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
      dragged: false
    };
    suppressClick = false;
    viewport.classList.add('is-grabbing');
    viewport.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  viewport.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const dx = event.clientX - gesture.clientX;
    const dy = event.clientY - gesture.clientY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) gesture.dragged = true;
    const scroll = previewPanScroll(gesture, event);
    viewport.scrollLeft = scroll.left;
    viewport.scrollTop = scroll.top;
    event.preventDefault();
  });

  viewport.addEventListener('pointerup', finish);
  viewport.addEventListener('pointercancel', finish);
  viewport.addEventListener('lostpointercapture', finish);
  viewport.addEventListener('click', event => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  return { cancel: finish };
}
