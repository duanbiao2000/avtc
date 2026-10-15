# AVTC 开发交接说明

**对应文档：** `AVTC-产品开发文档-v1.1.md`
**代码位置：** `avtc/`
**日期：** 2026-10-15
**状态：** M1–M4 的实现均已完成，自动化验证全部通过；**真实 Chrome 加载与 8 个站点的实测必须由你完成**（清单见 §3）。

---

## 1. 交付物

| 交付物 | 位置 | 说明 |
|---|---|---|
| 源码 | `avtc/src/` | core / popup / options / storage / i18n，TypeScript strict |
| 测试 | `avtc/tests/` | 6 个文件、111 个用例 |
| 可加载扩展 | `avtc/dist/` | `chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → 选这个目录 |
| 上架压缩包 | `avtc/avtc-1.0.0.zip` | 17.9 KB；内容与 `dist/` 逐文件一致（已用 diff 校验） |
| 图标 | `avtc/public/icons/{16,32,48,128}.png` | 克莱因蓝圆角方块 + 白色 AV，脚本生成 |
| 视觉校验台 | `avtc/preview/popup-states.html` | 内联全部样式，双击即可看 6 种状态（无需装扩展） |
| 产物体检脚本 | `avtc/scripts/check-dist.mjs` | 校验 manifest 引用、体积、权限、无 eval/内联脚本 |

## 2. 自动化验证结果（可复现）

```
npm install && npm run verify
```

| 检查项 | 结果 | 对应文档约束 |
|---|---|---|
| `tsc --noEmit` | 通过（strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`） | 工程要求 17 |
| `eslint .` | 通过（含 `no-eval` / `no-new-func` 硬规则） | 工程要求 14 |
| Vitest | **111 passed / 6 files** | M1、M4 |
| 覆盖率（core + storage） | 语句 **100%**、行 **100%**、函数 **100%**、分支 **97.65%**（阈值 90%） | 工程要求 17 |
| 构建 | `vite build` 通过，产物布局与 manifest 一致 | 工程要求 15 |
| 体积（不含图标） | **29.7 KB / 100 KB** | 工程要求 15 |
| 权限 | 仅 `storage` + `activeTab`；无 host 权限、无 `tabs`、无 background | 权限约束 1–2 |
| 产物卫生 | 无 `eval`、无 `new Function`、页面无内联脚本；manifest 引用的文件全部存在 | 工程要求 14 |

**单元测试覆盖的关键行为：**

- `parseRepo` 52 例：文档 §5.1 的 7 条原用例 + 保留词只在第一段生效（`torvalds/settings` 必须成功）+ 尾斜杠 / query / hash / `.GIT` / 大小写保留 / `..` 与 `%2F` / 长度上限 / `www.` 与子域拒绝。
- `buildUrl` 14 例：8 个模板逐一断言完整期望字符串（锁死模板不被误改）+ 非白名单主机（`gitdiagram.com.evil.com`、`evil-gitdiagram.com`）+ 非 https 不升级 + 凭据/端口/控制字符拒绝。
- `openTarget` 8 例：**直接对应你新增的要求** —— 正常前台 / 修饰键后台 / 地址无效时**不调用 createTab 且返回 `invalid-target`** / 浏览器拒收返回 `open-failed` / 不重试 / 不抛异常。
- `storage` 24 例：未知 id、重复 id、缺项补全、全隐藏、非数组、字符串、`null`、**读失败不写回**。
- `i18n` 6 例：中英 key 集合一致、无空文案、源码引用的 key 全部存在、**无死键**、工具名两语言保持英文、占位符一致。

## 3. 必须由你在真实 Chrome 里完成的验证（我无法在此环境执行）

沙箱里没有浏览器，也没法访问 chrome:// 页面，因此以下项目**未经验证**，请按顺序走一遍：

### 3.1 安装与权限（M4 验收）
1. `chrome://extensions` → 打开开发者模式 → 加载已解压的扩展程序 → 选 `avtc/dist`。
2. **确认安装时没有权限警告**（只应显示"存储"这类无害提示，不应出现"读取你在网站上的数据"）。
3. 若你之前装过旧版本，先移除再装，避免加载到旧产物。

### 3.2 弹窗与跳转（M1 / M2 验收）
4. 打开 `https://github.com/browser-act/skills`，点工具栏图标。
   - 核对：品牌区 / 当前项目名（克莱因蓝）/ 4 个分类竖线 / 8 行 44px / 底部"在新标签页打开"。
   - 与 `preview/popup-states.html` 对照，应完全一致。
5. **逐个点击 8 个动作**，确认新标签页打开且落在正确页面（前台打开时弹窗应自动消失）。
6. `Ctrl`/`Cmd` + 单击（或中键）→ 应为**后台**标签页，且弹窗**保持打开**并在底部显示"已打开：{工具名}"，可连续点多个。
7. 数字键 `1`–`8` 逐个试；`Esc` 应关闭弹窗。
8. 键盘 `Tab` 走一遍动作行，确认有可见的克莱因蓝焦点环。

