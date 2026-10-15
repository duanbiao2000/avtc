# AVTC

**Auckland Voyage Training Camp** — 一个 Chrome 扩展（Manifest V3）。识别当前 GitHub 仓库，把地址改写成 8 个第三方工具的地址并**直接跳转**；地址无效时不跳转，只在弹窗底部给一行文字提示。

只申请 `storage` 与 `activeTab` 两个权限，扩展自身**不发起任何网络请求**，不含遥测、不含远程代码、不注入内容脚本。

- 产品与技术规格： [`spec/AVTC-产品开发文档-v1.1.md`](./spec/AVTC-产品开发文档-v1.1.md)
- 开发交接与手工验收清单： [`spec/AVTC-开发交接-v1.0.md`](./spec/AVTC-开发交接-v1.0.md)
- 设计评审记录（v1.0 的 9 项决定）： [`spec/AVTC-文档评审-v1.0.md`](./spec/AVTC-文档评审-v1.0.md)

---

## 快速开始

```bash
npm install
npm run build          # 产出 dist/
npm run verify         # typecheck + lint + 覆盖率 + 构建 + 产物体检
npm run zip            # 打包成 avtc-1.0.0.zip（内容与 dist/ 一致）
```

| 命令 | 作用 |
|---|---|
| `npm run dev` | `vite build --watch`，改完在 `chrome://extensions` 点刷新 |
| `npm run test` / `npm run coverage` | Vitest；覆盖率阈值 90%（core + storage） |
| `npm run typecheck` / `npm run lint` / `npm run format` | TS strict / ESLint / Prettier |
| `npm run check:dist` | 校验 manifest 引用、体积 <100KB、权限白名单、无 eval/内联脚本、name/description 长度 |
| `npm run check:privacy` | **发布隐私政策前**必须通过（见下文「发布」） |
| `npm run assets:store` | 生成商店截图与宣传图块（需先 build；用 Puppeteer 驱动真实产物） |
| `npm run icons` | 重新生成 `public/icons/*.png` |

### 加载到 Chrome（114+）

1. `npm run build`
2. 打开 `chrome://extensions`，右上角开启「开发者模式」
3. 点「加载已解压的扩展程序」，选择 `dist/` 目录（不是仓库根目录）
4. 打开任意 `github.com/{owner}/{repo}` 页面，点扩展图标

### 不装扩展先看界面

打开 [`preview/popup-states.html`](./preview/popup-states.html)（内联样式、无外部资源），可对照规格第 2 节核对 6 种状态与配色。

---

## 仓库结构

```
.
├─ src/
│  ├─ core/            parseRepo · buildUrl · openTarget · actions（纯函数，全部被单测覆盖）
│  ├─ popup/           弹窗：渲染、数字键 1–8 / Esc、错误与「已打开」提示
│  ├─ options/         选项页：显隐、组内排序、恢复默认
│  ├─ storage.ts       chrome.storage.sync 读写 + 归一化（损坏回退默认，读失败不写回）
│  └─ i18n.ts          chrome.i18n 薄封装 + data-i18n
├─ tests/              Vitest（6 个文件 / 111 个用例）
├─ public/             manifest.json · _locales/{zh_CN,en} · icons（构建时原样拷贝）
├─ scripts/            make-icons · check-dist · make-store-assets · check-privacy
├─ docs/               GitHub Pages 站点：index.html + privacy.html  ← 公开 URL
├─ store/              上架材料：listing.md（提交主文档）· 隐私政策源文本 · 截图 · 宣传图块
├─ spec/               产品规格与工程文档（本目录顶部已链接）
├─ preview/            离线视觉校验页
└─ .github/workflows/  CI：verify + 构建产物上传 + 隐私政策占位符检查
```

---

## 发布到 GitHub / 托管隐私政策

Chrome 网上应用店的「隐私政策网址」是**必填**项，且必须是一个能公开访问、不返回 404、并点名扩展的页面。本仓库已经把页面准备好了：`docs/privacy.html`（中英双语、纯静态、不加载任何外部资源）。

### 第 1 步：填好占位符（本仓库发布前必做）

`docs/privacy.html` 里有三处占位符，直接编辑该文件：

| 占位符 | 说明 |
|---|---|
| `[你的联系邮箱]` | 必填。会出现在页眉、联系我们、页脚 |
| `[生效日期]` | 必填。建议写首次发布日期 |
| `[可选：仓库地址]` | 可选。若不公开仓库，把「项目地址」那一行整行删掉 |

