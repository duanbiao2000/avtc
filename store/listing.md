# AVTC · Chrome 网上应用店提交材料

**版本：** 1.0.0 · **打包文件：** `avtc/avtc-1.0.0.zip`（17.9 KB，含全部代码与两种语言）
**本文档用途：** 逐字段填写商店后台（Chrome Developer Dashboard）。所有可复制的字段都放在代码块里，直接粘。

---

## 0. 资产清单（`avtc/store/`）

| 文件 | 规格 | 用途 | 是否必需 |
|---|---|---|---|
| `icon-128.png` | 128×128 PNG | 商店图标 | ✅ 必需 |
| `screenshots/{zh_CN,en}/01-popup-in-context.png` | 1280×800 | 截图 1：真实仓库页 + 弹窗 | ✅ 至少 1 张，建议 5 张 |
| `screenshots/{zh_CN,en}/02-keyboard-shortcuts.png` | 1280×800 | 截图 2：数字键与后台打开 | 建议 |
| `screenshots/{zh_CN,en}/03-options-page.png` | 1280×800 | 截图 3：选项页 | 建议 |
| `screenshots/{zh_CN,en}/04-edge-states.png` | 1280×800 | 截图 4：三种边界状态 | 建议 |
| `screenshots/{zh_CN,en}/05-privacy.png` | 1280×800 | 截图 5：权限与隐私 | 建议 |
| `promo/small-440x280-{zh_CN,en}.png` | 440×280 PNG | 小型宣传图块 | 可选（建议传） |
| `promo/marquee-1400x560-{zh_CN,en}.png` | 1400×560 PNG | 大型宣传图块 | 可选（仅首页推荐用） |

**生成方式与保真度声明（审核若问起可照此回答）：**

截图由 `avtc/scripts/make-store-assets.mjs` 用 Puppeteer 从 **`dist/` 里真实构建的界面文件**（`popup.html`、`options.html`）渲染而成，界面文字取自 `public/_locales`，因此截图与商店实际行为不会漂移。仅有三处属于"截图环境"而非产品行为的替换，均已在脚本注释中标明：

1. `chrome.*` API 被替换为等价桩件（`chrome.i18n.getMessage` 用真实 locale 文件实现，`chrome.tabs.query` 返回演示用的仓库地址）；
2. 截图 04 的"已打开：GitDiagram"提示是**真实点击**触发的真实 UI 反馈（脚本中途会断言该文案出现，否则构建失败），只是 `tabs.create` 未真的开标签页；
3. 字体栈指向本机 Noto CJK，因为界面本身声明的是 macOS/Windows 系统字体，而截取环境是 Linux。

**没有**任何手工绘制或虚构的功能截图。

重新生成：`npm run build && npm run assets:store`（需要 `puppeteer` devDependency，首次会下载 Chrome）。

---

## 1. 商店信息（Store listing）标签

| 字段 | 填写内容 |
|---|---|
| **名称** | 见下方代码块（中英各一套，随商品语言切换） |
| **简短说明（summary）** | 取自 `manifest.json` 的 `description`，由扩展包自动带入，长度已校验（中 58 / 英 126 字符，上限 132） |
| **类别** | 开发者工具（Developer Tools） |
| **语言** | 中文（简体）+ English |
| **商品图标** | `store/icon-128.png` |
| **截图** | `store/screenshots/zh_CN/*`（中文商品）+ `store/screenshots/en/*`（英文商品），各 5 张，顺序 01→05 |
| **小型宣传图块** | `store/promo/small-440x280-zh_CN.png` / `-en.png` |
| **大型宣传图块** | `store/promo/marquee-1400x560-zh_CN.png` / `-en.png` |
| **官方网址 / 支持网址** | 建议填代码仓库地址（若公开）或留空 |
| **隐私政策网址** | **必填**。页面已备好：`docs/privacy.html`，按仓库 README「发布到 GitHub / 托管隐私政策」开启 GitHub Pages 后得到公开 URL（见 §5） |

**名称（中文）**
```
AVTC — GitHub 仓库工具跳转
```
**名称（English）**
```
AVTC — GitHub repo tool launcher
```