### 3.3 空状态与边界（M2 验收）
9. 在非仓库页试：`https://github.com/settings/profile`、`https://github.com/marketplace`、`chrome://extensions`、新标签页、`https://gist.github.com/...`、任意非 GitHub 网站。
   - 期望：列表置灰不可点、当前项目显示 `—`、底部提示"请打开一个 GitHub 仓库"。
10. 弹窗总高应为 **562px**（48 + 32 + 452 + 30），**不应出现滚动条**。若你的系统字体或缩放下超高，告诉我，我把分类标题或底部压缩 2px。

### 3.4 选项页（M3 验收）
11. 弹窗右上角齿轮 → 进入选项页。
12. 取消勾选某个动作 → 回到弹窗确认该行消失、数字键编号顺延、分组为空时不显示空标题。
13. 用 ↑↓ 在同一分类内调整顺序 → 弹窗顺序同步；**跨分类拖动应不可能**（按钮在组边界自动禁用）。
14. 全部取消勾选 → 弹窗应显示"所有动作已隐藏" + "打开设置"按钮。
15. 点"恢复默认" → 列表与顺序复原，显示"已保存"。
16. 在另一台设备（同 Chrome 账号）登录，确认偏好同步；或把 `chrome.storage.sync` 里的数据手动改坏（在 DevTools 的 Service Worker 控制台执行 `chrome.storage.sync.set({order: 'garbage', hidden: 5})`），刷新选项页应回退默认而不报错。

### 3.5 语言与快捷键
17. 把浏览器界面语言切成英文 → 弹窗与选项页应为英文；切成日语/韩语 → 应为英文（不是中文），这是 `default_locale: "en"` 的预期结果。
18. `chrome://extensions/shortcuts` 确认 `Alt+Shift+A` 已注册（若与其他扩展冲突会显示为空，需要手动指定）。

### 3.6 8 动作实测矩阵（M1 验收的核心，请回填 `avtc/README.md` 末尾表格）

| 动作 | 大型公开仓库 | 冷门未索引仓库 | 私有仓库 | 特殊名仓库（含 `.` / 大写） |
|---|---|---|---|---|
| GitDiagram / DeepWiki / Zread / GitReverse / Gitingest / GitHub1s / GitHub.dev / StackBlitz | | | | |

每格记"能否打开 / 是否需要登录 / 报错文案"，并记下日期。预期情况（按 v1.1 文档）：
- **GitHub.dev** 未登录时会跳到登录页；私有仓库走登录态可用。
- **GitHub1s** 公开仓库免登录；私有仓库需在该站连接账号或填 token。
- **Zread** 仅公开仓库，未索引的仓库需先申请索引，表现为"打开很慢"。
- **StackBlitz** 只对 Web/Node 类仓库能真正跑起来，Go/Rust/Java 仓库会空转或报错。
- **GitReverse / DeepWiki / Zread** 对私有仓库：官方口径是不支持或需付费，但不会拦你，打不开属预期。
- 若某工具**对仓库名大小写敏感**并因此 404，告诉我，我给该动作加一个模板级 `normalize: 'lower'` 开关（只影响该动作）。

## 4. 落地时对文档的偏离与补充（都记在这里，便于回填文档）

| # | 项目 | 说明 |
|---|---|---|
| 1 | **删除 background service worker** | 文档 D2：Chrome 不向扩展派发 `_execute_action`，SW 收不到任何调用，属死代码。`check-dist` 会在 manifest 里重新出现 `background` 时报错 |
| 2 | **`default_locale: "en"`** | 文档 D3：否则日/韩/德语浏览器会看到中文，与"跟随浏览器语言"矛盾 |
| 3 | **`publicOnly` → `privateRepo: 'no'\|'session'\|'token'`** | 文档 D6；GitHub.dev 实际支持私有仓库（登录态），旧布尔值会误导 |
| 4 | **新增构建步骤 `flatHtmlOutput()`** | Vite 会把页面输出到 `dist/popup/popup.html`，而 manifest 要求 `dist/popup.html`。用 `generateBundle` 改名**无效**（Vite 的 HTML 走 `emitFile({fileName})`，写盘时按注册名解析），因此改为构建后重定位并重写相对资源路径。文档未规定 dist 布局，这里补上了 |
| 5 | **新增 `npm run check:dist`** | 把"体积 < 100KB""无额外权限""无 eval / 无内联脚本""manifest 引用完整"变成自动检查，避免以后悄悄退化 |
| 6 | **新增 i18n 一致性测试** | 防 key 拼错导致标签空白、防两套文案 key 不一致、防出现死键 |
| 7 | **选项页焦点恢复** | 每次改动都会重建 DOM，若不处理键盘用户会丢焦点；现按稳定 id 恢复 |
| 8 | **存储带 `v: 1`** | 为将来迁移留出版本位，归一化会忽略未知字段 |
| 9 | **i18n 文案补齐** | 新增 `optionsSaved` / `optionsSaveFailed` / `optionsPrivateRepoTitle` / `privateRepo{No,Session,Token}` / `toastOpened` / `errInvalidTarget` / `errOpenFailed` / `stateAllHidden` / `openOptions` 等 |

