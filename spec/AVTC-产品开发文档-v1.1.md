# AVTC 产品开发文档 v1.1（最终版）

**AVTC(Auckland Voyage Training Camp)** 是一个 Chrome 扩展(Manifest V3)。它识别当前 GitHub 仓库,把仓库地址改写成 8 个第三方工具的地址,并在新标签页打开 —— **点击即跳转,中间不显示地址、不做二次确认**;若地址被判为无效,则不跳转,仅在弹窗底部给出一行文字提示。

| 项目 | 值 |
|---|---|
| 文档版本 | v1.1（最终版，取代 v1.0） |
| 文档日期 | 2026-10-15 |
| 扩展版本 | 1.0.0 |
| 目标浏览器 | Chrome ≥114；Edge / Brave 顺带兼容 |

### 本次相对 v1.0 的变更

1. **跳转语义定稿（用户新增要求）**：8 个动作全部是"直接跳转"，不存在"先展示候选地址再确认"的中间态；地址无效时**不跳转 + 文字提示**。新增 §2.5 错误提示规范、§3.6 跳转流程与 `core/openTarget.ts` 模块、对应测试用例。
2. **是否联网的边界明确**：扩展自身零网络请求的约束不变，因此"网址无效"只覆盖**本地可判定**的无效（模板缺占位符、非 https、主机不在白名单、含凭据、编码非法）与**浏览器拒收地址**这两种；目标站点自身的 404 / 停服 / 私有仓库无权限，扩展在无 host 权限时无法预判，由选项页说明（§4.3）。
3. **并入 v1.0 评审的 9 项决定**：详见附录 E（`default_locale` 改 `en`、删除空转的 background、popup 尺寸预算、选项页交互规格、存储归一化算法、`publicOnly` → `privateRepo` 三态、点击实现方式、空状态补全、全隐藏态）。
4. **补齐 v1.0 缺失的规格**：manifest 的 `icons`/`minimum_chrome_version`/`options_ui`、i18n key 全清单、构建产物布局、覆盖率口径、实测矩阵。

> **待你确认的唯一理解点**：本次"无效则不跳转"的判定发生在**跳转之前**（本地校验）以及"浏览器拒收该地址"这一层。若你的本意是"跳转过去发现第三方站点 404 也算无效"，那需要扩展联网探测，与"零网络请求 / 只申请 storage+activeTab / 安装无权限警告"三条硬约束直接冲突，v1.0 不做（可选方案见 §4.4）。

---

## 1. 产品定义

**定位:** 一个 URL 路由器。扩展本身不分析仓库,也不访问网络,只做"识别仓库、套用模板、直接跳转"。

**范围内:**
- 识别 `github.com/{owner}/{repo}` 页面及其子路径。
- 弹窗里按 4 个分类展示 8 个动作,单击/回车/数字键即跳转。
- 跳转前做本地地址校验;无效时不跳转并给出文字提示。
- 快捷键、空状态、中英文界面。
- 选项页:隐藏或显示动作、调整排序、恢复默认。

**范围外:**
- 不抓取仓库内容,不做后端,不做数据统计。
- 不支持 GitHub 以外的平台。
- 不支持自定义新增动作和本地协议动作(Obsidian 等)。
- **不做联网可用性探测**(不预判第三方站点是否在线/是否有该仓库) —— 见 §4.4。
- 不检测第三方站点的页面内容(不做内容脚本,不注入目标页面)。

### 1.1 动作清单(固定 8 项)

| 序号 | 分类 | 动作 | 工具 | URL 模板 | 私有仓库 | 备注 |
|---|---|---|---|---|---|---|
| 1 | 理解 | 看架构图 | GitDiagram | `https://gitdiagram.com/{owner}/{repo}` | `token` | 支持私有仓库,需细粒度 PAT;v1.0 不代传 token |
| 2 | 理解 | 读项目讲解 | DeepWiki | `https://deepwiki.com/{owner}/{repo}` | `no` | 公开仓库免费;私有仓库需付费授权 |
| 3 | 理解 | 用 Zread 解读 | Zread | `https://zread.ai/{owner}/{repo}` | `no` | 仅公开仓库;未索引的仓库需先申请索引,打开会较慢 |
| 4 | AI 协作 | 拆成 AI 提示词 | GitReverse | `https://www.gitreverse.com/{owner}/{repo}` | `no` | 官方仅处理公开仓库 |
| 5 | AI 协作 | 整理给 AI | Gitingest | `https://gitingest.com/{owner}/{repo}` | `token` | 站点内可粘贴 PAT 处理私有仓库 |
| 6 | 读写代码 | 在线读源码 | GitHub1s | `https://github1s.com/{owner}/{repo}` | `session` | 公开仓库免登录;私有需在该站连接 GitHub/GitLab 账号或 token |
| 7 | 读写代码 | 在线改代码 | GitHub.dev | `https://github.dev/{owner}/{repo}` | `session` | 官方 VS Code Web,用你的 GitHub 登录态;**未登录会跳转到登录页** |
| 8 | 运行 | 尝试在线运行 | StackBlitz | `https://stackblitz.com/github/{owner}/{repo}` | `no` | 基于 WebContainers,主要适合 Web/Node 仓库;私有组织仓库需 Team 计划 |

