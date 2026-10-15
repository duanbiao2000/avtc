# AVTC 开发文档评审 · 开发就绪度判定

**评审对象：** AVTC 产品开发文档 v1.0
**评审日期：** 2026-10-15
**评审人角色：** 开发者（接手实现方）
**结论：** ✅ **满足开发条件，可以开工。** 文档在"做什么"层面已经封闭到可实现的程度（产品边界、动作清单、视觉规范、权限约束都写死了），剩下 9 项属于"参数级"待拍板项，全部已给出默认建议 —— 若你全部采纳默认值，M1 今天即可开工，M3 需先确认 3 项。

---

## 0. 先看这里：9 项待拍板决定（每条附默认建议）

| # | 决定点 | 影响阶段 | 我的默认建议（可直接采纳） |
|---|---|---|---|
| D1 | 保留路径清单是否封闭、是否只作用于第一段 | M1 | 只作用于**第一段**；用保守黑名单（见 §4.1），"误判代价很低"作为设计依据 |
| D2 | `_execute_action` 之外，background service worker 到底做什么 | M1 | **删掉 background**（Chrome 不向扩展派发 `_execute_action`，现在是死代码） |
| D3 | `default_locale` 与"跟随浏览器语言"冲突 | M1 | `default_locale` 改 **`en`**，保留 `zh_CN`（否则日/韩/德语浏览器会看到中文） |
| D4 | 点击行为用 `<a target="_blank">` 还是 `chrome.tabs.create` | M2 | 用 **`<a target="_blank" rel="noopener">`**，Ctrl/Cmd+单击由浏览器原生处理；用 `tabs.create` 兜底自定义行为 |
| D5 | popup 总高与 Chrome 上限 600px 冲突 | M2 | 保 44px 行高，压缩品牌区/分类标题，目标 ≤560px（见 §4.5） |
| D6 | `publicOnly` 在 v1.0 的运行时行为 | M2 | v1.0 只作数据标记 + 选项页说明，不做拦截（不联网就无法判断）；字段改名 `needsLogin` 更准确 |
| D7 | 选项页完整交互规格（跨分组排序？自动保存？） | M3 | 排序**仅限组内**（↑/↓ 按钮，非拖拽）；自动保存；"恢复默认"清空 hidden 并重置 order |
| D8 | 存储 schema 校验与版本号 | M3 | 存 `{v:1, hidden, order}`，读取时归一化 + 补全未知动作（算法见 §4.2） |
| D9 | 8 个动作全部被隐藏时的 popup 状态 | M3 | 显示"所有动作已隐藏"+ 进入选项页按钮（文档未定义此状态） |

---

## 1. 我对文档的理解（复述校验，请确认无偏差）

### 1.1 一句话
AVTC 是一个**纯 URL 路由器**：输入是当前标签页的地址，输出要么是"8 个第三方工具的候选地址"，要么是"空状态"。扩展不读仓库内容、不联网、不存储任何仓库信息。

### 1.2 数据流
```
用户调用扩展（点图标 / Alt+Shift+A）
   → activeTab 被授予 → popup 读取 chrome.tabs.query({active, lastFocusedWindow})
   → tab.url 交给 parseRepo() → {owner, repo} | null
   → 读 chrome.storage.sync 的 {hidden, order}，与 actions.ts 常量合并、过滤、排序
   → 渲染：4 个分组 / 8 行（或空状态置灰）
   → 用户点击某行 → buildUrl(template, {owner, repo}) → 校验 https + 主机白名单
   → chrome.tabs.create({url, active: !modifier}) 打开新标签页
```

### 1.3 我识别到的 6 条硬不变量（实现时任何改动不得破坏）
1. 扩展自身**零网络请求**，无遥测，无远程代码；
2. 目标地址**必须是 https**，且主机名在 8 域名白名单内；
3. 动作集合**固定 8 个**，用户只能隐藏/排序，不能增删改；
4. 用户持久化数据**只有** `hidden` 与 `order`；仓库地址永不落盘；
5. 无 `eval`、无内联脚本、CSP 保持默认；
6. 权限恒为 `storage` + `activeTab`（不申请 `tabs`、不申请 host 权限）。

