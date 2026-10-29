import { normalizeConfig, SETTINGS_VERSION, STORAGE_KEYS } from './config.js';

export const CONFIG_BACKUP_KEY = 'configMigrationBackup';
let operations = Promise.resolve();

function serialize(action) {
  const run = () => globalThis.navigator?.locks?.request
    ? navigator.locks.request('smart-download-organizer-settings', action)
    : action();
  const result = operations.then(run);
  operations = result.catch(() => {});
  return result;
}

function getRaw() {
  return new Promise((resolve, reject) => chrome.storage.local.get(null, result => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve(result || {});
  }));
}

function setRaw(value) {
  return new Promise((resolve, reject) => chrome.storage.local.set(value, () => {
    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
    else resolve();
  }));
}

function snapshot(raw) {
  return Object.fromEntries(Object.entries(raw).filter(([key]) => key !== CONFIG_BACKUP_KEY));
}

async function backup(raw) {
  if (raw[CONFIG_BACKUP_KEY]) return;
  await setRaw({ [CONFIG_BACKUP_KEY]: {
    settingsVersion: raw.settingsVersion ?? 1,
    createdAt: new Date().toISOString(),
    config: snapshot(raw)
  } });
}

async function load(reason, existing) {
  const raw = existing || await getRaw();
  const version = raw.settingsVersion;
  if (version !== undefined && (!Number.isInteger(version) || version < 1 || version > SETTINGS_VERSION)) throw new TypeError('VERSION');
  if (version === SETTINGS_VERSION) return normalizeConfig(raw, { fallbackLanguage: 'zh' });

  const legacy = reason === 'update' || STORAGE_KEYS.some(key => Object.hasOwn(raw, key));
  if (legacy) await backup(raw);
  const input = legacy ? {
    ...raw,
    settingsVersion: version ?? 1,
    rules: raw.rules === undefined ? [] : raw.rules,
    language: raw.language === undefined ? 'en' : raw.language
  } : { rules: [] };
  const normalized = normalizeConfig(input, { fallbackLanguage: 'zh' });
  await setRaw(normalized);
  return normalized;
}

export function initializeConfig(reason) {
  return serialize(() => load(reason));
}

export function readConfig() {
  return initializeConfig();
}

export function readOriginalConfig() {
  return serialize(async () => snapshot(await getRaw()));
}

export function writeStorage(value, { replace = false } = {}) {
  return serialize(async () => {
    const raw = await getRaw();
    if (replace) {
      const normalized = normalizeConfig(value);
      if (STORAGE_KEYS.some(key => Object.hasOwn(raw, key))) await backup(raw);
      await setRaw(normalized);
    } else {
      await load(undefined, raw);
      await setRaw(value);
    }
  });
}
export function subscribeEnabled(listener) {
  const changed = (changes, area) => { if (area === 'local' && changes.enabled) listener(changes.enabled.newValue !== false); };
  chrome.storage.onChanged?.addListener(changed);
  return () => chrome.storage.onChanged?.removeListener(changed);
}
