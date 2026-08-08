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
    .replaceAll('Ctrl/Cmd', platform === 'mac' ? 'Cmd' : 'Ctrl')
    .replaceAll('Alt', platform === 'mac' ? 'Option' : 'Alt');
}
