export const DETACHED_PREVIEW_CHANNEL = 'plantuml-studio-detached-preview-v1';

export function detachedPreviewState({ svg = '', filename = 'diagram.puml', dark = false, status = '' } = {}) {
  return {
    type: 'detached-preview-state',
    svg: String(svg || ''),
    filename: String(filename || 'diagram.puml'),
    theme: dark ? 'dark' : 'light',
    status: String(status || '')
  };
}

export function isDetachedPreviewState(value) {
  return value?.type === 'detached-preview-state'
    && typeof value.svg === 'string'
    && typeof value.filename === 'string'
    && (value.theme === 'light' || value.theme === 'dark');
}

export function detachedPreviewLifecycle(type, previewId = 'detached-preview') {
  return { type, previewId: String(previewId || 'detached-preview') };
}

export function isDetachedPreviewLifecycle(value, type) {
  return value?.type === type && typeof value.previewId === 'string' && value.previewId.length > 0;
}

export function detachedPreviewAction(type, previewId, payload = {}) {
  return { type, previewId: String(previewId || 'detached-preview'), ...payload };
}

export function isDetachedPreviewAction(value, type) {
  return value?.type === type && typeof value.previewId === 'string' && value.previewId.length > 0;
}
