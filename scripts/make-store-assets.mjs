/**
 * Generates the Chrome Web Store graphics from the REAL built extension UI.
 *
 * Nothing is redrawn by hand: the popup and options pages are the actual files
 * from `dist/`, loaded in an iframe (screenshot) or a page (options). The only
 * capture-environment substitutions are:
 *   - `chrome.*` APIs are stubbed, configured per frame through the query string,
 *     because a plain page has no extension APIs (the popup needs tabs.query).
 *   - `chrome.tabs.create` resolves without navigating, so a real click can show
 *     the real "opened in background" toast without opening a tab.
 *   - the font stack is pointed at the Noto CJK faces that are installed here,
 *     since the UI names macOS/Windows system fonts.
 * The subset Chinese/English text comes from public/_locales, so screenshots and
 * shipped strings can never drift apart.
 *
 *   node scripts/make-store-assets.mjs
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'store');

const LOCALES = ['zh_CN', 'en'];

if (!existsSync(join(DIST, 'popup.html'))) {
  console.error('dist/ not found — run "npm run build" first');
  process.exit(1);
}

const MESSAGES = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(join(ROOT, 'public', '_locales', locale, 'messages.json'), 'utf8')),
  ]),
);

const ICON_DATA_URI = `data:image/png;base64,${readFileSync(
  join(ROOT, 'public', 'icons', '128.png'),
).toString('base64')}`;

/* ------------------------------------------------------------------ copy ---- */

const COPY = {
  zh_CN: {
    shot1: ['打开任意 GitHub 仓库，点一下扩展图标', '地址栏里的 owner/repo 被识别，8 个动作按 4 个分类排列'],
    shot2: ['一次点击直达，或按数字键 1–8', 'Ctrl / Cmd + 单击在后台新标签页打开，弹窗保持打开'],
    shot3: ['选项页：隐藏、组内排序、恢复默认', '偏好保存在 chrome.storage.sync，随 Chrome 账号同步到其他设备'],
    shot4: ['边界状态都有明确反馈', '非仓库页整列置灰 · 全部隐藏给出入口 · 后台打开后回一条确认'],
    shot5: ['权限最小化，零网络请求', '只申请 storage 与 activeTab；无 host 权限、无遥测、无远程代码'],
    keys: ['数字键直达', '隐藏的动作不占号，编号自动顺延'],
    options: ['↑ ↓ 在同一分类内调整顺序', '取消勾选 = 隐藏该动作', '恢复默认 = 清空隐藏并还原初始顺序'],
    panelB: '非仓库页',
    panelC: '全部隐藏',
    panelF: '后台打开',
    bullets: [
      '只申请 <b>storage</b> + <b>activeTab</b>，安装无额外权限警告',
      '扩展自身<b>不发起任何网络请求</b>，不含遥测与远程代码',
      '仓库地址<b>不落盘</b>，只在点击动作时随跳转发送给目标站点',
      '不注入内容脚本，不读取页面内容',
    ],
    promoTag: '8 个 GitHub 工具，一键直达',
    promoTools: '架构图 · 项目讲解 · AI 提示词 · 在线读改 · 在线运行',
  },
  en: {
    shot1: ['Open any GitHub repo, click the icon', 'owner/repo is read from the address bar; 8 actions in 4 categories'],
    shot2: ['One click, or press keys 1–8', 'Ctrl / Cmd + click opens a background tab and keeps the popup open'],
    shot3: ['Options: hide, reorder, reset', 'Preferences live in chrome.storage.sync and follow your Chrome account'],
    shot4: ['Every edge case answers back', 'Non-repo page greys out · all-hidden shows a way out · background open confirms'],
    shot5: ['Minimal permissions, zero network requests', 'Only storage and activeTab; no host permissions, no telemetry, no remote code'],
    keys: ['Key shortcuts', 'Hidden actions release their number; the rest shift up'],
    options: ['↑ ↓ reorder inside a category', 'Uncheck = hide this action', 'Restore defaults = clear hidden and reset order'],
    panelB: 'Not a repo page',
    panelC: 'Everything hidden',
    panelF: 'Opened in background',
    bullets: [
      'Requests only <b>storage</b> and <b>activeTab</b> — no install-time permission warning',
      'Makes <b>no network requests</b> of its own; no telemetry, no remote code',
      'Never stores the repo address; it is sent only when you click an action',
      'Injects no content scripts and reads no page content',
    ],
    promoTag: '8 GitHub tools, one click away',
    promoTools: 'Diagrams · Guides · AI prompts · Read & edit · Run online',
  },
};

