# store/ — 商店素材与提交材料

商店图标、截图与宣传图块由 `npm run assets:store` 从 **`dist/` 里真实构建的界面**渲染生成（脚本：`../scripts/make-store-assets.mjs`）。文字取自 `public/_locales`，因此素材与实际行为不会漂移。

| 路径 | 内容 |
|---|---|
| [`listing.md`](./listing.md) | **提交主文档**：逐字段填写内容（名称、说明、单一用途、权限理由、数据使用、测试说明）、提交清单、风险与对策 |
| [`privacy-policy.md`](./privacy-policy.md) | 隐私政策的 Markdown 源文本（中英双语）。**公开托管用 `docs/privacy.html`**，本文件是它的源文本，`npm run check:privacy` 会校验两者同步 |
| `icon-128.png` | 商店图标（与扩展内图标同一份文件） |
| `screenshots/{zh_CN,en}/01…05*.png` | 5 张 1280×800 截图，按文件名顺序上传 |
| `promo/small-440x280-*.png` | 小型宣传图块（可选） |
| `promo/marquee-1400x560-*.png` | 大型宣传图块（可选，仅首页推荐位用） |

## 重新生成

```bash
npm run build          # 素材取自 dist/，必须先构建
npm run assets:store   # 依赖 devDependency: puppeteer（首次会下载 Chrome）
```

脚本会在结束时校验每个文件的像素尺寸，不符即以非零退出码失败；截图 04 还会断言"已打开"提示确实出现，避免静默产出假素材。

## 隐私政策的发布

`docs/privacy.html` 是 GitHub Pages 用的公开渲染版（纯静态、无外部资源）。三处占位符替换后跑 `npm run check:privacy` 校验，再按仓库根 README 的「发布到 GitHub / 托管隐私政策」开启 Pages 并取 URL。

## 素材保真度

只有三处属于截图环境而非产品行为的替换，均写在脚本注释里：`chrome.*` API 桩件、`tabs.create` 不真的开标签页、字体栈指向本机 Noto CJK（界面本身声明的是 macOS/Windows 系统字体）。没有任何手工绘制或虚构的功能截图。