**详细说明（中文，粘贴到"说明"框）**
```
AVTC（Auckland Voyage Training Camp）是一个 URL 路由器：识别你正在浏览的 GitHub 仓库，把仓库地址改写成 8 个第三方开发者工具的地址，并在新标签页直接打开。

在任意 github.com/{owner}/{repo} 页面点一下扩展图标（或按 Alt+Shift+A），弹窗会读到当前仓库名，并把 8 个动作按 4 个分类列出：

【理解】
· 看架构图 — GitDiagram
· 读项目讲解 — DeepWiki
· 用 Zread 解读 — Zread

【AI 协作】
· 拆成 AI 提示词 — GitReverse
· 整理给 AI — Gitingest

【读写代码】
· 在线读源码 — GitHub1s
· 在线改代码 — GitHub.dev

【运行】
· 尝试在线运行 — StackBlitz

使用方式
· 单击（或按数字键 1–8）：在当前窗口前台打开新标签页
· Ctrl / Cmd + 单击、鼠标中键：在后台打开，弹窗保持打开，可连续打开多个工具
· Esc：关闭弹窗
· 地址无效时不会打开任何标签页，只在弹窗底部给出一行文字提示

选项页（弹窗右上角齿轮）
· 隐藏不常用的动作，被隐藏的动作不再占用数字键
· 在同一分类内用 ↑ ↓ 调整顺序
· 一键恢复默认
· 偏好保存在 chrome.storage.sync，随 Chrome 账号同步到其他设备

隐私
· 只申请 storage 与 activeTab 两个权限，安装时不会出现"读取你在网站上的数据"之类的警告
· 扩展自身不发起任何网络请求，不含遥测，不含远程代码，不注入内容脚本
· 仓库地址不会被保存；只有在你点击某个动作时，才会随浏览器跳转一并发送给该动作对应的第三方站点

说明
· 扩展只负责生成地址并跳转，不检测目标站点是否可用：站点下线、页面 404、需要登录、私有仓库无权限，都不属于"地址无效"
· 8 个工具均为第三方服务，各自的服务条款与隐私政策由其自行提供；AVTC 与它们没有隶属关系
· 各工具对私有仓库的支持不同，选项页内有逐条说明
```

**详细说明（English）**
```
AVTC (Auckland Voyage Training Camp) is a URL router. It recognises the GitHub repository you are viewing, rewrites the repository address into the addresses of eight third-party developer tools, and opens them in a new tab — one click, no intermediate step.

Open any github.com/{owner}/{repo} page, click the extension icon (or press Alt+Shift+A), and the popup reads the current repository and lists eight actions in four categories:

Understand
· View architecture — GitDiagram
· Read the guide — DeepWiki
· Explain with Zread — Zread

AI workflow
· Turn into an AI prompt — GitReverse
· Digest for AI — Gitingest

Read & edit
· Read source online — GitHub1s
· Edit online — GitHub.dev

Run
· Try running it — StackBlitz

How to use it
· Click, or press keys 1–8: opens a foreground tab
· Ctrl / Cmd + click or middle click: opens a background tab and keeps the popup open, so several tools can be opened in a row
· Esc: closes the popup
· If an address is rejected, nothing is opened and a single line of text explains why

Settings (gear icon in the popup)
· Hide actions you do not use; hidden actions release their number key
· Reorder inside a category with ↑ ↓
· Restore defaults in one click
· Preferences live in chrome.storage.sync and follow your Chrome account

Privacy
· Requests only storage and activeTab — no "read your data on websites" warning at install time
· Makes no network requests of its own, contains no telemetry and no remote code, injects no content scripts
· The repository address is never stored; it is sent to a third-party site only when you click one of its actions, as part of the browser navigation

Please note
· The extension builds addresses and navigates; it does not check whether a target site is reachable. A retired site, a 404 page, a sign-in requirement or a private repo you cannot access is not an "invalid address"
· All eight tools are third-party services with their own terms and privacy policies. AVTC is not affiliated with them
· Support for private repositories differs per tool; the settings page explains each one
```

---

## 2. 隐私规范（Privacy practices）标签

### 2.1 单一用途说明（Single purpose）

**中文**
```
AVTC 只有一个用途：把当前 GitHub 仓库的地址改写成 8 个第三方开发者工具的地址，并在新标签页打开。它不分析仓库内容，不提供与本用途无关的任何其他功能。
```
**English**
```
AVTC has one purpose: to rewrite the address of the current GitHub repository into the address of one of eight third-party developer tools and open it in a new tab. It does not analyse repository contents and does nothing unrelated to that purpose.
```

### 2.2 权限理由（Permission justification）

