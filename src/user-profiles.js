export const PROFILE_REGISTRY_KEY = 'plantuml-user-profiles-v1';
export const GUEST_PROFILE_ID = 'guest';

const PROFILE_PREFIX = 'plantuml-profile:';
const LEGACY_KEYS = [
  'plantuml-local-source',
  'plantuml-local-theme',
  'plantuml-live-render',
  'plantuml-autocomplete',
  'plantuml-workspace-split',
  'plantuml-problems-height',
  'plantuml-recent-files-v1',
  'plantuml-spelling-ignores-v1'
];

function safeJson(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function validProfile(value) {
  return value && typeof value.id === 'string' && /^[a-z0-9_-]+$/i.test(value.id)
    && typeof value.name === 'string' && value.name.trim();
}

function readRegistry(storage) {
  const parsed = safeJson(storage?.getItem(PROFILE_REGISTRY_KEY) || '', null);
  if (!parsed || !Array.isArray(parsed.profiles)) return null;
  const profiles = parsed.profiles.filter(validProfile).map(profile => ({
    id: profile.id,
    name: profile.name.trim().slice(0, 40),
    createdAt: Number(profile.createdAt) || 0
  }));
  const activeProfileId = profiles.some(profile => profile.id === parsed.activeProfileId)
    ? parsed.activeProfileId
    : GUEST_PROFILE_ID;
  return { version: 1, activeProfileId, profiles };
}

function writeRegistry(storage, registry) {
  storage?.setItem(PROFILE_REGISTRY_KEY, JSON.stringify(registry));
  return registry;
}

function profileKey(profileId, key) {
  return `${PROFILE_PREFIX}${profileId}:${key}`;
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(String(key)) ? values.get(String(key)) : null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: key => values.delete(String(key)),
    clear: () => values.clear()
  };
}

export function createProfileStorage(storage, profileId) {
  if (!profileId || profileId === GUEST_PROFILE_ID) return memoryStorage();
  return {
    getItem: key => storage?.getItem(profileKey(profileId, key)) ?? null,
    setItem: (key, value) => storage?.setItem(profileKey(profileId, key), String(value)),
    removeItem: key => storage?.removeItem(profileKey(profileId, key))
  };
}

function hasLegacyData(storage) {
  return LEGACY_KEYS.some(key => storage?.getItem(key) != null);
}

function migrateLegacyProfile(storage) {
  const profile = { id: 'default', name: 'Default', createdAt: Date.now() };
  for (const key of LEGACY_KEYS) {
    const value = storage?.getItem(key);
    if (value == null) continue;
    storage.setItem(profileKey(profile.id, key), value);
    storage.removeItem(key);
  }
  return writeRegistry(storage, { version: 1, activeProfileId: profile.id, profiles: [profile] });
}

export function initializeUserProfiles(storage = globalThis.localStorage) {
  let registry = readRegistry(storage);
  let needsSelection = false;
  if (!registry && hasLegacyData(storage)) registry = migrateLegacyProfile(storage);
  if (!registry) {
    registry = { version: 1, activeProfileId: GUEST_PROFILE_ID, profiles: [] };
    needsSelection = true;
  }
  const profile = registry.profiles.find(item => item.id === registry.activeProfileId)
    || { id: GUEST_PROFILE_ID, name: 'Guest', guest: true };
  return {
    registry,
    profile,
    isGuest: profile.id === GUEST_PROFILE_ID,
    needsSelection,
    storage: createProfileStorage(storage, profile.id)
  };
}

export function createUserProfile(storage, name, { id = '' } = {}) {
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!cleanName) throw new Error('Enter a profile name.');
  const registry = readRegistry(storage) || { version: 1, activeProfileId: GUEST_PROFILE_ID, profiles: [] };
  if (registry.profiles.some(profile => profile.name.toLowerCase() === cleanName.toLowerCase())) {
    throw new Error('A profile with this name already exists.');
  }
  const generatedId = id || `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  if (!/^[a-z0-9_-]+$/i.test(generatedId) || generatedId === GUEST_PROFILE_ID) throw new Error('Invalid profile identifier.');
  const profile = { id: generatedId, name: cleanName, createdAt: Date.now() };
  registry.profiles.push(profile);
  writeRegistry(storage, registry);
  return profile;
}

export function selectUserProfile(storage, profileId) {
  const registry = readRegistry(storage) || { version: 1, activeProfileId: GUEST_PROFILE_ID, profiles: [] };
  if (profileId !== GUEST_PROFILE_ID && !registry.profiles.some(profile => profile.id === profileId)) return false;
  registry.activeProfileId = profileId;
  writeRegistry(storage, registry);
  return true;
}

export function clearUserProfileStorage(storage, profileId) {
  if (!profileId || profileId === GUEST_PROFILE_ID) return;
  const prefix = `${PROFILE_PREFIX}${profileId}:`;
  const keys = [];
  for (let index = 0; index < Number(storage?.length || 0); index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

export function deleteUserProfile(storage, profileId) {
  if (!profileId || profileId === GUEST_PROFILE_ID) return false;
  const registry = readRegistry(storage);
  if (!registry?.profiles.some(profile => profile.id === profileId)) return false;
  registry.profiles = registry.profiles.filter(profile => profile.id !== profileId);
  if (registry.activeProfileId === profileId) registry.activeProfileId = GUEST_PROFILE_ID;
  clearUserProfileStorage(storage, profileId);
  writeRegistry(storage, registry);
  return true;
}

export function listUserProfiles(storage = globalThis.localStorage) {
  return readRegistry(storage)?.profiles || [];
}