const REPO_URL = 'https://github.com/acme-labs/voyage-kit';
const NON_REPO_URL = 'https://github.com/settings/profile';
const ALL_HIDDEN_PREFS = {
  v: 1,
  hidden: [
    'gitdiagram',
    'deepwiki',
    'zread',
    'gitreverse',
    'gitingest',
    'github1s',
    'githubdev',
    'stackblitz',
  ],
  order: [
    'gitdiagram',
    'deepwiki',
    'zread',
    'gitreverse',
    'gitingest',
    'github1s',
    'githubdev',
    'stackblitz',
  ],
};

/* ------------------------------------------------------- chrome API stub ---- */

const STUB_SOURCE = `(() => {
  const params = new URLSearchParams(location.search);
  const tabUrl = params.get('__url') || '${REPO_URL}';
  const prefsRaw = params.get('__prefs');
  const messages = JSON.parse(decodeURIComponent(params.get('__messages') || '%7B%7D'));

  const css = ":root{--font-sans:'Noto Sans CJK SC','Noto Sans SC',sans-serif;--font-serif:'Noto Serif CJK SC','Noto Serif SC',serif}";
  const inject = () => {
    const style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  };
  if (document.head) inject();
  else document.addEventListener('DOMContentLoaded', inject, { once: true });

  const getMessage = (key, subs) => {
    const entry = messages[key];
    if (!entry) return '';
    let out = entry.message;
    if (subs) (Array.isArray(subs) ? subs : [subs]).forEach((v, i) => {
      out = out.split('$' + (i + 1)).join(String(v));
    });
    return out;
  };

  window.chrome = {
    i18n: { getMessage },
    tabs: {
      query: () => Promise.resolve([{ id: 1, index: 0, active: true, windowId: 1, url: tabUrl }]),
      create: (_props, cb) => { if (typeof cb === 'function') cb({ id: 2 }); return Promise.resolve({ id: 2 }); },
    },
    runtime: { lastError: undefined, openOptionsPage: () => {} },
    storage: {
      sync: {
        get: (_keys, cb) => { cb(prefsRaw ? JSON.parse(decodeURIComponent(prefsRaw)) : {}); },
        set: (_items, cb) => { if (cb) cb(); },
      },
    },
  };
})();`;

/* ------------------------------------------------------------- fixtures ---- */

