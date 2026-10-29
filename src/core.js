export const FILE_TYPE_MAP = Object.freeze({
  zh: Object.freeze({
    图片: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tif', 'tiff'],
    文档: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'rtf', 'odt', 'ods', 'odp'],
    压缩包: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'z', 'lz', 'lzma'],
    视频: ['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg', 'webm'],
    音频: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'aiff', 'ape'],
    代码: ['js', 'ts', 'html', 'css', 'json', 'xml', 'php', 'py', 'java', 'c', 'cpp', 'h', 'sh', 'bat', 'yml', 'yaml'],
    可执行文件: ['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm', 'apk'],
    字体: ['ttf', 'otf', 'woff', 'woff2', 'eot']
  }),
  en: Object.freeze({
    Images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tif', 'tiff'],
    Documents: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'rtf', 'odt', 'ods', 'odp'],
    Archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'z', 'lz', 'lzma'],
    Videos: ['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg', 'webm'],
    Audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'aiff', 'ape'],
    Code: ['js', 'ts', 'html', 'css', 'json', 'xml', 'php', 'py', 'java', 'c', 'cpp', 'h', 'sh', 'bat', 'yml', 'yaml'],
    Executables: ['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm', 'apk'],
    Fonts: ['ttf', 'otf', 'woff', 'woff2', 'eot']
  })
});

export const SETTINGS_VERSION = 2;
export const MAX_RULES = 200;

export function getFileCategory(filename, language = 'en') {
  const name = String(filename);
  const lastDot = name.lastIndexOf('.');
  const extension = lastDot > 0 && lastDot < name.length - 1
    ? name.slice(lastDot + 1).toLowerCase()
    : '';
  const categories = FILE_TYPE_MAP[language] || FILE_TYPE_MAP.en;

  for (const [category, extensions] of Object.entries(categories)) {
    if (extensions.includes(extension)) {
      return category;
    }
  }

  return '';
}