**`privateRepo` 字段语义**(取代 v1.0 的 `publicOnly` 布尔值):

| 值 | 含义 | v1.0 运行时行为 |
|---|---|---|
| `no` | 仅公开仓库可用 | 不拦截,照常跳转 |
| `session` | 依赖用户在该站点的登录态 | 不拦截,照常跳转 |
| `token` | 需用户在该站点自行提供 PAT | 不拦截,照常跳转 |

> v1.0 **不对任何动作做权限拦截**：扩展无法在离线状态下判断仓库是否公开,也不该替用户决定。该字段仅用于：① 选项页的说明文案；② v1.1 计划中的行内悬停提示。

**模板依据(已完成外部规则核查,2026-10-15):**

| 动作 | 核查结论 |
|---|---|
| GitDiagram | ✅ 官方推荐用法即 `github.com/x/y` → `gitdiagram.com/x/y` |
| DeepWiki | ✅ 官方路径规则 `deepwiki.com/{org}/{repo}` |
| Zread | ✅ 官方说明"把 `github.com` 换成 `zread.ai`" |
| GitReverse | ✅ 官网原文 "replace hub with reverse in any GitHub URL" |
| Gitingest | ✅ 仓库 README "Replace 'hub' with 'ingest'" |
| GitHub1s | ✅ 官方 README "Add **1s** after github"（v1.0 §5 中"截图里的 GitHubs 即 GitHub1s"的推断**成立**） |
| GitHub.dev | ✅ GitHub 官方网页版 VS Code |
| StackBlitz | ✅ 官方导入格式还支持追加 `/{branch\|tag\|commit}` |

> 以上为**规则核查**，不等于浏览器实测。M1 必须按 §5.3 实测矩阵逐个跑一遍并回填结果。

---

## 2. 交互与视觉设计

### 2.1 界面结构（popup，宽 340px，高 ≤560px）

1. **顶部品牌区:** 左侧克莱因蓝方块(白色 "AV"),右侧 AVTC 加副标题 Auckland Voyage Training Camp。右侧为一个齿轮按钮(进入选项页,`chrome.runtime.openOptionsPage()`)。
2. **当前项目行:** 显示 `owner/repo`,文字为克莱因蓝。
3. **动作列表:** 按 4 个分类分组。分类小标题前有一条克莱因蓝短竖线。每行格式是"中文动作名 + 右侧工具名 + ↗"。
4. **底部提示:** "在新标签页打开"。该区域同时是**瞬态提示区**(错误提示 / 已打开提示,见 §2.5)。

### 2.2 状态矩阵

| 状态 | 触发条件 | 表现 |
|---|---|---|
| **A 正常** | `parseRepo` 返回 `{owner, repo}` | 8 行(或按偏好过滤排序后的 N 行)可点击 |
| **B 非仓库页** | `parseRepo` 返回 `null` | 列表整体置灰不可点,底部提示"请打开一个 GitHub 仓库" |
| **C 全隐藏** | 偏好里 `hidden` 覆盖全部动作 | 列表区显示"所有动作已隐藏",附"打开设置"按钮 |
| **D 单行动作地址无效** | 渲染期 `buildUrl` 返回 `null`(模板写错等) | 该行置灰不可点,其余行正常 |
| **E 错误提示** | 点击后校验失败 / 浏览器拒收地址 | 列表保持原状,底部提示区替换为一行文字提示(§2.5) |
| **F 已打开提示** | 后台打开成功后 | 底部提示区显示"已打开：{工具名}"约 1.5s,随后恢复 |

补充规则:
- 状态 B/C 下数字键 1–8 无效,`Esc` 仍可关闭。
- 状态切换不改变 popup 尺寸（高度按最长状态预留），避免弹窗跳动。
- storage 读取失败时**静默使用默认偏好**（等价状态 A），不显示技术性报错,不写回。

### 2.3 跳转与打开方式（本次定稿）

**核心约定：点击一个动作 = 立即跳转。** 不显示地址、不弹确认框、不需要二次点击；地址只存在于内存与 DOM 属性中,不作为"候选列表"呈现给用户。

| 操作 | 行为 |
|---|---|
| 单击 / `Enter`（行聚焦时） | 前台新标签页打开,popup 随焦点转移自动关闭 |
| `Ctrl`(Win/Linux) / `Cmd`(mac) + 单击 | **后台**新标签页打开,popup 保持打开（便于连续打开多个工具）,并在底部显示"已打开：{工具名}" |
| 鼠标中键 | 同后台打开 |
| 数字键 `1`–`8` | 按**当前显示顺序**编号,等同前台打开 |
| `Esc` | 关闭 popup |
| 右键 → 复制链接地址 | 保留原生可用（地址无效时的兜底路径） |

实现方式(定稿): 每行渲染为 `<a href="{url}" target="_blank" rel="noopener">`,但**拦截 click / auxclick**,统一走 `core/openTarget.ts` 的跳转流程 —— 只有拦截才能捕获失败并给出文字提示。修饰键语义由我们自己映射:`active = !(ctrlKey || metaKey)`。

