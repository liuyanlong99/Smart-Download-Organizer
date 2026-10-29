import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDownloadPath,
  getDateString,
  getDefaultSettings,
  getDownloadDomain,
  getFileCategory,
  matchesDomain,
  normalizeDomainPattern,
  normalizeRelativePath,
  normalizeSettings
} from '../src/core.js';

test('classifies common file extensions in English', () => {
  assert.equal(getFileCategory('photo.JPG', 'en'), 'Images');
  assert.equal(getFileCategory('report.pdf', 'en'), 'Documents');
  assert.equal(getFileCategory('source.js', 'en'), 'Code');
});

test('classifies common file extensions in Chinese', () => {
  assert.equal(getFileCategory('photo.png', 'zh'), '图片');
  assert.equal(getFileCategory('archive.zip', 'zh'), '压缩包');
  assert.equal(getFileCategory('music.flac', 'zh'), '音频');
});

test('returns an empty category for an unknown extension', () => {
  assert.equal(getFileCategory('download.unknown', 'en'), '');
  assert.equal(getFileCategory('pdf', 'en'), '');
});

test('formats local dates as YYYY-MM-DD', () => {
  assert.equal(getDateString(new Date(2026, 7, 9)), '2026-08-09');
});

test('uses the referring page as the download domain when available', () => {
  assert.equal(getDownloadDomain({
    referrer: 'https://www.example.com/page',
    finalUrl: 'https://cdn.example.net/file.zip',
    url: 'https://redirect.example.org/file.zip'
  }), 'www.example.com');
});

test('falls back from final URL to the original URL without guessing another tab', () => {
  assert.equal(getDownloadDomain({ finalUrl: 'https://cdn.example.net/file.zip' }), 'cdn.example.net');
  assert.equal(getDownloadDomain({ url: 'https://downloads.example.org/file.zip' }), 'downloads.example.org');
  assert.equal(getDownloadDomain({}), '');
});

test('leaves domain folders off by default and preserves explicit and legacy settings', () => {
  assert.deepEqual(getDefaultSettings(undefined), {
    enableDomain: false,
    enableFileType: true,
    enableDate: true
  });
  assert.deepEqual(getDefaultSettings({ enableDomain: true, enableFileType: true, enableDate: true }), {
    enableDomain: true,
    enableFileType: true,
    enableDate: true
  });
  assert.deepEqual(getDefaultSettings({ enableFileType: false, enableDate: true }), {
    enableDomain: false,
    enableFileType: false,
    enableDate: true
  });
});

test('matches exact domains and wildcard domains without building a regular expression', () => {
  assert.equal(matchesDomain('example.com', 'example.com'), true);
  assert.equal(matchesDomain('example.com', 'www.example.com'), false);
  assert.equal(matchesDomain('*.example.com', 'example.com'), true);
  assert.equal(matchesDomain('*.example.com', 'a.example.com'), true);
  assert.equal(matchesDomain('*.example.com', 'a.b.example.com'), true);
  assert.equal(matchesDomain('*.example.com', 'notexample.com'), false);
});

test('normalizes domains and rejects ambiguous wildcard syntax', () => {
  assert.equal(normalizeDomainPattern(' Example.COM. '), 'example.com');
  assert.equal(normalizeDomainPattern('*.例子.测试'), '*.xn--fsqu00a.xn--0zwm56d');
  assert.throws(() => normalizeDomainPattern('foo*bar.example.com'));
  assert.throws(() => normalizeDomainPattern('https://example.com'));
});

test('normalizes safe relative paths and rejects traversal or absolute paths', () => {
  assert.equal(normalizeRelativePath('Work\\Reports'), 'Work/Reports');
  assert.equal(normalizeRelativePath('Work:Files'), 'Work_Files');
  assert.throws(() => normalizeRelativePath('../Secrets'));
  assert.throws(() => normalizeRelativePath('C:\\Secrets'));
  assert.throws(() => normalizeRelativePath('/Secrets'));
});

test('builds a safe path for matched and unmatched downloads', () => {
  assert.equal(buildDownloadPath({
    rulePath: 'Work/Reports',
    domain: 'example.com',
    fileType: 'Documents',
    date: '2026-08-19',
    fileName: 'report?.pdf',
    settings: { enableFileType: true, enableDate: true }
  }), 'Work/Reports/Documents/2026-08-19/report_.pdf');

  assert.equal(buildDownloadPath({
    domain: 'example.com',
    fileType: 'Images',
    date: '2026-08-19',
    fileName: 'photo.png',
    settings: { enableDomain: true, enableFileType: true, enableDate: true }
  }), 'example.com/Images/2026-08-19/photo.png');
});

test('normalizes imported settings to a whitelist and migrates version 1 data', () => {
  const settings = normalizeSettings({
    rules: [{
      domain: '*.Example.com',
      path: 'Work\\Files',
      enableFileType: true,
      enableDate: false,
      injected: '<script>'
    }],
    defaultSettings: { enableFileType: true, enableDate: true },
    language: 'zh',
    unexpected: 'discard me'
  });

  assert.deepEqual(settings, {
    settingsVersion: 2,
    rules: [{
      domain: '*.example.com',
      path: 'Work/Files',
      enableFileType: true,
      enableDate: false
    }],
    defaultSettings: {
      enableDomain: false,
      enableFileType: true,
      enableDate: true
    },
    language: 'zh'
  });
});

test('rejects malformed or excessive imported settings', () => {
  assert.throws(() => normalizeSettings({ rules: 'not-an-array' }));
  assert.throws(() => normalizeSettings({
    rules: [{
      domain: 'example.com',
      path: '../outside',
      enableFileType: true,
      enableDate: true
    }]
  }));
  assert.throws(() => normalizeSettings({
    rules: [{
      domain: 'example.com',
      path: 'Safe',
      enableFileType: 'true',
      enableDate: true
    }]
  }));
  assert.throws(() => normalizeSettings({
    rules: Array.from({ length: 201 }, () => ({
      domain: 'example.com',
      path: 'Safe',
      enableFileType: true,
      enableDate: true
    }))
  }));
  assert.throws(() => normalizeSettings({
    rules: [],
    defaultSettings: { enableFileType: 'true' }
  }));
  assert.throws(() => normalizeSettings({
    settingsVersion: 99,
    rules: []
  }));
});