export function getDateString(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

export function getHostname(url) {
  if (typeof url !== 'string' || !url.trim()) {
    return '';
  }

  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function getDownloadDomain(downloadItem) {
  for (const candidate of [downloadItem?.referrer, downloadItem?.finalUrl, downloadItem?.url]) {
    const hostname = getHostname(candidate);
    if (hostname) {
      return hostname;
    }
  }

  return '';
}

export function getDefaultSettings(storedSettings) {
  if (!storedSettings || typeof storedSettings !== 'object') {
    return {
      enableDomain: false,
      enableFileType: true,
      enableDate: true
    };
  }

  return {
    // Existing version 1 settings did not have enableDomain. Preserve their old behavior.
    enableDomain: storedSettings.enableDomain === true,
    enableFileType: storedSettings.enableFileType !== false,
    enableDate: storedSettings.enableDate !== false
  };
}

export function normalizeDomainPattern(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Domain rule must be a string.');
  }

  const input = value.trim().toLowerCase().replace(/\.$/, '');
  const hasWildcard = input.startsWith('*.');
  const hostnameInput = hasWildcard ? input.slice(2) : input;

  if (
    !hostnameInput ||
    hostnameInput.includes('*') ||
    /[\s/:?#@]/.test(hostnameInput)
  ) {
    throw new TypeError('Domain rule must be a hostname or begin with *.');
  }

  let hostname;
  try {
    hostname = new URL(`http://${hostnameInput}`).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    throw new TypeError('Domain rule is not a valid hostname.');
  }

  if (!hostname || hostname.length > 253 || hostname.split('.').some((label) => (
    !label ||
    label.length > 63 ||
    !/^[a-z0-9-]+$/i.test(label) ||
    label.startsWith('-') ||
    label.endsWith('-')
  ))) {
    throw new TypeError('Domain rule is not a valid hostname.');
  }

  return hasWildcard ? `*.${hostname}` : hostname;
}

export function matchesDomain(pattern, domain) {
  try {
    const normalizedPattern = normalizeDomainPattern(pattern);
    const normalizedDomain = normalizeDomainPattern(domain);

    if (!normalizedPattern.startsWith('*.')) {
      return normalizedPattern === normalizedDomain;
    }

    const suffix = normalizedPattern.slice(2);
    return normalizedDomain === suffix || normalizedDomain.endsWith(`.${suffix}`);
  } catch {
    return false;
  }
}

const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

export function sanitizePathSegment(value) {
  let segment = String(value)
    .replace(/[\x00-\x1f<>:"/\\|?*]/g, '_')
    .trim()
    .replace(/[. ]+$/g, '');

  if (!segment || segment === '.' || segment === '..') {
    throw new TypeError('Path contains an empty or relative segment.');
  }

  if (WINDOWS_RESERVED_NAME.test(segment)) {
    segment = `_${segment}`;
  }

  return segment;
}

export function normalizeRelativePath(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Path must be a string.');
  }

  const input = value.trim();
  if (!input || /^[\\/]/.test(input) || /^[a-z]:/i.test(input)) {
    throw new TypeError('Path must be relative to the Downloads directory.');
  }

  const rawSegments = input.split(/[\\/]/);
  if (
    rawSegments.length > 20 ||
    rawSegments.some((segment) => !segment.trim() || segment.trim() === '.' || segment.trim() === '..')
  ) {
    throw new TypeError('Path contains an invalid segment.');
  }

  const segments = rawSegments.map((segment) => {
    const sanitized = sanitizePathSegment(segment);
    if (sanitized.length > 100) {
      throw new TypeError('Path segment is too long.');
    }
    return sanitized;
  });

  return segments.join('/');
}

export function buildDownloadPath({
  rulePath = '',
  domain = '',
  fileType = '',
  date = '',
  fileName,
  settings = {}
}) {
  const segments = [];

  if (rulePath) {
    segments.push(...normalizeRelativePath(rulePath).split('/'));
  } else if (settings.enableDomain && domain) {
    segments.push(sanitizePathSegment(domain));
  }

  if (settings.enableFileType && fileType) {
    segments.push(sanitizePathSegment(fileType));
  }

  if (settings.enableDate && date) {
    segments.push(sanitizePathSegment(date));
  }

  segments.push(sanitizePathSegment(fileName));
  return segments.join('/');
}

export function normalizeRule(rule, { strict = true } = {}) {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    throw new TypeError('Rule must be an object.');
  }

  if (strict && (
    typeof rule.enableFileType !== 'boolean' ||
    typeof rule.enableDate !== 'boolean'
  )) {
    throw new TypeError('Rule switches must be boolean values.');
  }

  return {
    domain: normalizeDomainPattern(rule.domain),
    path: normalizeRelativePath(rule.path),
    enableFileType: strict ? rule.enableFileType : rule.enableFileType !== false,
    enableDate: strict ? rule.enableDate : rule.enableDate !== false
  };
}

export function normalizeSettings(input, {
  fallbackLanguage = 'en',
  strict = true
} = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Settings must be an object.');
  }

  if (strict && !Array.isArray(input.rules)) {
    throw new TypeError('Settings rules must be an array.');
  }

  const sourceRules = Array.isArray(input.rules) ? input.rules : [];
  if (strict && sourceRules.length > MAX_RULES) {
    throw new TypeError(`Settings cannot contain more than ${MAX_RULES} rules.`);
  }

  if (strict && input.settingsVersion > SETTINGS_VERSION) {
    throw new TypeError('Settings were created by a newer unsupported version.');
  }

  if (strict && input.defaultSettings !== undefined) {
    if (
      !input.defaultSettings ||
      typeof input.defaultSettings !== 'object' ||
      Array.isArray(input.defaultSettings)
    ) {
      throw new TypeError('Default settings must be an object.');
    }

    for (const key of ['enableDomain', 'enableFileType', 'enableDate']) {
      if (input.defaultSettings[key] !== undefined && typeof input.defaultSettings[key] !== 'boolean') {
        throw new TypeError('Default setting switches must be boolean values.');
      }
    }
  }

  const rules = [];
  for (const rule of sourceRules.slice(0, MAX_RULES)) {
    try {
      rules.push(normalizeRule(rule, { strict }));
    } catch (error) {
      if (strict) throw error;
    }
  }

  if (strict && input.language !== undefined && !['zh', 'en'].includes(input.language)) {
    throw new TypeError('Settings language is invalid.');
  }

  const language = ['zh', 'en'].includes(input.language)
    ? input.language
    : fallbackLanguage;

  return {
    settingsVersion: SETTINGS_VERSION,
    rules,
    defaultSettings: getDefaultSettings(input.defaultSettings),
    language
  };
}