const BASE_CSS = `
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{width:var(--w,1280px);height:var(--h,800px);overflow:hidden;background:#fff;color:#111;
       font-family:'Noto Sans CJK SC','Noto Sans SC',-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
  .caption{padding:22px 40px 16px;border-bottom:1px solid #e8e8e8}
  .caption h1{display:flex;align-items:center;gap:11px;margin:0 0 7px;font-size:24px;font-weight:600;letter-spacing:.2px}
  .caption h1::before{content:'';width:4px;height:22px;border-radius:2px;background:#002fa7;flex:0 0 auto}
  .caption p{margin:0;color:#6b6b6b;font-size:14px}
  .canvas{position:relative;height:calc(var(--h,800px) - 106px);background:#eef0f3;padding:26px 40px;overflow:hidden}

  /* browser mock */
  .browser{position:relative;height:100%;border-radius:10px;background:#fff;overflow:hidden;
           box-shadow:0 18px 44px rgba(17,17,17,.16),0 2px 6px rgba(17,17,17,.08)}
  .browser__tabs{display:flex;align-items:flex-end;gap:6px;height:40px;padding:8px 10px 0;background:#dfe3e8}
  .tab{display:flex;align-items:center;gap:8px;height:32px;padding:0 12px;border-radius:8px 8px 0 0;
       background:#fff;font-size:12px;color:#3c4043;max-width:280px;white-space:nowrap}
  .tab--idle{background:#eceff3;color:#5f6368}
  .tab__dot{width:12px;height:12px;border-radius:3px;background:#002fa7;flex:0 0 auto}
  .browser__toolbar{display:flex;align-items:center;gap:10px;height:44px;padding:0 12px;
                    background:#f4f6f8;border-bottom:1px solid #dfe3e8}
  .navbtn{width:24px;height:24px;border-radius:50%;background:#e6e9ed;color:#5f6368;font-size:11px;
          display:flex;align-items:center;justify-content:center;flex:0 0 auto}
  .omnibox{display:flex;align-items:center;gap:8px;flex:1 1 auto;height:28px;padding:0 12px;border-radius:14px;
           background:#fff;border:1px solid #dadce0;font-size:12px;color:#202124}
  .omnibox__lock{display:flex;align-items:center;flex:0 0 auto;opacity:.75}
  .omnibox__lock svg{width:11px;height:11px;display:block}
  .extzone{display:flex;align-items:center;gap:8px;flex:0 0 auto}
  .exticon{width:22px;height:22px;border-radius:4px;background:#e6e9ed;display:flex;align-items:center;justify-content:center;
           font-size:11px;color:#5f6368}
  .exticon--active{background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.28)}
  .exticon img{width:16px;height:16px;display:block}
  .avatar{width:22px;height:22px;border-radius:50%;background:#002fa7;color:#fff;font-size:11px;
          display:flex;align-items:center;justify-content:center}

  /* fake repo page — generic, no third-party branding beyond the address itself */
  .viewport{height:calc(100% - 84px);overflow:hidden;background:#fff}
  .gh{padding:18px 26px;font-size:13px;color:#24292f;line-height:1.35}
  .gh__files{table-layout:fixed}
  .gh__top{display:flex;align-items:center;gap:8px;padding-bottom:14px;border-bottom:1px solid #d8dee4}
  .gh__mark{width:26px;height:26px;border-radius:6px;background:#24292f;flex:0 0 auto}
  .gh__owner{color:#0969da;font-size:16px}
  .gh__slash{color:#57606a}
  .gh__repo{color:#0969da;font-size:16px;font-weight:600}
  .gh__badge{margin-left:4px;padding:1px 7px;border:1px solid #d0d7de;border-radius:10px;font-size:11px;color:#57606a}
  .gh__topright{margin-left:auto;display:flex;gap:8px}
  .gh__topright span{padding:3px 10px;border:1px solid #d0d7de;border-radius:6px;background:#f6f8fa;font-size:11px;color:#24292f}
  .gh__tabs{display:flex;gap:20px;margin:12px 0 0;padding-bottom:10px;border-bottom:1px solid #d8dee4;color:#24292f}
  .gh__tabs .is-active{border-bottom:2px solid #fd8c73;padding-bottom:9px;font-weight:600}
  .gh__ops{display:flex;align-items:center;gap:10px;margin:14px 0}
  .gh__branch{padding:4px 12px;border:1px solid #d0d7de;border-radius:6px;background:#f6f8fa;font-size:12px;font-weight:600}
  .gh__muted{color:#57606a;font-size:12px}
  .gh__files{width:100%;border-collapse:collapse;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  .gh__files tr{border-bottom:1px solid #d8dee4}
  .gh__files tr:last-child{border-bottom:0}
  .gh__files td{padding:9px 14px;font-size:12.5px;color:#24292f}
  .gh__files td:last-child{color:#57606a;text-align:right;width:180px}
  .gh__files .ico{display:inline-block;width:13px;margin-right:8px;color:#57606a}
  .gh__files tr:nth-child(even){background:#f6f8fa}
  .gh__readme{margin-top:16px;padding:16px 18px;border:1px solid #d0d7de;border-radius:6px}
  .gh__readme h3{margin:0 0 10px;padding-bottom:9px;border-bottom:1px solid #d8dee4;font-size:13px}
  .gh__readme p{margin:0 0 8px;color:#24292f}
  .gh__code{margin:0;padding:12px;border-radius:6px;background:#f6f8fa;font:11.5px/1.5 ui-monospace,Menlo,monospace;color:#24292f}

  /* real popup, shown in a floating frame */
  .popupwrap{position:absolute;border-radius:10px;overflow:hidden;background:#fff;
             box-shadow:0 20px 48px rgba(17,17,17,.26),0 2px 8px rgba(17,17,17,.12);border:1px solid #e8e8e8}
  .popupwrap iframe{display:block;width:340px;height:562px;border:0}

  /* decorative key badges (annotation, not UI) */
  .keybadge{position:absolute;width:24px;height:24px;border-radius:50%;background:#002fa7;color:#fff;
            font-size:11.5px;font-weight:600;display:flex;align-items:center;justify-content:center;
            box-shadow:0 3px 10px rgba(0,47,167,.28)}
  .keybadge::after{content:'';position:absolute;left:24px;top:11px;width:34px;height:1px;
                   background:linear-gradient(90deg,#002fa7,rgba(0,47,167,.25))}

  .aside{display:flex;flex-direction:column;gap:14px;max-width:330px}
  .aside__title{font-size:15px;font-weight:600}
  .aside__hint{color:#6b6b6b;font-size:12.5px}
  .bullets{display:flex;flex-direction:column;gap:11px}
  .bullet{display:flex;gap:11px;font-size:13.5px;line-height:1.55;color:#111}
  .bullet::before{content:'';width:3px;height:17px;border-radius:2px;background:#002fa7;flex:0 0 auto;margin-top:2px}
  .bullet b{color:#002fa7}
  .panellabel{position:absolute;top:-10px;left:50%;transform:translateX(-50%);padding:3px 11px;border-radius:11px;
              background:#002fa7;color:#fff;font-size:11px;white-space:nowrap;z-index:3}
  .panel{position:relative}

  /* promo tiles */
  .promo{--w:440px;--h:280px;position:relative;width:440px;height:280px;background:#002fa7;color:#fff;overflow:hidden}
  .promo--marquee{--w:1400px;--h:560px;width:1400px;height:560px}
  .promo__logo{width:52px;height:52px;border-radius:9px;background:#fff;color:#002fa7;font-size:20px;font-weight:700;
               letter-spacing:.5px;display:flex;align-items:center;justify-content:center}
  .promo--marquee .promo__logo{width:88px;height:88px;border-radius:16px;font-size:34px}
`;

