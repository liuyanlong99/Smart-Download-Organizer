import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, normalizeRule, createDomainRule, normalizeCategories, normalizeExtensions, getDefaultCategories, nextCategoryName, resolveDownload, resolveGlobalPreview, formatDate, normalizeDateFormat } from '../src/config.js';
const now = new Date(2026, 8, 11);
const item = (filename = 'photo.jpg', domain = 'example.com') => ({ filename, url: `https://${domain}/file` });
const defaults = overrides => normalizeConfig({ rules: [], language: 'zh', ...overrides });
const custom = (name, extensions, extra = {}) => ({ id: `custom_${name}`, name, extensions, enabled: true, dateMode: 'inherit', dateFormat: '', ...extra });
const route = (config, file = item()) => resolveDownload(file, config, now).filename;

test('new category defaults create type folders without date folders', () => {
  assert.ok(getDefaultCategories().every(category => category.dateMode === 'off'));
  assert.equal(route(defaults()), '图片/photo.jpg');
  const config = defaults({ defaultSettings: { enableDomain: true, enableFileType: true, enableDate: true }, categories: getDefaultCategories() });
  assert.equal(route(config), 'example.com/图片/photo.jpg');
});

test('category date settings override global defaults and preserve saved inheritance', () => {
  const categories = getDefaultCategories(); categories[0].dateMode = 'inherit';
  const config = defaults({ categories });
  assert.equal(route(config), '图片/2026-09-11/photo.jpg');
  config.categories[0].dateMode = 'off';
  assert.equal(route(config), '图片/photo.jpg');
  config.defaultSettings.enableDate = false; config.categories[0].dateMode = 'on'; config.categories[0].dateFormat = 'YYYY/MM';
  assert.equal(route(config), '图片/2026/09/photo.jpg');
});

test('global preview follows every combination of the three main controls', () => {
  for (const enableDomain of [false, true]) for (const enableFileType of [false, true]) for (const enableDate of [false, true]) {
    const categories = getDefaultCategories(); categories[0].enabled = false;
    const config = defaults({ categories, defaultSettings: { enableDomain, enableFileType, enableDate } });
    const expected = [enableDomain ? 'example.com' : '', enableFileType ? '图片' : '', enableDate ? '2026-09-11' : '', 'photo.jpg'].filter(Boolean).join('/');
    assert.equal(resolveGlobalPreview(item(), config, now).filename, expected, JSON.stringify({ enableDomain, enableFileType, enableDate }));
  }
});

test('global preview bypasses domain and category overrides without changing actual download behavior', () => {
  const config = defaults({ rules: [{ ...createDomainRule('example.com'), path: '网站专属' }] });
  const before = structuredClone(config);
  assert.equal(resolveGlobalPreview(item(), config, now).filename, '图片/2026-09-11/photo.jpg');
  assert.equal(route(config), '网站专属/photo.jpg');
  assert.deepEqual(config, before);
});

test('global preview uses the global date format while downloads keep the category format', () => {
  const categories = getDefaultCategories(); categories[0].dateMode = 'on'; categories[0].dateFormat = 'YYYYMMDD';
  const config = defaults({ categories, defaultSettings: { enableDomain: false, enableFileType: true, enableDate: true, dateFormat: 'YYYY/MM' } });
  assert.equal(resolveGlobalPreview(item(), config, now).filename, '图片/2026/09/photo.jpg');
  assert.equal(route(config), '图片/20260911/photo.jpg');
});

test('global preview respects pause state and localized system folder names', () => {
  const config = defaults({ enabled: false, language: 'en' });
  const paused = resolveGlobalPreview(item(), config, now);
  assert.equal(paused.paused, true); assert.equal(paused.filename, 'photo.jpg');
  config.enabled = true;
  assert.equal(resolveGlobalPreview(item(), config, now).filename, 'Images/2026-09-11/photo.jpg');
});

test('legacy configurations without category settings keep their global date behavior', () => {
  const config = defaults({ settingsVersion: 2, defaultSettings: { enableDomain: false, enableFileType: true, enableDate: true } });
  assert.equal(route(config), '图片/2026-09-11/photo.jpg');
  assert.ok(config.categories.every(category => category.dateMode === 'inherit'));
});

test('new unnamed category names skip existing and disabled names', () => {
  const categories = getDefaultCategories();
  assert.equal(nextCategoryName(categories), '未命名01');
  categories.push(custom('A', ['foo'], { name: '未命名01' }), custom('B', ['bar'], { name: '未命名02', enabled: false }));
  assert.equal(nextCategoryName(categories), '未命名03');
  categories[8].name = '素材';
  assert.equal(nextCategoryName(categories), '未命名01');
});

test('English unnamed categories reserve names without case or whitespace differences', () => {
  const categories = [custom('A', ['foo'], { name: 'untitled01' }), custom('B', ['bar'], { name: ' Untitled02 ', enabled: false })];
  assert.equal(nextCategoryName(categories, 'en'), 'Untitled03');
});

