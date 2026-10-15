/**
 * Covers the requirement added in doc v1.1: a click either opens a tab, or it does
 * not open a tab and reports why — never a third state, never a retry.
 */
import { describe, expect, it, vi } from 'vitest';
import { ACTIONS, actionById, type Action } from '../src/core/actions';
import { openTarget, type OpenResult } from '../src/core/openTarget';

const repo = { owner: 'browser-act', repo: 'skills' };
const gitdiagram = actionById('gitdiagram') as Action;

function createSpy(): { createTab: ReturnType<typeof vi.fn>; calls: [string, boolean][] } {
  const calls: [string, boolean][] = [];
  const createTab = vi.fn((url: string, active: boolean) => {
    calls.push([url, active]);
    return Promise.resolve();
  });
  return { createTab, calls };
}

describe('openTarget — success paths', () => {
  it('opens in the foreground for a plain click', async () => {
    const { createTab, calls } = createSpy();
    const result = await openTarget(gitdiagram, repo, { background: false }, { createTab });

    expect(result).toEqual<OpenResult>({
      ok: true,
      url: 'https://gitdiagram.com/browser-act/skills',
      active: true,
      tool: 'GitDiagram',
    });
    expect(calls).toEqual([['https://gitdiagram.com/browser-act/skills', true]]);
  });

  it('opens in the background for Ctrl/Cmd + click', async () => {
    const { createTab, calls } = createSpy();
    const result = await openTarget(gitdiagram, repo, { background: true }, { createTab });

    expect(result.ok).toBe(true);
    expect(result.ok && result.active).toBe(false);
    expect(calls).toEqual([['https://gitdiagram.com/browser-act/skills', false]]);
  });

  it('reaches the right URL for all 8 shipped actions', async () => {
    for (const action of ACTIONS) {
      const { createTab, calls } = createSpy();
      const result = await openTarget(action, repo, { background: false }, { createTab });
      expect(result.ok, action.id).toBe(true);
      expect(calls, action.id).toHaveLength(1);
      expect(calls[0]?.[0]).toContain(action.tool === 'StackBlitz' ? '/github/' : '/');
    }
  });
});

describe('openTarget — failure paths (doc §5.3)', () => {
  it('does not call createTab and reports invalid-target when the URL is rejected', async () => {
    const broken: Action = { ...gitdiagram, template: 'http://gitdiagram.com/{owner}/{repo}' };
    const { createTab } = createSpy();

    const result = await openTarget(broken, repo, { background: false }, { createTab });

    expect(result).toEqual<OpenResult>({
      ok: false,
      failure: 'invalid-target',
      tool: 'GitDiagram',
    });
    expect(createTab).not.toHaveBeenCalled();
  });

  it('reports invalid-target for a template with no placeholders', async () => {
    const broken: Action = { ...gitdiagram, template: 'https://gitdiagram.com/' };
    const { createTab } = createSpy();

    const result = await openTarget(broken, repo, { background: false }, { createTab });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failure).toBe('invalid-target');
    expect(createTab).not.toHaveBeenCalled();
  });

  it('reports open-failed when the browser refuses the tab, without throwing', async () => {
    const createTab = vi.fn(() => Promise.reject(new Error('Invalid URL')));

    const result = await openTarget(gitdiagram, repo, { background: false }, { createTab });

    expect(result).toEqual<OpenResult>({ ok: false, failure: 'open-failed', tool: 'GitDiagram' });
    expect(createTab).toHaveBeenCalledTimes(1);
  });

  it('reports open-failed when createTab throws synchronously', async () => {
    const createTab = vi.fn(() => {
      throw new Error('boom');
    });

    const result = await openTarget(gitdiagram, repo, { background: false }, { createTab });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failure).toBe('open-failed');
  });

  it('never retries', async () => {
    const createTab = vi.fn(() => Promise.reject(new Error('nope')));
    await openTarget(gitdiagram, repo, { background: false }, { createTab });
    expect(createTab).toHaveBeenCalledTimes(1);
  });
});
