import { FILE_TYPE_MAP, getDefaultSettings, getDownloadDomain, matchesDomain, normalizeDomainPattern, normalizeRelativePath, sanitizePathSegment } from './core.js';

export const SETTINGS_VERSION = 3;
export const MAX_RULES = 200;
export const MAX_CATEGORIES = 100;
export const STORAGE_KEYS = ['settingsVersion', 'enabled', 'rules', 'categories', 'defaultSettings', 'language'];
export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';
export const DATE_FORMATS = ['YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY-MM', 'YYYY/MM', 'YYYYMMDD', 'YYYY年MM月DD日'];
const CATEGORY_IDS = ['images', 'documents', 'archives', 'videos', 'audio', 'code', 'executables', 'fonts'];

export function getDefaultCategories() {
  return Object.values(FILE_TYPE_MAP.en).map((extensions, index) => ({
    id: CATEGORY_IDS[index], builtin: true, name: '', extensions: [...extensions], enabled: true, dateMode: 'off', dateFormat: ''
  }));
}
export function categoryName(category, language = 'en') {
  return category.builtin ? Object.keys(FILE_TYPE_MAP[language] || FILE_TYPE_MAP.en)[CATEGORY_IDS.indexOf(category.id)] : category.name;
}
export function nextCategoryName(categories, language = 'zh') {
  const occupied = new Set(categories.flatMap(category => ['zh', 'en'].map(locale => String(categoryName(category, locale) || '').trim().toLowerCase())));
  const prefix = language === 'zh' ? '未命名' : 'Untitled';
  let index = 1;
  while (occupied.has(`${prefix}${String(index).padStart(2, '0')}`.toLowerCase())) index++;
  return `${prefix}${String(index).padStart(2, '0')}`;
}
export function normalizeExtensions(value) {
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,，;；\s]+/).filter(Boolean) : [];
  if (!parts.length || parts.length > 100) throw new TypeError('EXTENSION_FORMAT');
  const result = parts.map(part => {
    if (typeof part !== 'string') throw new TypeError('EXTENSION_FORMAT');
    const extension = part.trim().replace(/^\./, '').toLowerCase();
    if (extension.length > 32 || !/^[a-z0-9]+(?:\.[a-z0-9]+)*$/.test(extension)) throw new TypeError('EXTENSION_FORMAT');
    return extension;
  });
  if (new Set(result).size !== result.length) throw new TypeError('EXTENSION_DUPLICATE');
  return result;
}
export function normalizeDateFormat(value, { allowInherit = false } = {}) {
  if (allowInherit && (value === '' || value === undefined)) return '';
  if (typeof value !== 'string' || value.length > 60 || !value.includes('YYYY')) throw new TypeError('DATE_FORMAT');
  if (/[^\-_.\/ 年月日]/.test(value.replace(/YYYY|MM|DD/g, ''))) throw new TypeError('DATE_FORMAT');
  if (['YYYY', 'MM', 'DD'].some(token => value.split(token).length > 2)) throw new TypeError('DATE_FORMAT');
  const sample = value.replace('YYYY', '2026').replace('MM', '09').replace('DD', '11');
  try { if (normalizeRelativePath(sample) !== sample) throw new Error(); } catch { throw new TypeError('DATE_FORMAT'); }
  return value;
}
export function formatDate(date = new Date(), format = DEFAULT_DATE_FORMAT) {
  normalizeDateFormat(format);
  return format.replace('YYYY', String(date.getFullYear())).replace('MM', String(date.getMonth() + 1).padStart(2, '0')).replace('DD', String(date.getDate()).padStart(2, '0'));
}
function mode(value, fallback = 'inherit') {
  if (value === undefined) return fallback;
  if (!['inherit', 'on', 'off'].includes(value)) throw new TypeError('DATE_MODE');
  return value;
}
function bool(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new TypeError('BOOLEAN');
  return value;
}
export function normalizeCategoryName(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100 || /[<>:"/\\|?*\x00-\x1f]/.test(value) || /^\.+$/.test(value.trim())) throw new TypeError('CATEGORY_NAME');
  const name = value.trim();
  if (sanitizePathSegment(name) !== name) throw new TypeError('CATEGORY_NAME');
  return name;
}
export function normalizeCategories(input, { scope = 'global', strict = true } = {}) {
  const defaults = scope === 'global' ? getDefaultCategories() : [];
  if (input === undefined) return defaults;
  if (!Array.isArray(input) || input.length > MAX_CATEGORIES) {
    if (!strict) return defaults;
    throw new TypeError('CATEGORIES');
  }
  const result = [...defaults];
  const ids = new Set();
  const order = new Map();
  input.forEach((item, index) => { if (typeof item?.id === 'string' && !order.has(item.id)) order.set(item.id, index); });
  for (const item of input) {
    try {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id)) throw new TypeError('CATEGORY_ID');
      const built = defaults.find(category => category.id === item.id);
      if (scope !== 'global' && (item.builtin || CATEGORY_IDS.includes(item.id))) throw new TypeError('CATEGORY_ID');
      const normalized = {
        id: item.id, builtin: Boolean(built), name: built ? '' : normalizeCategoryName(item.name),
        extensions: built ? [...built.extensions] : normalizeExtensions(item.extensions),
        enabled: bool(item.enabled, true), dateMode: mode(item.dateMode), dateFormat: normalizeDateFormat(item.dateFormat, { allowInherit: true })
      };
      if (built && strict && (item.name || JSON.stringify(normalizeExtensions(item.extensions)) !== JSON.stringify(built.extensions))) throw new TypeError('BUILTIN_READONLY');
      const others = result.filter(category => category.id !== item.id);
      const occupied = new Set(others.flatMap(category => category.extensions));
      if (normalized.extensions.some(extension => occupied.has(extension))) throw new TypeError('EXTENSION_DUPLICATE');
      if (!built && others.some(category => categoryName(category, 'zh').toLowerCase() === normalized.name.toLowerCase() || categoryName(category, 'en').toLowerCase() === normalized.name.toLowerCase())) throw new TypeError('CATEGORY_NAME_DUPLICATE');
      ids.add(item.id);
      if (built) result[result.findIndex(category => category.id === item.id)] = normalized;
      else result.push(normalized);
    } catch (error) { if (strict) throw error; }
  }
  if (result.length > MAX_CATEGORIES) throw new TypeError('CATEGORIES');
  return result.sort((first, second) => (order.get(first.id) ?? input.length) - (order.get(second.id) ?? input.length));
}
export function normalizeRule(rule, { strict = true } = {}) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new TypeError('RULE');
  if (rule.enableDate !== undefined) bool(rule.enableDate, true);
  return {
    domain: normalizeDomainPattern(rule.domain), path: rule.path ? normalizeRelativePath(rule.path) : '',
    enabled: bool(rule.enabled, true),
    enableFileType: bool(rule.enableFileType, true),
    dateMode: mode(rule.dateMode, rule.enableDate === undefined ? 'inherit' : rule.enableDate ? 'on' : 'off'),
    dateFormat: normalizeDateFormat(rule.dateFormat, { allowInherit: true }),
    types: normalizeCategories(rule.types, { scope: 'domain', strict })
  };
}
export function createDomainRule(domain = '') {
  return { domain, path: '', enabled: true, enableFileType: false, dateMode: 'off', dateFormat: DEFAULT_DATE_FORMAT, types: [] };
}
export function normalizeConfig(input = {}, { strict = true, fallbackLanguage = 'en' } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('SETTINGS');
  if (input.settingsVersion !== undefined && (!Number.isInteger(input.settingsVersion) || input.settingsVersion < 1 || input.settingsVersion > SETTINGS_VERSION)) throw new TypeError('VERSION');
  if (strict && (!Array.isArray(input.rules) || input.rules.length > MAX_RULES)) throw new TypeError('RULES');
  if (strict && input.defaultSettings !== undefined && (!input.defaultSettings || typeof input.defaultSettings !== 'object' || Array.isArray(input.defaultSettings))) throw new TypeError('SETTINGS');
  const defaults = getDefaultSettings(input.defaultSettings);
  for (const key of ['enableDomain', 'enableFileType', 'enableDate']) {
    if (strict) bool(input.defaultSettings?.[key], defaults[key]);
  }
  const rules = [];
  for (const rule of (Array.isArray(input.rules) ? input.rules : []).slice(0, MAX_RULES)) {
    try { rules.push(normalizeRule(rule, { strict })); } catch (error) { if (strict) throw error; }
  }
  let dateFormat = DEFAULT_DATE_FORMAT;
  try { dateFormat = normalizeDateFormat(input.defaultSettings?.dateFormat ?? DEFAULT_DATE_FORMAT); } catch (error) { if (strict) throw error; }
  if (strict && input.language !== undefined && !['zh', 'en'].includes(input.language)) throw new TypeError('LANGUAGE');
  // Settings saved before per-category controls must retain their global date behavior.
  const categories = input.categories === undefined && (input.settingsVersion !== undefined || input.defaultSettings !== undefined)
    ? getDefaultCategories().map(category => ({ ...category, dateMode: 'inherit' })) : input.categories;
  return {
    settingsVersion: SETTINGS_VERSION, enabled: strict ? bool(input.enabled, true) : input.enabled !== false,
    language: ['zh', 'en'].includes(input.language) ? input.language : fallbackLanguage,
    defaultSettings: { ...defaults, dateFormat }, rules,
    categories: normalizeCategories(categories, { strict })
  };
}
export function findCategory(filename, categories) {
  const name = String(filename).toLowerCase();
  return categories.filter(category => category.enabled)
    .flatMap(category => category.extensions.map(extension => ({ category, extension })))
    .filter(({ extension }) => name.length > extension.length + 1 && name.endsWith(`.${extension}`))
    .sort((a, b) => b.extension.length - a.extension.length)[0]?.category || null;
}
// Shared by the download worker and all previews. Pass normalized configuration.
export function resolveDownload(item, config, date = new Date()) {
  const fileName = String(item.filename || 'report.pdf').split(/[\\/]/).pop();
  const domain = getDownloadDomain(item);
  if (!config.enabled) return { filename: fileName, segments: [fileName], paused: true, typeSource: 'global', dateSource: 'default' };
  const rule = config.rules.find(candidate => candidate.enabled !== false && matchesDomain(candidate.domain, domain));
  const useType = rule ? rule.enableFileType : config.defaultSettings.enableFileType;
  const localType = useType && rule ? findCategory(fileName, rule.types) : null;
  const category = useType ? localType || findCategory(fileName, config.categories) : null;
  const enabledDate = rule && rule.dateMode !== 'inherit' ? rule.dateMode === 'on'
    : category && category.dateMode !== 'inherit' ? category.dateMode === 'on' : config.defaultSettings.enableDate;
  const dateFormat = rule?.dateFormat || category?.dateFormat || config.defaultSettings.dateFormat;
  const folder = rule?.path || (config.defaultSettings.enableDomain || rule ? domain : '');
  const segments = [];
  if (folder) segments.push(...normalizeRelativePath(folder).split('/'));
  if (category) segments.push(sanitizePathSegment(categoryName(category, config.language)));
  if (enabledDate) segments.push(...normalizeRelativePath(formatDate(date, dateFormat)).split('/'));
  segments.push(sanitizePathSegment(fileName));
  return { filename: segments.join('/'), segments, paused: false, category, rule,
    typeSource: localType ? 'domain' : 'global',
    dateSource: rule && (rule.dateMode !== 'inherit' || rule.dateFormat) ? 'domain' : category && (category.dateMode !== 'inherit' || category.dateFormat) ? 'type' : 'default' };
}

// The main settings preview shows the global controls, without per-domain or per-category overrides.
export function resolveGlobalPreview(item, config, date = new Date()) {
  const categories = getDefaultCategories().map(category => ({ ...category, dateMode: 'inherit' }));
  return resolveDownload(item, { ...config, rules: [], categories }, date);
}