### 2.4 私有仓库的处理

点击任一动作时,扩展**不做仓库可见性判断**,直接打开。目标站点是否需要登录、能否处理私有仓库,由用户在目标站点自行处理。选项页里有对应说明文案（同时展示每个动作的 `privateRepo` 值）。

### 2.5 错误提示规范（本次新增）

**触发条件（两者取其一，均**不**发生跳转）：**

| 情况 | 判定层 | 说明 |
|---|---|---|
| 地址校验未通过 | 本地（`buildUrl` 返回 `null`） | 模板缺占位符、非 https、主机不在白名单、含 `user:pass@`、编码含控制字符等。模板是常量,正常版本几乎不可能触发,属于防御性通路 |
| 浏览器拒收地址 | `chrome.tabs.create` 承诺被拒绝 | 极端兜底（如 URL 超长、被策略拦截）。此时**新标签页未打开**,popup 仍在 |

**呈现方式:**
- 位置：底部提示区（原"在新标签页打开"的位置,不新增布局、不改变尺寸）。
- 样式：白底 + 左侧 2px×14px 克莱因蓝竖线(复用分类竖线的视觉语言) + `#111111` 正文,13px。不使用红色 —— 调色板保持"白 + 克莱因蓝点缀"的封闭性;若你希望警告更醒目,可新增一个 `--color-alert` token,属于可选变更。
- 语义：`role="alert"` / `aria-live="polite"`,供读屏软件播报。
- 清除：下一次点击任一动作、按 `Esc`、或列表重新渲染时清除。
- 文案（中英各一套,见附录 C）：
  - 校验未通过：`{tool} 的地址无效，已取消打开`
  - 浏览器拒收：`浏览器拒绝了该地址，已取消打开`

**明确不做的:**
- 不把"目标站点 404 / 页面打不开 / 私有仓库无权限"当作"地址无效" —— 扩展无网络权限,无法判定,也不做内容脚本探测。这类情况由选项页说明：**"扩展只负责生成并跳转,目标站点是否可用由其自身决定"。**
- 不因一次失败而禁用该动作（下次点击仍会尝试）。

---

## 3. 技术架构

**技术栈:** TypeScript(strict,含 `noUncheckedIndexedAccess`)、Vite(纯 Vite,不引 CRX 插件)、原生 CSS 变量,不使用 React 等框架。

### 3.1 目录结构

```
avtc/
├─ public/                     # 原样拷贝到 dist 根
│  ├─ manifest.json
│  ├─ _locales/{zh_CN,en}/messages.json
│  └─ icons/{16,32,48,128}.png
├─ src/
│  ├─ popup/                   # popup.html / popup.ts / popup.css
│  ├─ options/                 # options.html / options.ts / options.css
│  ├─ core/
│  │  ├─ parseRepo.ts          # URL → {owner, repo} | null
│  │  ├─ buildUrl.ts           # 模板填充 + 白名单/协议校验
│  │  ├─ actions.ts            # 8 个动作常量
│  │  └─ openTarget.ts         # 跳转决策 + 失败归类(可注入 tabs 端口,便于单测)
│  ├─ storage.ts               # chrome.storage.sync 读写 + 归一化
│  └─ i18n.ts                  # msg() 薄封装 + data-i18n 应用
├─ tests/{parseRepo,buildUrl,openTarget,storage}.test.ts
├─ scripts/make-icons.mjs      # 生成 Klein 蓝 + 白色 "AV" 的 4 个尺寸 PNG
├─ vite.config.ts · tsconfig.json · eslint.config.js · .prettierrc · package.json
```

> **v1.0 的 `src/background/` 已删除**：Chrome 不向扩展派发 `_execute_action` 命令事件,service worker 收不到任何调用,属于死代码（详见附录 E - D2）。`Alt+Shift+A` 由 Chrome 直接执行,无需后台代码。

### 3.2 manifest.json

```jsonc
{
  "manifest_version": 3,
  "name": "__MSG_extName__",                     // ≤45 字符
  "short_name": "AVTC",
  "description": "__MSG_extDescription__",       // ≤132 字符
  "default_locale": "en",                        // 见附录 E - D3
  "version": "1.0.0",
  "minimum_chrome_version": "114",
  "icons": { "16": "icons/16.png", "32": "icons/32.png",
             "48": "icons/48.png", "128": "icons/128.png" },
  "action": {
    "default_popup": "popup.html",
    "default_title": "__MSG_extName__",
    "default_icon": { "16": "icons/16.png", "32": "icons/32.png" }
  },
  "options_ui": { "page": "options.html", "open_in_tab": true },
  "permissions": ["storage", "activeTab"],
  "commands": {
    "_execute_action": { "suggested_key": { "default": "Alt+Shift+A" } }
  }
}
```
无 `background` 字段；无 host 权限；无 `tabs` 权限。

### 3.3 动作的数据结构(`actions.ts`,写死,不开放用户编辑)

