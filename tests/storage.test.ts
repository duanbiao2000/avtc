import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIONS } from '../src/core/actions';
import {
  defaultOrder,
  defaultPrefs,
  groupedActions,
  loadPrefs,
  moveWithinGroup,
  normalize,
  orderedActions,
  resetPrefs,
  savePrefs,
  toggleHidden,
  type Prefs,
} from '../src/storage';

describe('normalize — damaged configuration falls back to defaults', () => {
  it('returns defaults for unusable input', () => {
    for (const raw of [null, undefined, 'nonsense', 42, [], { hidden: 'x', order: 7 }]) {
      expect(normalize(raw)).toEqual(defaultPrefs());
    }
  });

  it('accepts a well-formed configuration', () => {
    const prefs = normalize({ v: 1, hidden: ['zread'], order: [...defaultOrder()] });
    expect(prefs).toEqual({ v: 1, hidden: ['zread'], order: defaultOrder() });
  });

  it('drops unknown ids', () => {
    expect(normalize({ hidden: ['zread', 'not-an-action'], order: [] }).hidden).toEqual(['zread']);
  });

  it('collapses duplicates', () => {
    expect(normalize({ hidden: ['zread', 'zread'] }).hidden).toEqual(['zread']);
  });

  it('appends ids missing from order, in default order', () => {
    const prefs = normalize({ order: ['stackblitz', 'gitdiagram'] });
    expect(prefs.order.slice(0, 2)).toEqual(['stackblitz', 'gitdiagram']);
    expect(prefs.order).toHaveLength(8);
    expect(new Set(prefs.order).size).toBe(8);
    expect(prefs.order.slice(2)).toEqual(
      defaultOrder().filter((id) => id !== 'stackblitz' && id !== 'gitdiagram'),
    );
  });

  it('tolerates non-string entries inside the arrays', () => {
    expect(normalize({ hidden: ['zread', 7, null, {}] }).hidden).toEqual(['zread']);
  });

  it('tolerates all 8 actions being hidden', () => {
    expect(normalize({ hidden: defaultOrder() }).hidden).toHaveLength(8);
  });
});

describe('selection helpers', () => {
  it('default prefs show all 8 actions in 4 groups', () => {
    const views = groupedActions(defaultPrefs());
    expect(views.map((v) => v.actions.length)).toEqual([3, 2, 2, 1]);
  });

  it('hides an action and omits an empty group', () => {
    let prefs: Prefs = defaultPrefs();
    prefs = toggleHidden(prefs, 'stackblitz');
    expect(groupedActions(prefs).map((v) => v.group)).toEqual(['understand', 'ai', 'code']);
  });

  it('reports no groups when every action is hidden', () => {
    const prefs: Prefs = { v: 1, hidden: ACTIONS.map((a) => a.id), order: defaultOrder() };
    expect(groupedActions(prefs)).toEqual([]);
  });

  it('toggles back to visible', () => {
    const once = toggleHidden(defaultPrefs(), 'zread');
    expect(toggleHidden(once, 'zread').hidden).toEqual([]);
  });

  it('orders visible actions by preference', () => {
    const prefs: Prefs = { v: 1, hidden: [], order: ['zread', 'gitdiagram', 'deepwiki', 'gitreverse', 'gitingest', 'github1s', 'githubdev', 'stackblitz'] };
    expect(orderedActions(prefs).map((a) => a.id).slice(0, 3)).toEqual(['zread', 'gitdiagram', 'deepwiki']);
  });
});