### 1.4 模块职责边界（我的理解，供对照）

| 模块 | 职责 | 明确不做 |
|---|---|---|
| `core/parseRepo.ts` | 纯函数：URL 字符串 → `{owner, repo} \| null` | 不查询、不缓存、不网络 |
| `core/buildUrl.ts` | 纯函数：模板 + repo → 安全 URL（白名单校验） | 不做跳转 |
| `core/actions.ts` | 8 个动作常量（单一事实来源） | 不读存储、不读 i18n |
| `storage.ts` | `chrome.storage.sync` 读写 + 校验 + 回退默认 | 不存仓库信息 |
| `popup/` | 取 tab、渲染、键盘、跳转 | 不含 URL 规则（全部委托 core） |
| `options/` | 隐藏/排序/恢复默认 + 隐私说明 | 不允许自定义新增动作 |
| `background/` | 仅快捷键命令 | **v1.0 实际无事可做**（见 D2） |

### 1.5 范围外（我按文档严格执行，不做"顺手加"）
不抓取仓库内容、不支持 GitLab/Bitbucket、不支持自定义动作与本地协议（Obsidian 等）、不做账号体系与统计。

---

## 2. 8 个模板独立核查结果

文档要求"开发时仍要逐个实测"。我做了**外部规则核查**（非浏览器实测），8 个模板全部与官方/权威来源一致：

| 动作 | 文档模板 | 核查结论 | 需要写进文档的补充事实 |
|---|---|---|---|
| GitDiagram | `gitdiagram.com/{owner}/{repo}` | ✅ 成立。官方推荐用法即 `github.com/x/y` → `gitdiagram.com/x/y` | 也支持私有仓库（需细粒度 PAT），文档"仅公开"是**保守**假设 |
| DeepWiki | `deepwiki.com/{owner}/{repo}` | ✅ 成立（Cognition 官方路径规则） | 公开仓库免费；私有仓库需付费授权 |
| Zread | `zread.ai/{owner}/{repo}` | ✅ 成立（官方说明：把 `github.com` 换成 `zread.ai`） | 现行版本**仅支持公开仓库**；未索引的仓库需申请索引（可能等待），这会表现为"动作打开很慢"，不是扩展的 bug |
| GitReverse | `www.gitreverse.com/{owner}/{repo}` | ✅ 成立（官网原文："replace hub with reverse in any GitHub URL"） | 官方只处理**公开**仓库；建议实测 `gitreverse.com`（无 www）是否 301 |
| Gitingest | `gitingest.com/{owner}/{repo}` | ✅ 成立（仓库 README：replace `hub` with `ingest`） | 私有仓库需在站点内填 PAT；网页版有 token 输入框 |
| GitHub1s | `github1s.com/{owner}/{repo}` | ✅ 成立 | **文档 §5 的"GitHubs 是 GitHub1s"推断正确**：官方 README 原文 "Add **1s** after github"。私有仓库需在该站登录 GitHub/GitLab 或提供 token —— 注意 token 不在 URL 里，扩展无需、也无法代传 |
| GitHub.dev | `github.dev/{owner}/{repo}` | ✅ 成立（GitHub 官方） | 需浏览器已登录 GitHub；"无需 token"成立，但**未登录时会跳去登录页** |
| StackBlitz | `stackblitz.com/github/{owner}/{repo}` | ✅ 成立（官方导入格式还支持 `/{branch\|tag\|commit}` 后缀） | 基于 WebContainers，**只对 Web/Node 类仓库能真正跑起来**；非 Web 仓库（Go/Rust/Java/嵌入式）打开后大概率报错或空转。这属于"打开成功但不好用"，需在选项页/文档里说明；私有组织仓库需 Team 计划 |

**由此对 §1 动作表的两条修正建议：**
1. 把 `publicOnly: boolean` 改成更准确的三态或改名：`access: "public" | "signin-required"`（GitHub1s / GitHub.dev 是"需登录"，不是"仅公开"）。布尔值会让实现者误解成"私有仓库点击要拦截"。
2. 文档"仅公开仓库"列的**依据强度**应标注：只有 GitReverse、Zread 是官方口径，其余是合理推断，需 M1 实测回填。

