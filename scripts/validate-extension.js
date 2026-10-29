import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(scriptDirectory, '..');
const manifestPath = path.join(extensionRoot, 'manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
assert.equal(manifest.key, undefined, 'Do not bundle an extension key in the public package');

const referencedFiles = new Set();

function addReference(reference) {
  if (typeof reference === 'string' && reference.trim()) {
    referencedFiles.add(reference);
  }
}

function addIconReferences(icons) {
  if (typeof icons === 'string') {
    addReference(icons);
    return;
  }

  for (const reference of Object.values(icons || {})) {
    addReference(reference);
  }
}

addReference(manifest.background?.service_worker);
addReference(manifest.options_page);
addReference(manifest.action?.default_popup);
addIconReferences(manifest.icons);
addIconReferences(manifest.action?.default_icon);

if (manifest.default_locale) {
  const localeRoot = path.join(extensionRoot, '_locales');
  const locales = (await readdir(localeRoot, { withFileTypes: true })).filter(entry => entry.isDirectory());
  assert.ok(locales.some(entry => entry.name === manifest.default_locale), 'Missing default locale catalog');
  const defaultMessages = JSON.parse(await readFile(path.join(localeRoot, manifest.default_locale, 'messages.json'), 'utf8'));
  const messageKeys = [...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map(match => match[1]);
  for (const key of messageKeys) assert.ok(defaultMessages[key]?.message, `Missing default message: ${key}`);
  for (const locale of locales) {
    const reference = `_locales/${locale.name}/messages.json`;
    addReference(reference);
    const messages = JSON.parse(await readFile(path.join(extensionRoot, reference), 'utf8'));
    for (const [key, value] of Object.entries(messages)) {
      assert.ok(typeof value.message === 'string' && value.message.trim(), `Invalid message: ${locale.name}/${key}`);
    }
    const localizedValue = field => field.replace(/__MSG_(\w+)__/g, (_, key) => messages[key]?.message || defaultMessages[key].message);
    assert.ok(localizedValue(manifest.name).length <= 75, `Localized name is too long: ${locale.name}`);
    assert.ok(localizedValue(manifest.description).length <= 132, `Localized description is too long: ${locale.name}`);
  }
}

for (const contentScript of manifest.content_scripts || []) {
  for (const reference of contentScript.js || []) addReference(reference);
  for (const reference of contentScript.css || []) addReference(reference);
}

for (const htmlPage of [manifest.options_page, manifest.action?.default_popup].filter(Boolean)) {
  const optionsHtml = await readFile(path.join(extensionRoot, htmlPage), 'utf8');
  const localAssetPattern = /(?:src|href)=["']([^"']+)["']/g;

  for (const match of optionsHtml.matchAll(localAssetPattern)) {
    const reference = match[1];
    if (!reference.includes('://') && !reference.startsWith('#') && !reference.startsWith('data:')) {
      addReference(reference);
    }
  }
}

const visitedModules = new Set();
const visitedStyles = new Set();

async function collectStyleReferences(reference) {
  const normalizedReference = reference.replaceAll('\\', '/');
  if (visitedStyles.has(normalizedReference) || !normalizedReference.endsWith('.css')) return;
  visitedStyles.add(normalizedReference);
  const source = await readFile(path.resolve(extensionRoot, normalizedReference), 'utf8');
  const urlPattern = /url\(\s*["']?([^"')\s]+)["']?\s*\)/g;
  for (const match of source.matchAll(urlPattern)) {
    const asset = match[1];
    if (/^(?:[a-z]+:|#|\/\/)/i.test(asset)) continue;
    const importedReference = path.posix.normalize(path.posix.join(path.posix.dirname(normalizedReference), asset));
    addReference(importedReference);
    await collectStyleReferences(importedReference);
  }
}

async function collectModuleImports(reference) {
  const normalizedReference = reference.replaceAll('\\', '/');
  if (visitedModules.has(normalizedReference) || !normalizedReference.endsWith('.js')) {
    return;
  }

  visitedModules.add(normalizedReference);
  const source = await readFile(path.resolve(extensionRoot, normalizedReference), 'utf8');
  const importPattern = /\bimport\s+(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g;

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;

    const importedReference = path.posix.normalize(
      path.posix.join(path.posix.dirname(normalizedReference), specifier)
    );
    addReference(importedReference);
    await collectModuleImports(importedReference);
  }
}

for (const reference of [...referencedFiles]) {
  await collectModuleImports(reference);
  await collectStyleReferences(reference);
}

for (const reference of referencedFiles) {
  const resolvedPath = path.resolve(extensionRoot, reference);
  const relativePath = path.relative(extensionRoot, resolvedPath);

  assert.ok(
    relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath),
    `Manifest resource escapes the extension root: ${reference}`
  );

  const file = await stat(resolvedPath);
  assert.ok(file.isFile(), `Referenced resource is not a file: ${reference}`);
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ version: manifest.version, files: [...referencedFiles].sort() }));
} else {
  console.log(`Validated ${referencedFiles.size} extension resources.`);
}