## 5. 已知局限（与文档一致，不是缺陷）

1. **不检测目标站点可用性**：404、停服、需登录、私有仓库无权限都不属于"地址无效"。选项页已写明，并提示可用右键"复制链接地址"自行排查。
2. **不代传任何 token**：GitDiagram / Gitingest 需要 PAT 时，由你在目标站点内自行粘贴。
3. **不做内容脚本**：不读取、不注入目标页面。
4. **仓库地址不落盘**：只在点击动作时随浏览器跳转发送。

## 6. M4 上架材料（已完成）

> 上一版此处列的三项中，第一项你已确认（安装后无使用问题），第二项已完成，第三项见下方"仍需你本人完成"。

### 6.1 交付物

| 交付物 | 位置 | 说明 |
|---|---|---|
| 提交主文档 | `avtc/store/listing.md` | 逐字段填写内容：名称、简短/详细说明（中英）、单一用途、两条权限理由、远程代码=否、数据使用=不收集、审核员测试说明、分发设置、提交清单、风险与对策 |
| 隐私政策 | `avtc/store/privacy-policy.md` | 中英双语、点名扩展 AVTC，替换 3 处占位符后即可托管 |
| 商店图标 | `avtc/store/icon-128.png` | 与扩展内图标同一份文件 |
| 截图 ×10 | `avtc/store/screenshots/{zh_CN,en}/01…05*.png` | 5 张 × 2 语言，均 1280×800，全出血无留白 |
| 宣传图块 ×4 | `avtc/store/promo/` | 小型 440×280 + 大型 1400×560，各 2 语言 |
| 素材生成器 | `avtc/scripts/make-store-assets.mjs` | `npm run assets:store`；用 Puppeteer 驱动**真实构建产物**渲染，结束时校验像素尺寸并断言截图 04 的"已打开"提示确已出现 |

### 6.2 素材是怎么做出来的（保真度）

截图不是手绘，也不是拿弹窗截图往白底上贴：脚本起一个本地 HTTP 服务，把 `dist/` 里的 `popup.html` / `options.html` 装进一个浏览器窗口模拟（标签页 + 地址栏 + 扩展区）里截图。中文文案直接读 `public/_locales/zh_CN/messages.json`，所以截图文字与扩展实际显示的文案永远不会漂移。

三处属于截图环境而非产品行为的替换（脚本注释里也写了）：

1. `chrome.*` 桩件：`chrome.i18n.getMessage` 用真实 locale 文件实现，`chrome.tabs.query` 返回演示仓库地址，`chrome.storage.sync` 返回真实偏好结构；
2. 截图 04 的"已打开：GitDiagram"是**真实中键点击**触发的真实 UI 反馈 —— 脚本会断言该文案出现，否则构建失败；只是 `tabs.create` 没真的开标签页；
3. 字体栈指向本机 Noto CJK，因为界面声明的是 macOS/Windows 系统字体，而截取环境是 Linux。

### 6.3 开发过程中修掉的上架阻塞问题

| # | 问题 | 影响 | 处理 |
|---|---|---|---|
| 1 | **英文 `description` 154 字符，超过 Chrome 的 132 上限** | 打包/上架会被拒 | 改写为 126 字符；并把"name ≤ 45 / description ≤ 132"写进 `check:dist`，以后超长会直接构建失败 |
| 2 | 截图脚本的 `chrome.tabs.create` 桩没调用回调 | popup 内的 `createTab` Promise 永不 settle，"已打开"提示不出现，素材会**静默缺失**关键 UI | 桩改为同步回调（与真实 API 行为一致），并加断言：提示不出现就报错退出 |
| 3 | 键位徽标按测量位置绘制，但测量发生在字体加载完成前 | 徽标逐行漂移，压到分类标题 | 测量前等 `document.fonts.ready` + 稳定延迟，徽标移到弹窗左侧并加引线 |

### 6.4 仍需你本人完成（我无法代做）

1. **托管隐私政策**并替换 3 处占位符，拿到公开 URL；
2. **注册/登录开发者账号**（一次性 $5）；
3. **在商店内搜 "AVTC" 复核重名**（我用公开搜索未发现同名，但搜索结果受地区与账号影响）；
4. **声明 Trader / Non-trader**（EU DSA，法律判断，`store/listing.md` §2.5 给了口径参考）；
5. **上传 `avtc/avtc-1.0.0.zip`**（不是 `dist/` 目录）；
6. 若你此前已上传过修复前的 zip，请把 `manifest.json` 的 `version` 升到 `1.0.1` 再打包，否则商店会因版本号未变而拒绝更新。

## 7. 后续可选事项

- v1.1 的 `privateRepo` 行内悬停提示（文档已列为计划项）；
- 若你要"跳转后 404 也提示"，按文档 §4.4 单独评估 opt-in 的 host 权限预检方案（会引入权限警告，不建议）；
- 每发一个版本前跑一次 `npm run assets:store`，让截图随 UI 自动更新。
