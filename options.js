import { normalizeDomainPattern, normalizeRelativePath } from './src/core.js';
import { normalizeConfig, normalizeRule, createDomainRule, normalizeCategories, normalizeCategoryName, nextCategoryName, normalizeExtensions, normalizeDateFormat, formatDate, resolveDownload, resolveGlobalPreview, categoryName, DEFAULT_DATE_FORMAT, DATE_FORMATS, MAX_RULES, MAX_CATEGORIES } from './src/config.js';
import { readConfig, readOriginalConfig, writeStorage, subscribeEnabled } from './src/storage.js';

const $ = id => document.getElementById(id);
let config, baseline = '', busy = false, language = 'zh', sampleDomain = 'example.com', sampleFile = 'photo.jpg';
let loadError = false;
let timer, modal, modalTrigger, domainModal, closePathEditor;
const previews = new Map();
const text = (zh, en) => language === 'zh' ? zh : en;
const fingerprint = value => JSON.stringify({ ...value, enabled: undefined, language: undefined });
const dirty = () => config && fingerprint(config) !== baseline;
function node(tag, className, content) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content !== undefined) element.textContent = content;
  return element;
}
function button(label, action, style = 'secondary') {
  const result = node('button', `button ${style}`, label); result.type = 'button'; result.addEventListener('click', action); return result;
}
function icon(name, className = '') {
  const result = node('span', `material-icon icon-${name} ${className}`.trim()); result.setAttribute('aria-hidden', 'true'); return result;
}
function navigationRow(id, title, dialogId, action) {
  const row = node('button', 'navigation-row'); row.type = 'button'; row.id = id;
  row.setAttribute('aria-haspopup', 'dialog'); row.setAttribute('aria-controls', dialogId);
  row.append(node('span', 'setting-title', title), icon('chevron-right'));
  row.addEventListener('click', action); return row;
}
function errorMessage(error) {
  const messages = {
    EXTENSION_FORMAT: ['后缀格式无效。使用 .jpg、.png 或 .tar.gz，以空格或逗号分隔。', 'Use extensions such as .jpg, .png or .tar.gz, separated by commas or spaces.'],
    EXTENSION_DUPLICATE: ['后缀重复：同一范围内，每个后缀只能归属一个分类（包括已禁用分类）。', 'Duplicate extension. Each extension can belong to only one category in this scope, including disabled categories.'],
    CATEGORY_NAME: ['请输入有效的分类名称，不能包含路径分隔符或特殊字符。', 'Enter a valid folder name without path separators or special characters.'],
    CATEGORY_NAME_DUPLICATE: ['此分类名称已存在，请使用其他名称。', 'This category name already exists.'],
    DATE_FORMAT: ['使用 YYYY、MM、DD，每个最多一次，必须包含 YYYY。可用 - / _ . 或年月日分隔。', 'Use YYYY (required), MM and DD at most once each. Separate with - / _ . or 年月日.'],
    BUILTIN_READONLY: ['内置分类的名称和后缀不可修改。', 'Built-in names and extensions are read-only.'],
    CATEGORIES: ['最多支持 100 个分类。', 'Up to 100 categories are supported.'],
    RULES: ['最多支持 200 条域名规则。', 'Up to 200 domain rules are supported.'],
    VERSION: ['此配置来自更新版本，暂不支持导入。', 'This settings version is not supported.']
  };
  return messages[error.message] ? text(...messages[error.message]) : text('请检查域名、目录或配置格式。', 'Please check the domain, folder, or settings format.');
}
function hideNotice() { clearTimeout(timer); $('notification').classList.remove('open'); $('notification').inert = true; }
function notice(message, undo) {
  clearTimeout(timer); $('notificationText').textContent = message; $('undo').hidden = !undo;
  $('undo').textContent = text('撤销', 'Undo'); $('undo').onclick = () => { if (!busy) { undo(); hideNotice(); } };
  $('notification').inert = false; $('notification').classList.add('open');
  if (!undo) timer = setTimeout(hideNotice, 5000);
}
function status() {
  $('saveStatus').textContent = loadError ? text('原配置已保留，请处理后导入。', 'Original settings are preserved. Import corrected settings to continue.') : !config ? text('正在加载…', 'Loading…') : busy ? text('正在保存…', 'Saving…') : '';
  $('save').dataset.dirty = String(Boolean(dirty()));
  $('save').setAttribute('aria-label', dirty() ? text('保存设置，有未保存的更改', 'Save settings, unsaved changes') : text('保存设置', 'Save settings'));
  $('save').disabled = !config || busy || !dirty();
  document.querySelectorAll('.lang-btn').forEach(b => { b.disabled = busy || !config; });
  $('main').inert = busy || (!config && !loadError);
}
function changed() { hideNotice(); updatePreviews(); status(); }
function field(label, value, update, validate, placeholder = '') {
  const wrap = node('label', 'form-field'); const name = node('span', 'field-label', label);
  const input = node('input'); input.type = 'text'; input.value = value; input.placeholder = placeholder; input.autocomplete = 'off'; input.spellcheck = false;
  const error = node('span', 'field-error'); error.hidden = true;
  const id = `field-${crypto.randomUUID()}`; name.id = id; error.id = `${id}-error`; input.setAttribute('aria-labelledby', id); input.setAttribute('aria-describedby', error.id);
  const check = () => {
    try { validate?.(input.value); input.removeAttribute('aria-invalid'); error.hidden = true; return true; }
    catch (err) { input.setAttribute('aria-invalid', 'true'); error.textContent = errorMessage(err); error.hidden = false; return false; }
  };
  input.addEventListener('input', () => { update(input.value); check(); changed(); }); input.addEventListener('blur', check);
  wrap.append(name, input, error); return wrap;
}
function choiceCards(label, value, choices, update) {
  const wrap = node('details', 'choice-picker');
  const summary = node('summary', 'choice-summary');
  const copy = node('span', 'setting-copy');
  const current = node('span', 'choice-current', choices.find(([key]) => key === value)?.[1] || '');
  copy.append(node('span', 'field-label', label), current);
  const indicator = node('span', 'choice-expand', text('展开选项', 'Show choices'));
  summary.append(copy, indicator, icon('expand-more', 'chevron'));
  wrap.addEventListener('toggle', () => { indicator.textContent = wrap.open ? text('收起选项', 'Hide choices') : text('展开选项', 'Show choices'); });
  const options = node('fieldset', 'choice-options'); const legend = node('legend', 'visually-hidden', label); options.append(legend);
  const name = `choice-${crypto.randomUUID()}`;
  choices.forEach(([key, title, description]) => {
    const card = node('label', 'choice-card');
    const input = node('input'); input.type = 'radio'; input.name = name; input.value = key; input.checked = key === value;
    const cardCopy = node('span', 'setting-copy'); cardCopy.append(node('span', 'choice-title', title));
    if (description) cardCopy.append(node('span', 'caption', description));
    input.addEventListener('change', () => { if (input.checked) { current.textContent = title; update(key); changed(); } });
    card.append(input, cardCopy); options.append(card);
  });
  wrap.append(summary, options); return wrap;
}
function toggle(label, checked, update, description = '', className = 'setting-row') {
  const wrap = node('label', className); const copy = node('span', 'setting-copy'); copy.append(node('span', 'setting-title', label)); if (description) copy.append(node('span', 'setting-description', description));
  const switcher = node('span', 'switch'); const input = node('input'); input.type = 'checkbox'; input.setAttribute('role', 'switch'); input.checked = checked;
  input.addEventListener('change', () => update(input.checked)); switcher.append(input, node('span', 'slider')); wrap.append(copy, switcher); return wrap;
}
function dateFormatSetting(target, id, onChange = changed) {
  target.dateFormat ||= DEFAULT_DATE_FORMAT;
  const wrap = node('div', 'date-format-setting');
  const row = node('div', 'category-option-row category-dependent-row date-format-row');
  const label = node('label', 'setting-title', text('日期格式', 'Date format')); label.htmlFor = id;
  const control = node('div', 'date-format-control'); const select = node('select', 'date-format-select'); select.id = id;
  const isCustom = !DATE_FORMATS.includes(target.dateFormat);
  for (const [value, title] of [...DATE_FORMATS.map(format => [format, format]), ['custom', text('自定义格式', 'Custom format')]]) {
    const option = node('option', '', title); option.value = value; select.append(option);
  }
  select.value = isCustom ? 'custom' : target.dateFormat;
  const custom = field(text('自定义日期格式', 'Custom date format'), isCustom ? target.dateFormat : DEFAULT_DATE_FORMAT, value => { target.dateFormat = value; onChange(); }, normalizeDateFormat, 'YYYY/MM/DD');
  custom.hidden = !isCustom; custom.classList.add('category-date-custom');
  select.addEventListener('change', () => {
    target.dateFormat = select.value === 'custom' ? custom.querySelector('input').value : select.value;
    custom.hidden = select.value !== 'custom'; onChange();
  });
  control.append(select, icon('expand-more')); row.append(label, control); wrap.append(row, custom); return wrap;
}
function previewNode(key, getOptions) {
  const wrap = node('div', 'path-preview'); wrap.append(node('span', 'caption', text('效果路径', 'RESULTING PATH')));
  const path = node('div', 'example-path'); path.setAttribute('aria-live', 'polite'); wrap.append(path);
  const source = node('p', 'caption'); wrap.append(source); previews.set(key, { path, source, getOptions }); return wrap;
}
function previewRow(key, getOptions, label = text('预览：', 'Preview:')) {
  const row = node('div', 'category-option-row category-dependent-row category-preview-row');
  const path = node('span', 'category-preview-text'); path.setAttribute('aria-live', 'polite');
  row.append(node('span', 'setting-title', label), path); previews.set(key, { path, getOptions }); return row;
}
function updatePreviews() {
  if (!config) return;
  for (const [key, item] of previews) {
    if (!item.path.isConnected) { previews.delete(key); continue; }
    try {
      const options = item.getOptions();
      const raw = { ...config, enabled: options.actual ? config.enabled : true,
        defaultSettings: options.defaultSettings || config.defaultSettings,
        rules: options.rule ? [options.rule] : options.defaults ? [] : config.rules,
        categories: options.categories || config.categories };
      const normalized = normalizeConfig(raw);
      const domain = options.domain || sampleDomain;
      normalizeDomainPattern(domain);
      const file = options.filename || sampleFile;
      if (!file.trim() || /[\\/]/.test(file)) throw new Error('FILE');
      const resolve = options.global ? resolveGlobalPreview : resolveDownload;
      const result = resolve({ filename: file, url: `https://${domain}` }, normalized);
      item.path.textContent = `${text('下载目录', 'Downloads')}/${result.filename}`;
      if (options.interactive) renderPathButtons(item.path, result, normalized, domain);
      item.path.classList.remove('invalid-preview');
      if (item.source) {
        const origins = { domain: text('域名设置', 'Website'), type: text('类型设置', 'File type'), default: text('全局默认', 'Default') };
        item.source.textContent = result.paused ? text('整理已暂停，新下载使用浏览器原有路径。', 'Paused. New downloads use the browser’s original location.')
          : `${text('类型来源：', 'Type: ')}${result.typeSource === 'domain' ? origins.domain : origins.default} · ${text('日期来源：', 'Date: ')}${origins[result.dateSource]}`;
        item.source.hidden = Boolean(options.interactive);
      }
    } catch (err) { item.path.textContent = text('完成有效配置后显示路径', 'Complete valid settings to preview the path'); item.path.classList.add('invalid-preview'); if (item.source) item.source.textContent = errorMessage(err); }
  }
}
function renderPathButtons(path, result, normalized, domain) {
  path.replaceChildren(); path.classList.add('interactive-path');
  const segment = (key, value, action) => {
    if (path.children.length) path.append(node('span', 'path-separator', '/'));
    const entry = button(value, action, 'path-link');
    entry.id = `path-${key}`; path.append(entry);
  };
  segment('folder', text('下载目录', 'Downloads'), () => {
    if (!globalThis.chrome?.downloads?.showDefaultFolder) {
      notice(text('请在扩展的配置页面中打开实际下载目录。', 'Open the installed extension’s settings to access your Downloads folder.')); return;
    }
    try { chrome.downloads.showDefaultFolder(); }
    catch { notice(text('下载目录打开失败，请重试。', 'Could not open the Downloads folder. Please try again.')); }
  });
  if (normalized.defaultSettings.enableDomain) segment('domain', domain, openDomainEditor);
  if (result.category) segment('type', categoryName(result.category, language), () => openManager(null, result.category.id));
  const dated = result.category && result.category.dateMode !== 'inherit' ? result.category.dateMode === 'on' : normalized.defaultSettings.enableDate;
  if (dated) segment('date', formatDate(new Date(), result.category?.dateFormat || normalized.defaultSettings.dateFormat), openDateEditor);
}
function pathEditor(title, content, { apply, cleanup } = {}) {
  closePathEditor?.();
  const trigger = document.activeElement;
  const dialog = node('dialog', 'path-dialog'); dialog.setAttribute('aria-labelledby', 'pathDialogTitle');
  const heading = node('h2', '', title); heading.id = 'pathDialogTitle';
  const header = node('div', 'dialog-header'); const error = node('p', 'field-error'); error.setAttribute('role', 'alert');
  const close = () => { dialog.close(); cleanup?.(); dialog.remove(); closePathEditor = null; updatePreviews(); (trigger?.id ? $(trigger.id) : trigger)?.focus(); };
  closePathEditor = close;
  const dismiss = button('', close, 'quiet icon-button'); dismiss.append(icon('close')); dismiss.setAttribute('aria-label', text('关闭弹窗', 'Close dialog')); header.append(heading, dismiss);
  const body = node('div', 'path-dialog-body'); body.append(content, error);
  const footer = node('div', 'dialog-footer');
  if (apply) footer.append(button(text('取消', 'Cancel'), close, 'quiet'));
  footer.append(button(apply ? text('应用到配置', 'Apply to settings') : text('完成', 'Done'), () => {
    try { apply?.(); close(); changed(); } catch (err) { error.textContent = errorMessage(err); }
  }, 'primary'));
  dialog.append(header, body, footer); document.body.append(dialog); dialog.addEventListener('cancel', event => { event.preventDefault(); close(); }); dialog.showModal(); updatePreviews();
}
function openDomainEditor() {
  closePathEditor?.(); hideNotice();
  domainModal = { items: structuredClone(config.rules).map(rule => ({ ...rule, dateMode: rule.dateMode === 'inherit' ? 'off' : rule.dateMode, dateFormat: rule.dateFormat || DEFAULT_DATE_FORMAT })), selected: 0, deleted: [], trigger: document.activeElement };
  $('domainDialogTitle').textContent = text('设置域名路径规则', 'Set domain path rules');
  $('domainDialogDescription').textContent = text('注：域名的配置优先于全局配置；', 'Note: Domain settings override global settings.');
  $('addRuleLabel').textContent = text('新增域名', 'Add website'); $('addRule').setAttribute('aria-label', text('新增域名', 'Add website'));
  $('undoRule').textContent = text('撤销删除', 'Undo deletion');
  $('cancelDomains').textContent = text('取消', 'Cancel');
  $('applyDomains').textContent = text('应用', 'Apply');
  $('closeDomainDialog').setAttribute('aria-label', text('关闭弹窗', 'Close dialog'));
  $('domainDialogError').textContent = ''; renderDomainManager();
  $('domainDialog').showModal(); requestAnimationFrame(() => $('domainDialog').classList.add('open'));
}
function closeDomainEditor() {
  const trigger = domainModal?.trigger;
  $('domainDialog').classList.remove('open'); $('domainDialog').close();
  domainModal = null; $('domainNav').replaceChildren(); $('domainEditor').replaceChildren(); previews.delete('domain-rule');
  (trigger?.id ? $(trigger.id) : trigger)?.focus();
}
function openDateEditor() {
  const draft = structuredClone(config.defaultSettings); const content = node('div', 'date-editor');
  content.append(dateFormatSetting(draft, 'defaultDateFormat'), previewNode('date-dialog', () => ({ global: true, defaults: true, defaultSettings: draft })));
  pathEditor(text('全局日期格式', 'Default date format'), content, { apply: () => {
    const dateFormat = normalizeDateFormat(draft.dateFormat); config.defaultSettings.dateFormat = dateFormat;
  } });
}
async function setEnabled(enabled) {
  const previous = config.enabled; config.enabled = enabled; renderEnabled(); updatePreviews();
  $('enabledPanel').inert = true;
  try { await writeStorage({ enabled }); }
  catch { config.enabled = previous; notice(text('切换失败，请重试。', 'Could not change status. Please try again.')); }
  finally { $('enabledPanel').inert = false; renderEnabled(); updatePreviews(); }
}
function renderEnabled(rebuild = false) {
  // Keep the controls mounted during status updates so their sliding transitions can finish.
  if (rebuild || !$('organizerEnabled')) {
    const master = toggle(text('自动整理下载', 'Organize downloads'), config.enabled, setEnabled);
    const input = master.querySelector('input'); input.id = 'organizerEnabled'; input.setAttribute('aria-controls', 'organizeOptions');
    const options = node('div', 'organize-options'); options.id = 'organizeOptions'; options.setAttribute('role', 'group'); options.setAttribute('aria-label', text('下载整理选项', 'Download organization options'));
    for (const [key, zh, en] of [['enableDomain', '按域名建立目录', 'Group by source website'], ['enableFileType', '按文件类型建立目录', 'Group by file type'], ['enableDate', '按日期创建目录', 'Create date folders']]) {
      const row = toggle(text(zh, en), config.defaultSettings[key], value => { config.defaultSettings[key] = value; changed(); });
      row.querySelector('input').id = key; options.append(row);
    }
    const current = previewRow('current-path', () => ({ actual: true, global: true }), text('当前路径：', 'Current path:')); current.classList.add('current-path-row'); options.append(current);
    $('enabledPanel').replaceChildren(master, options);
  }
  $('organizerEnabled').checked = config.enabled;
  $('organizeOptions').hidden = !config.enabled;
}
function render() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  $('save').textContent = text('保存设置', 'Save settings');
  $('dismissNotification').setAttribute('aria-label', text('关闭通知', 'Dismiss notification'));
  document.querySelectorAll('.lang-btn').forEach(btn => { btn.classList.toggle('active', btn.dataset.lang === language); btn.setAttribute('aria-pressed', String(btn.dataset.lang === language)); });
  previews.clear(); renderEnabled(true);
  $('groups').replaceChildren();
  const navigation = node('div', 'panel configuration-navigation');
  navigation.append(navigationRow('manageTypes', text('设置文件类型路径规则', 'Set file type path rules'), 'typeDialog', () => openManager()),
    navigationRow('manageDomains', text('设置域名路径规则', 'Set domain path rules'), 'domainDialog', () => openDomainEditor()));
  $('groups').append(navigation);
  const backup = node('section', 'panel backup-panel'); backup.id = 'backupGroup'; backup.setAttribute('aria-labelledby', 'backupTitle');
  const backupRow = node('div', 'backup-row');
  const backupTitle = node('span', 'setting-title', text('备份与恢复', 'Backup & restore')); backupTitle.id = 'backupTitle';
  const backupActions = node('div', 'backup-actions');
  backupActions.append(button(text('导出配置', 'Export settings'), exportConfig, 'quiet text-button'), button(text('导入配置', 'Import settings'), importConfig, 'quiet text-button'), button(text('还原为初始配置', 'Restore initial settings'), resetConfig, 'quiet text-button danger'));
  backupRow.append(backupTitle, backupActions); backup.append(backupRow); $('backupSection').replaceChildren(backup);
  updatePreviews(); status();
}
function domainChanged() {
  $('domainDialogError').textContent = ''; renderDomainNav(); updatePreviews();
}
function renderDomainNav() {
  const list = $('domainNav'); const scrollTop = $('domainSidebar').scrollTop; list.replaceChildren();
  domainModal.items.forEach((rule, index) => {
    const row = node('div', 'domain-nav-row'); row.classList.toggle('selected', index === domainModal.selected);
    const item = button('', () => { domainModal.selected = index; $('domainDialogError').textContent = ''; renderDomainManager(); }, 'quiet domain-nav-item');
    item.id = `domain-rule-${index}`; item.classList.toggle('selected', index === domainModal.selected); item.setAttribute('aria-pressed', String(index === domainModal.selected));
    const name = rule.domain || text('新域名', 'New website');
    const copy = node('span', 'setting-copy'); const heading = node('span', 'domain-nav-heading');
    const title = node('span', 'domain-nav-name', name); title.setAttribute('aria-hidden', 'true');
    const remove = button(text('删除', 'Delete'), event => { event.stopPropagation(); deleteDomainRule(rule); }, 'category-chip domain-delete');
    remove.setAttribute('aria-label', text(`删除域名“${name}”`, `Delete website ${name}`)); heading.append(title, remove); copy.append(heading);
    if (rule.path) { const path = node('span', 'caption', rule.path); path.setAttribute('aria-hidden', 'true'); copy.append(path); }
    const state = rule.enabled ? text('已启用', 'Enabled') : text('已停用', 'Disabled');
    item.setAttribute('aria-label', `${name}，${state}`);
    const statusIcon = icon(rule.enabled ? 'check-circle' : 'cancel', `category-status ${rule.enabled ? 'is-enabled' : 'is-disabled'}`); statusIcon.title = state;
    row.append(item, copy, statusIcon); list.append(row);
  });
  $('domainSidebar').scrollTop = scrollTop;
  $('addRule').disabled = domainModal.items.length >= MAX_RULES;
  $('undoRule').hidden = !domainModal.deleted.length;
  $('undoRule').disabled = domainModal.items.length >= MAX_RULES;
  $('domainSidebarActions').hidden = !domainModal.deleted.length;
}
function renderDomainManager() {
  renderDomainNav(); const editor = $('domainEditor'); editor.replaceChildren(); editor.scrollTop = 0; previews.delete('domain-rule');
  const index = domainModal.selected, rule = domainModal.items[index];
  if (!rule) { editor.append(node('div', 'empty-rules', text('还没有域名规则', 'No website rules yet'))); return; }
  editor.append(field(text('域名（支持 *.example.com）', 'Domain (supports *.example.com)'), rule.domain, value => { rule.domain = value; domainChanged(); }, normalizeDomainPattern, '*.example.com'),
    field(text('路径名称（可选）', 'Path name (optional)'), rule.path, value => { rule.path = value; domainChanged(); }, value => { if (value) normalizeRelativePath(value); }, text('留空使用完整域名，例如 a.example.com', 'Leave blank to use the full domain, e.g. a.example.com')));
  const options = node('div', 'category-options'); const children = node('div', 'domain-dependent-settings'); children.id = 'domainDependentSettings'; children.hidden = !rule.enabled;
  const enabled = toggle(text('启用此域名', 'Enable website rule'), rule.enabled, value => { rule.enabled = value; children.hidden = !value; domainChanged(); }, '', 'category-option-row category-enabled-row');
  enabled.querySelector('input').setAttribute('aria-controls', children.id);
  const manage = button(text(`专属类型（${rule.types.length}）`, `Website types (${rule.types.length})`), () => openManager(domainModal.selected), 'quiet domain-types-row'); manage.id = 'manageRuleTypes'; manage.append(icon('chevron-right')); manage.hidden = !rule.enableFileType;
  const types = toggle(text('按类型创建目录', 'Create file type folders'), rule.enableFileType, value => { rule.enableFileType = value; manage.hidden = !value; domainChanged(); }, '', 'category-option-row category-dependent-row');
  const format = dateFormatSetting(rule, 'domainDateFormat', domainChanged); format.hidden = rule.dateMode !== 'on';
  const date = toggle(text('按日期创建目录', 'Create date folders'), rule.dateMode === 'on', value => { rule.dateMode = value ? 'on' : 'off'; format.hidden = !value; domainChanged(); }, '', 'category-option-row category-dependent-row');
  date.querySelector('input').setAttribute('aria-controls', 'domainDateFormat');
  children.append(types, manage, date, format, previewRow('domain-rule', () => {
    const extension = rule.types.find(type => type.enabled)?.extensions?.[0];
    return { rule, domain: rule.domain.replace(/^\*\./, ''), filename: extension ? `example.${extension}` : sampleFile };
  })); options.append(enabled, children); editor.append(options); updatePreviews();
}
function deleteDomainRule(rule) {
  if (!domainModal) return;
  const index = domainModal.items.indexOf(rule); if (index < 0) return;
  const selected = domainModal.items[domainModal.selected];
  domainModal.deleted.push({ rule, index }); domainModal.items.splice(index, 1);
  domainModal.selected = selected === rule ? Math.min(index, Math.max(0, domainModal.items.length - 1)) : domainModal.items.indexOf(selected);
  $('domainDialogError').textContent = '';
  if (selected === rule) renderDomainManager(); else { renderDomainNav(); updatePreviews(); }
  const next = $(`domain-rule-${Math.min(index, Math.max(0, domainModal.items.length - 1))}`);
  (next || $('addRule')).focus();
}
$('addRule').addEventListener('click', () => {
  if (domainModal.items.length >= MAX_RULES) return;
  domainModal.items.unshift(createDomainRule());
  domainModal.selected = 0; $('domainDialogError').textContent = ''; renderDomainManager(); $('domainEditor').querySelector('input').focus();
  $('domainSidebar').scrollTop = 0;
});
$('undoRule').addEventListener('click', () => {
  if (domainModal.items.length >= MAX_RULES) return;
  const deleted = domainModal.deleted.pop(); if (!deleted) return;
  const index = Math.min(deleted.index, domainModal.items.length); domainModal.items.splice(index, 0, deleted.rule); domainModal.selected = index;
  $('domainDialogError').textContent = ''; renderDomainManager(); $(`domain-rule-${index}`).focus();
});
$('applyDomains').addEventListener('click', () => {
  const rules = [];
  for (let index = 0; index < domainModal.items.length; index++) {
    try { normalizeDateFormat(domainModal.items[index].dateFormat); rules.push(normalizeRule(domainModal.items[index])); }
    catch (err) {
      domainModal.selected = index; renderDomainManager(); $('domainDialogError').textContent = errorMessage(err); $('domainEditor').querySelector('input')?.focus(); return;
    }
  }
  config.rules = rules; closeDomainEditor(); render(); changed(); $('manageDomains').focus();
});
$('cancelDomains').addEventListener('click', closeDomainEditor); $('closeDomainDialog').addEventListener('click', closeDomainEditor);
$('domainDialog').addEventListener('cancel', event => { event.preventDefault(); closeDomainEditor(); });