---

## 3. 需要补充的信息

### 3.1 P0 —— 不拍板就会导致返工或验收标准不成立

**P0-1 保留路径清单的封闭性与作用域（对应 D1）**
文档只举了 5 个例子（settings/orgs/marketplace/topics/notifications/login），实现者无法判断"是否还有别的、我漏了会怎样"。真正的问题是**作用域**：保留词只对第一段生效。
- `github.com/torvalds/settings` → **是合法仓库**（Linux 仓库里确实有同名目录的习惯），必须解析成功。
- `github.com/settings/profile` → 保留词在第一段 → `null`。
而且 GitHub 未公开完整保留清单，穷举不可能。建议明确写下这条设计原则：
> 黑名单是**第一段的经验清单**，不追求穷举。少列一项的代价 = 用户在一个非仓库页点到 404（无害）；多列一项的代价 = 真实仓库被误挡（有害）。因此**宁可少列**。

**P0-2 background service worker 的职责是空的（对应 D2）**
经核查 Chrome 官方文档：`_execute_action` 是保留命令，**不会派发 `commands.onCommand` 事件**。文档里 background 的唯一职责就是"处理快捷键命令"，而 v1.0 唯一的命令是 `_execute_action` —— 也就是说这个 service worker 收不到任何调用。
- 方案 A（推荐）：**manifest 里删掉 `background` 字段**，目录里也不建 `src/background/`。功能完全等价（`_execute_action` 由 Chrome 自己执行，且键盘快捷键同样会授予 `activeTab`，popup 行为与点图标完全一致）。
- 方案 B：确实想做"直接跳转"类全局快捷键（如 Alt+Shift+1..8）。注意 Chrome 对 `suggested_key` 数量有上限（4 个），其余只能让用户去 `chrome://extensions/shortcuts` 自己设，体验并不好 —— 文档把 1–8 放在**popup 内**（而非全局）是更正确的选择。
请明确选 A 还是 B，否则会交付一个空转的 SW。

**P0-3 `default_locale: zh_CN` 与"跟随浏览器语言"冲突（对应 D3）**
Chrome 的 i18n 回退规则是：找不到匹配语言时用 `default_locale`。若 `default_locale = zh_CN`，则在**日语/韩语/德语/法语**浏览器上，用户看到的是中文界面，而不是英文 —— 与"中英文两套文案、默认跟随浏览器语言"自相矛盾。建议改为 `default_locale: "en"`：中文浏览器自动得到 `zh_CN`，其余语言得到 `en`，符合直觉。（若你坚持中文优先，则需接受"非中英语言全看到中文"这个后果，并在文档里写明。）

**P0-4 选项页规格严重不足（对应 D7）**
文档只说"隐藏或显示动作、调整排序、恢复默认"。以下每一条都会影响实现与 UI：
- 排序是**仅组内**，还是跨分组（能把 StackBlitz 拖到"理解"分类里）？→ 建议仅组内，跨组会破坏"4 分类"的信息架构。
- 排序交互：拖拽（实现复杂、需键盘等价操作才符合无障碍）、↑/↓ 按钮（简单、天然可键盘操作）？→ 建议 ↑/↓。
- 保存模型：自动保存（改动即写 storage）还是显式"保存"按钮？→ 建议自动保存 + 一条"已保存"的轻提示。
- "恢复默认"是否同时清空 hidden 和重置 order？是否二次确认？→ 建议两者都做 + 无需确认（可撤销代价低）。
- 选项页是否也按 4 分组展示？→ 建议是，与 popup 一致。
- 选项页是否需要入口：**当前 popup 没有任何进入选项页的路径**，用户只能去 chrome://extensions 里找。建议底部提示行右侧加一个齿轮按钮（`chrome.runtime.openOptionsPage()`，无需额外权限）。