```ts
interface Action {
  id: 'gitdiagram' | 'deepwiki' | 'zread' | 'gitreverse'
    | 'gitingest' | 'github1s' | 'githubdev' | 'stackblitz';
  group: 'understand' | 'ai' | 'code' | 'run';
  labelKey: string;              // i18n key
  tool: string;                  // 'GitDiagram' … 保持英文原名,不进 i18n
  template: string;              // 唯一事实来源：改模板只改这一处
  privateRepo: 'no' | 'session' | 'token';
}

export const ACTIONS: readonly Action[] = [ /* 8 项,顺序即默认顺序 */ ];
```

### 3.4 用户存储(`chrome.storage.sync`,只存偏好)

```ts
{ v: 1, hidden: string[], order: string[] }
```
- 仓库地址永不落盘。
- 读取即**归一化**：未知 id 丢弃、重复 id 去重、缺失 id 按默认顺序追加到组内末尾、整体损坏 → 等价默认配置（算法见附录 B）。
- 读失败（`runtime.lastError`）→ 使用默认配置且**不写回**,避免覆盖用户正常数据。
- 写入时机：仅在用户于选项页改动时。

### 3.5 核心流程

```
用户调用扩展（工具栏图标 / Alt+Shift+A）
  → activeTab 被授予 → chrome.tabs.query({active:true, lastFocusedWindow:true})
  → parseRepo(tab.url) → {owner, repo} | null
  → 读偏好并归一化 → 与 ACTIONS 合并、过滤、排序
  → 渲染（正常 / 非仓库页 / 全隐藏；逐行动作先 buildUrl 校验,失败则该行置灰）
  → 用户点击某行
      → buildUrl(template, repo)：填充 → encodeURIComponent → 解析 → 校验
      → 失败：不跳转,底部文字提示（状态 E）
      → 成功：chrome.tabs.create({url, active: !修饰键})；被拒：不跳转 + 文字提示
```

### 3.6 跳转流程(`core/openTarget.ts`,本次新增,可直接单测)

```ts
export type OpenFailure = 'invalid-target' | 'open-failed';
export type OpenResult =
  | { ok: true; url: string; active: boolean }
  | { ok: false; failure: OpenFailure; tool: string };

/** 纯决策 + 注入式副作用：浏览器侧的 tabs.create 由调用方传入 */
export async function openTarget(
  action: Action,
  repo: { owner: string; repo: string },
  opts: { background: boolean },
  deps: { createTab: (url: string, active: boolean) => Promise<void> },
): Promise<OpenResult> {
  const url = buildUrl(action.template, repo);
  if (!url) return { ok: false, failure: 'invalid-target', tool: action.tool };
  const active = !opts.background;
  try { await deps.createTab(url, active); }
  catch { return { ok: false, failure: 'open-failed', tool: action.tool }; }
  return { ok: true, url, active };
}
```

popup 侧接线：

```ts
const res = await openTarget(action, repo, { background: ctrl || meta }, {
  createTab: (url, active) => chrome.tabs.create({ url, active }).then(() => void 0),
});
if (!res.ok) showError(res.failure, res.tool);   // 状态 E：不跳转 + 文字提示
else if (!res.active) showToast(res.tool);       // 状态 F：后台打开时给一次确认
```

- 前台打开成功时 popup 会因失焦自动关闭,**不调用 `window.close()`**。
- 后台打开成功时 popup 保留,支持连续打开多个工具。
- 不实现"点击后先写 `pending` 状态再等结果"之类的中间态 —— 跳转是即时的。

### 3.7 模块职责边界

| 模块 | 职责 | 明确不做 |
|---|---|---|
| `core/parseRepo.ts` | 纯函数：URL → `{owner, repo} \| null` | 不查询、不缓存、不网络 |
| `core/buildUrl.ts` | 纯函数：模板 + repo → 安全 URL | 不做跳转 |
| `core/actions.ts` | 8 个动作常量（单一事实来源） | 不读存储、不读 i18n |
| `core/openTarget.ts` | 跳转决策、失败归类、可注入副作用 | 不碰 DOM、不读存储 |
| `storage.ts` | 读写 + 校验 + 回退默认 | 不存仓库信息 |
| `i18n.ts` | `msg()` / `data-i18n` 应用、复数与占位符替换 | 不加载远程资源 |
| `popup/` | 取 tab、渲染、键盘、错误/提示呈现 | 不含 URL 规则（委托 core） |
| `options/` | 隐藏/排序/恢复默认 + 隐私与私有仓库说明 | 不允许自定义新增动作 |

### 3.8 构建与产物

```ts
// vite.config.ts 关键点
export default defineConfig({
  root: 'src',                                  // src/popup/popup.html → dist/popup.html
  publicDir: resolve(__dirname, 'public'),      // manifest/_locales/icons 原样拷贝
  build: {
    outDir: resolve(__dirname, 'dist'), emptyOutDir: true,
    target: 'chrome114', modulePreload: false, sourcemap: false,
    rollupOptions: { input: { popup: 'popup/popup.html', options: 'options/options.html' } },
  },
});
```
产物：`dist/{manifest.json, popup.html, options.html, assets/*.{js,css}, _locales/**, icons/**}`。
脚本：`dev`(`vite build --watch`)、`build`、`zip`、`test`、`typecheck`、`lint`。