describe('moveWithinGroup', () => {
  it('swaps with the neighbour inside the same group', () => {
    const prefs = moveWithinGroup(defaultPrefs(), 'gitdiagram', 1);
    expect(prefs.order.slice(0, 3)).toEqual(['deepwiki', 'gitdiagram', 'zread']);
  });

  it('moves up', () => {
    const prefs = moveWithinGroup(defaultPrefs(), 'zread', -1);
    expect(prefs.order.slice(0, 3)).toEqual(['gitdiagram', 'zread', 'deepwiki']);
  });

  it('does nothing at the group edge', () => {
    expect(moveWithinGroup(defaultPrefs(), 'gitdiagram', -1).order).toEqual(defaultOrder());
    expect(moveWithinGroup(defaultPrefs(), 'zread', 1).order).toEqual(defaultOrder());
  });

  it('never crosses a group boundary', () => {
    // 'zread' is last in `understand`; pushing it further down must be a no-op,
    // otherwise it would land inside the `ai` group.
    const prefs = moveWithinGroup(defaultPrefs(), 'zread', 1);
    expect(prefs.order).toEqual(defaultOrder());
    expect(prefs).toEqual(defaultPrefs());
  });

  it('keeps the flat length and members intact', () => {
    let prefs = defaultPrefs();
    prefs = moveWithinGroup(prefs, 'github1s', 1);
    prefs = moveWithinGroup(prefs, 'stackblitz', -1);
    expect(prefs.order).toHaveLength(8);
    expect(new Set(prefs.order)).toEqual(new Set(defaultOrder()));
  });

  it('ignores an unknown id', () => {
    expect(moveWithinGroup(defaultPrefs(), 'nope', 1)).toEqual(defaultPrefs());
  });

  it('ignores an id missing from order', () => {
    const prefs: Prefs = { v: 1, hidden: [], order: ['gitdiagram', 'deepwiki'] };
    expect(moveWithinGroup(prefs, 'zread', -1).order).toEqual(['gitdiagram', 'deepwiki']);
  });
});

describe('resetPrefs', () => {
  it('clears hidden and restores the default order', () => {
    const hidden = toggleHidden(defaultPrefs(), 'zread');
    const moved = moveWithinGroup(defaultPrefs(), 'deepwiki', 1);
    expect(hidden.hidden).toEqual(['zread']);
    expect(moved.order).not.toEqual(defaultOrder());

    expect(resetPrefs()).toEqual({ v: 1, hidden: [], order: defaultOrder() });
  });
});

/* ---------- chrome.storage integration (mocked) ---------- */

interface FakeChrome {
  runtime: { lastError?: { message: string } };
  storage: { sync: { get: unknown; set: unknown } };
}

function installChrome(overrides: Record<string, unknown> = {}, failGet = false, failSet = false): void {
  const chromeStub: FakeChrome = {
    runtime: {},
    storage: {
      sync: {
        get: (_keys: string[], cb: (items: Record<string, unknown>) => void) => {
          if (failGet) {
            chromeStub.runtime.lastError = { message: 'QUOTA_BYTES exceeded' };
            cb({});
            return;
          }
          cb({ v: 1, hidden: ['zread'], order: overrides['order'] ?? defaultOrder() });
          delete chromeStub.runtime.lastError;
        },
        set: (_items: unknown, cb: () => void) => {
          if (failSet) chromeStub.runtime.lastError = { message: 'QUOTA_BYTES exceeded' };
          cb();
          delete chromeStub.runtime.lastError;
        },
      },
    },
  };
  vi.stubGlobal('chrome', chromeStub);
}

describe('loadPrefs / savePrefs', () => {
  beforeEach(() => {
    installChrome();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads and normalises what storage returns', async () => {
    const prefs = await loadPrefs();
    expect(prefs.hidden).toEqual(['zread']);
    expect(prefs.order).toHaveLength(8);
  });

  it('falls back to defaults when the read fails, and does not write back', async () => {
    vi.unstubAllGlobals();
    const setSpy = vi.fn();
    installChrome({}, true);
    (chrome.storage.sync as unknown as { set: unknown }).set = setSpy;

    await expect(loadPrefs()).resolves.toEqual(defaultPrefs());
    expect(setSpy).not.toHaveBeenCalled();
  });

  it('returns defaults when chrome.storage is unavailable', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('chrome', { runtime: {} });
    await expect(loadPrefs()).resolves.toEqual(defaultPrefs());
    await expect(savePrefs(defaultPrefs())).resolves.toBe(false);
  });

  it('reports success and failure of a write', async () => {
    await expect(savePrefs(defaultPrefs())).resolves.toBe(true);

    vi.unstubAllGlobals();
    installChrome({}, false, true);
    await expect(savePrefs(defaultPrefs())).resolves.toBe(false);
  });
});