**P0-5 存储 schema 无版本、无归一化规则（对应 D8）**
文档只给了 `{hidden: string[]; order: string[]}`，但明确要求"配置损坏时回退默认"，却没定义"损坏"。必须定义并测试：非数组 / 含非字符串 / 含未知 id / 重复 id / 缺少某个 id / 空数组 / 整个键缺失。且必须回答：**未来新增第 9 个动作时怎么办**（建议：未知 id 丢弃、缺失 id 按默认顺序追加到组内末尾）。给出算法见 §4.2。

**P0-6 空状态覆盖不全（对应 D9）**
文档只定义了"非仓库页"。还有三个未定义状态：① 8 个动作全被隐藏；② `tab.url` 取不到（`chrome://` 页面、新标签页、PDF 查看器、Chrome 应用商店页面 —— 这些页面 `activeTab` 拿不到 URL）；③ storage 读取失败/未初始化（必须静默用默认值，不能白屏）。

### 3.2 P1 —— 建议明确，但可以直接给默认值

- **P1-1 URL 解析的 8 个细节**（query/hash/trailing slash/`http:` 与 `https:`/`www.github.com`/`.Git` 大小写后缀/`%2F` 编码/`..` 路径穿越）。逐条给出建议见 §4.1，其中 **`..` 必须显式拒绝**：正则 `[A-Za-z0-9._-]+` 会放行 `..`，拼进 URL 后被浏览器规范化成上级路径，会生成错误目标。
- **P1-2 数字键 1–8 与隐藏动作的关系**：按**当前显示顺序**编号（第 1 行 = 1 键），隐藏后编号自动顺延；显示顺序不足 8 项时，多余数字键无效。
- **P1-3 popup 高度**：见 §4.5，需要现在就定，因为它决定 CSS 变量。
- **P1-4 后台打开后 popup 是否关闭**：`chrome.tabs.create({active:false})` 不会让 popup 失焦，会一直开着。建议显式 `window.close()`。
- **P1-5 `tabs.query` 的窗口参数**：popup 里建议用 `lastFocusedWindow: true`（官方对 popup 场景的推荐写法），比 `currentWindow` 更稳。
- **P1-6 覆盖率的统计口径**：建议 `coverage.include = ['src/core/**', 'src/storage.ts']`，阈值 lines/branches/functions/statements 各 90；popup/options 的 DOM 逻辑不做单测，用 M2/M3 的手工核对清单覆盖。
- **P1-7 工程细节**：Node ≥20、npm、`tsconfig` 建议开 `strict` + `noUncheckedIndexedAccess`（后者能让 `segs[0]` 变成 `string | undefined`，强制写守卫，正好适配 parseRepo）；加 CI（可选）与 `npm run zip` 打包脚本；manifest 需补 `icons`、`description`、`minimum_chrome_version`（见 §4.3）。
- **P1-8 图标资产**：文档有 `icons/` 目录且 M4 要上架，但 manifest 里没有任何 `icons` 字段，也没说谁产出 16/32/48/128 四个 PNG。建议现在就用脚本生成（Klein 蓝底 + 白色 "AV"，与 popup logo 同一套视觉）。
- **P1-9 体积/性能验收方法**：见 §6.2，两个指标都很容易达标，需要明确"怎么算通过"。

### 3.3 P2 —— 可延后

- `zh_TW` / `zh_HK` 文案（繁体用户目前会拿到简体）。
- 上架材料：Chrome 商店要求 1280×800 截图、单一用途说明、权限用途说明（`storage` 和 `activeTab` 均不触发安装警告，这一点文档的 M4 验收是对的）。
- 重名核查（文档已列风险）：建议现在就在商店搜一次 "AVTC"，比上架前再查便宜。
- v1.1 的 `publicOnly` 悬停提示（若 D6 采纳 `access` 字段，v1.1 可直接用它渲染提示）。

---

## 4. 补充技术规格（可直接并入文档）

### 4.1 `parseRepo` 精确规范

