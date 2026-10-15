/**
 * Template + repo -> safe target URL, or null.
 *
 * Every failure here means "do not open a tab"; the caller turns null into a
 * one-line hint in the popup footer.
 */
import type { RepoRef } from './parseRepo';

/** Exact-match host allowlist. Never use endsWith(): it would accept evil-gitdiagram.com. */
export const ALLOWED_HOSTS: readonly string[] = [
  'gitdiagram.com',
  'deepwiki.com',
  'zread.ai',
  'www.gitreverse.com',
  'gitingest.com',
  'github1s.com',
  'github.dev',
  'stackblitz.com',
];

const ALLOWED_HOST_SET: ReadonlySet<string> = new Set(ALLOWED_HOSTS);

const INVALID_NAME_CHAR = /[^A-Za-z0-9._-]/;

/** C0 controls and DEL must never reach a navigation URL. */
function hasControlChar(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

const MAX_OWNER_LENGTH = 39;
const MAX_REPO_LENGTH = 100;

function isSafeName(value: string): boolean {
  if (value === '' || value === '.' || value === '..') return false;
  return !INVALID_NAME_CHAR.test(value);
}

/**
 * @param template e.g. `https://gitdiagram.com/{owner}/{repo}`
 * @param repo     already validated owner/repo, original case preserved
 */
export function buildUrl(template: string, repo: RepoRef): string | null {
  const { owner, repo: name } = repo;

  if (typeof template !== 'string' || !template.includes('{owner}') || !template.includes('{repo}')) {
    return null;
  }
  if (!isSafeName(owner) || !isSafeName(name)) return null;
  if (owner.length > MAX_OWNER_LENGTH || name.length > MAX_REPO_LENGTH) return null;

  const filled = template
    .replace('{owner}', encodeURIComponent(owner))
    .replace('{repo}', encodeURIComponent(name));

  if (hasControlChar(filled)) return null;

  let url: URL;
  try {
    url = new URL(filled);
  } catch {
    return null;
  }

  // Output is always https (a bare `http:` template is rejected, not upgraded).
  if (url.protocol !== 'https:') return null;
  if (!ALLOWED_HOST_SET.has(url.hostname)) return null;
  if (url.username !== '' || url.password !== '') return null;
  if (url.port !== '') return null;

  return url.toString();
}