### 3.9 popup 尺寸预算（Chrome 硬上限 800×600，超出即出现滚动条）

| 区块 | 规格 |
|---|---|
| 品牌区 | 48px |
| 当前项目行 | 32px |
| 分类标题 × 4 | 22px 各 |
| **动作行 × 8** | **44px 各（保留，可点区域优先）** |
| 底部提示/错误区 | 24px（高度按最长文案预留） |
| 内边距合计 | ~16px |
| **总计** | **≈ 560px** |

容器加 `max-height: 600px; overflow-y: auto` 兜底；错误/已打开提示不改变总高。

---

## 4. 开发约束

### 4.1 权限与隐私
1. 只申请 `storage` 和 `activeTab`。不申请 `tabs`、`<all_urls>` 或任何 host 权限。
2. 扩展自身不发起任何网络请求,不做遥测,不含远程代码,不注入任何内容脚本。
3. 仓库地址只在用户点击动作后,随浏览器跳转发送给目标站点。该条必须写进选项页隐私说明。
4. 键盘快捷键调用同样会授予 `activeTab`,popup 行为与点图标完全一致。

### 4.2 URL 解析与安全
5. `parseRepo` 只接受 `github.com` 域名(不含 `www.`、`gist.github.com` 等子域)。
6. 保留路径清单**仅作用于第一段**（因此 `github.com/torvalds/settings` 是合法仓库,`github.com/settings/profile` 是 `null`）。保留词比较忽略大小写。清单采取**保守策略**：不追求穷举 —— 少列一项的代价是用户在非仓库页点到 404（无害）,多列一项的代价是真实仓库被误挡（有害）。
7. 处理 `.git` 后缀（`/\.git$/i`）、尾斜杠、query、hash、大小写；`owner`/`repo` 保留原始大小写用于生成链接。
8. `owner` 与 `repo` 需通过正则校验（字母/数字/`-`/`_`/`.`，且**首尾不得为 `-` 或 `.`**，天然拒绝 `.`、`..` 路径穿越）,再用 `encodeURIComponent` 编码；`%2F` 之类解码后含 `/` 的输入判为 `null`。
9. 所有目标地址必须是 `https:`,主机名必须**精确匹配**白名单（禁止 `endsWith`,防 `evil-gitdiagram.com`）：`gitdiagram.com`、`deepwiki.com`、`zread.ai`、`www.gitreverse.com`、`gitingest.com`、`github1s.com`、`github.dev`、`stackblitz.com`；地址中不得含 `user:pass@`。
10. 细节决策表（输入宽容、输出严格）：

| 输入形态 | 期望 |
|---|---|
| `.../owner/repo/`（尾斜杠） | 成功 |
| `.../owner/repo?tab=readme#top` | 成功 |
| `.../owner/repo.GIT` | `repo` |
| `http://github.com/owner/repo` | 成功（输出恒为 https） |
| `https://www.github.com/owner/repo` | `null`（按本约束第 5 条） |
| `https://github.com/owner/..`、`.../a%2Fb` | `null` |
| `owner` > 39 字符 / `repo` > 100 字符 | `null` |

### 4.3 跳转与"无效"的判定边界（本次明确）
11. 扩展**只做本地判定**：模板、协议、主机白名单、凭据、字符编码、长度。这是"地址无效"的全部含义。
12. 目标站点自身的问题（404、停服、需要登录、仓库未索引、私有仓库无权限）**不在扩展判定范围内**,扩展既不预判也不事后检测。选项页必须写明这一点,并给出"用右键复制链接到浏览器手动尝试"的兜底路径。
13. 失败时不重试、不禁用该动作、不改变其他动作状态。

### 4.4 可选方案（若将来真的要检测站点可用性）
唯一可行做法是申请 `host_permissions`（8 个域名）后发 `HEAD` 请求预检。代价：① 违反"零网络请求"；② 安装时会从"无权限警告"变成"读取你在这些网站上的数据",与 M4 验收标准冲突；③ 预检会给第三方站点带来额外流量,HEAD 也可能被部分站点拒绝而误判。**结论：v1.0 不做**；若确有需求,建议作为 v1.2 的**默认关闭、显式 opt-in** 开关单独评估。

### 4.5 工程要求
14. 遵守 MV3：不使用 `eval`、不使用内联脚本、CSP 保持默认。
15. 打包后总体积 < 100KB(不含图标)；popup 首次渲染 < 100ms。
16. 兼容 Chrome 114+，Edge 与 Brave 顺带兼容。
17. strict TypeScript + ESLint + Prettier；`core/` 与 `storage.ts` 用 Vitest 测试，覆盖率 ≥ 90%。
18. 国际化：`zh_CN` 与 `en` 两套文案；`default_locale: "en"` 使非中文浏览器落到英文；工具名保持英文原名，不进 i18n 表。popup/options 使用 `data-i18n` 属性 + `i18n.ts` 填充。

