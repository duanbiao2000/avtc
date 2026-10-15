# AVTC 隐私政策 / Privacy Policy

> **使用前请替换三处占位符：** `[你的联系邮箱]`、`[生效日期]`、`[可选：仓库地址]`。
> 托管到任何能公开访问的 URL（GitHub Pages / Cloudflare Pages / Netlify 均可），把该 URL 填进 Chrome 网上应用店后台的"隐私政策网址"字段。
> 商店要求政策中**点名扩展**（本文件已做到），且 URL 不能返回 404。

---

## 中文版

**适用扩展：** AVTC — GitHub 仓库工具跳转（Chrome 扩展，Manifest V3）
**生效日期：** [生效日期]
**联系邮箱：** [你的联系邮箱]

### 一、我们收集什么

**不收集任何个人数据。**

AVTC 不设账号、不含统计埋点、不含广告、不含远程代码，也不会把任何信息发送到我们或第三方运营的服务器。我们不收集、不存储、不出售、不转让任何用户数据。

### 二、扩展会读取什么，以及为什么

| 读取内容 | 时机 | 用途 | 是否保存 |
|---|---|---|---|
| 当前标签页的地址（URL） | 仅在你点击扩展图标或按下快捷键 `Alt+Shift+A` 的那一刻 | 判断当前页面是否为 GitHub 仓库（`github.com/{owner}/{repo}`），并从中提取仓库名以生成目标地址 | **不保存**。仅在内存中使用，弹窗关闭即消失 |

扩展**不读取**页面内容、不注入内容脚本、不记录浏览历史、不访问你的 GitHub 账号，也不在任何其他时间读取任何标签页。

### 三、数据会发往哪里

AVTC 自身**不发起任何网络请求**。

只有当你**主动点击**某个动作时，浏览器才会按你的意图跳转到对应的第三方站点（GitDiagram、DeepWiki、Zread、GitReverse、Gitingest、GitHub1s、GitHub.dev、StackBlitz 之一），此时该仓库地址会作为正常网页访问的一部分出现在该站点的访问日志中 —— 这与你在地址栏手动输入该地址**完全等价**。

这些第三方站点由其各自的运营方提供，其数据处理行为适用它们自己的隐私政策与服务条款。AVTC 与它们没有隶属关系，也不对其内容或可用性负责。

### 四、权限说明

AVTC 只申请两个权限：

- **`storage`**：在 `chrome.storage.sync` 中保存你的显示偏好（哪些动作被隐藏、动作的排列顺序）。该偏好随你的 Chrome 账号同步到其他设备，其中**不含任何仓库地址或个人数据**。
- **`activeTab`**：在你点击扩展图标后，临时获得读取当前标签页地址的权限（见第二节）。

扩展不申请 `tabs`、不申请任何网站访问权限（`host_permissions` / `<all_urls>`）、不申请 `scripting`，因此安装时不会出现"读取你在网站上的数据"之类的权限警告。

### 五、你的控制

- 卸载扩展即可移除全部本地行为；偏好数据存放在你的 Chrome 账号中，可在 Chrome 的同步设置中清除。
- 扩展内不产生任何需要删除的服务器端数据，因为我们不运营任何服务器。

### 六、儿童

AVTC 不面向儿童设计，也不收集任何年龄段用户的数据。

### 七、政策变更

若本政策发生变化，我们会在扩展的更新说明与本页面中注明；生效日期会随之更新。由于扩展不收集数据，预期不会有实质性变更。

### 八、联系我们

对本政策有任何疑问，请联系：[你的联系邮箱]
项目地址：[可选：仓库地址]

---

## English version

**Applies to:** AVTC — GitHub repo tool launcher (Chrome extension, Manifest V3)
**Effective date:** [生效日期]
**Contact:** [你的联系邮箱]

### 1. What we collect

**Nothing. AVTC collects no personal data.**

AVTC has no account system, no analytics, no advertising and no remote code, and it sends nothing to servers operated by us or by third parties. We do not collect, store, sell or transfer any user data.

### 2. What the extension reads, and why

| What | When | Why | Retained? |
|---|---|---|---|
| The address (URL) of the current tab | Only at the moment you click the extension icon or press `Alt+Shift+A` | To decide whether the page is a GitHub repository (`github.com/{owner}/{repo}`) and to extract the repository name used to build the target address | **Never.** Used in memory only; it disappears when the popup closes |

The extension does **not** read page content, inject content scripts, keep browsing history, access your GitHub account, or touch any tab at any other time.

### 3. Where data goes

AVTC makes **no network requests of its own**.

Only when you **click an action** does the browser navigate to the corresponding third-party site (one of GitDiagram, DeepWiki, Zread, GitReverse, Gitingest, GitHub1s, GitHub.dev, StackBlitz). At that point the repository address appears in that site's access logs as part of an ordinary page visit — exactly as if you had typed the address into the address bar yourself.

Those third-party sites are operated by their own providers and their handling of data is governed by their own privacy policies and terms. AVTC is not affiliated with them and is not responsible for their content or availability.

### 4. Permissions

AVTC requests exactly two permissions:

- **`storage`** — stores your display preferences (which actions are hidden and in what order) in `chrome.storage.sync`, synced to your Chrome account. It contains **no repository addresses and no personal data**.
- **`activeTab`** — grants temporary access to the current tab's address after you click the extension icon (see section 2).

The extension does not request `tabs`, any host permissions (`host_permissions` / `<all_urls>`) or `scripting`, so no "read your data on websites" warning appears at install time.

### 5. Your control

- Uninstalling the extension removes all local behaviour; preference data lives in your Chrome account and can be cleared through Chrome's sync settings.
- There is no server-side data to delete, because we operate no server.

### 6. Children

AVTC is not directed at children and collects no data from users of any age.

### 7. Changes

If this policy changes we will note it in the extension's release notes and on this page, and the effective date will be updated. Since the extension collects no data, no material change is expected.

### 8. Contact

Questions about this policy: [你的联系邮箱]
Project: [可选：仓库地址]