然后跑校验，通过后再继续：

```bash
npm run check:privacy
```

它会检查：占位符是否都已替换、页面是否点名 AVTC、中英两段是否齐全、关键披露项是否与 `store/privacy-policy.md` 一致、以及页面是否**零外部资源**（无 CDN、无远程字体、无埋点、无脚本）。CI 里也有一份同样的检查（非阻塞），提醒你别把带占位符的政策发出去。

### 第 2 步：推到 GitHub

```bash
git remote add origin git@github.com:<你的账号>/avtc.git
git push -u origin main
```

### 第 3 步：开启 Pages

**注意：GitHub Free 个人账号的 Pages 只能从「公开仓库」发布。** 请先决定走哪条路：

| 方案 | 适用 | 代价 |
|---|---|---|
| **A. 仓库设为公开** | 代码可以公开 | 仓库内容对所有人可见 |
| **B. 仓库保持私有 + 付费版** | 代码不公开 | 需要 GitHub Pro / Team / Enterprise 才能开 Pages |
| **C. 仓库私有 + 另建公开小仓库** | 代码不公开、不想付费 | 把 `docs/` 两个文件复制到一个公开仓库（例如 `avtc-policy`），只发布隐私政策 |
| **D. 用 Cloudflare Pages / Netlify** | 代码不公开、不想付费 | 授权第三方平台读取仓库；或直接把 `docs/` 拖上去 |

方案 A / B 的 Pages 设置：

```
Repository → Settings → Pages
  Source:            Deploy from a branch
  Branch:            main
  Folder:            /docs
→ Save，等约 1 分钟
```

发布后的地址（把 `<账号>` 换成你的账号）：

```
https://<账号>.github.io/avtc/privacy.html     ← 填进商店的「隐私政策网址」
https://<账号>.github.io/avtc/                 ← 站点首页（docs/index.html）
```

> Pages 发布的是**静态页面**，无需构建步骤；`docs/` 里的文件是源文件也是产物，改完直接推即可。

### 第 4 步：回到商店

把上面的 `privacy.html` 地址填进开发者后台的「隐私政策网址」，其余字段照 [`store/listing.md`](./store/listing.md) 逐项填写。

---

## 上架材料

`store/` 里是提交 Chrome 网上应用店所需的全部内容：

| 文件 | 内容 |
|---|---|
| [`store/listing.md`](./store/listing.md) | 提交主文档：名称、中英详细说明、单一用途、两条权限理由、远程代码=否、数据使用、审核员测试说明、提交清单、风险表 |
| `store/privacy-policy.md` | 隐私政策的 Markdown 源文本（`docs/privacy.html` 是它的公开渲染版，`check:privacy` 会校验两者同步） |
| `store/icon-128.png` | 商店图标 |
| `store/screenshots/{zh_CN,en}/01…05*.png` | 5 张 × 2 语言，均 1280×800 |
| `store/promo/*` | 小型 440×280 与大型 1400×560 宣传图块 |

截图由 `npm run assets:store` 用 Puppeteer 驱动 **`dist/` 里真实构建的界面**渲染，文案取自 `public/_locales`，因此素材与扩展实际显示不会漂移；脚本结束时校验像素尺寸，并在截图 04 断言「已打开」提示确实出现。细节见 [`store/README.md`](./store/README.md)。

---

## 约束（改代码时不可破坏）

- 权限恒为 `storage` + `activeTab`；无 host 权限、无 `tabs`、无 `scripting`；安装无额外权限警告。
- 扩展自身零网络请求、无遥测、无远程代码、无 `eval`、无内联脚本、无内容脚本。
- 仓库地址永不落盘；只在用户点击动作时随跳转发送给目标站点。
- 目标地址必须是 `https:` 且主机名**精确匹配** 8 个白名单域名。
- 扩展**不检测**目标站点是否可用（404 / 停服 / 需登录都不属于「地址无效」）。
- 「跳转」只有一个结果：要么打开标签页，要么不打开并给出一行文字提示；不重试、不弹确认框。

以上大部分约束由 `npm run verify` 自动把关（`check:dist` + 单测 + i18n 一致性），改动后请务必跑一次。

---

## 许可

本仓库暂未附带许可协议，即默认保留所有权利。若要开源，请自行添加 `LICENSE`（例如 MIT），并在仓库描述与商店信息中保持一致。