### 4.6 用户交互与无障碍
19. 悬停与聚焦：整行浅蓝底 `#F2F5FF`,文字变克莱因蓝,并显示可见键盘焦点环(`:focus-visible`)。
20. 数字键 1–8 绑定**当前显示顺序**；被隐藏的动作不占号，编号自动顺延。
21. 状态 C 的"打开设置"按钮需可通过 Tab 到达；错误提示使用 `role="alert"`。

### 4.7 视觉规范
界面底色为白色,克莱因蓝只做点缀。

| 用途 | 色值 |
|---|---|
| 背景 | `#FFFFFF` |
| 分隔线 | `#E8E8E8` |
| 主文字 | `#111111` |
| 次要文字 | `#6B6B6B` |
| 点缀色(克莱因蓝) | `#002FA7` |
| 悬停底色 | `#F2F5FF` |

- 克莱因蓝只出现在：Logo 方块、当前项目名、分类竖线、悬停与聚焦状态、**错误提示竖线**。
- 字体：标题用系统衬线字体(Noto Serif SC、Songti SC),正文用系统无衬线字体,**不加载远程字体**。
- 尺寸：动作行高 44px,圆角 6px。
- 对比度：`#002FA7` 在白底上满足 WCAG AA。

---

## 5. 测试

### 5.1 `parseRepo`（文档原有 7 条 + 补充）

| 输入 | 期望 |
|---|---|
| `https://github.com/browser-act/skills` | `browser-act` / `skills` |
| `https://github.com/browser-act/skills/tree/main/docs` | `browser-act` / `skills` |
| `https://github.com/browser-act/skills.git` | `browser-act` / `skills` |
| `https://github.com/settings/profile` | `null` |
| `https://github.com/orgs/foo/people` | `null` |
| `https://gist.github.com/foo/abc` | `null` |
| `https://example.com/foo/bar` | `null` |
| `https://github.com/torvalds/settings` | `torvalds` / `settings`（保留词只在第一段生效） |
| `https://github.com/Settings/profile` | `null`（保留词忽略大小写） |
| `https://github.com/owner/repo/` | 成功 |
| `https://github.com/owner/repo?tab=readme#top` | 成功 |
| `https://github.com/owner/repo/issues/123` | 成功 |
| `https://github.com/owner/repo.GIT` | `repo` |
| `https://github.com/owner/..` · `.../owner/.` | `null` |
| `https://github.com/owner/` · `https://github.com/owner` | `null` |
| `https://github.com/` · `https://github.com` | `null` |
| `https://www.github.com/owner/repo` | `null` |
| `http://github.com/owner/repo` | 成功 |
| `ftp://github.com/owner/repo` | `null` |
| `https://github.com/owner/repo/a%2Fb` | `null` |
| `not a url` · `''` | `null` |
| `https://github.com/owner/repo/-` | `null` |

### 5.2 `buildUrl`

正常填充 8 个模板并断言完整期望字符串（顺带锁死模板不被误改）· 模板缺占位符 → `null` · `http:` 模板 → `null` · `gitdiagram.com.evil.com` / `evil-gitdiagram.com` → `null` · 含 `user:pass@` → `null` · 已在 `encodeURIComponent` 后仍含控制字符 → `null`。

### 5.3 `openTarget`（本次新增，直接覆盖用户新要求）

| 场景 | 期望 |
|---|---|
| 合法动作 + 前台 | 调用 `createTab(url, true)`,返回 `{ok:true}` |
| 合法动作 + `Ctrl`/`Cmd` | 调用 `createTab(url, false)`,返回 `{ok:true, active:false}` |
| 模板非法（mock 一个坏动作） | **不调用** `createTab`,返回 `{ok:false, failure:'invalid-target'}` |
| `createTab` 抛出/拒绝 | 返回 `{ok:false, failure:'open-failed'}`,不抛异常 |
| 8 个动作 × 成功路径 | 逐一断言目标 URL 字符串 |

### 5.4 `storage.normalize`

非数组 · 含未知 id · 重复 id · 缺 3 个 id（补到组内末尾）· `hidden` 含全部 8 项 · 空对象 · `null` · 字符串 · 读失败（mock `runtime.lastError`）不写回。

### 5.5 覆盖率与手工验收

- `coverage.include = ['src/core/**', 'src/storage.ts']`,lines/branches/functions/statements 阈值各 90。
- popup/options 的 DOM 逻辑不做单测,由 M2/M3 手工核对清单覆盖（含：状态 A–F 六态、错误提示文案、键盘 1–8 与 Esc、焦点环、后台打开保留 popup）。

### 5.6 M1 实测矩阵（8 动作 × 4 类仓库）

每格记录"能否打开 / 是否需要登录 / 报错文案",并回填 §1.1 备注列：

| | 大型公开仓库（`microsoft/vscode`） | 冷门未索引小仓库 | 私有仓库（自有账号） | 特殊名仓库（`owner/repo.name`、含大写） |
|---|---|---|---|---|
| 8 个动作 | | | | |

---

## 6. 里程碑与风险