test('category names cannot duplicate custom or localized built-in names', () => {
  assert.throws(() => normalizeCategories([custom('Design', ['foo']), custom('design', ['bar'], { enabled: false })]), /CATEGORY_NAME_DUPLICATE/);
  assert.throws(() => normalizeCategories([custom('Images', ['foo'])]), /CATEGORY_NAME_DUPLICATE/);
  assert.throws(() => normalizeCategories([custom('A', ['foo'], { name: '图片' })]), /CATEGORY_NAME_DUPLICATE/);
  assert.throws(() => normalizeCategories([custom('Design', ['foo']), custom('design', ['bar'])], { scope: 'domain' }), /CATEGORY_NAME_DUPLICATE/);
});

test('new categories remain above system categories after normalization and saving', () => {
  const categories = getDefaultCategories();
  categories.unshift(custom('First', ['first'])); categories.unshift(custom('Newest', ['newest']));
  const config = defaults({ categories });
  assert.deepEqual(config.categories.slice(0, 2).map(category => category.name), ['Newest', 'First']);
  const restored = normalizeConfig(JSON.parse(JSON.stringify(config)));
  assert.deepEqual(restored.categories.map(category => category.id), categories.map(category => category.id));
});

test('new domain rules remain first after saving and take precedence over earlier matches', () => {
  const rules = [{ ...createDomainRule('*.example.com'), path: 'Earlier' }];
  rules.unshift({ ...createDomainRule('example.com'), path: 'Newest' });
  const restored = normalizeConfig(JSON.parse(JSON.stringify(defaults({ rules }))));
  assert.deepEqual(restored.rules.map(rule => rule.path), ['Newest', 'Earlier']);
  assert.equal(route(restored), 'Newest/photo.jpg');
});
test('master switch bypasses every configured folder', () => {
  assert.equal(route(defaults({ enabled: false })), 'photo.jpg');
});
test('legacy v2 settings preserve aliases, classification and explicit date switches', () => {
  const config = normalizeConfig({ settingsVersion: 2, rules: [{ domain: '*.example.com', path: 'Work/Files', enableFileType: true, enableDate: false }], language: 'en' });
  assert.equal(config.settingsVersion, 3);
  assert.equal(route(config), 'Work/Files/Images/photo.jpg');
  assert.equal(config.rules[0].dateMode, 'off');
});
test('blank alias falls back to the actual subdomain', () => {
  const config = defaults({ rules: [{ domain: '*.example.com', path: '', enableFileType: false, dateMode: 'off' }] });
  assert.equal(route(config, item('photo.jpg', 'a.example.com')), 'a.example.com/photo.jpg');
});

test('new domain rules start enabled with type and date folders off and keep the full matching domain', () => {
  const rule = createDomainRule('*.example.com');
  assert.equal(rule.enabled, true); assert.equal(rule.enableFileType, false); assert.equal(rule.dateMode, 'off'); assert.equal(rule.dateFormat, 'YYYY-MM-DD');
  const config = defaults({ rules: [rule] });
  assert.equal(route(config, item('photo.jpg', 'a.b.example.com')), 'a.b.example.com/photo.jpg');
  config.rules[0].path = '工作/素材';
  assert.equal(route(config, item('photo.jpg', 'a.b.example.com')), '工作/素材/photo.jpg');
});

test('domain folder toggles apply independently and explicit formats do not follow the global format', () => {
  const rule = createDomainRule('example.com');
  const config = defaults({ rules: [rule], defaultSettings: { enableDomain: false, enableFileType: true, enableDate: true, dateFormat: 'YYYY/MM' } });
  config.rules[0].enableFileType = true;
  assert.equal(route(config), 'example.com/图片/photo.jpg');
  config.rules[0].dateMode = 'on';
  assert.equal(route(config), 'example.com/图片/2026-09-11/photo.jpg');
  config.rules[0].enableFileType = false;
  assert.equal(route(config), 'example.com/2026-09-11/photo.jpg');
  config.rules[0].dateFormat = 'YYYYMMDD';
  assert.equal(route(config), 'example.com/20260911/photo.jpg');
});

