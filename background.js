import { resolveDownload } from './src/config.js';
import { initializeConfig, readConfig } from './src/storage.js';

chrome.runtime.onInstalled?.addListener(details => {
  if (details.reason === 'install' || details.reason === 'update') {
    initializeConfig(details.reason).catch(error => console.error('Could not initialize settings:', error));
  }
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  let suggested = false;
  const once = value => { if (!suggested) { suggested = true; suggest(value); } };
  readConfig().then(config => {
    if (!config.enabled) { once(); return; }
    const resolved = resolveDownload(item, config);
    once({ filename: resolved.filename, conflictAction: 'uniquify' });
  }).catch(error => { console.error('Failed to organize download:', error); once(); });
  return true;
});