// The dialog keeps a private draft. Cancel/Escape discards it; Apply validates the whole scope.
function openManager(ruleIndex = null, selectedId) {
  closePathEditor?.();
  modalTrigger = document.activeElement;
  const rule = ruleIndex === null ? null : (domainModal?.items || config.rules)[ruleIndex];
  modal = { ruleIndex, rule, items: structuredClone(rule ? rule.types : config.categories).map(category => ({ ...category, dateFormat: category.dateFormat || DEFAULT_DATE_FORMAT })), selected: 0 };
  if (selectedId) modal.selected = Math.max(0, modal.items.findIndex(item => item.id === selectedId));
  $('typeDialogTitle').textContent = ruleIndex === null ? text('设置文件类型路径规则', 'Set file type path rules') : text('域名专属类型', 'Website-specific types');
  $('typeDialogDescription').textContent = text('注：文件类型的配置优先于全局配置，自定义分类的配置优先于系统分类配置；', 'Note: File type settings override global settings. Custom category settings override system category settings.');
  $('addCategoryLabel').textContent = text('新增分类', 'Add category');
  $('addCategory').setAttribute('aria-label', text('新增分类', 'Add category')); $('addCategory').title = text('新增分类', 'Add category');
  $('cancelDialog').textContent = text('取消', 'Cancel'); $('applyCategories').textContent = text('应用', 'Apply');
  $('closeDialog').setAttribute('aria-label', text('关闭弹窗', 'Close dialog'));
  $('dialogError').textContent = ''; renderManager(); $('typeDialog').showModal(); requestAnimationFrame(() => $('typeDialog').classList.add('open'));
}
function closeManager() {
  $('typeDialog').classList.remove('open'); $('typeDialog').close(); modal = null;
  $('categoryNav').replaceChildren(); $('categoryEditor').replaceChildren(); previews.delete('modal'); modalTrigger?.focus();
}
function renderManagerNav() {
  const scrollTop = $('categorySidebar').scrollTop; $('categoryNav').replaceChildren();
  modal.items.forEach((category, index) => {
    const name = categoryName(category, language) || text('未命名', 'Untitled');
    const state = category.enabled ? text('已启用', 'Enabled') : text('已停用', 'Disabled');
    const row = node('div', 'category-nav-row'); row.classList.toggle('selected', index === modal.selected);
    const item = button('', () => { modal.selected = index; $('dialogError').textContent = ''; renderManager(); }, 'quiet category-select');
    item.setAttribute('aria-pressed', String(index === modal.selected));
    item.setAttribute('aria-label', `${name}，${category.builtin ? text('系统，', 'System, ') : ''}${state}`);
    const heading = node('span', 'category-nav-heading'); const title = node('span', 'category-nav-name', name); title.setAttribute('aria-hidden', 'true'); heading.append(title);
    if (category.builtin) {
      const chip = node('span', 'category-chip category-system-chip', text('系统', 'System')); chip.setAttribute('aria-hidden', 'true'); heading.append(chip);
    } else {
      const remove = button(text('删除', 'Delete'), event => { event.stopPropagation(); deleteCategory(category); }, 'category-chip category-delete');
      remove.setAttribute('aria-label', text(`删除分类“${name}”`, `Delete category ${name}`)); heading.append(remove);
    }
    const statusIcon = icon(category.enabled ? 'check-circle' : 'cancel', `category-status ${category.enabled ? 'is-enabled' : 'is-disabled'}`); statusIcon.title = state;
    row.append(item, heading, statusIcon); $('categoryNav').append(row);
  });
  $('categorySidebar').scrollTop = scrollTop;
  $('addCategory').disabled = modal.items.length >= MAX_CATEGORIES;
}
function deleteCategory(category) {
  if (!modal || category.builtin) return;
  const index = modal.items.indexOf(category); if (index < 0) return;
  const selected = modal.items[modal.selected]; modal.items.splice(index, 1);
  modal.selected = selected === category ? Math.min(index, Math.max(0, modal.items.length - 1)) : modal.items.indexOf(selected);
  $('dialogError').textContent = '';
  if (selected === category) renderManager(); else { renderManagerNav(); updateCategoryPreview(); }
  const next = $('categoryNav').querySelectorAll('.category-select')[Math.min(index, Math.max(0, modal.items.length - 1))];
  (next || $('addCategory')).focus();
}
function modalChanged() {
  $('dialogError').textContent = ''; renderManagerNav(); updateCategoryPreview(); updatePreviews();
}
function categoryDateSettings(category) {
  const settings = node('div', 'category-dependent-settings'); settings.id = 'categoryDependentSettings'; settings.hidden = !category.enabled;
  const dateEnabled = category.dateMode === 'on' || (category.dateMode === 'inherit' && config.defaultSettings.enableDate);
  const date = toggle(text('按照日期创建目录', 'Create date folders'), dateEnabled, value => { category.dateMode = value ? 'on' : 'off'; modalChanged(); }, '', 'category-option-row category-dependent-row');
  const format = dateFormatSetting(category, 'categoryDateFormat', modalChanged);
  const preview = node('div', 'category-option-row category-dependent-row category-preview-row');
  const path = node('span', 'category-preview-text'); path.setAttribute('aria-live', 'polite'); modal.previewText = path;
  preview.append(node('span', 'setting-title', text('预览：', 'Preview:')), path);
  settings.append(date, format, preview); return settings;
}
function updateCategoryPreview() {
  if (!modal?.previewText) return;
  const path = modal.previewText;
  try {
    const categories = normalizeCategories(modal.items, { scope: modal.ruleIndex === null ? 'global' : 'domain' });
    const category = categories.find(item => item.id === modal.items[modal.selected]?.id);
    if (!category) throw new TypeError('CATEGORIES');
    const rule = modal.rule ? { ...modal.rule, types: categories } : null;
    const domain = rule ? rule.domain.replace(/^\*\./, '') : 'example.com'; normalizeDomainPattern(domain);
    const normalized = normalizeConfig({ ...config, enabled: true, categories: rule ? config.categories : categories, rules: rule ? [rule] : [] });
    const result = resolveDownload({ filename: `example.${category.extensions[0]}`, url: `https://${domain}` }, normalized);
    path.textContent = `${text('下载目录', 'Downloads')}/${result.filename}`; path.dataset.invalid = 'false'; path.title = path.textContent;
  } catch (err) { path.textContent = text('填写有效配置后预览', 'Complete valid settings to preview'); path.dataset.invalid = 'true'; path.title = errorMessage(err); }
}
function renderManager() {
  renderManagerNav(); const editor = $('categoryEditor'); editor.replaceChildren(); editor.scrollTop = 0; modal.previewText = null;
  const category = modal.items[modal.selected];
  if (!category) { editor.append(node('div', 'empty-rules', text('点击左侧加号新增分类', 'Use the plus button to add a category'))); return; }
  const validateName = value => {
    const normalized = normalizeCategoryName(value).toLowerCase();
    if (modal.items.some(item => item !== category && ['zh', 'en'].some(locale => String(categoryName(item, locale) || '').trim().toLowerCase() === normalized))) throw new TypeError('CATEGORY_NAME_DUPLICATE');
  };
  const name = field(text('分类名称', 'Category name'), categoryName(category, language), value => { category.name = value; modalChanged(); }, validateName, text('例如：设计素材', 'e.g. Design assets'));
  const validateSuffixes = value => {
    const suffixes = normalizeExtensions(value);
    const occupied = new Set(modal.items.filter(item => item !== category).flatMap(item => {
      try { return normalizeExtensions(item.extensions); } catch { return []; }
    }));
    if (suffixes.some(suffix => occupied.has(suffix))) throw new TypeError('EXTENSION_DUPLICATE');
  };
  const extensions = field(text('文件后缀', 'Extensions'), Array.isArray(category.extensions) ? category.extensions.map(ext => `.${ext}`).join(', ') : category.extensions, value => { category.extensions = value; modalChanged(); }, validateSuffixes, '.jpg, .png');
  if (category.builtin) { name.querySelector('input').readOnly = true; extensions.querySelector('input').readOnly = true; }
  const dates = categoryDateSettings(category);
  const enabled = toggle(text('启用此分类', 'Enable category'), category.enabled, value => { category.enabled = value; dates.hidden = !value; modalChanged(); }, '', 'category-option-row category-enabled-row');
  enabled.querySelector('input').setAttribute('aria-controls', dates.id);
  const options = node('div', 'category-options'); options.append(enabled, dates); editor.append(name, extensions, options);
  if (!category.builtin) editor.append(button(text('删除此分类', 'Delete category'), () => deleteCategory(category), 'quiet'));
  updateCategoryPreview();
}
$('addCategory').addEventListener('click', () => {
  if (modal.items.length >= MAX_CATEGORIES) return;
  modal.items.unshift({ id: `custom_${crypto.randomUUID()}`, builtin: false, name: nextCategoryName(modal.items, language), extensions: [], enabled: true, dateMode: 'off', dateFormat: DEFAULT_DATE_FORMAT });
  modal.selected = 0; $('dialogError').textContent = ''; renderManager();
  $('categorySidebar').scrollTop = 0; const input = $('categoryEditor').querySelector('input'); input.focus(); input.select();
});
$('applyCategories').addEventListener('click', () => {
  try {
    modal.items.forEach(category => normalizeDateFormat(category.dateFormat));
    const categories = normalizeCategories(modal.items, { scope: modal.ruleIndex === null ? 'global' : 'domain' });
    const rule = modal.rule;
    if (rule) rule.types = categories; else config.categories = categories;
    closeManager();
    if (rule && domainModal) { renderDomainManager(); $('manageRuleTypes').focus(); }
    else { render(); changed(); $('manageTypes').focus(); notice(text('类型配置已应用，保存设置后生效。', 'Types updated. Save settings to apply.')); }
  } catch (err) { $('dialogError').textContent = errorMessage(err); }
});
$('cancelDialog').addEventListener('click', closeManager); $('closeDialog').addEventListener('click', closeManager);
$('typeDialog').addEventListener('cancel', event => { event.preventDefault(); closeManager(); });