```ts
// 只对第一段生效的保留路径（保守清单，宁可少列）
const RESERVED_FIRST_SEGMENT = new Set([
  'settings', 'orgs', 'organizations', 'apps', 'marketplace', 'topics',
  'collections', 'trending', 'explore', 'sponsors', 'notifications',
  'login', 'logout', 'signup', 'join', 'sessions', 'account', 'dashboard',
  'search', 'pulls', 'issues', 'stars', 'watching', 'new',
  'features', 'pricing', 'about', 'blog', 'contact', 'customer-stories',
  'enterprise', 'events', 'team', 'security', 'readme',
]);

const NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;   // 首尾不放过 '-' '.'，且天然拒绝 '.'、'..'

export function parseRepo(rawUrl: string): { owner: string; repo: string } | null {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null; // 输入宽容，输出恒 https
  if (u.hostname !== 'github.com') return null;                      // 严格：不含 www. / gist.
  const segs = u.pathname.split('/').filter(Boolean);
  if (segs.length < 2) return null;
  const ownerRaw = safeDecode(segs[0]!), repoRaw0 = safeDecode(segs[1]!);
  if (RESERVED_FIRST_SEGMENT.has(ownerRaw.toLowerCase())) return null;
  if (!NAME.test(ownerRaw) || !NAME.test(repoRaw0)) return null;
  const repo = repoRaw0.replace(/\.git$/i, '');
  if (!repo) return null;
  return { owner: ownerRaw, repo };   // 保留原始大小写（按文档要求）
}
```

逐条决策（建议值）：

| 输入形态 | 期望 | 理由 |
|---|---|---|
| `.../owner/repo/`（尾斜杠） | 解析成功 | `filter(Boolean)` 已覆盖 |
| `.../owner/repo?tab=readme#x` | 解析成功 | `pathname` 天然忽略 query/hash |
| `.../owner/repo.GIT` | `repo` | 后缀匹配用 `/\.git$/i` |
| `http://github.com/...` | 解析成功（输出仍是 https） | 输入宽容、输出严格 |
| `www.github.com/...` | `null` | 遵守文档"不含子域"；代价是极少见的 www 页面显示空状态 |
| `.../owner/repo%2Ffoo` | `null` | 先 decode 再校验，`%2F` 解码成 `/` 会被正则拦下 |
| `.../owner/..`、`.../../x` | `null` | 防路径穿越（正则首尾字符约束已覆盖，测试要显式覆盖） |
| `.../owner/repo` 大小写 | 原样保留 | 文档要求；但**第三方站点可能大小写敏感**，实测若发现某个工具 404，就给该动作加 `normalize: 'lower'` 开关（模板级，不改 core 语义） |
| `owner` 长度 | 建议 ≤39、`repo` ≤100 | GitHub 实际限制，避免畸形输入 |

### 4.2 `buildUrl` 与存储校验

```ts
// buildUrl：填模板 → 解析 → 双重校验，任一不通过返回 null（不抛异常）
const ALLOWED_HOSTS = new Set([
  'gitdiagram.com', 'deepwiki.com', 'zread.ai', 'www.gitreverse.com',
  'gitingest.com', 'github1s.com', 'github.dev', 'stackblitz.com',
]);
export function buildUrl(template: string, repo: {owner: string; repo: string}) {
  const url = template
    .replace('{owner}', encodeURIComponent(repo.owner))
    .replace('{repo}',  encodeURIComponent(repo.repo));
  const u = new URL(url);
  if (u.protocol !== 'https:') return null;
  if (!ALLOWED_HOSTS.has(u.hostname)) return null;   // 精确匹配，禁止 endsWith（防 evil-gitdiagram.com）
  if (u.username || u.password) return null;
  return u.toString();
}
```

```ts
// storage：读取即归一化，任何异常都静默回退默认值；只在用户改动时写回
type Prefs = { v: 1; hidden: string[]; order: string[] };
const DEFAULT_ORDER = ACTIONS.map(a => a.id);

function normalize(raw: unknown): Prefs {
  const known = new Set(DEFAULT_ORDER);
  const pick = (x: unknown) => Array.isArray(x)
    ? [...new Set(x.filter((i): i is string => typeof i === 'string' && known.has(i)))]
    : [];
  const r = (raw ?? {}) as Record<string, unknown>;
  const order0 = pick(r.order);
  return { v: 1, hidden: pick(r.hidden), order: [...order0, ...DEFAULT_ORDER.filter(i => !order0.includes(i))] };
}
```
> 规则要点：未知 id 丢弃 · 重复 id 去重 · 缺失 id 按默认顺序追加 · 全部损坏 → 等价于默认配置 · 读取失败（`runtime.lastError`）→ 默认配置且**不写回**（避免把用户的正常数据覆盖掉）。

