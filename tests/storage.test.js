import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, resolveDownload } from '../src/config.js';

let stored;
let writes;
let failedWrite;
globalThis.chrome = {
  runtime: { lastError: undefined },
  storage: { local: {
    get(keys, callback) {
      assert.equal(keys, null);
      queueMicrotask(() => callback(structuredClone(stored)));
    },
    set(value, callback) {
      writes.push(structuredClone(value));
      queueMicrotask(() => {
        if (failedWrite?.(value)) {
          chrome.runtime.lastError = { message: 'Storage write failed' };
          callback();
          chrome.runtime.lastError = undefined;
        } else {
          Object.assign(stored, structuredClone(value));
          callback();
        }
      });
    }
  } }
};
const { CONFIG_BACKUP_KEY, initializeConfig, readConfig, readOriginalConfig, writeStorage } = await import('../src/storage.js');
const date = new Date(2026, 8, 11);
const item = { filename: 'photo.jpg', url: 'https://example.com/photo.jpg' };
const pathFor = config => resolveDownload(item, config, date).filename;
const withoutBackup = () => Object.fromEntries(Object.entries(stored).filter(([key]) => key !== CONFIG_BACKUP_KEY));

beforeEach(() => {
  stored = {};
  writes = [];
  failedWrite = undefined;
  chrome.runtime.lastError = undefined;
});

test('a fresh install persists modern defaults without a migration backup', async () => {
  const config = await initializeConfig('install');
  assert.equal(config.settingsVersion, 3);
  assert.equal(config.language, 'zh');
  assert.equal(pathFor(config), '图片/photo.jpg');
  assert.deepEqual(stored, config);
  assert.equal(writes.length, 1);
});

test('language-only legacy settings keep their old date behavior and a complete backup', async () => {
  stored = { language: 'en', otherLegacyField: 'preserved' };
  const original = structuredClone(stored);
  const config = await readConfig();
  assert.equal(pathFor(config), 'Images/2026-09-11/photo.jpg');
  assert.deepEqual(stored[CONFIG_BACKUP_KEY].config, original);
  assert.equal(stored[CONFIG_BACKUP_KEY].settingsVersion, 1);
  assert.ok(!Number.isNaN(Date.parse(stored[CONFIG_BACKUP_KEY].createdAt)));
  assert.equal(stored.otherLegacyField, 'preserved');
  assert.equal(writes.length, 2);
  assert.ok(writes[0][CONFIG_BACKUP_KEY]);
});

test('an update with empty legacy storage keeps legacy English and date defaults', async () => {
  const config = await initializeConfig('update');
  assert.equal(config.language, 'en');
  assert.equal(pathFor(config), 'Images/2026-09-11/photo.jpg');
  assert.deepEqual(stored[CONFIG_BACKUP_KEY].config, {});
});

test('legacy aliases, switches, date format and rule order survive migration', async () => {
  stored = {
    settingsVersion: 2, enabled: false, language: 'en',
    defaultSettings: { enableDomain: true, enableFileType: true, enableDate: false, dateFormat: 'YYYY/MM' },
    rules: [
      { domain: '*.example.com', path: 'Work/Files', enabled: false, enableFileType: false, enableDate: false },
      { domain: 'example.com', path: 'Photos', enableFileType: true, enableDate: true }
    ]
  };
  const original = structuredClone(stored);
  const config = await readConfig();
  assert.equal(config.enabled, false);
  assert.equal(pathFor({ ...config, enabled: true }), 'Photos/Images/2026/09/photo.jpg');
  assert.deepEqual(config.rules.map(rule => [rule.path, rule.enabled, rule.dateMode]), [
    ['Work/Files', false, 'off'], ['Photos', true, 'on']
  ]);
  assert.equal(config.defaultSettings.enableDomain, true);
  assert.equal(config.defaultSettings.enableDate, false);
  assert.deepEqual(stored[CONFIG_BACKUP_KEY].config, original);
});