| 权限 | 理由（可直接粘贴） |
|---|---|
| `storage` | 保存用户的显示偏好：哪些动作被隐藏、动作的排列顺序。不保存仓库地址、浏览历史或任何个人数据。 |
| `activeTab` | 用户点击扩展图标后，读取当前标签页的地址，从中提取 GitHub 仓库的 owner/repo 以生成目标地址。扩展不会读取页面内容，也不会在用户未点击时访问任何标签页。 |

English versions:

| Permission | Justification |
|---|---|
| `storage` | Stores the user's display preferences: which actions are hidden and in what order. It stores no repository addresses, no browsing history and no personal data. |
| `activeTab` | After the user clicks the extension icon, reads the current tab's address to extract the GitHub owner/repo needed to build the target address. The extension does not read page content and does not touch any tab unless the user clicks the icon. |

**本扩展不申请**：`tabs`、`host_permissions`、`<all_urls>`、`scripting`、`webRequest`、`declarativeNetRequest`。

### 2.3 远程代码（Remote code）

选择 **"不使用远程代码"**。

理由：全部 JavaScript/CSS 随扩展包分发，构建产物中不含 `eval`、`new Function`，页面中无内联脚本（`npm run check:dist` 会对此做自动校验）。扩展不加载任何 CDN 资源，也不加载远程字体。

### 2.4 数据使用（Data usage）

| 问题 | 回答 |
|---|---|
| 是否收集用户数据？ | **不收集** |
| 个人身份信息 / 健康信息 / 财务与支付信息 / 身份验证信息 / 个人通讯 / 位置 / 网络历史 / 用户活动 / 网站内容 | 全部**不勾选** |
| 是否向第三方出售或转让数据？ | 否 |
| 是否将数据用于与单一用途无关的目的？ | 否 |
| 是否使用数据判断信用度或用于借贷？ | 否 |

**如审核要求补充说明，可用这段：**
```
扩展读取当前标签页的地址（仅在用户点击扩展图标的那一刻），以提取 GitHub 仓库的 owner/repo。该地址不会被存储、不会被上传到任何服务器，也不会用于任何统计。扩展自身不发起任何网络请求；只有用户点击某个动作时，浏览器才会按用户意图跳转到相应第三方站点，此时该地址随正常导航一并出现在目标站点的访问日志中——这与用户手动在地址栏输入该地址完全等价。
```

### 2.5 EU DSA 交易者声明（Trader / Non-trader）

后台会要求你就欧盟《数字服务法》声明身份。**这是一项法律判断，必须由你本人选择**，我不能代填。参考口径（不构成法律意见）：

- 若 AVTC **完全免费、不投放广告、不内购、不收集数据、且你以个人兴趣身份发布** → 通常可选择 **Non-trader**（非交易者）。此选项下，你的名称/地址不会公开展示。
- 若你以公司名义发布、或将来计划收费/内购/接商业合作 → 通常属于 **Trader**，后台会公开显示你的法定名称、地址、邮箱与电话。

非交易者与交易者的判定按**发布者账号**（publisher account），与地区无关：只要欧盟用户能安装，Google 就要求填写该项，选错或漏填可能导致商品被下架。

---

## 3. 分发设置（Distribution）标签

| 字段 | 建议值 |
|---|---|
| 可见性 | 公开（Public） |
| 定价 | 免费 |
| 地区 | 所有地区 |
| 自动发布 | 建议先关闭，人工确认通过后再开启 |

---

## 4. 审核员测试说明（Review instructions，后台"测试说明"字段）

```
扩展无需登录、无需账号、无付费内容，可在任意机器上直接验证。

1. 打开 https://github.com/browser-act/skills
2. 点工具栏上的 AVTC 图标（或按 Alt+Shift+A）
   预期：弹窗顶部显示 browser-act/skills，下列出 8 个动作，分 4 类（理解 / AI 协作 / 读写代码 / 运行）
3. 按数字键 1，或点击第一行"看架构图"
   预期：新标签页打开 https://gitdiagram.com/browser-act/skills（第三方站点，加载速度由其自身决定；GitDiagram 免费且无需账号）
4. 按住 Ctrl（macOS 为 Cmd）再点击任意一行
   预期：新标签页在后台打开，弹窗保持打开，底部出现"已打开：<工具名>"
5. 打开 https://github.com/settings/profile 后再点图标
   预期：动作列表整体置灰、不可点击，底部提示"请打开一个 GitHub 仓库"
6. 点弹窗右上角齿轮进入选项页
   预期：可取消勾选隐藏动作、用 ↑ ↓ 在同一分类内调整顺序；改动即时保存，弹窗顺序同步
7. 权限与网络验证
   预期：扩展仅申请 storage 与 activeTab；打开 DevTools 的 Network 面板可见扩展自身不发起任何请求（点击动作后的跳转属于正常导航）

备注：8 个目标站点均为第三方服务，可能出现加载缓慢、要求登录或对特定仓库不支持的情况，这属于第三方站点行为，不影响扩展功能（扩展只负责生成地址并跳转，不检测站点可用性）。其中 GitHub.dev 需要 GitHub 登录态，StackBlitz 对非 Web/Node 仓库可能无法运行。
```