### 6.1 里程碑

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| M1 | 仓库识别、8 个动作直接跳转、无效地址提示 | 7 种原始测试 URL + §5.1 补充用例全部通过；`openTarget` 失败路径单测通过（不跳转、有提示）；8 个目标站点在真实仓库上都能打开；实测矩阵回填 |
| M2 | 品牌视觉、快捷键、空状态、错误/已打开提示 | 与 §2 逐项对照通过（含状态 A–F、44px 行高、克莱因蓝只作点缀、焦点环、后台打开保留 popup、popup 高 ≤600 无滚动） |
| M3 | 选项页（隐藏/排序/恢复默认）、中英文 | 排序仅组内、自动保存、恢复默认清空 hidden 并重置 order；偏好跨设备同步；配置损坏回退默认；全隐藏态可见且可一键进入选项页 |
| M4 | 测试、打包、可选上架 | 单元测试与覆盖率达标；体积 <100KB；安装时无额外权限警告；商店重名核查完成 |

### 6.2 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 第三方站点下线或改规则 | 某动作失效 | 模板集中在 `actions.ts`,只改一处;实测矩阵记录基线日期 |
| **地址有效但站点已 404/改版**（本次边界） | 用户以为是扩展坏了 | 选项页说明"扩展不检测目标站点可用性";用户可用右键复制链接自行验证;若要求变,按 §4.4 单独评估 opt-in 预检 |
| 私有仓库 | 多数工具不支持 | `privateRepo` 字段 + 选项页逐动作说明;v1.1 计划行内悬停提示 |
| popup 内容超 600px | 出现滚动条,破坏"一屏看完" | §3.9 尺寸预算 |
| `activeTab` 在受限页面取不到 URL | `chrome://`、新标签页、商店页、PDF 页走空状态 | 已覆盖（状态 B/C）;文案统一为"请打开一个 GitHub 仓库" |
| StackBlitz 对非 Web 仓库不可用 | "运行"分类名不符实 | 动作名"尝试在线运行"已含"尝试";选项页说明 |
| 构建工具版本滞后 | 无法使用 `modulePreload` 等配置 | 升 Vite ≥5;配置项按版本微调,不影响产物布局 |
| Chrome 商店重名 | 上架受阻 | 提前到 M2 前搜索 "AVTC" |
| popup 关闭时机理解偏差 | 后台打开后弹窗滞留/误关 | 已定稿：前台自动关闭、后台保留并显示"已打开"提示 |

---

## 附录 A · 参考实现：`core/parseRepo.ts`

```ts
const RESERVED_FIRST_SEGMENT = new Set([
  'settings', 'orgs', 'organizations', 'apps', 'marketplace', 'topics',
  'collections', 'trending', 'explore', 'sponsors', 'notifications',
  'login', 'logout', 'signup', 'join', 'sessions', 'account', 'dashboard',
  'search', 'pulls', 'issues', 'stars', 'watching', 'new',
  'features', 'pricing', 'about', 'blog', 'contact', 'customer-stories',
  'enterprise', 'events', 'team', 'security', 'readme',
]);

const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;  // 首尾不允许 '-' '.'；天然拒绝 '.' 与 '..'
const MAX_OWNER = 39, MAX_REPO = 100;

export function parseRepo(rawUrl: string): { owner: string; repo: string } | null {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.hostname !== 'github.com') return null;

  const segs = u.pathname.split('/').filter(Boolean);
  if (segs.length < 2) return null;

  let owner: string, repo: string;
  try { owner = decodeURIComponent(segs[0]!); repo = decodeURIComponent(segs[1]!); }
  catch { return null; }                                   // 非法百分号编码

  if (RESERVED_FIRST_SEGMENT.has(owner.toLowerCase())) return null;
  if (owner.length > MAX_OWNER || repo.length > MAX_REPO) return null;
  if (!NAME.test(owner) || !NAME.test(repo)) return null;

  const cleaned = repo.replace(/\.git$/i, '');
  if (!cleaned) return null;
  return { owner, repo: cleaned };                          // 保留原始大小写
}
```

## 附录 B · 参考实现：`core/buildUrl.ts` 与 `storage.ts`

```ts
const ALLOWED_HOSTS = new Set([
  'gitdiagram.com', 'deepwiki.com', 'zread.ai', 'www.gitreverse.com',
  'gitingest.com', 'github1s.com', 'github.dev', 'stackblitz.com',
]);

export function buildUrl(template: string, r: { owner: string; repo: string }): string | null {
  if (!template.includes('{owner}') || !template.includes('{repo}')) return null;
  let u: URL;
  try {
    u = new URL(template
      .replace('{owner}', encodeURIComponent(r.owner))
      .replace('{repo}',  encodeURIComponent(r.repo)));
  } catch { return null; }
  if (u.protocol !== 'https:') return null;
  if (!ALLOWED_HOSTS.has(u.hostname)) return null;   // 精确匹配
  if (u.username || u.password) return null;
  return u.toString();
}
```

