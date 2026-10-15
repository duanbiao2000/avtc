/**
 * GitHub URL -> { owner, repo } | null.
 *
 * Pure, synchronous, network-free. Tolerant on input (http, trailing slash,
 * query, hash, .git suffix, sub-paths), strict on which pages count as a repo.
 */

export interface RepoRef {
  readonly owner: string;
  readonly repo: string;
}

/**
 * Paths that are GitHub the product rather than a user. Compared case-insensitively
 * and applied to the FIRST path segment only, so a repository may still be named
 * `settings` (`github.com/torvalds/settings` resolves fine).
 *
 * Deliberately conservative: an extra entry blocks a real repository (harmful),
 * a missing entry lets a non-repo page through and the user hits a 404 (harmless).
 */
export const RESERVED_FIRST_SEGMENT: ReadonlySet<string> = new Set([
  'settings',
  'orgs',
  'organizations',
  'apps',
  'marketplace',
  'topics',
  'collections',
  'trending',
  'explore',
  'sponsors',
  'notifications',
  'login',
  'logout',
  'signup',
  'join',
  'sessions',
  'account',
  'dashboard',
  'search',
  'pulls',
  'issues',
  'stars',
  'watching',
  'new',
  'features',
  'pricing',
  'about',
  'blog',
  'contact',
  'customer-stories',
  'enterprise',
  'events',
  'team',
  'security',
  'readme',
]);

/** Letters, digits, `-`, `_`, `.`; first and last character must be alphanumeric. */
export const NAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

export const MAX_OWNER_LENGTH = 39;
export const MAX_REPO_LENGTH = 100;

export function parseRepo(rawUrl: string | undefined | null): RepoRef | null {
  if (typeof rawUrl !== 'string' || rawUrl === '') return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  // Tolerant on input, strict on output: http pages are accepted, targets are always https.
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  // No subdomains, no gist.github.com, no www.github.com.
  if (url.hostname !== 'github.com') return null;

  const segments = url.pathname.split('/').filter((s) => s !== '');
  const [ownerSegment, repoSegment] = segments;
  if (ownerSegment === undefined || repoSegment === undefined) return null;

  let owner: string;
  let repo: string;
  try {
    owner = decodeURIComponent(ownerSegment);
    repo = decodeURIComponent(repoSegment);
  } catch {
    return null; // malformed percent-encoding
  }

  if (RESERVED_FIRST_SEGMENT.has(owner.toLowerCase())) return null;
  if (owner.length > MAX_OWNER_LENGTH || repo.length > MAX_REPO_LENGTH) return null;
  // NAME_PATTERN rejects `.` and `..` (leading dot), so path traversal is impossible.
  if (!NAME_PATTERN.test(owner) || !NAME_PATTERN.test(repo)) return null;

  const cleaned = repo.replace(/\.git$/i, '');
  if (cleaned === '' || !NAME_PATTERN.test(cleaned)) return null;

  // Original case is preserved for link generation.
  return { owner, repo: cleaned };
}