### 4.3 manifest 补全版（差异部分）

```jsonc
{
  "manifest_version": 3,
  "name": "__MSG_extName__",                 // ≤45 字符
  "short_name": "AVTC",
  "description": "__MSG_extDescription__",   // ≤132 字符
  "default_locale": "en",                    // ← D3：原 zh_CN
  "version": "1.0.0",
  "minimum_chrome_version": "114",           // ← 新增（对应约束 11）
  "icons": {                                 // ← 新增（原文档缺失）
    "16": "icons/16.png", "32": "icons/32.png",
    "48": "icons/48.png", "128": "icons/128.png"
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "__MSG_extName__",
    "default_icon": { "16": "icons/16.png", "32": "icons/32.png" }
  },
  "options_ui": { "page": "options.html", "open_in_tab": true },
  "permissions": ["storage", "activeTab"],
  // "background": 删除（D2 方案 A）
  "commands": {
    "_execute_action": { "suggested_key": { "default": "Alt+Shift+A" } }
  }
}
```
> 注：`_execute_action` 由 Chrome 直接执行、不触发 `onCommand`；键盘调用同样授予 `activeTab`，所以 popup 逻辑与点图标完全一致（这一点建议加进 M2 验收项）。

### 4.4 构建与产物

推荐**纯 Vite**（不引 `@crxjs/vite-plugin`，减少一层不确定性）：

```ts
// vite.config.ts 关键点
export default defineConfig({
  root: 'src',                    // 使 src/popup/popup.html → dist/popup.html（与 manifest 路径一致）
  publicDir: resolve(__dirname, 'public'),   // manifest.json + _locales + icons 原样拷贝
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'chrome114',
    modulePreload: false,         // 少几个产物文件
    sourcemap: false,             // release；dev 可 true
    rollupOptions: { input: { popup: 'popup/popup.html', options: 'options/options.html' } }
  }
});
```
产物预期：`dist/{manifest.json, popup.html, options.html, assets/*.js|css, _locales/**, icons/**}`。脚本建议：`dev`（`vite build --watch` + 手动 Reload）、`build`、`zip`（`cd dist && zip -r ../avtc-1.0.0.zip .`）、`test`、`lint`、`typecheck`。

### 4.5 popup 尺寸预算（与 600px 硬上限的冲突）

Chrome 对 popup 的硬上限是 **800×600**（超出即出现内部滚动条），文档未考虑这一点。按当前规格估算：

| 区块 | 当前规格估算 | 建议压缩后 |
|---|---|---|
| 品牌区（logo 32 + padding） | 56 | 48 |
| 当前项目行 | 36 | 32 |
| 分类标题 × 4 | 104（26/个） | 88（22/个） |
| 动作行 × 8（行高 44） | 352 | 352（**保留 44**） |
| 底部提示 | 28 | 24 |
| 内边距合计 | ~16 | ~16 |
| **合计** | **~592** | **~560** |

建议：保留 44px 行高（可点击区域与可读性更稳），压缩其余区块，目标 ≤560px 留出余量；同时给容器加 `max-height: 600px; overflow-y: auto` 兜底。空状态（列表置灰）高度建议与正常态一致，避免弹窗尺寸跳动。

### 4.6 i18n key 清单（两套文案需一一对应）

