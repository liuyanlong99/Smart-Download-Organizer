import test from 'node:test';
import assert from 'node:assert/strict';

let downloadListener;
let storedSettings = {};
let requestedKeys;

globalThis.chrome = {
  downloads: {
    onDeterminingFilename: {
      addListener(listener) {
        downloadListener = listener;
      }
    }
  },
  storage: {
    local: {
      get(keys, callback) {
        requestedKeys = keys;
        callback(structuredClone(storedSettings));
      },
      set(value, callback) {
        Object.assign(storedSettings, structuredClone(value));
        callback();
      }
    }
  },
  runtime: {
    lastError: undefined
  }
};

await import('../background.js');

function determineFilename(item) {
  return new Promise(resolve => {
    const returnedAsync = downloadListener(item, resolve);
    assert.equal(returnedAsync, true);
  });
}

test('new installs use type folders with category date creation disabled by default', async () => {
  storedSettings = {};
  const suggestion = await determineFilename({ filename: 'photo.jpg', url: 'https://example.com/photo.jpg' });
  assert.equal(suggestion.filename, '图片/photo.jpg');
  assert.equal(suggestion.conflictAction, 'uniquify');
});

test('background organizes an unmatched download by source domain, type, and date', async () => {
  storedSettings = {
    rules: [],
    defaultSettings: {
      enableDomain: true,
      enableFileType: true,
      enableDate: false
    },
    language: 'en'
  };

  const suggestion = await determineFilename({
    filename: 'C:\\Downloads\\report.pdf',
    referrer: 'https://portal.example.com/reports',
    finalUrl: 'https://cdn.example.net/report.pdf'
  });

  assert.deepEqual(suggestion, {
    filename: 'portal.example.com/Documents/report.pdf',
    conflictAction: 'uniquify'
  });
});

test('background applies the first matching custom domain rule', async () => {
  storedSettings = {
    rules: [{
      domain: '*.example.com',
      path: 'Work/Example',
      enableFileType: false,
      enableDate: false
    }],
    defaultSettings: {
      enableDomain: true,
      enableFileType: true,
      enableDate: true
    },
    language: 'en'
  };

  const suggestion = await determineFilename({
    filename: 'C:\\Downloads\\archive.zip',
    url: 'https://a.b.example.com/archive.zip'
  });

  assert.deepEqual(suggestion, {
    filename: 'Work/Example/archive.zip',
    conflictAction: 'uniquify'
  });
});

test('worker ignores disabled domain rules and uses the next enabled match', async () => {
  storedSettings = { language: 'en', rules: [
    { domain: '*.example.com', path: 'Disabled', enabled: false, enableFileType: false, dateMode: 'off' },
    { domain: 'example.com', path: 'Active', enabled: true, enableFileType: false, dateMode: 'off' }
  ] };
  assert.deepEqual(await determineFilename({ filename: 'photo.jpg', url: 'https://example.com/photo.jpg' }), {
    filename: 'Active/photo.jpg', conflictAction: 'uniquify'
  });
});

test('paused organizer leaves the browser filename untouched', async () => {
  storedSettings = { enabled: false };
  assert.equal(await determineFilename({ filename: 'photo.jpg', url: 'https://example.com/photo.jpg' }), undefined);
});

test('worker reads v3 settings and applies domain-specific types and date format', async () => {
  storedSettings = {
    settingsVersion: 3, enabled: true, language: 'en',
    rules: [{ domain: 'example.com', path: 'Design', dateMode: 'on', dateFormat: 'YYYY',
      types: [{ id: 'custom_assets', name: 'Assets', extensions: ['jpg'], enabled: true, dateMode: 'off', dateFormat: '' }] }]
  };
  assert.deepEqual(await determineFilename({ filename: 'photo.jpg', url: 'https://example.com/photo.jpg' }), {
    filename: `Design/Assets/${new Date().getFullYear()}/photo.jpg`, conflictAction: 'uniquify'
  });
  assert.equal(requestedKeys, null);
});

test('invalid saved settings let the download proceed without rewriting its filename', async t => {
  t.mock.method(console, 'error', () => {});
  storedSettings = { settingsVersion: 99, language: 'en', futureOption: true };
  const original = structuredClone(storedSettings);
  let suggestions = 0;
  await new Promise(resolve => {
    assert.equal(downloadListener({ filename: 'photo.jpg', url: 'https://example.com/photo.jpg' }, value => {
      suggestions++;
      assert.equal(value, undefined);
      resolve();
    }), true);
  });
  assert.equal(suggestions, 1);
  assert.deepEqual(storedSettings, original);
});
