<p align="center">
  <img src="docs/assets/logo.png" width="96" height="96" alt="Smart Download Organizer logo">
</p>

<h1 align="center">Smart Download Organizer</h1>

<p align="center">让新下载各归其位 · A place for every new download</p>
<p align="center">免费开源 · Chrome / Microsoft Edge · 中文 / English</p>
<p align="center">
  <a href="#简体中文">简体中文</a> ·
  <a href="#english">English</a> ·
  <a href="https://chromewebstore.google.com/detail/下载路径规则配置-smart-download-o/dihefcbongaiapidifokoklienncabko">Chrome Web Store</a> ·
  <a href="https://microsoftedge.microsoft.com/addons/detail/cpdapmdfjccinmcncpogpbolcboadgdh">Edge Add-ons</a> ·
  <a href="LICENSE">MIT License</a>
</p>

## 简体中文

Smart Download Organizer 在文件开始下载时，按照你设置的**来源域名、文件类型和日期规则**生成保存目录，减少下载后的手动整理。

> **版本说明（2026-10-29）**：当前公开的 `main` 源码版本为 `1.0`。本文中的 `1.1.0` 新增内容属于开发预览，商店实际版本以各自页面为准。

### 安装

- [从 Chrome Web Store 安装](https://chromewebstore.google.com/detail/下载路径规则配置-smart-download-o/dihefcbongaiapidifokoklienncabko)
- [从 Microsoft Edge Add-ons 安装](https://microsoftedge.microsoft.com/addons/detail/cpdapmdfjccinmcncpogpbolcboadgdh)

新版源码与运行资源正在整理同步，建议普通用户先通过商店安装。获得完整开发目录后，可在 `chrome://extensions` 或 `edge://extensions` 开启开发者模式，选择“加载已解压的扩展程序”，加载含有 `manifest.json` 的目录。

### 能做什么

- **网站专属目录**：为不同域名设置独立目录名称，支持精确域名与 `*.example.com` 形式的通配符。
- **按文件类型整理**：支持图片、文档、压缩包、视频、音频、代码、可执行文件和字体。
- **按日期归档**：需要时在保存路径中加入日期目录。
- **规则优先匹配**：按配置顺序应用第一条匹配的域名规则。
- **配置备份与迁移**：导出或导入 JSON，便于备份和手动迁移。
- **中英文界面**：可切换界面语言与内置分类目录名称。

![按域名、文件类型和日期整理新下载的功能示意](docs/assets/overview-zh-CN.png)

*上图为功能示意，非浏览器界面截图；实际路径取决于已保存的规则。*

### 开始使用

1. 在浏览器的扩展管理页打开本扩展的配置页面。
2. 选择需要的文件类型、日期选项，或添加网站专属目录规则。
3. 保存配置，再发起新的下载。

例如，为 `example.com` 设置路径名称 `项目素材`，并为该规则开启文件类型和日期目录，中文界面中的图片可以保存到：

```text
浏览器默认下载目录/
└── 项目素材/
    └── 图片/
        └── 2026-10-29/
            └── example.jpg
```

已有文件保持原位。所有目录均位于浏览器默认下载目录下，不能直接指定任意磁盘绝对路径。

### 1.1.0 开发预览

新版的本地开发版本已包含以下调整，正在整理发布：

- 分行卡片式设置页面，以及可立即启停整理的工具栏快捷浮窗。
- 文件类型与域名路径规则使用独立弹窗，支持启停和路径预览。
- 自定义文件分类及 `.tar.gz` 等复合后缀。
- 独立的域名、分类日期选项和日期格式。
- 保存按钮红点提示、配置导入导出与还原操作。
- 新 logo，以及中英文商店名称和简短说明。

新版中，域名与文件类型的单独配置优先于全局配置。要生成带日期的实际下载目录，需要确认命中的域名或分类规则已开启日期目录。

**旧版升级**：请先导出一份 JSON 备份，再通过原商店条目更新。常见旧字段已有读取转换，迁移前自动备份、异常规则提示和部分缺失字段的兼容保护仍在完善。

### 隐私与权限

用户的目录规则、分类选项和界面语言保存在浏览器本地存储中。Chrome 与 Edge 的配置分别保存，需要跨浏览器迁移时可手动导出、导入 JSON。

| 源码版本 | 申请的权限 |
| --- | --- |
| 1.0（当前公开源码） | `downloads`、`storage`、`history`、`tabs`、`webNavigation`、`activeTab` |
| 1.1.0（开发预览） | `downloads`、`storage` |

新版移除网页内容脚本，使用浏览器下载事件提供的文件名和来源网址在本机生成路径，不向开发者服务器上传下载信息，不自动云同步。安装时请以对应版本的权限提示和 `manifest.json` 为准。

### 支持开发者

本项目免费开源，所有功能均可直接使用。如果它对你有帮助，欢迎通过反馈问题、改进文档或提交代码支持维护。

自愿打赏渠道正在准备，后续将提供国内二维码和海外支持链接。打赏用于支持持续维护与问题修复，与功能使用无关。

### 反馈与参与

欢迎通过 [GitHub Issues](https://github.com/liuyanlong99/Smart-Download-Organizer/issues) 反馈问题。请说明浏览器和扩展版本、相关开关、脱敏后的规则、期望路径与实际路径；请勿提交包含私人项目名或敏感网址的完整配置。

欢迎修复问题、改善翻译和文档。项目采用 [MIT License](LICENSE)，第三方资源的许可随对应资源保留。

---

## English

Smart Download Organizer creates folder paths for new downloads using the **source website, file type, and date rules** you choose.

> **Version status — October 29, 2026:** the public `main` source is version `1.0`. Items described as `1.1.0` below are a development preview. Check each store page for its published version.

### Install

- [Install from the Chrome Web Store](https://chromewebstore.google.com/detail/下载路径规则配置-smart-download-o/dihefcbongaiapidifokoklienncabko)
- [Install from Microsoft Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/cpdapmdfjccinmcncpogpbolcboadgdh)

The updated source and runtime assets are being prepared for publication. Store installation is recommended for now. Once you have a complete development folder, open `chrome://extensions` or `edge://extensions`, enable Developer mode, and load the unpacked folder containing `manifest.json`.

### Features

- **Website-specific folders:** assign a folder name to a domain, with exact-domain and `*.example.com` wildcard rules.
- **File-type folders:** organize Images, Documents, Archives, Videos, Audio, Code, Executables, and Fonts.
- **Date folders:** add a date to the destination when needed.
- **Ordered rules:** the first matching domain rule takes priority.
- **Local JSON backups:** export and import settings for backup or manual migration.
- **English and Chinese:** switch the interface language and built-in category folder names.

![Feature illustration showing website, file-type and date folders](docs/assets/overview-en.png)

*This is a feature illustration, not a captured browser screenshot. Actual paths depend on your saved rules.*

### Get started

1. Open the extension's settings from your browser's extension management page.
2. Choose file-type and date options, or add a website-specific folder rule.
3. Save your settings, then start a new download.

For example, a rule for `example.com` with the folder name `Project Assets`, file-type folders, and date folders enabled can produce:

```text
Default download directory/
└── Project Assets/
    └── Images/
        └── 2026-10-29/
            └── example.jpg
```

Existing files remain in place. Destinations are subfolders of the browser's default download directory; arbitrary absolute disk paths are not supported.

### Version 1.1.0 preview

The local development version includes a redesigned settings page, a toolbar popup with an immediate on/off switch, separate file-type and domain dialogs, custom categories, compound extensions such as `.tar.gz`, individual date settings, a new logo, and localized store metadata.

Individual domain and category settings take precedence over global settings. To include a date in an actual download path, enable date folders in the matching rule or category.

Before upgrading, export a JSON backup and update through the existing store listing. Common legacy fields can already be read and converted; automatic pre-migration backups, invalid-rule reporting, and some missing-field compatibility protections are still being completed.

### Privacy and permissions

Rules and preferences are stored locally in the browser. Chrome and Edge keep separate settings; use JSON export/import to move them manually.

| Source version | Requested permissions |
| --- | --- |
| 1.0 — current public source | `downloads`, `storage`, `history`, `tabs`, `webNavigation`, `activeTab` |
| 1.1.0 — development preview | `downloads`, `storage` |

Version 1.1.0 removes website content scripts. It processes browser-supplied download filenames and source URLs locally to construct paths, without uploading download information to the developer or automatically syncing settings to the cloud. Check the permissions and manifest for the version you install.

### Support development

This project is free and open source. All features are available to everyone. You can support maintenance by reporting issues, improving documentation, or contributing code.

Optional tipping channels are being prepared, including domestic QR codes and an international support link. Tips will support maintenance and bug fixes; using the extension will remain independent of tipping.

### Feedback and contributions

Please use [GitHub Issues](https://github.com/liuyanlong99/Smart-Download-Organizer/issues) for bug reports. Include your browser and extension versions, relevant settings, a redacted rule, and the expected and actual paths.

Contributions to code, translations, and documentation are welcome. This project is licensed under the [MIT License](LICENSE). Keep the relevant notices when reusing third-party resources.
