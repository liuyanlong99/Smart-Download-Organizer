import { readConfig, writeStorage, subscribeEnabled } from './src/storage.js';
import { resolveDownload } from './src/config.js';
const $ = id => document.getElementById(id);
let config;
const text = (zh, en) => config?.language === 'en' ? en : zh;
function render() {
  document.documentElement.lang = config.language === 'en' ? 'en' : 'zh-CN';
  $('popupTitle').textContent = text('下载整理', 'Download organizer');
  $('enabledLabel').textContent = text('自动整理', 'Auto organize');
  $('popupEnabled').checked = config.enabled;
  $('popupPreview').textContent = `${text('下载目录', 'Downloads')}/${resolveDownload({ filename: 'photo.jpg', url: 'https://example.com' }, config).filename}`;
  $('openOptions').textContent = text('打开配置页面', 'Open settings');
}
$('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('popupEnabled').addEventListener('change', async () => {
  const previous = config.enabled; config.enabled = $('popupEnabled').checked; $('popupEnabled').disabled = true; render();
  try { await writeStorage({ enabled: config.enabled }); $('popupMessage').textContent = text('已立即生效', 'Applied immediately'); }
  catch { config.enabled = previous; render(); $('popupMessage').textContent = text('保存失败，请重试', 'Could not save. Try again.'); }
  finally { $('popupEnabled').disabled = false; }
});
subscribeEnabled(enabled => { if (config) { config.enabled = enabled; render(); } });
try { config = await readConfig(); render(); $('popupEnabled').disabled = false; }
catch { $('popupMessage').textContent = text('读取失败，请重新打开', 'Could not load. Please reopen.'); }
