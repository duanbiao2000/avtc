import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  GROUP_LABEL_KEY,
  GROUP_ORDER,
  actionById,
  actionIds,
} from '../src/core/actions';

describe('action catalogue', () => {
  it('ships exactly 8 actions in the documented order', () => {
    expect(ACTIONS).toHaveLength(8);
    expect(actionIds()).toEqual([
      'gitdiagram',
      'deepwiki',
      'zread',
      'gitreverse',
      'gitingest',
      'github1s',
      'githubdev',
      'stackblitz',
    ]);
  });

  it('keeps every id unique', () => {
    expect(new Set(actionIds()).size).toBe(8);
  });

  it('covers all four groups and keeps each group contiguous', () => {
    const groups = ACTIONS.map((a) => a.group);
    expect(new Set(groups)).toEqual(new Set(GROUP_ORDER));
    const seen = new Set<string>();
    let previous: string | null = null;
    for (const group of groups) {
      if (group !== previous) {
        expect(seen.has(group)).toBe(false); // no group appears twice
        seen.add(group);
        previous = group;
      }
    }
  });

  it('gives every group a label key', () => {
    for (const group of GROUP_ORDER) expect(GROUP_LABEL_KEY[group]).toMatch(/^group/);
  });

  it('has a label key and a tool name for each action', () => {
    for (const action of ACTIONS) {
      expect(action.labelKey).toMatch(/^action/);
      expect(action.tool.length).toBeGreaterThan(1);
    }
  });

  it('uses the documented templates and private-repo support', () => {
    const template = Object.fromEntries(ACTIONS.map((a) => [a.id, a.template]));
    expect(template['gitdiagram']).toBe('https://gitdiagram.com/{owner}/{repo}');
    expect(template['githubdev']).toBe('https://github.dev/{owner}/{repo}');
    expect(template['stackblitz']).toBe('https://stackblitz.com/github/{owner}/{repo}');

    expect(actionById('zread')?.privateRepo).toBe('no');
    expect(actionById('githubdev')?.privateRepo).toBe('session');
    expect(actionById('gitingest')?.privateRepo).toBe('token');
  });

  it('resolves ids and returns undefined for unknown ones', () => {
    expect(actionById('gitdiagram')?.tool).toBe('GitDiagram');
    expect(actionById('nope')).toBeUndefined();
  });
});