test('disabled domain rules are skipped and their state survives configuration serialization', () => {
  const first = { ...createDomainRule('*.example.com'), enabled: false, path: 'Disabled' };
  const next = { ...createDomainRule('example.com'), path: 'Active' };
  const config = defaults({ rules: [first, next] });
  assert.equal(route(config), 'Active/photo.jpg');
  config.rules[1].enabled = false;
  assert.equal(route(config), '图片/photo.jpg');
  const restored = normalizeConfig(JSON.parse(JSON.stringify(config)));
  assert.equal(restored.rules[0].enabled, false); assert.equal(restored.rules[1].enabled, false);
  assert.equal(route(restored), '图片/photo.jpg');
  assert.equal(normalizeRule({ domain: 'example.com' }).enabled, true);
});
test('domain types override global types and unmatched suffixes fall back to global', () => {
  const config = defaults({ rules: [{ domain: 'example.com', path: '工作', types: [custom('Design', ['jpg'])] }] });
  assert.equal(route(config), '工作/Design/2026-09-11/photo.jpg');
  assert.equal(route(config, item('report.pdf')), '工作/文档/report.pdf');
  assert.equal(route(config, item('photo.jpg', 'other.com')), '图片/photo.jpg');
});
test('date precedence resolves domain before type before default, independently per property', () => {
  const categories = getDefaultCategories(); categories[0].dateMode = 'off'; categories[0].dateFormat = 'YYYY/MM';
  let config = defaults({ categories });
  assert.equal(route(config), '图片/photo.jpg');
  config = defaults({ categories, rules: [{ domain: 'example.com', dateMode: 'on', dateFormat: 'YYYY年MM月' }] });
  assert.equal(route(config), 'example.com/图片/2026年09月/photo.jpg');
  config.rules[0].dateFormat = '';
  assert.equal(route(config), 'example.com/图片/2026/09/photo.jpg');
  config.rules[0].dateMode = 'off';
  assert.equal(route(config), 'example.com/图片/photo.jpg');
});
test('domain-specific category date settings are used before the global default', () => {
  const config = defaults({ rules: [{ domain: 'example.com', types: [custom('Design', ['jpg'], { dateMode: 'on', dateFormat: 'YYYYMMDD' })] }] });
  assert.equal(route(config), 'example.com/Design/20260911/photo.jpg');
});
test('custom names, longest compound extension and disabled categories', () => {
  const config = defaults({ categories: [custom('Bundles', ['tar.gz'])] });
  assert.equal(route(config, item('backup.TAR.GZ')), 'Bundles/2026-09-11/backup.TAR.GZ');
  config.categories.find(c => c.id === 'images').enabled = false;
  assert.equal(route(config), '2026-09-11/photo.jpg');
});
test('suffix validation canonicalizes dots and case and rejects malformed or duplicate values', () => {
  assert.deepEqual(normalizeExtensions('.JPG, png .tar.gz'), ['jpg', 'png', 'tar.gz']);
  for (const invalid of ['', '*.jpg', '..png', 'image/png', 'jpg?x', '.jpg JPG']) assert.throws(() => normalizeExtensions(invalid));
  assert.throws(() => normalizeCategories([custom('Other', ['jpg'])]), /EXTENSION_DUPLICATE/);
  assert.throws(() => normalizeCategories([custom('A', ['foo']), custom('B', ['FOO'], { enabled: false })]), /EXTENSION_DUPLICATE/);
  assert.doesNotThrow(() => normalizeCategories([custom('Local', ['jpg'])], { scope: 'domain' }));
});
test('built-in names and extension mappings cannot be modified via imports', () => {
  let list = getDefaultCategories(); list[0].name = 'Renamed';
  assert.throws(() => normalizeCategories(list), /BUILTIN_READONLY/);
  list = getDefaultCategories(); list[0].extensions = ['fake'];
  assert.throws(() => normalizeCategories(list), /BUILTIN_READONLY/);
  assert.equal(normalizeCategories(list, { strict: false })[0].extensions[0], 'jpg');
});
test('date patterns are constrained to safe, useful folder templates', () => {
  assert.equal(formatDate(now, 'YYYY/MM/DD'), '2026/09/11');
  assert.equal(formatDate(now, 'YYYY年MM月DD日'), '2026年09月11日');
  for (const value of ['../YYYY', 'YYYY/../MM', '/YYYY', 'YYYY:MM', 'YYYY-YYYY', 'YY/MM', 'YYYY/<x>', 'YYYY//MM']) assert.throws(() => normalizeDateFormat(value));
});
test('malformed v3 flags, dates and categories fail strict import without accepting partial data', () => {
  assert.throws(() => defaults({ enabled: 'false' }));
  assert.throws(() => defaults({ categories: 'broken' }));
  assert.throws(() => defaults({ rules: [{ domain: 'example.com', dateMode: 'maybe' }] }));
  assert.throws(() => defaults({ rules: [{ domain: 'example.com', enabled: 'false' }] }));
  assert.throws(() => defaults({ defaultSettings: { dateFormat: '../YYYY' } }));
  assert.throws(() => defaults({ settingsVersion: 99 }));
});
test('unknown file types skip only the type folder and first domain rule wins', () => {
  const config = defaults({ rules: [{ domain: '*.example.com', path: 'First' }, { domain: 'example.com', path: 'Second' }] });
  assert.equal(route(config, item('unknown.xyz')), 'First/2026-09-11/unknown.xyz');
});
