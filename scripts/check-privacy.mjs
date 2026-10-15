/**
 * Checks the public privacy policy before it is published to GitHub Pages:
 *
 *  1. every placeholder has been replaced (contact email, effective date)
 *  2. the page names the extension (the store rejects a policy that does not)
 *  3. both languages disclose the same required facts, and the HTML stays in
 *     sync with store/privacy-policy.md (the Markdown source of the same text)
 *  4. the page loads no external resources — no CDN, no remote fonts, no tracking
 *     pixels — so what reviewers see is exactly what is in the repository
 *
 *   npm run check:privacy
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML_FILE = join(ROOT, 'docs', 'privacy.html');
const MD_FILE = join(ROOT, 'store', 'privacy-policy.md');

const problems = [];
const warnings = [];
const notes = [];

if (!existsSync(HTML_FILE)) {
  console.error('docs/privacy.html not found');
  process.exit(1);
}

const html = readFileSync(HTML_FILE, 'utf8');
const md = existsSync(MD_FILE) ? readFileSync(MD_FILE, 'utf8') : '';
if (md === '') problems.push(`store/privacy-policy.md not found — cannot verify the two stay in sync`);

/* ---------- 1. placeholders ---------- */

const REQUIRED_FILLED = [
  { token: '[你的联系邮箱]', what: '联系邮箱 / contact email' },
  { token: '[生效日期]', what: '生效日期 / effective date' },
];
for (const { token, what } of REQUIRED_FILLED) {
  if (html.includes(token)) {
    const lines = html.split('\n').reduce((acc, line, i) => (line.includes(token) ? [...acc, i + 1] : acc), []);
    problems.push(`${what} 仍是占位符 ${token}（docs/privacy.html 第 ${lines.join(', ')} 行）`);
  }
}

const OPTIONAL_TOKEN = '[可选：仓库地址]';
if (html.includes(OPTIONAL_TOKEN)) {
  notes.push(`仓库地址是可选项：若公开仓库，替换 ${OPTIONAL_TOKEN}；若不公开，删掉它所在的那一行`);
}

/* ---------- 2. names the extension ---------- */

for (const needle of ['AVTC', 'Manifest V3']) {
  if (!html.includes(needle)) problems.push(`docs/privacy.html 未提到「${needle}」`);
}

/* ---------- 3. disclosures, and HTML vs Markdown parity ---------- */

const REQUIRED_DISCLOSURES = [
  ['storage', 'storage 权限'],
  ['activeTab', 'activeTab 权限'],
  ['chrome.storage.sync', '偏好存储位置'],
  ['host_permissions', '未申请 host 权限'],
  ['GitDiagram', '第三方站点清单（首项）'],
  ['StackBlitz', '第三方站点清单（末项）'],
];

for (const [needle, label] of REQUIRED_DISCLOSURES) {
  if (!html.includes(needle)) problems.push(`docs/privacy.html 缺少披露项：${label}`);
  if (md !== '' && !md.includes(needle)) {
    problems.push(`store/privacy-policy.md 缺少披露项：${label} —— 两个文件已不同步`);
  }
}

/* HTML must cover both languages: look for the anchor heading texts. */
for (const anchor of ['id="zh"', 'id="en"', '中文版', 'English version']) {
  if (!html.includes(anchor)) problems.push(`docs/privacy.html 缺少语言段落标记：${anchor}`);
}
/* The Chinese section must carry the same content as the Markdown source. */
const CHINESE_HEADINGS = [
  '我们收集什么',
  '扩展会读取什么',
  '数据会发往哪里',
  '权限说明',
  '你的控制',
  '政策变更',
  '联系我们',
];
for (const heading of CHINESE_HEADINGS) {
  if (!html.includes(heading)) problems.push(`docs/privacy.html 缺少中文小节：${heading}`);
  if (md !== '' && !md.includes(heading)) problems.push(`store/privacy-policy.md 缺少中文小节：${heading}`);
}

/* ---------- 4. no external resources ---------- */

const external = [
  ...html.matchAll(/\s(?:src|href)\s*=\s*"(https?:)?\/\/[^"]+"/gi),
].map((m) => m[0].trim());
if (external.length > 0) {
  problems.push(`docs/privacy.html 引用了外部资源（应全部内联）：${external.join(', ')}`);
}
if (/<script\b/i.test(html)) problems.push('docs/privacy.html 含 <script>，该页面应为纯静态无脚本');
if (/@import\s/i.test(html)) problems.push('docs/privacy.html 含 CSS @import，应内联样式');

/* ---------- report ---------- */

for (const note of notes) console.log(`note  ${note}`);
for (const warning of warnings) console.log(`warn  ${warning}`);

if (problems.length > 0) {
  console.error('\ncheck-privacy FAILED:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('\n处理好上面几项后重新运行 npm run check:privacy。');
  console.error('发布流程见 README 的「发布到 GitHub / 托管隐私政策」一节。');
  process.exit(1);
}

console.log('check-privacy OK — docs/privacy.html 可以发布');
