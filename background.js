let recentDomains = [];
let activeDomain = null;

// 跟踪导航历史
chrome.webNavigation.onCompleted.addListener((details) => {
  try {
    const url = new URL(details.url);
    recentDomains = [url.hostname, ...recentDomains].slice(0, 5);
  } catch { }
}, { url: [{ schemes: ['http', 'https'] }] });

// 接收内容脚本消息
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "pageVisibility") {
    activeDomain = message.domain;
  }
});

chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  let isSuggestCalled = false;
  console.log("Download Start...");
  chrome.storage.local.get({
    rules: [],
    defaultSettings: {
      enableFileType: true,
      enableDate: true
    }
  }, async ({ rules, defaultSettings }) => { // 改为 async 函数
    if (isSuggestCalled) return;

    try {
      // 多途径获取域名
      const domain = await getDownloadDomain(item);

      const fileName = item.filename.split(/[\\/]/).pop() || item.filename;
      const fileType = await getFileCategory(fileName);
      const dateStr = getDateString();

      const pathSegments = [];

      // 匹配规则（如果有域名）
      let matchedRule = null;
      if (domain) {
        matchedRule = rules.find(rule => {
          const regexPattern = rule.domain
            .replace(/\./g, '\\.')
            .replace(/\*/g, '[^.]*')
            .replace(/^\\\.\*/, '(?:[^.]+\\.)?');

          return new RegExp(`^${regexPattern}$`).test(domain);
        });
      }

      // 应用设置
      const settings = matchedRule
        ? matchedRule
        : defaultSettings;

      // 添加规则路径（如果有）
      if (matchedRule) {
        pathSegments.push(matchedRule.path);
      }

      // 文件类型分类
      if (settings.enableFileType && fileType) {
        pathSegments.push(fileType);
      }

      // 日期分类
      if (settings.enableDate) {
        pathSegments.push(dateStr);
      }

      // 添加文件名
      pathSegments.push(fileName);

      // 构建最终路径
      let finalPath = pathSegments.join('/')
        .replace(/[\\/]+/g, '/')
        .replace(/[:\*\?"<>\|]/g, '_');

      // 路径验证
      if (!isValidPath(finalPath)) {
        console.warn('Invalid path, fallback to original:', finalPath);
        finalPath = item.filename;
      }

      isSuggestCalled = true;
      suggest({
        filename: finalPath,
        conflictAction: 'uniquify'
      });
    } catch (error) {
      console.error('Error:', error);
      suggest({ filename: item.filename });
    }
  });

  return true;
});
// 多途径获取域名
async function getDownloadDomain(item) {
  let domain = "";
  // 方法1: 直接从下载URL获取
  console.log(item.url);
  if (item.url) {
    const url = new URL(item.url);
    if (url.hostname) {
      domain = url.hostname;
      return domain;
    }
  }
  // 方法2: 从referrer获取
  console.log(item.referrer);
  if (item.referrer) {
    const referrerUrl = new URL(item.referrer);
    if (referrerUrl.hostname) {
      domain = referrerUrl.hostname;
      return domain;
    }
  }
  // 方法3: 从发起下载的标签页获取
  console.log(item.tabId);
  if (item.tabId && item.tabId !== -1) {
    const tab = await chrome.tabs.get(item.tabId);
    if (tab && tab.url) {
      const tabUrl = new URL(tab.url);
      if (tabUrl.hostname) {
        domain = tabUrl.hostname;
        return domain;
      }
    }
  }
  // 方法4: 从最近的浏览历史中查找
  const history = await chrome.history.search({
    text: '',
    startTime: Date.now() - 10000, // 最近10秒
    maxResults: 5
  });
  console.log(history);
  if (history) {
    for (const entry of history) {
      try {
        const entryUrl = new URL(entry.url);
        return entryUrl.hostname;
      } catch { }
    }
  }
  // 方法5: 使用导航跟踪器
  console.log(recentDomains);
  if (!domain && recentDomains.length > 0) {
    if (recentDomains[0]) {
      domain = recentDomains[0];
      return domain;
    }
  }
  // 方法6: 使用内容脚本报告的活跃域名
  console.log(activeDomain);
  if (!domain && activeDomain) {
    domain = activeDomain;
    return domain;
  }
  // 所有方法都失败
  console.warn('All Function Failed!');
  return "";
}

// 异步获取文件类型分类
async function getFileCategory(filename) {
  // 异步获取语言设置
  const result = await chrome.storage.local.get("language");
  const language = result.language || 'en'; // 默认英语
  
  const ext = (filename.split('.').pop() || '').toLowerCase();
  
  // 定义多语言分类映射
  const typeMap = {
    "zh": {
      // 图片类型
      "图片": ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tif', 'tiff'],
      // 文档类型
      "文档": ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'rtf', 'odt', 'ods', 'odp'],
      // 压缩包类型
      "压缩包": ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'z', 'lz', 'lzma'],
      // 视频类型
      "视频": ['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg', 'webm'],
      // 音频类型
      "音频": ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'aiff', 'ape'],
      // 编程代码
      "代码": ['js', 'ts', 'html', 'css', 'json', 'xml', 'php', 'py', 'java', 'c', 'cpp', 'h', 'sh', 'bat', 'yml', 'yaml'],
      // 可执行文件
      "可执行文件": ['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm', 'apk'],
      // 字体
      "字体": ['ttf', 'otf', 'woff', 'woff2', 'eot']
    },
    "en": {
      // 图片类型
      "Images": ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tif', 'tiff'],
      // 文档类型
      "Documents": ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'rtf', 'odt', 'ods', 'odp'],
      // 压缩包类型
      "Archives": ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'z', 'lz', 'lzma'],
      // 视频类型
      "Videos": ['mp4', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg', 'webm'],
      // 音频类型
      "Audio": ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'aiff', 'ape'],
      // 编程代码
      "Code": ['js', 'ts', 'html', 'css', 'json', 'xml', 'php', 'py', 'java', 'c', 'cpp', 'h', 'sh', 'bat', 'yml', 'yaml'],
      // 可执行文件
      "Executables": ['exe', 'msi', 'dmg', 'pkg', 'deb', 'rpm', 'apk'],
      // 字体
      "Fonts": ['ttf', 'otf', 'woff', 'woff2', 'eot']
    }
  };

  // 获取当前语言的分类映射
  const langMap = typeMap[language] || typeMap['en'];
  
  // 检查扩展名是否在分类中
  for (const [type, exts] of Object.entries(langMap)) {
    if (exts.includes(ext)) {
      // 返回分类名称（首字母大写）
      return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }
  
  // 如果没有匹配的分类，返回空字符串
  return '';
}

// 获取日期字符串（YYYY-MM-DD）
function getDateString() {
  const d = new Date();
  return [
    d.getFullYear(),
    (d.getMonth() + 1).toString().padStart(2, '0'),
    d.getDate().toString().padStart(2, '0')
  ].join('-');
}

// 验证路径合法性
function isValidPath(path) {
  return !(
    // 检查绝对路径和非法字符
    path.startsWith('/') ||
    path.startsWith('\\') ||
    /[\x00-\x1f:\\:*?"<>|]/.test(path) // 包含控制字符或非法符号
  );
}