test('repeated reads do not rewrite modern settings or the first backup', async () => {
  stored = { language: 'en' };
  const first = await readConfig();
  const backup = structuredClone(stored[CONFIG_BACKUP_KEY]);
  const count = writes.length;
  assert.deepEqual(await readConfig(), first);
  assert.deepEqual(await initializeConfig('update'), first);
  assert.equal(writes.length, count);
  assert.deepEqual(stored[CONFIG_BACKUP_KEY], backup);
});

test('malformed or oversized legacy settings are backed up without silently dropping rules', async () => {
  for (const invalid of [
    { rules: [{ domain: 'https://bad.example.com/path' }] },
    { rules: Array.from({ length: 201 }, () => ({ domain: 'example.com' })) },
    { rules: 'broken' },
    { enabled: 'false' },
    { categories: 'broken' }
  ]) {
    stored = structuredClone(invalid);
    writes = [];
    await assert.rejects(readConfig());
    assert.deepEqual(withoutBackup(), invalid);
    assert.deepEqual(stored[CONFIG_BACKUP_KEY].config, invalid);
    assert.deepEqual(await readOriginalConfig(), invalid);
    assert.equal(writes.length, 1);
  }
});

test('unsupported versions are neither downgraded nor changed and remain exportable', async () => {
  for (const version of [99, null, '3', 0, 2.5]) {
    stored = { settingsVersion: version, language: 'en', futureOption: { rules: ['future'] } };
    const original = structuredClone(stored);
    await assert.rejects(readConfig(), /VERSION/);
    assert.deepEqual(stored, original);
    assert.deepEqual(await readOriginalConfig(), original);
    assert.equal(writes.length, 0);
    assert.throws(() => normalizeConfig(original, { strict: false }), /VERSION/);
  }
});

test('a failed backup prevents any migration write', async () => {
  stored = { language: 'en' };
  failedWrite = value => Object.hasOwn(value, CONFIG_BACKUP_KEY);
  await assert.rejects(readConfig(), /Storage write failed/);
  assert.deepEqual(stored, { language: 'en' });
  assert.equal(writes.length, 1);
});

test('a failed migration can retry using the unchanged original backup', async () => {
  stored = { language: 'en' };
  failedWrite = value => Object.hasOwn(value, 'settingsVersion');
  await assert.rejects(readConfig(), /Storage write failed/);
  assert.deepEqual(withoutBackup(), { language: 'en' });
  const backup = structuredClone(stored[CONFIG_BACKUP_KEY]);
  failedWrite = undefined;
  assert.equal(pathFor(await readConfig()), 'Images/2026-09-11/photo.jpg');
  assert.deepEqual(stored[CONFIG_BACKUP_KEY], backup);
});

test('language and enabled writes are serialized and never turn fresh defaults into legacy settings', async () => {
  await Promise.all([writeStorage({ language: 'en' }), writeStorage({ enabled: false })]);
  const config = await readConfig();
  assert.equal(config.language, 'en');
  assert.equal(config.enabled, false);
  assert.equal(pathFor({ ...config, enabled: true }), 'Images/photo.jpg');
  assert.equal(stored[CONFIG_BACKUP_KEY], undefined);
});

test('an explicit corrected import can recover unsupported settings without losing their backup', async () => {
  stored = { settingsVersion: 99, futureOption: true };
  const original = structuredClone(stored);
  await assert.rejects(readConfig(), /VERSION/);
  const corrected = normalizeConfig({ rules: [], language: 'en' });
  await writeStorage(corrected, { replace: true });
  assert.deepEqual(await readConfig(), corrected);
  assert.deepEqual(stored[CONFIG_BACKUP_KEY].config, original);
  const backup = structuredClone(stored[CONFIG_BACKUP_KEY]);
  await writeStorage({ ...corrected, enabled: false }, { replace: true });
  assert.deepEqual(stored[CONFIG_BACKUP_KEY], backup);
});

test('invalid imports do not modify stored settings', async () => {
  stored = normalizeConfig({ rules: [], language: 'zh' });
  const original = structuredClone(stored);
  await assert.rejects(writeStorage({ rules: 'broken' }, { replace: true }), /RULES/);
  assert.deepEqual(stored, original);
  assert.equal(writes.length, 0);
});