function page({ title, locale, extraCss = '', body }) {
  return `<!doctype html><html lang="${locale === 'zh_CN' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8">
<title>${title}</title><style>${BASE_CSS}${extraCss}</style></head><body>${body}</body></html>`;
}

function caption(locale, [headline, subline]) {
  const escaped = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<div class="caption"><h1>${escaped(headline)}</h1><p>${escaped(subline)}</p></div>`;
}

function browserMock({ tabTitle, url, viewport, addressLock = true }) {
  return `<div class="browser">
    <div class="browser__tabs">
      <div class="tab"><span class="tab__dot"></span>${tabTitle}</div>
      <div class="tab tab--idle">AVTC</div>
    </div>
    <div class="browser__toolbar">
      <span class="navbtn">←</span><span class="navbtn">→</span><span class="navbtn">⟳</span>
      <div class="omnibox"><span class="omnibox__lock">${
        addressLock
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="#5f6368" stroke-width="2.4"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
          : ''
      }</span>${url}</div>
      <div class="extzone">
        <span class="exticon">⋮⋮</span>
        <span class="exticon exticon--active"><img src="${ICON_DATA_URI}" alt="AVTC"></span>
        <span class="avatar">A</span>
      </div>
    </div>
    <div class="viewport">${viewport}</div>
  </div>`;
}

const REPO_PAGE = `<div class="gh">
  <div class="gh__top">
    <span class="gh__mark"></span>
    <span class="gh__owner">acme-labs</span><span class="gh__slash">/</span><span class="gh__repo">voyage-kit</span>
    <span class="gh__badge">Public</span>
    <div class="gh__topright"><span>Watch</span><span>Fork 118</span><span>★ Star 2.4k</span></div>
  </div>
  <div class="gh__tabs">
    <span class="is-active">Code</span><span>Issues</span><span>Pull requests</span>
    <span>Actions</span><span>Wiki</span><span>Security</span><span>Insights</span>
  </div>
  <div class="gh__ops"><span class="gh__branch">⌥ main</span><span class="gh__muted">3 branches · 27 tags</span></div>
  <table class="gh__files">
    <tr><td><span class="ico">▸</span>.github</td><td>workflows: CI · 2 days ago</td></tr>
    <tr><td><span class="ico">▸</span>src</td><td>refactor: split router from probe · 5 hours ago</td></tr>
    <tr><td><span class="ico">▸</span>tests</td><td>add regression case for .git suffix · 5 hours ago</td></tr>
    <tr><td><span class="ico">≡</span>README.md</td><td>docs: screenshot tour · 1 week ago</td></tr>
    <tr><td><span class="ico">≡</span>package.json</td><td>chore: bump deps · 1 week ago</td></tr>
    <tr><td><span class="ico">≡</span>LICENSE</td><td>MIT · 3 months ago</td></tr>
  </table>
  <div class="gh__readme">
    <h3>README.md</h3>
    <p>voyage-kit — a small toolkit for exploring unfamiliar codebases.</p>
    <pre class="gh__code">npm install
npm run dev     # start the local playground</pre>
  </div>
</div>`;

function popupFrame({ locale, url = REPO_URL, prefs, extraClass = '' }) {
  const params = new URLSearchParams({ __messages: encodeURIComponent(JSON.stringify(MESSAGES[locale])) });
  if (url) params.set('__url', url);
  if (prefs) params.set('__prefs', encodeURIComponent(JSON.stringify(prefs)));
  return `<iframe class="${extraClass}" src="/popup.html?${params.toString()}" scrolling="no"></iframe>`;
}

/* --------------------------------------------------------- shot builders --- */

function shotInContext(locale) {
  const t = COPY[locale];
  return page({
    title: 'coverage 01',
    locale,
    body: `${caption(locale, t.shot1)}
      <div class="canvas">
        ${browserMock({ tabTitle: 'acme-labs/voyage-kit · Repo', url: 'github.com/acme-labs/voyage-kit', viewport: REPO_PAGE })}
        <div class="popupwrap" style="right:24px;top:88px">${popupFrame({ locale })}</div>
      </div>`,
  });
}

function shotKeys(locale) {
  const t = COPY[locale];
  return page({
    title: 'coverage 02',
    locale,
    extraCss: `.canvas{background:#f6f7f8}
      .keygrid{position:absolute;left:104px;top:26px}
      .legend{position:absolute;right:96px;top:120px;max-width:330px}`,
    body: `${caption(locale, t.shot2)}
      <div class="canvas">
        <div class="popupwrap" style="left:190px;top:26px">${popupFrame({ locale })}</div>
        <div class="keygrid" id="keygrid"></div>
        <div class="legend aside">
          <div class="aside__title">${t.keys[0]}</div>
          <div class="aside__hint">${t.keys[1]}</div>
        </div>
      </div>`,
  });
}

function shotOptions(locale) {
  const t = COPY[locale];
  const bullets = t.options.map((line) => `<div class="bullet">${line}</div>`).join('');
  return page({
    title: 'coverage 03',
    locale,
    extraCss: `.canvas{background:#eef0f3;padding:26px 40px}
      .browser .viewport{height:100%}
      .canvas .browser{height:auto}
      .browser .viewport iframe{display:block;width:100%;height:560px;border:0;background:#fff}
      .optaside{position:absolute;right:40px;bottom:34px;max-width:420px;padding:16px 18px;border-radius:8px;
                background:#fff;box-shadow:0 10px 30px rgba(17,17,17,.14)}`,
    body: `${caption(locale, t.shot3)}
      <div class="canvas">
        ${browserMock({
          tabTitle: 'AVTC settings',
          url: 'chrome-extension://avtc/options.html',
          addressLock: false,
          viewport: `<iframe src="/options.html?__messages=${encodeURIComponent(
            JSON.stringify(MESSAGES[locale]),
          )}" scrolling="no"></iframe>`,
        })}
        <div class="optaside bullets">${bullets}</div>
      </div>`,
  });
}

function shotStates(locale) {
  const t = COPY[locale];
  const panel = (label, iframe) =>
    `<div class="panel"><div class="panellabel">${label}</div><div class="popupwrap" style="position:relative;left:0;top:0">${iframe}</div></div>`;

  return page({
    title: 'coverage 04',
    locale,
    extraCss: `.canvas{background:#f6f7f8;display:flex;gap:26px;justify-content:center;align-items:flex-start;padding-top:34px}
      .panel .popupwrap{box-shadow:0 12px 30px rgba(17,17,17,.16)}`,
    body: `${caption(locale, t.shot4)}
      <div class="canvas">
        ${panel(t.panelB, popupFrame({ locale, url: NON_REPO_URL }))}
        ${panel(t.panelC, popupFrame({ locale, prefs: ALL_HIDDEN_PREFS }))}
        ${panel(t.panelF, popupFrame({ locale }))}
      </div>`,
  });
}

function shotPrivacy(locale) {
  const t = COPY[locale];
  const bullets = t.bullets.map((line) => `<div class="bullet">${line}</div>`).join('');
  return page({
    title: 'coverage 05',
    locale,
    extraCss: `.canvas{background:#fff;display:flex;align-items:flex-start;gap:56px;padding:44px 60px}
      .privacy__logo{width:44px;height:44px;border-radius:8px;background:#002fa7;color:#fff;font-size:17px;font-weight:700;
                     display:flex;align-items:center;justify-content:center;letter-spacing:.5px;margin-bottom:18px}
      .privacy{max-width:600px}
      .privacy .bullets{margin-top:22px}`,
    body: `${caption(locale, t.shot5)}
      <div class="canvas">
        <div class="privacy">
          <div class="privacy__logo">AV</div>
          <div class="bullets">${bullets}</div>
        </div>
        <div class="popupwrap" style="position:relative;left:0;top:0">${popupFrame({ locale })}</div>
      </div>`,
  });
}

function promoSmall(locale) {
  const t = COPY[locale];
  return page({
    title: 'promo small',
    locale,
    w: 440,
    h: 280,
    extraCss: `body{--w:440px;--h:280px}
      .promo{display:flex;flex-direction:column;justify-content:space-between;padding:26px 28px}
      .promo__title{font-family:'Noto Serif CJK SC','Noto Serif SC',serif;font-size:40px;font-weight:700;letter-spacing:1px;line-height:1}
      .promo__tag{margin-top:10px;font-size:15px;color:rgba(255,255,255,.92)}
      .promo__tools{font-size:11px;color:rgba(255,255,255,.6);letter-spacing:.2px}
      .promo__row{display:flex;align-items:center;gap:14px}`,
    body: `<div class="promo">
      <div class="promo__row">
        <div class="promo__logo">AV</div>
        <div>
          <div class="promo__title">AVTC</div>
          <div class="promo__tag">${t.promoTag}</div>
        </div>
      </div>
      <div class="promo__tools">${t.promoTools}</div>
    </div>`,
  });
}

function promoMarquee(locale) {
  const t = COPY[locale];
  return page({
    title: 'promo marquee',
    locale,
    w: 1400,
    h: 560,
    extraCss: `body{--w:1400px;--h:560px}
      .marquee{position:relative;width:1400px;height:560px;background:#002fa7;color:#fff;overflow:hidden}
      .marquee__left{position:absolute;left:96px;top:150px;max-width:640px}
      .marquee__row{display:flex;align-items:center;gap:22px;margin-bottom:26px}
      .marquee__title{font-family:'Noto Serif CJK SC','Noto Serif SC',serif;font-size:74px;font-weight:700;letter-spacing:2px;line-height:1}
      .marquee__tag{font-size:26px;color:rgba(255,255,255,.94);line-height:1.5}
      .marquee__tools{margin-top:26px;font-size:15px;color:rgba(255,255,255,.62);letter-spacing:.3px}
      .marquee__right{position:absolute;right:104px;top:76px}
      .marquee__frame{border-radius:14px;overflow:hidden;background:#fff;
                      box-shadow:0 34px 70px rgba(0,0,0,.34),0 4px 14px rgba(0,0,0,.2)}
      .marquee__frame iframe{display:block;width:340px;height:562px;transform:scale(.72);transform-origin:top left}
      .marquee__clip{width:245px;height:405px;overflow:hidden}`,
    body: `<div class="marquee">
      <div class="marquee__left">
        <div class="marquee__row"><div class="promo__logo">AV</div><div class="marquee__title">AVTC</div></div>
        <div class="marquee__tag">${t.promoTag}</div>
        <div class="marquee__tools">${t.promoTools}</div>
      </div>
      <div class="marquee__right">
        <div class="marquee__frame"><div class="marquee__clip">${popupFrame({ locale })}</div></div>
      </div>
    </div>`,
  });
}

/* ------------------------------------------------------------- plumbing ---- */

const FIXTURES = new Map();
for (const locale of LOCALES) {
  FIXTURES.set(`/f/01-${locale}`, shotInContext(locale));
  FIXTURES.set(`/f/02-${locale}`, shotKeys(locale));
  FIXTURES.set(`/f/03-${locale}`, shotOptions(locale));
  FIXTURES.set(`/f/04-${locale}`, shotStates(locale));
  FIXTURES.set(`/f/05-${locale}`, shotPrivacy(locale));
  FIXTURES.set(`/f/promo-small-${locale}`, promoSmall(locale));
  FIXTURES.set(`/f/promo-marquee-${locale}`, promoMarquee(locale));
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function startServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const fixture = FIXTURES.get(url.pathname);
    if (fixture !== undefined) {
      res.writeHead(200, { 'content-type': MIME['.html'] });
      res.end(fixture);
      return;
    }
    const file = join(DIST, url.pathname.replace(/^\/+/, ''));
    if (!existsSync(file) || !statSyncSafe(file)) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function statSyncSafe(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

async function main() {
  // Only the generated asset folders are cleared. `store/` also holds hand-written
  // submission docs (listing.md, privacy-policy.md), which must never be touched.
  for (const dir of ['screenshots', 'promo']) {
    rmSync(join(OUT, dir), { recursive: true, force: true });
  }
  for (const locale of LOCALES) mkdirSync(join(OUT, 'screenshots', locale), { recursive: true });
  mkdirSync(join(OUT, 'promo'), { recursive: true });

  const server = await startServer();
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  const browser = await puppeteer.launch({
    args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--hide-scrollbars'],
  });

  const written = [];
  const shoot = async (path, url, { w, h, prepare }) => {
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(STUB_SOURCE);
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.goto(`${origin}${url}`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.fonts.ready);
    if (prepare) await prepare(page);
    await new Promise((r) => setTimeout(r, 180));
    await page.screenshot({ path, type: 'png' });
    await page.close();
    written.push({ path, w, h });
  };

  /** Draw key badges aligned with the real rows measured inside the popup iframe. */
  const drawKeyBadges = async (page, iframeLeft, iframeTop) => {
    const frame = page.frames().find((f) => f.url().includes('/popup.html'));
    if (frame === undefined) return;
    const rows = await frame.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) => setTimeout(resolve, 150));
      return [...document.querySelectorAll('.row')].map((el) => {
        const rect = el.getBoundingClientRect();
        return Math.round(rect.top + rect.height / 2);
      });
    });
    await page.evaluate(
      (centers, left0, top) => {
        const host = document.getElementById('keygrid');
        if (host === null) return;
        host.style.position = 'absolute';
        host.style.left = `${left0 - 58}px`;
        host.style.top = `${top}px`;
        centers.forEach((center, index) => {
          const badge = document.createElement('div');
          badge.className = 'keybadge';
          badge.textContent = String(index + 1);
          badge.style.top = `${center - 12}px`;
          host.append(badge);
        });
      },
      rows,
      iframeLeft,
      iframeTop,
    );
  };

  /* 01–05 per locale */
  // badges sit to the LEFT of the popup, with a connector pointing at each row
  const popupBox = { left: 190, top: 26 };

  for (const locale of LOCALES) {
    const dir = join(OUT, 'screenshots', locale);
    await shoot(join(dir, '01-popup-in-context.png'), `/f/01-${locale}`, { w: 1280, h: 800 });
    await shoot(join(dir, '02-keyboard-shortcuts.png'), `/f/02-${locale}`, {
      w: 1280,
      h: 800,
      prepare: (page) => drawKeyBadges(page, popupBox.left, popupBox.top),
    });
    await shoot(join(dir, '03-options-page.png'), `/f/03-${locale}`, { w: 1280, h: 800 });
    await shoot(join(dir, '04-edge-states.png'), `/f/04-${locale}`, {
      w: 1280,
      h: 800,
      prepare: async (page) => {
        // Drive the real background-open path on the THIRD panel: a middle click on
        // an enabled row, with the stubbed tabs.create resolving without navigating.
        // The toast it produces is therefore genuine UI, not a mock-up.
        const frames = page.frames().filter((f) => f.url().includes('/popup.html'));
        const last = frames[frames.length - 1];
        if (last === undefined) throw new Error('state panel iframe not found');

        const diag = await last.evaluate(() => {
          const row = document.querySelector('.row:not(.row--disabled):not(.row--invalid)');
          if (row === null) throw new Error('no enabled row to click');
          row.dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true, cancelable: true }));
          return { hasChrome: typeof chrome !== 'undefined', hasTabs: typeof chrome?.tabs?.create };
        });
        if (process.env.AVTC_DEBUG) console.log('   [debug] frame:', last.url().slice(0, 80), diag);
        await new Promise((r) => setTimeout(r, 400));
        if (process.env.AVTC_DEBUG) {
          const footer = await last.evaluate(() => document.getElementById('footer-text')?.textContent ?? '(none)');
          console.log('   [debug] footer after click:', JSON.stringify(footer));
        }

        // Fail loudly rather than shipping a screenshot without the toast.
        await new Promise((r) => setTimeout(r, 400));
        const footer = await last.evaluate(
          () => document.getElementById('footer-text')?.textContent ?? '',
        );
        const expected = locale === 'zh_CN' ? '已打开' : 'Opened';
        if (!footer.includes(expected)) {
          throw new Error(`state panel did not show the background-open toast (footer: ${footer})`);
        }
      },
    });
    await shoot(join(dir, '05-privacy.png'), `/f/05-${locale}`, { w: 1280, h: 800 });

    await shoot(join(OUT, 'promo', `small-440x280-${locale}.png`), `/f/promo-small-${locale}`, {
      w: 440,
      h: 280,
    });
    await shoot(join(OUT, 'promo', `marquee-1400x560-${locale}.png`), `/f/promo-marquee-${locale}`, {
      w: 1400,
      h: 560,
    });
  }

  await browser.close();
  server.close();

  writeFileSync(join(OUT, 'icon-128.png'), readFileSync(join(ROOT, 'public', 'icons', '128.png')));

  /* ---- verify what was produced ---- */
  const limits = {
    screenshot: { w: 1280, h: 800 },
    small: { w: 440, h: 280 },
    marquee: { w: 1400, h: 560 },
  };
  let failed = false;
  const rows = [];
  for (const item of written) {
    const kind = item.path.includes('/promo/')
      ? item.path.includes('marquee')
        ? 'marquee'
        : 'small'
      : 'screenshot';
    const expect = limits[kind];
    const ok = item.w === expect.w && item.h === expect.h;
    if (!ok) failed = true;
    rows.push(
      `${ok ? '✓' : '✗'} ${item.path.slice(OUT.length + 1)}  ${item.w}×${item.h}${
        ok ? '' : ` (expected ${expect.w}×${expect.h})`
      }`,
    );
  }

  console.log(rows.join('\n'));
  console.log(`\nstore/icon-128.png (copied from the shipped icon)`);
  console.log(`\n${failed ? 'FAILED: asset size mismatch' : `OK — ${written.length + 1} assets`}`);
  if (failed) process.exit(1);
}

await main();
