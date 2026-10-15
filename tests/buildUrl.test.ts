import { describe, expect, it } from 'vitest';
import { ACTIONS } from '../src/core/actions';
import { ALLOWED_HOSTS, buildUrl } from '../src/core/buildUrl';

const repo = { owner: 'browser-act', repo: 'skills' };

describe('buildUrl — the 8 shipped templates', () => {
  it('produces exactly the documented target for each action', () => {
    const expected: Record<string, string> = {
      gitdiagram: 'https://gitdiagram.com/browser-act/skills',
      deepwiki: 'https://deepwiki.com/browser-act/skills',
      zread: 'https://zread.ai/browser-act/skills',
      gitreverse: 'https://www.gitreverse.com/browser-act/skills',
      gitingest: 'https://gitingest.com/browser-act/skills',
      github1s: 'https://github1s.com/browser-act/skills',
      githubdev: 'https://github.dev/browser-act/skills',
      stackblitz: 'https://stackblitz.com/github/browser-act/skills',
    };

    for (const action of ACTIONS) {
      expect(buildUrl(action.template, repo), action.id).toBe(expected[action.id]);
    }
  });

  it('every shipped template targets an allow-listed host', () => {
    for (const action of ACTIONS) {
      const url = buildUrl(action.template, repo);
      expect(url, action.id).not.toBeNull();
      expect(ALLOWED_HOSTS, action.id).toContain(new URL(url as string).hostname);
    }
  });

  it('encodes names that need it', () => {
    // Names outside the allowed charset never reach the encoder — see the rejection suite.
    expect(
      buildUrl('https://github1s.com/{owner}/{repo}', { owner: 'some-org', repo: 'my_repo.js' }),
    ).toBe('https://github1s.com/some-org/my_repo.js');
  });

  it('refuses names that would need escaping', () => {
    expect(buildUrl('https://github1s.com/{owner}/{repo}', { owner: 'a b', repo: 'c&d' })).toBeNull();
    expect(buildUrl('https://github1s.com/{owner}/{repo}', { owner: 'a', repo: 'c%2Fd' })).toBeNull();
    expect(buildUrl('https://github1s.com/{owner}/{repo}', { owner: 'a', repo: 'c?d' })).toBeNull();
  });
});

describe('buildUrl — rejections', () => {
  it('rejects a template without placeholders', () => {
    expect(buildUrl('https://gitdiagram.com/', repo)).toBeNull();
    expect(buildUrl('https://gitdiagram.com/{owner}', repo)).toBeNull();
  });

  it('rejects a non-https template instead of upgrading it', () => {
    expect(buildUrl('http://gitdiagram.com/{owner}/{repo}', repo)).toBeNull();
  });

  it('rejects hosts outside the allowlist', () => {
    expect(buildUrl('https://evil.com/{owner}/{repo}', repo)).toBeNull();
  });

  it('rejects suffix-spoofed hosts (exact match, never endsWith)', () => {
    expect(buildUrl('https://gitdiagram.com.evil.com/{owner}/{repo}', repo)).toBeNull();
    expect(buildUrl('https://evil-gitdiagram.com/{owner}/{repo}', repo)).toBeNull();
    expect(buildUrl('https://notgithub.dev/{owner}/{repo}', repo)).toBeNull();
  });

  it('rejects credentials and ports', () => {
    expect(buildUrl('https://user:pass@gitdiagram.com/{owner}/{repo}', repo)).toBeNull();
    expect(buildUrl('https://gitdiagram.com:8443/{owner}/{repo}', repo)).toBeNull();
  });

  it('rejects unsafe names', () => {
    expect(buildUrl('https://gitdiagram.com/{owner}/{repo}', { owner: '.', repo: 'a' })).toBeNull();
    expect(buildUrl('https://gitdiagram.com/{owner}/{repo}', { owner: '..', repo: 'a' })).toBeNull();
    expect(buildUrl('https://gitdiagram.com/{owner}/{repo}', { owner: 'a/b', repo: 'b' })).toBeNull();
    expect(buildUrl('https://gitdiagram.com/{owner}/{repo}', { owner: 'a b', repo: 'b' })).toBeNull();
    expect(buildUrl('https://gitdiagram.com/{owner}/{repo}', { owner: 'a', repo: '' })).toBeNull();
    expect(buildUrl('https://gitdiagram.com/{owner}/{repo}', { owner: '<x>', repo: 'b' })).toBeNull();
  });

  it('rejects over-long names', () => {
    expect(
      buildUrl('https://gitdiagram.com/{owner}/{repo}', { owner: 'a'.repeat(40), repo: 'b' }),
    ).toBeNull();
  });

  it('rejects a malformed template', () => {
    expect(buildUrl('not a url {owner} {repo}', repo)).toBeNull();
    expect(buildUrl('', repo)).toBeNull();
  });

  it('rejects a template carrying control characters', () => {
    expect(buildUrl('https://gitdiagram.com/{owner}/{repo}\u0000', repo)).toBeNull();
    expect(buildUrl('https://gitdiagram.com/{owner}/{repo}\t', repo)).toBeNull();
    expect(buildUrl('https://gitdiagram.com/{owner}/{repo}\u007f', repo)).toBeNull();
  });

  it('never returns a non-https or off-allowlist URL for any shipped action', () => {
    for (const action of ACTIONS) {
      const url = buildUrl(action.template, { owner: 'a'.repeat(39), repo: 'b'.repeat(100) });
      expect(url, action.id).not.toBeNull();
      const parsed = new URL(url as string);
      expect(parsed.protocol, action.id).toBe('https:');
      expect(ALLOWED_HOSTS, action.id).toContain(parsed.hostname);
    }
  });
});