async function persist(value, includeEnabled = false) {
  busy = true; hideNotice(); status();
  try {
    const normalized = normalizeConfig(value); const payload = { ...normalized }; if (!includeEnabled) delete payload.enabled;
    await writeStorage(payload, { replace: includeEnabled }); normalized.enabled = includeEnabled ? normalized.enabled : config.enabled; config = normalized; loadError = false; language = config.language; baseline = fingerprint(config); render(); notice(text('配置已保存。', 'Settings saved.'));
  } catch (err) { notice(errorMessage(err)); }
  finally { busy = false; status(); }
}
$('save').addEventListener('click', () => persist(config));
function resetConfig() {
  const previous = structuredClone(config); config = normalizeConfig({ rules: [], enabled: config.enabled, language }, { strict: true }); render(); changed();
  notice(text('已还原为初始配置。', 'Initial settings restored.'), () => { previous.enabled = config.enabled; config = previous; render(); changed(); });
}
function exportConfig() {
  try {
    const normalized = normalizeConfig(config); const url = URL.createObjectURL(new Blob([JSON.stringify(normalized, null, 2)], { type: 'application/json' }));
    const link = node('a'); link.href = url; link.download = 'download_rules_settings.json'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); notice(text('已生成配置导出文件。', 'Settings export created.'));
  } catch (err) { notice(errorMessage(err)); }
}
async function exportOriginalConfig() {
  try {
    const raw = await readOriginalConfig();
    const url = URL.createObjectURL(new Blob([JSON.stringify(raw, null, 2)], { type: 'application/json' }));
    const link = node('a'); link.href = url; link.download = 'download_rules_original.json'; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { notice(text('导出失败，请重试。', 'Export failed. Please try again.')); }
}
function showConfigRecovery(error) {
  loadError = true;
  const content = node('div', 'panel-padding');
  content.append(node('p', 'setting-title', text('配置需要处理', 'Settings need attention')));
  content.append(node('p', 'caption', `${errorMessage(error)} ${text('原配置没有被替换。可先导出检查，再导入修复后的配置。', 'The original settings have not been replaced. Export them for review, then import corrected settings.')}`));
  const actions = node('div', 'panel-actions');
  actions.append(button(text('导出原始配置', 'Export original settings'), exportOriginalConfig), button(text('导入修复后的配置', 'Import corrected settings'), importConfig));
  content.append(actions); $('enabledPanel').replaceChildren(content); status();
}
function importConfig() {
  const input = node('input'); input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true; document.body.append(input);
  input.addEventListener('cancel', () => input.remove(), { once: true });
  input.addEventListener('change', async () => {
    const file = input.files[0]; if (!file || busy) { input.remove(); return; }
    if (file.size > 1024 * 1024) { input.remove(); notice(text('配置文件不能超过 1 MB。', 'Settings must be 1 MB or smaller.')); return; }
    busy = true; status();
    try { const normalized = normalizeConfig(JSON.parse(await file.text())); await persist(normalized, true); }
    catch (err) { notice(errorMessage(err)); }
    finally { input.remove(); busy = false; status(); }
  }); input.click();
}
document.querySelectorAll('.lang-btn').forEach(btn => btn.addEventListener('click', async () => {
  hideNotice();
  const previous = language; language = btn.dataset.lang; config.language = language; busy = true; status();
  try { await writeStorage({ language }); } catch { language = previous; config.language = previous; notice(text('语言保存失败。', 'Could not save language.')); }
  finally { busy = false; render(); }
}));
$('dismissNotification').addEventListener('click', hideNotice);
window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('scroll', () => $('toolbar').classList.toggle('scrolled', scrollY > 8), { passive: true });
subscribeEnabled(enabled => { if (config) { config.enabled = enabled; renderEnabled(); updatePreviews(); } });
status();
try { config = await readConfig(); language = config.language; baseline = fingerprint(config); render(); }
catch (error) {
  try {
    const original = await readOriginalConfig();
    if (['zh', 'en'].includes(original.language)) language = original.language;
  } catch {}
  showConfigRecovery(error);
}
