import { describe, expect, it } from 'vitest';
import { MAX_REPO_LENGTH, parseRepo } from '../src/core/parseRepo';

describe('parseRepo — cases from the spec (doc §5.1)', () => {
  it('resolves a plain repository URL', () => {
    expect(parseRepo('https://github.com/browser-act/skills')).toEqual({
      owner: 'browser-act',
      repo: 'skills',
    });
  });

  it('resolves a sub-path URL', () => {
    expect(parseRepo('https://github.com/browser-act/skills/tree/main/docs')).toEqual({
      owner: 'browser-act',
      repo: 'skills',
    });
  });

  it('strips a .git suffix', () => {
    expect(parseRepo('https://github.com/browser-act/skills.git')).toEqual({
      owner: 'browser-act',
      repo: 'skills',
    });
  });

  it.each([
    ['https://github.com/settings/profile', 'reserved page'],
    ['https://github.com/orgs/foo/people', 'organisations page'],
    ['https://gist.github.com/foo/abc', 'gist subdomain'],
    ['https://example.com/foo/bar', 'other host'],
  ])('returns null for %s (%s)', (url) => {
    expect(parseRepo(url)).toBeNull();
  });
});

describe('parseRepo — reserved first segment', () => {
  it('still accepts a repository that is named like a reserved word', () => {
    expect(parseRepo('https://github.com/torvalds/settings')).toEqual({
      owner: 'torvalds',
      repo: 'settings',
    });
  });

  it('is case-insensitive', () => {
    expect(parseRepo('https://github.com/Settings/profile')).toBeNull();
    expect(parseRepo('https://github.com/SETTINGS/profile')).toBeNull();
  });

  it.each([
    'marketplace',
    'topics',
    'notifications',
    'login',
    'explore',
    'sponsors',
    'collections',
    'trending',
  ])('rejects /%s/foo', (segment) => {
    expect(parseRepo(`https://github.com/${segment}/foo`)).toBeNull();
  });

  it('rejects a reserved segment with a single trailing slash', () => {
    expect(parseRepo('https://github.com/settings/')).toBeNull();
  });
});

describe('parseRepo — URL shape tolerance', () => {
  it.each([
    'https://github.com/owner/repo/',
    'https://github.com/owner/repo?tab=readme',
    'https://github.com/owner/repo#top',
    'https://github.com/owner/repo/tree/main?x=1#y',
    'http://github.com/owner/repo',
    'https://github.com/owner/repo/issues/123',
    'https://github.com/owner/repo/pull/9/files',
  ])('accepts %s', (url) => {
    expect(parseRepo(url)).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('strips an upper-case .GIT suffix', () => {
    expect(parseRepo('https://github.com/owner/repo.GIT')).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('preserves the original case of owner and repo', () => {
    expect(parseRepo('https://github.com/WebKit/WebKit')).toEqual({
      owner: 'WebKit',
      repo: 'WebKit',
    });
  });

  it('keeps dots, dashes and underscores', () => {
    expect(parseRepo('https://github.com/some-org/my_repo.js')).toEqual({
      owner: 'some-org',
      repo: 'my_repo.js',
    });
  });
});

describe('parseRepo — rejections', () => {
  it.each([
    ['https://www.github.com/owner/repo', 'www subdomain is out of scope'],
    ['https://github.com.evil.com/owner/repo', 'suffix-spoofed host'],
    ['ftp://github.com/owner/repo', 'non-http protocol'],
    ['javascript:alert(1)', 'not a URL we accept'],
    ['https://github.com/owner/.', 'dot segment'],
    ['https://github.com/owner/..', 'parent segment'],
    ['https://github.com/owner/repo.', 'trailing dot in repo'],
    ['https://github.com/owner', 'owner only'],
    ['https://github.com/owner/', 'owner with trailing slash'],
    ['https://github.com/', 'host only'],
    ['https://github.com', 'bare host'],
    ['https://github.com/owner/repo-', 'repo name ending in a dash'],
    ['https://github.com/-owner/repo', 'leading dash'],
    ['https://github.com/owner/-repo', 'leading dash in repo'],
    ['https://github.com/owner/.hidden', 'leading dot in repo'],
    ['', 'empty string'],
    ['not a url', 'garbage'],
    ['   ', 'whitespace'],
  ])('returns null for %s (%s)', (url) => {
    expect(parseRepo(url)).toBeNull();
  });

  it('returns null for null and undefined input', () => {
    expect(parseRepo(null)).toBeNull();
    expect(parseRepo(undefined)).toBeNull();
  });

  it('rejects over-long owner and repo names', () => {
    const owner = 'a'.repeat(40);
    const repo = 'b'.repeat(MAX_REPO_LENGTH + 1);
    expect(parseRepo(`https://github.com/${owner}/repo`)).toBeNull();
    expect(parseRepo(`https://github.com/owner/${repo}`)).toBeNull();
  });

  it('rejects malformed percent-encoding', () => {
    expect(parseRepo('https://github.com/%E0%A4%A/repo')).toBeNull();
  });
});

describe('parseRepo — URL normalisation and encoded segments', () => {
  it('lets the URL parser collapse a leading traversal, then judges the result', () => {
    // `new URL()` normalises `..` away before parsing: this really is /owner/repo.
    expect(parseRepo('https://github.com/../owner/repo')).toEqual({ owner: 'owner', repo: 'repo' });
    // but a traversal that eats the repo segment leaves nothing to parse
    expect(parseRepo('https://github.com/owner/../')).toBeNull();
  });

  it('ignores an encoded slash in a sub-path, because sub-paths are not parsed', () => {
    expect(parseRepo('https://github.com/owner/repo/a%2Fb')).toEqual({ owner: 'owner', repo: 'repo' });
  });

  it('rejects an encoded slash inside the owner or repo segment', () => {
    // decoded to `owner/repo`, which the name pattern refuses
    expect(parseRepo('https://github.com/owner%2Frepo/name')).toBeNull();
    expect(parseRepo('https://github.com/owner/re%2Fpo')).toBeNull();
  });
});