```ts
type Prefs = { v: 1; hidden: string[]; order: string[] };
const DEFAULT_ORDER = ACTIONS.map(a => a.id);

export function normalize(raw: unknown): Prefs {
  const known = new Set(DEFAULT_ORDER);
  const pick = (x: unknown): string[] => Array.isArray(x)
    ? [...new Set(x.filter((i): i is string => typeof i === 'string' && known.has(i)))]
    : [];
  const r = (raw ?? {}) as Record<string, unknown>;
  const order = pick(r.order);
  return {
    v: 1,
    hidden: pick(r.hidden),
    order: [...order, ...DEFAULT_ORDER.filter(i => !order.includes(i))],
  };
}
// 读取失败（runtime.lastError）→ 返回默认值且不写回；仅在用户改动时写入。
```

## 附录 C · i18n key 清单（两套文案一一对应）

**界面：** `extName` · `extDescription` · `groupUnderstand` · `groupAi` · `groupCode` · `groupRun`
**动作：** `actionGitdiagram` · `actionDeepwiki` · `actionZread` · `actionGitreverse` · `actionGitingest` · `actionGithub1s` · `actionGithubdev` · `actionStackblitz`
**状态与提示：** `stateNoRepo`（请打开一个 GitHub 仓库）· `stateAllHidden`（所有动作已隐藏）· `openOptions`（打开设置）· `footerOpenInNewTab`（在新标签页打开）· `toastOpened`（已打开：{tool}）· `errInvalidTarget`（{tool} 的地址无效，已取消打开）· `errOpenFailed`（浏览器拒绝了该地址，已取消打开）
**选项页：** `optionsTitle` · `optionsGroupsHint` · `optionsMoveUp` · `optionsMoveDown` · `optionsToggleShow` · `optionsVisibleHidden` · `optionsReset` · `optionsResetDone` · `optionsPrivacyTitle` · `optionsPrivacyBody`（含"点击动作后仓库地址会随跳转发送给目标站点"）· `optionsPrivateRepoNote` · `optionsSiteAvailabilityNote`（扩展不检测目标站点是否可用）

工具名（GitDiagram/GitHub1s/…）保持英文原名,直接取自 `actions.ts` 的 `tool` 字段,不进 i18n 表。

## 附录 D · 外部核查来源（2026-10-15）

- Chrome 命令 API（`_execute_action` 为保留命令、不派发 `onCommand`）：https://developer.chrome.com/docs/extensions/reference/api/commands
- `activeTab` 在用户调用扩展时授予（含快捷键路径）：https://developer.chrome.com/docs/extensions/get-started/tutorial/scripts-activetab
- popup 硬上限 800×600：https://developer.chrome.com/docs/extensions/reference/api/action
- GitDiagram：https://github.com/ahmedkhaleel2004/gitdiagram · DeepWiki：https://deepwiki.com/
- Zread：https://zread.ai/ · GitReverse：https://www.gitreverse.com/
- Gitingest（replace hub with ingest、私有仓库需 PAT）：https://github.com/coderamp-labs/gitingest
- GitHub1s（add 1s after github）：https://github.com/conwnet/github1s
- StackBlitz 导入格式与 WebContainers 限制：https://developer.stackblitz.com/

## 附录 E · 决策记录（v1.0 评审 9 项，已按默认值定稿）

| # | 决定 | 定稿结果 |
|---|---|---|
| D1 | 保留词清单的封闭性与作用域 | 仅作用于第一段；保守黑名单；`torvalds/settings` 必须解析成功 |
| D2 | background service worker 职责 | **删除**（Chrome 不派发 `_execute_action`，SW 收不到调用） |
| D3 | `default_locale` | 改 `en`，保留 `zh_CN` |
| D4 | 点击实现方式 | `<a href>` 保留原生可用性 + 拦截 click/auxclick 走 `openTarget`（**修订**：v1.0 评审时建议纯原生锚点，因新增"失败需提示"要求改为拦截式，以捕获失败） |
| D5 | popup 高度 | 保 44px 行高，其余压缩，总高 ≈560px，含 600px 兜底 |
| D6 | `publicOnly` 字段 | 改为 `privateRepo: 'no' \| 'session' \| 'token'`，v1.0 不做运行时拦截 |
| D7 | 选项页交互 | 排序仅组内、↑/↓ 按钮（非拖拽）、自动保存、恢复默认清空 hidden 并重置 order、底部齿轮入口 |
| D8 | 存储 schema | `{v:1, hidden, order}` + 归一化算法（附录 B）+ 读失败不写回 |
| D9 | 全隐藏态 | 显示"所有动作已隐藏" + "打开设置"按钮 |

**新增决定：**

| # | 决定 | 定稿结果 |
|---|---|---|
| D10 | 跳转语义 | 点击即跳转，无中间态；本地校验失败或浏览器拒收 → **不跳转 + 底部文字提示**；提示用白底 + 克莱因蓝竖线，不用红色 |
| D11 | 后台打开的 popup 行为 | 保留 popup（支持连续打开多个工具），显示"已打开：{tool}"提示；前台打开由失焦自动关闭 |
| D12 | 站点可用性检测 | v1.0 **不做**（需 host 权限与联网，与隐私约束和 M4 验收冲突）；如确需，作为 v1.2 opt-in 单独评估 |