`extName` · `extDescription` · `groupUnderstand` · `groupAi` · `groupCode` · `groupRun` · `actionGitdiagram` · `actionDeepwiki` · `actionZread` · `actionGitreverse` · `actionGitingest` · `actionGithub1s` · `actionGithubdev` · `actionStackblitz` · `stateNoRepo` · `stateAllHidden` · `footerOpenInNewTab` · `footerOptions` · `optionsTitle` · `optionsGroupsHint` · `optionsMoveUp` · `optionsMoveDown` · `optionsToggleShow` · `optionsReset` · `optionsResetDone` · `optionsPrivacyTitle` · `optionsPrivacyBody` · `optionsPrivateRepoNote`
> 工具名（GitDiagram/GitHub1s/…）保持英文原名，**不进 i18n 表**，直接写在 `actions.ts` 的 `tool` 字段里。

---

## 5. 测试用例补充（在文档 §4 表基础上追加）

`parseRepo`（除文档已列的 7 条外）：

| 输入 | 期望 |
|---|---|
| `https://github.com/torvalds/settings` | `torvalds` / `settings`（保留词只在第一段生效） |
| `https://github.com/Settings/profile` | `null`（保留词比较忽略大小写） |
| `https://github.com/owner/repo/` | 成功 |
| `https://github.com/owner/repo?tab=readme#top` | 成功 |
| `https://github.com/owner/repo/issues/123` | 成功 |
| `https://github.com/owner/repo.GIT` | `repo` |
| `https://github.com/owner/..` | `null` |
| `https://github.com/owner/` | `null` |
| `https://github.com/owner` | `null` |
| `https://github.com/` / `https://github.com` | `null` |
| `https://www.github.com/owner/repo` | `null`（按文档定义） |
| `http://github.com/owner/repo` | 成功 |
| `ftp://github.com/owner/repo` | `null` |
| `http://github.com/owner/repo/a%2Fb` | `null` |
| `not a url` | `null` |
| `https://github.com/owner/repo/-` | `null`（首尾字符约束） |

`buildUrl`：正常填充 · 模板缺占位符 · 非白名单主机（`gitdiagram.com.evil.com`、`evil-gitdiagram.com` 必须 `null`）· `http:` 模板必须 `null` · 含 `user:pass@` 必须 `null` · 8 个模板逐一断言完整期望字符串（顺带锁死模板不被误改）。

`storage.normalize`：非数组 · 含未知 id · 重复 id · 缺 3 个 id · `hidden` 全 8 项 · 空对象 · `null` · 字符串 · 读失败（mock `runtime.lastError`）不写回。

---

## 6. 风险登记册更新

### 6.1 文档已有风险 —— 我的处置意见
- **第三方站点变动**：建议补一条"M1 实测矩阵"（见 6.3），把 8 个动作在 4 类仓库上过一遍，并把实测日期写进 README，作为下次复查的基线。
- **私有仓库**：D6 采纳 `access` 字段后，回退为"文案问题"而非"功能问题"，风险大幅下降。
- **GitHub1s 名称**：**已消解**（官方 README 确认为 GitHub1s，文档推断正确）。
- **重名风险**：建议提前到 M2 之前做一次商店搜索。

### 6.2 新增风险（文档未覆盖）
| 风险 | 影响 | 对策 |
|---|---|---|
| popup 内容超 600px 上限 | 出现滚动条，破坏"一屏看完 8 个动作" | §4.5 尺寸预算 |
| `activeTab` 在受限页面拿不到 URL | `chrome://`、新标签页、商店页、PDF 页会走空状态 | 已并入 P0-6；文案统一为"请打开一个 GitHub 仓库" |
| iOS/Edge/Brave 差异 | Brave 默认可装 CRX；Edge 对 `commands` 与 i18n 表现一致，但 `github.dev` 需微软/Google 账号体系正常 | 只需保证清单同步，不做额外适配 |
| 大仓库/未索引仓库导致目标站点加载慢 | 用户误认为是扩展卡住 | 选项页说明一句；扩展侧无动作可做（这正是"不请求网络"的代价，属于设计取舍） |
| StackBlitz 对非 Web 仓库不可用 | "运行"分类名不符实 | 选项页说明；或把动作名从"尝试在线运行"保留（措辞已含"尝试"，可接受） |