---

## 5. 提交前必须由你完成的事

| # | 事项 | 说明 |
|---|---|---|
| 1 | **填好隐私政策的占位符** | 编辑 `docs/privacy.html`，替换 `[你的联系邮箱]`、`[生效日期]`、`[可选：仓库地址]`，然后跑 `npm run check:privacy` 直到通过 |
| 2 | **把隐私政策托管到公开 URL** | 开启 GitHub Pages（仓库 `Settings → Pages → Deploy from a branch → main / /docs`）。注意 **GitHub Free 个人账号的 Pages 只能从公开仓库发布**；不想公开代码就走 Cloudflare Pages / Netlify，或把 `docs/` 放进一个公开的小仓库。发布后 URL 为 `https://<账号>.github.io/<仓库名>/privacy.html`，要能直接打开且不能 404 |
| 3 | **注册/登录 Chrome Web Store 开发者账号** | 一次性 $5，我无法代登录 |
| 4 | **商店搜索 "AVTC" 复核重名** | 我在 2026-10-15 用公开搜索未发现同名扩展，但搜索结果受地区与账号影响；请在商店内再确认一次（文档风险项） |
| 5 | **决定 Trader / Non-trader** | 见 §2.5，法律判断 |
| 6 | **上传 zip** | `avtc/avtc-1.0.0.zip`（不要用 `dist/` 目录，商店要求 zip） |
| 7 | **选择商品语言** | 至少填中文（简体）；若同时提交 English 商品，则分别上传 `store/screenshots/en/*` |

**提交后注意**：本次修复了英文 `description` 超长（154 → 126 字符，Chrome 上限 132，超长会导致打包/上架报错）。如果你之前已经上传过旧 zip，请用新的 `avtc/avtc-1.0.0.zip` 覆盖，并把 `manifest.json` 的 `version` 升到 `1.0.1`（命令：改 `public/manifest.json` 后 `npm run build && npm run zip`），否则商店会因版本号未变而拒绝更新。

---

## 6. 已知风险与应对（提交前知悉）

| 风险 | 应对 |
|---|---|
| 第三方站点改规则或下线导致某动作失效 | 模板集中在 `src/core/actions.ts`，改一处即可；发新版本更新 |
| 审核质疑"跳转到第三方站点"的用途 | 单一用途说明已写明是 URL 路由器；扩展不抓取、不分析内容，风险低 |
| 审核为验证 activeTab 理由，可能要求演示触发路径 | §4 的测试说明已给出逐步路径 |
| 用户预期"跳转目标一定可用" | 详情页与选项页均已声明不检测站点可用性，并给出右键复制链接的兜底方式 |
| 名称/图标与既有扩展混淆 | 名称含描述性后缀、图标为自定义 AV 方块；如商店提示重名，改名为 `AVTC — GitHub 工具跳转` 即可 |

---

## 7. 提交清单（勾选式）

```
[ ] 隐私政策已托管，URL 可访问、提到 AVTC
[ ] 商店图标 icon-128.png 已上传
[ ] 5 张截图（中文商品）已按 01→05 顺序上传
[ ] （可选）英文商品截图已上传
[ ] 小型宣传图块已上传
[ ] 名称、简短说明、详细说明已填
[ ] 类别 = 开发者工具，语言 = 中文（简体）+ English
[ ] 单一用途说明、两个权限理由、远程代码 = 否 已填
[ ] 数据使用：不收集（全部不勾选）
[ ] Trader / Non-trader 已声明
[ ] 审核员测试说明已填
[ ] 已上传 avtc-1.0.0.zip（不是 dist/ 目录）
[ ] 商店内搜索 AVTC 确认无重名
[ ] 提交审核
```
