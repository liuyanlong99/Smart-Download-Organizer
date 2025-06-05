document.addEventListener('DOMContentLoaded', function () {
  // 多语言支持
  const translations = {
    zh: {
      title: "下载路径规则配置",
      subtitle: "为不同域名配置个性化的下载路径和组织方式",
      defaultSettingsTitle: "默认分类设置",
      defaultSettingsDesc: "设置未匹配到域名规则时的默认分类方式：",
      fileTypeLabel: "启用文件类型分类",
      dateLabel: "启用日期分类",
      exampleTitle: "默认路径示例",
      exampleDesc: "当未匹配域名规则时，下载路径将按照以下方式组织：",
      domainRulesTitle: "域名规则设置",
      addRuleText: "添加域名规则",
      tipsTitle: "使用提示",
      tip1: "使用 <strong>*.你的域名.com</strong> 匹配所有子域名",
      tip2: "路径支持多级目录，如 <strong>Work/Documents</strong>",
      tip3: "禁用类型/日期分类后，文件将直接保存到域名目录",
      tip4: "规则按从上到下的顺序匹配，优先匹配第一个符合条件的规则",
      tip5: "拖拽规则可以调整匹配顺序",
      saveText: "保存设置",
      resetText: "恢复默认",
      toolsTitle: "数据工具",
      toolsDesc: "导入/导出设置数据，用于备份或迁移",
      exportText: "导出设置",
      importText: "导入设置",
      confirmReset: "确定要恢复默认设置吗？当前设置将被覆盖。",
      settingsSaved: "设置已成功保存！",
      settingsReset: "已恢复默认设置",
      settingsExported: "设置已导出",
      settingsImported: "设置已成功导入并保存",
      importError: "导入失败: 文件格式无效",
      requiredFields: "请填写所有必填字段",
      downloadFolder: "浏览器默认下载路径"
    },
    en: {
      title: "Download Path Rules Configuration",
      subtitle: "Configure personalized download paths and organization for different domains",
      defaultSettingsTitle: "Default Settings",
      defaultSettingsDesc: "Set default classification when no domain rule is matched:",
      fileTypeLabel: "Enable File Type Classification",
      dateLabel: "Enable Date Classification",
      exampleTitle: "Default Path Example",
      exampleDesc: "When no domain rule is matched, the download path will be organized as follows:",
      domainRulesTitle: "Domain Rules Settings",
      addRuleText: "Add Domain Rule",
      tipsTitle: "Usage Tips",
      tip1: "Use <strong>*.yourdomain.com</strong> to match all subdomains",
      tip2: "Paths support multi-level directories, such as <strong>Work/Documents</strong>",
      tip3: "After disabling type/date classification, files will be saved directly to the domain directory",
      tip4: "Rules are matched from top to bottom, with the first matching rule taking priority",
      tip5: "Drag rules to adjust the matching order",
      saveText: "Save Settings",
      resetText: "Restore Defaults",
      toolsTitle: "Data Tools",
      toolsDesc: "Import/export settings for backup or migration",
      exportText: "Export Settings",
      importText: "Import Settings",
      confirmReset: "Are you sure you want to restore default settings? Current settings will be overwritten.",
      settingsSaved: "Settings saved successfully!",
      settingsReset: "Default settings restored",
      settingsExported: "Settings exported",
      settingsImported: "Settings imported and saved successfully",
      importError: "Import failed: Invalid file format",
      requiredFields: "Please fill in all required fields",
      downloadFolder: "Default download path"
    }
  };

  // 当前语言
  let currentLang = 'zh';

  // 切换语言函数
  function switchLanguage(lang) {
    currentLang = lang;
    const texts = translations[lang];

    // 更新界面文本
    document.getElementById('title').textContent = texts.title;
    document.getElementById('subtitle').textContent = texts.subtitle;
    document.getElementById('defaultSettingsTitle').textContent = texts.defaultSettingsTitle;
    document.getElementById('defaultSettingsDesc').textContent = texts.defaultSettingsDesc;
    document.getElementById('fileTypeLabel').textContent = texts.fileTypeLabel;
    document.getElementById('dateLabel').textContent = texts.dateLabel;
    document.getElementById('exampleTitle').textContent = texts.exampleTitle;
    document.getElementById('exampleDesc').textContent = texts.exampleDesc;
    document.getElementById('domainRulesTitle').textContent = texts.domainRulesTitle;
    document.getElementById('addRuleText').textContent = texts.addRuleText;
    document.getElementById('tipsTitle').textContent = texts.tipsTitle;
    document.getElementById('tip1').innerHTML = texts.tip1;
    document.getElementById('tip2').innerHTML = texts.tip2;
    document.getElementById('tip3').innerHTML = texts.tip3;
    document.getElementById('tip4').innerHTML = texts.tip4;
    document.getElementById('tip5').innerHTML = texts.tip5;
    document.getElementById('saveText').textContent = texts.saveText;
    document.getElementById('resetText').textContent = texts.resetText;
    document.getElementById('toolsTitle').textContent = texts.toolsTitle;
    document.getElementById('toolsDesc').textContent = texts.toolsDesc;
    document.getElementById('exportText').textContent = texts.exportText;
    document.getElementById('importText').textContent = texts.importText;

    // 更新路径示例
    updateDefaultPathExample();

    // 更新语言按钮状态
    document.querySelectorAll('.lang-btn').forEach(btn => {
      if (btn.dataset.lang === lang) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 重新渲染规则（更新标签文本）
    renderRules(currentRules);
  }

  // 语言切换事件
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      switchLanguage(lang);
      // 保存语言设置
      chrome.storage.local.set({ language: lang });
    });
  });

  // 加载语言设置
  chrome.storage.local.get(['language'], (result) => {
    if (result.language) {
      switchLanguage(result.language);
    } else {
      switchLanguage('zh');
    }
  });

  // 页面元素引用
  const domainRules = document.getElementById('domain-rules');
  const addRuleBtn = document.getElementById('addRule');
  const saveBtn = document.getElementById('save');
  const resetBtn = document.getElementById('reset');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const defaultEnableFileType = document.getElementById('defaultEnableFileType');
  const defaultEnableDate = document.getElementById('defaultEnableDate');
  const defaultPathExample = document.getElementById('defaultPathExample');

  // 默认规则数据
  const defaultRules = [];

  // 当前规则数据
  let currentRules = [];

  // 加载保存的设置
  function loadSettings() {
    chrome.storage.local.get(['rules', 'defaultSettings'], (result) => {
      if (result.rules && result.rules.length > 0) {
        currentRules = result.rules;
        console.log('从存储加载规则:', currentRules);
      } else {
        currentRules = [...defaultRules];
        console.log('使用默认规则');
      }

      if (result.defaultSettings) {
        defaultEnableFileType.checked = result.defaultSettings.enableFileType;
        defaultEnableDate.checked = result.defaultSettings.enableDate;
        console.log('从存储加载默认设置:', result.defaultSettings);
      } else {
        defaultEnableFileType.checked = true;
        defaultEnableDate.checked = true;
        console.log('使用默认设置');
      }

      renderRules(currentRules);
      updateDefaultPathExample();
    });
  }

  // 渲染规则列表
  function renderRules(rules) {
    domainRules.innerHTML = '';

    if (rules.length === 0) {
      const emptyMessage = currentLang === 'zh' ?
        '暂无规则，点击"添加域名规则"创建新规则' :
        'No rules yet, click "Add Domain Rule" to create a new rule';

      domainRules.innerHTML = `<p class="empty-rules">${emptyMessage}</p>`;
      return;
    }

    rules.forEach((rule, index) => {
      const ruleElement = document.createElement('div');
      ruleElement.className = 'rule';
      ruleElement.dataset.index = index;

      const typeLabel = currentLang === 'zh' ? '类型' : 'Type';
      const dateLabel = currentLang === 'zh' ? '日期' : 'Date';
      const removeLabel = currentLang === 'zh' ? '删除' : 'Remove';

      ruleElement.innerHTML = `
            <div class="drag-handle">≡</div>
            <div class="rule-input">
              <input type="text" class="domain" placeholder="${currentLang === 'zh' ? '域名（如：example.com）' : 'example.com'}" value="${rule.domain}">
            </div>
            <div class="rule-input">
              <input type="text" class="path" placeholder="${currentLang === 'zh' ? '路径（如：Example）' : 'Example'}" value="${rule.path}">
            </div>
            <div class="rule-controls">
              <div class="rule-toggle">
                <label class="control-label">
                  <div class="switch">
                    <input type="checkbox" class="file-type-toggle" ${rule.enableFileType ? 'checked' : ''}>
                    <span class="slider"></span>
                  </div>
                  <span class="toggle-label">${typeLabel}</span>
                </label>
              </div>
              <div class="rule-toggle">
                <label class="control-label">
                  <div class="switch">
                    <input type="checkbox" class="date-toggle" ${rule.enableDate ? 'checked' : ''}>
                    <span class="slider"></span>
                  </div>
                  <span class="toggle-label">${dateLabel}</span>
                </label>
              </div>
              <div class="rule-actions">
                <button class="remove-rule">${removeLabel}</button>
              </div>
            </div>
          `;

      // 添加删除按钮事件
      ruleElement.querySelector('.remove-rule').addEventListener('click', () => {
        currentRules.splice(index, 1);
        renderRules(currentRules);
      });

      // 添加拖拽处理
      const dragHandle = ruleElement.querySelector('.drag-handle');
      dragHandle.addEventListener('mousedown', initDrag);

      domainRules.appendChild(ruleElement);
    });

    // 初始化拖拽排序
    initDragSort();
  }

  // 拖拽排序功能
  let dragSrcElement = null;

  function initDrag(e) {
    dragSrcElement = this.closest('.rule');
    dragSrcElement.classList.add('dragging');

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDrag(e) {
    if (!dragSrcElement) return;

    // 计算拖拽位置
    const rules = Array.from(domainRules.querySelectorAll('.rule:not(.dragging)'));
    const nextSibling = rules.find(rule => {
      return e.clientY < rule.getBoundingClientRect().top + rule.offsetHeight / 2;
    });

    domainRules.insertBefore(dragSrcElement, nextSibling);
  }

  function onDragEnd() {
    if (dragSrcElement) {
      dragSrcElement.classList.remove('dragging');

      // 更新规则顺序
      const newRules = [];
      const ruleElements = domainRules.querySelectorAll('.rule');
      ruleElements.forEach(el => {
        const index = parseInt(el.dataset.index);
        if (!isNaN(index)) {
          newRules.push(currentRules[index]);
        }
      });

      currentRules = newRules;
      renderRules(currentRules);
    }

    dragSrcElement = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', onDragEnd);
  }

  function initDragSort() {
    const rules = domainRules.querySelectorAll('.rule');
    rules.forEach(rule => {
      rule.addEventListener('dragover', function (e) {
        e.preventDefault();
      });

      rule.addEventListener('dragenter', function (e) {
        e.preventDefault();
        this.classList.add('drag-over');
      });

      rule.addEventListener('dragleave', function () {
        this.classList.remove('drag-over');
      });
    });
  }

  // 添加新规则
  addRuleBtn.addEventListener('click', () => {
    currentRules.push({
      domain: "",
      path: currentLang === 'zh' ? "新规则" : "New Rule",
      enableFileType: true,
      enableDate: true
    });
    renderRules(currentRules);
  });

  // 更新默认路径示例
  function updateDefaultPathExample() {
    const texts = translations[currentLang];
    const segments = [texts.downloadFolder];

    if (defaultEnableFileType.checked) {
      segments.push("Images");
    }
    if (defaultEnableDate.checked) {
      segments.push("2023-10-15");
    }

    segments.push("image.jpg");
    defaultPathExample.textContent = segments.join('/');
  }

  // 监听默认设置变化
  defaultEnableFileType.addEventListener('change', updateDefaultPathExample);
  defaultEnableDate.addEventListener('change', updateDefaultPathExample);

  // 保存设置
  saveBtn.addEventListener('click', () => {
    // 收集所有规则
    const rules = [];
    let hasError = false;

    document.querySelectorAll('.rule').forEach(ruleElement => {
      const domain = ruleElement.querySelector('.domain').value.trim();
      const path = ruleElement.querySelector('.path').value.trim();
      const enableFileType = ruleElement.querySelector('.file-type-toggle').checked;
      const enableDate = ruleElement.querySelector('.date-toggle').checked;

      if (!domain) {
        ruleElement.querySelector('.domain').style.borderColor = 'var(--light-error)';
        hasError = true;
      } else {
        ruleElement.querySelector('.domain').style.borderColor = '';
      }

      if (!path) {
        ruleElement.querySelector('.path').style.borderColor = 'var(--light-error)';
        hasError = true;
      } else {
        ruleElement.querySelector('.path').style.borderColor = '';
      }

      if (domain && path) {
        rules.push({
          domain,
          path,
          enableFileType,
          enableDate
        });
      }
    });

    if (hasError) {
      showNotification(translations[currentLang].requiredFields, 'error');
      return;
    }

    // 收集默认设置
    const defaultSettings = {
      enableFileType: defaultEnableFileType.checked,
      enableDate: defaultEnableDate.checked
    };

    // 保存到chrome.storage
    chrome.storage.local.set({ rules, defaultSettings, language: currentLang }, () => {
      showNotification(translations[currentLang].settingsSaved);
      console.log('保存的规则:', rules);
      console.log('保存的默认设置:', defaultSettings);

      // 更新当前规则
      currentRules = rules;
    });
  });

  // 恢复默认设置
  resetBtn.addEventListener('click', () => {
    const confirmMessage = translations[currentLang].confirmReset;
    if (confirm(confirmMessage)) {
      currentRules = [...defaultRules];
      defaultEnableFileType.checked = true;
      defaultEnableDate.checked = true;

      renderRules(currentRules);
      updateDefaultPathExample();

      // 保存默认设置
      chrome.storage.local.set({
        rules: currentRules,
        defaultSettings: {
          enableFileType: true,
          enableDate: true
        },
        language: currentLang
      }, () => {
        showNotification(translations[currentLang].settingsReset);
      });
    }
  });

  // 导出设置
  exportBtn.addEventListener('click', () => {
    const settings = {
      rules: currentRules,
      defaultSettings: {
        enableFileType: defaultEnableFileType.checked,
        enableDate: defaultEnableDate.checked
      },
      language: currentLang
    };

    const dataStr = "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(settings, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "download_rules_settings.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    showNotification(translations[currentLang].settingsExported);
  });

  // 导入设置
  importBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function (event) {
        try {
          const settings = JSON.parse(event.target.result);

          // 验证导入的数据结构
          if (!settings.rules || !Array.isArray(settings.rules)) {
            throw new Error('无效的设置文件');
          }

          currentRules = settings.rules;

          if (settings.defaultSettings) {
            defaultEnableFileType.checked = !!settings.defaultSettings.enableFileType;
            defaultEnableDate.checked = !!settings.defaultSettings.enableDate;
          }

          // 更新语言（如果导入的设置中包含语言）
          if (settings.language && (settings.language === 'zh' || settings.language === 'en')) {
            switchLanguage(settings.language);
          }

          renderRules(currentRules);
          updateDefaultPathExample();

          // 保存导入的设置
          chrome.storage.local.set(settings, () => {
            showNotification(translations[currentLang].settingsImported);
          });
        } catch (error) {
          console.error('导入失败:', error);
          showNotification(translations[currentLang].importError, 'error');
        }
      };

      reader.readAsText(file);
    };

    input.click();
  });
  // 显示通知
  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;

    if (type === 'error') {
      notification.style.background = 'var(--light-error)';
    }

    document.body.appendChild(notification);

    setTimeout(() => {
      document.body.removeChild(notification);
    }, 3000);
  }

  // 初始加载
  loadSettings();
});