### 6.3 M1 实测矩阵（建议）
每个动作至少在以下 4 类仓库上测一次，记录"能否打开 / 是否需要登录 / 报错文案"：
1. 大型活跃公开仓库（如 `microsoft/vscode`、`facebook/react`）
2. 冷门小仓库（未索引）
3. 私有仓库（自有账号，验证是否需要登录/付费，验证 `access` 字段文案是否准确）
4. 特殊名字仓库（含 `.` / `_` / 大写字母，如 `owner/repo.name`）

---

## 7. 结论与开工建议

### 7.1 开发条件判定
| 阶段 | 是否可开工 | 前置条件 |
|---|---|---|
| M1 仓库识别 + 8 动作跳转 | ✅ **可立即开工** | 仅需 D1（保留词表，建议照 §4.1 抄）、D2（删 background）、D3（default_locale） |
| M2 品牌视觉 / 快捷键 / 空状态 | ✅ 可开工 | 先定 D5（尺寸预算）、D4（点击实现方式） |
| M3 选项页 / 中英文 | ⚠️ 需先定规格 | D7（选项页交互）、D8（存储 schema）、D9（全隐藏态） |
| M4 测试 / 打包 / 上架 | ✅ 无阻塞 | 需产出图标资产（P1-8） |

**总体：文档已经具备开工条件。** 它的优点是把"范围外"和"不变量"写得很死（这是扩展类项目最容易失控的地方），缺失的都是参数级细节，不是方向性缺口。上面 9 项决定若全部采纳默认建议，我可以直接进入实现，无需再回来讨论。

### 7.2 M1 任务拆解（约 1–2 个工作日的量）
1. `npm init` + Vite/TS/Vitest/ESLint/Prettier 脚手架；`tsconfig` 开 `strict` + `noUncheckedIndexedAccess`
2. `actions.ts`：8 个常量（含 `access` 字段，替代 `publicOnly`）
3. `core/parseRepo.ts` + 22 条单测（覆盖 §5 全表）
4. `core/buildUrl.ts` + 白名单/协议/凭据校验单测
5. `storage.ts`：`normalize()` + 读失败不写回 + 单测
6. `popup.html/css/ts`：三态渲染（正常 / 非仓库页 / 全隐藏）、44px 行、Klein 蓝点缀、hover/focus 环
7. 点击与跳转：`<a target="_blank" rel="noopener">` + `tabs.create` 兜底 + 后台打开后 `window.close()`
8. popup 键盘：1–8、Esc；焦点环可见
9. manifest 按 §4.3 落盘；`vite build` 产出 `dist/` 并可加载
10. `npm run test -- --coverage` 达 90%（core + storage）
11. 手工加载真实仓库跑 §6.3 实测矩阵，回填 8 个动作的实测结果到文档
12. 打包体积与 popup 首屏耗时用 §6.2 口径记录一次基线

---

## 附：本文档引用的外部核查来源

- Chrome 命令 API（`_execute_action` 为保留命令、不派发 `onCommand`、`suggested_key` 上限）：https://developer.chrome.com/docs/extensions/reference/api/commands
- `activeTab` 在用户调用扩展时授予（含键盘快捷键路径）：https://developer.chrome.com/docs/extensions/get-started/tutorial/scripts-activetab
- popup 硬上限 800×600：https://developer.chrome.com/docs/extensions/reference/api/action
- GitDiagram 官方用法与私有仓库 PAT 支持：https://github.com/ahmedkhaleel2004/gitdiagram
- DeepWiki 路径规则（`deepwiki.com/{org}/{repo}`）：https://deepwiki.com/
- Zread 用法与"仅公开仓库"：https://zread.ai/
- GitReverse 官方说明（replace hub with reverse）：https://www.gitreverse.com/
- Gitingest README（replace hub with ingest、私有仓库需 PAT）：https://github.com/coderamp-labs/gitingest
- GitHub1s 官方 README（add 1s after github、私有仓库连接账号或 token）：https://github.com/conwnet/github1s
- StackBlitz 打开 GitHub 仓库格式 `stackblitz.com/github/{owner}/{repo}[/{ref}]`：https://developer.stackblitz.com/
