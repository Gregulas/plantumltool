export function detectShortcutPlatform(navigatorInfo = {}) {
  const identity = [navigatorInfo.userAgentData?.platform, navigatorInfo.platform, navigatorInfo.userAgent]
    .filter(Boolean)
    .join(' ');
  if (/mac|iphone|ipad|ipod/i.test(identity)) return 'mac';
  if (/win/i.test(identity)) return 'windows';
  return 'linux';
}

export function formatShortcutLabel(value, platform) {
  return String(value || '')
    .replaceAll('Autocomplete', autocompleteShortcutLabel(platform))
    .replaceAll('Ctrl/Cmd', platform === 'mac' ? 'Cmd' : 'Ctrl')
    .replaceAll('Alt', platform === 'mac' ? 'Option' : 'Alt');
}

export function autocompleteShortcutLabel(platform) {
  return platform === 'mac' ? 'Option+Space' : 'Ctrl+Space';
}

export function isAutocompleteShortcut(event, platform) {
  if (event.code !== 'Space' || event.shiftKey) return false;
  if (platform === 'mac') return event.altKey && !event.ctrlKey && !event.metaKey;
  return event.ctrlKey && !event.altKey && !event.metaKey;
}
