/**
 * Checks the built extension against the hard constraints from the doc:
 *  - every path the manifest references exists in dist/
 *  - the bundle stays under 100 KB excluding icons
 *  - no eval / new Function, no inline <script> in the pages
 *
 *   node scripts/check-dist.mjs   (run after `npm run build`)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const SIZE_LIMIT = 100 * 1024; // 100 KB, icons excluded

const failures = [];

function fail(message) {
  failures.push(message);
}

function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

let files;
try {
  files = listFiles(DIST);
} catch {
  console.error(`dist/ not found — run "npm run build" first`);
  process.exit(1);
}

const relativeFiles = files.map((f) => relative(DIST, f).split('\\').join('/'));
const has = (p) => relativeFiles.includes(p);

/* ---------- manifest references ---------- */
const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));
const referenced = [
  manifest.action?.default_popup,
  manifest.options_ui?.page,
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action?.default_icon ?? {}),
  manifest.background?.service_worker,
].filter((p) => typeof p === 'string');

for (const path of referenced) {
  if (!has(path)) fail(`manifest references a missing file: ${path}`);
}

for (const locale of ['zh_CN', 'en']) {
  const file = `_locales/${locale}/messages.json`;
  if (!has(file)) fail(`missing locale file: ${file}`);
}

/* ---------- store listing limits (name <= 45, description <= 132) ---------- */
const NAME_LIMIT = 45;
const DESCRIPTION_LIMIT = 132;
for (const locale of ['zh_CN', 'en']) {
  const file = join(DIST, '_locales', locale, 'messages.json');
  if (!existsSync(file)) continue;
  const messages = JSON.parse(readFileSync(file, 'utf8'));
  const checks = [
    ['extName', NAME_LIMIT],
    ['extDescription', DESCRIPTION_LIMIT],
  ];
  for (const [key, limit] of checks) {
    const value = messages[key]?.message;
    if (typeof value !== 'string') {
      fail(`${locale}: ${key} is missing`);
      continue;
    }
    const length = [...value].length;
    if (length > limit) fail(`${locale}: ${key} is ${length} characters, over the ${limit} limit`);
  }
}

/* ---------- permissions & MV3 hygiene ---------- */
const allowed = new Set(['storage', 'activeTab']);
for (const permission of manifest.permissions ?? []) {
  if (!allowed.has(permission)) fail(`unexpected permission requested: ${permission}`);
}
for (const key of ['host_permissions', 'optional_host_permissions', 'content_scripts', 'web_accessible_resources']) {
  if (manifest[key] !== undefined) fail(`manifest must not declare ${key}`);
}
if (manifest.background !== undefined) {
  fail('manifest declares a background service worker, but v1.0 has no background work');
}

/* ---------- size (icons excluded) ---------- */
const contentBytes = files
  .filter((f) => !relative(DIST, f).startsWith('icons/'))
  .reduce((sum, f) => sum + statSync(f).size, 0);
if (contentBytes > SIZE_LIMIT) {
  fail(`bundle is ${(contentBytes / 1024).toFixed(1)} KB, over the ${SIZE_LIMIT / 1024} KB limit`);
}

/* ---------- no dynamic code, no inline scripts ---------- */
for (const file of relativeFiles) {
  if (!/\.(js|html)$/.test(file)) continue;
  const source = readFileSync(join(DIST, file), 'utf8');
  if (/\beval\s*\(/.test(source)) fail(`${file} contains eval()`);
  if (/new\s+Function\s*\(/.test(source)) fail(`${file} contains new Function()`);
  if (file.endsWith('.html') && /<script(?![^>]*\bsrc=)[^>]*>/.test(source)) {
    fail(`${file} contains an inline script`);
  }
}

/* ---------- report ---------- */
const iconBytes = files
  .filter((f) => relative(DIST, f).startsWith('icons/'))
  .reduce((sum, f) => sum + statSync(f).size, 0);

if (failures.length > 0) {
  console.error('check-dist FAILED:');
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}

console.log('check-dist OK');
console.log(`  files            : ${relativeFiles.length}`);
console.log(`  size (no icons)  : ${(contentBytes / 1024).toFixed(1)} KB / 100 KB`);
console.log(`  icons            : ${(iconBytes / 1024).toFixed(1)} KB`);
console.log(`  permissions      : ${(manifest.permissions ?? []).join(', ')}`);
console.log(`  locales          : ${relativeFiles.filter((f) => f.startsWith('_locales/')).length}`);
