/**
 * Preferences: the only thing AVTC ever persists. Repository addresses are never stored.
 *
 * Rules (see doc §3.4 / appendix B):
 *  - reads are normalised: unknown ids dropped, duplicates collapsed, missing ids
 *    appended in default order, anything unusable falls back to defaults
 *  - a failed read returns defaults and does NOT write back (so bad luck on one read
 *    can never overwrite a user's good configuration)
 *  - writes happen only when the user changes something on the options page
 */
import {
  ACTIONS,
  GROUP_ORDER,
  actionById,
  type Action,
  type ActionGroup,
} from './core/actions';

export interface Prefs {
  readonly v: 1;
  readonly hidden: readonly string[];
  /** Flat id list; grouping is applied at render time. */
  readonly order: readonly string[];
}

export const STORAGE_KEYS = ['v', 'hidden', 'order'] as const;

export function defaultOrder(): string[] {
  return ACTIONS.map((a) => a.id);
}

export function defaultPrefs(): Prefs {
  return { v: 1, hidden: [], order: defaultOrder() };
}

function pickKnownIds(value: unknown, known: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && known.has(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

export function normalize(raw: unknown): Prefs {
  const known = new Set<string>(ACTIONS.map((a) => a.id));
  const source: Record<string, unknown> =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  const order = pickKnownIds(source['order'], known);
  const missing = defaultOrder().filter((id) => !order.includes(id));

  return { v: 1, hidden: pickKnownIds(source['hidden'], known), order: [...order, ...missing] };
}

export function orderedActions(prefs: Prefs): Action[] {
  const out: Action[] = [];
  for (const id of prefs.order) {
    const action = actionById(id);
    if (action !== undefined && !prefs.hidden.includes(id)) out.push(action);
  }
  return out;
}

export interface ActionGroupView {
  readonly group: ActionGroup;
  readonly actions: Action[];
}

/** Visible actions bucketed by category, empty categories omitted. */
export function groupedActions(prefs: Prefs): ActionGroupView[] {
  const visible = orderedActions(prefs);
  return GROUP_ORDER.map((group) => ({
    group,
    actions: visible.filter((a) => a.group === group),
  })).filter((view) => view.actions.length > 0);
}

export function toggleHidden(prefs: Prefs, id: string): Prefs {
  const hidden = prefs.hidden.includes(id)
    ? prefs.hidden.filter((h) => h !== id)
    : [...prefs.hidden, id];
  return { ...prefs, hidden };
}

/**
 * Move an action one slot up (-1) or down (+1) **within its own group**.
 * Swapping flat positions keeps other groups untouched and preserves grouping.
 */
export function moveWithinGroup(prefs: Prefs, id: string, direction: -1 | 1): Prefs {
  const action = actionById(id);
  if (action === undefined) return prefs;

  const groupIds = prefs.order.filter((candidate) => actionById(candidate)?.group === action.group);
  const index = groupIds.indexOf(id);
  if (index < 0) return prefs;

  const neighbour = groupIds[index + direction];
  if (neighbour === undefined) return prefs;

  const order = [...prefs.order];
  const a = order.indexOf(id);
  const b = order.indexOf(neighbour);
  if (a < 0 || b < 0) return prefs;

  order[a] = neighbour;
  order[b] = id;
  return { ...prefs, order };
}

export function resetPrefs(): Prefs {
  return defaultPrefs();
}

function storageAvailable(): boolean {
  return typeof chrome !== 'undefined' && chrome.storage?.sync !== undefined;
}

export async function loadPrefs(): Promise<Prefs> {
  if (!storageAvailable()) return defaultPrefs();

  try {
    const items = await new Promise<Record<string, unknown>>((resolve, reject) => {
      chrome.storage.sync.get([...STORAGE_KEYS], (result) => {
        const error = chrome.runtime?.lastError;
        if (error) reject(new Error(error.message));
        else resolve(result);
      });
    });
    return normalize(items);
  } catch {
    return defaultPrefs(); // silent fallback, no write-back
  }
}

export async function savePrefs(prefs: Prefs): Promise<boolean> {
  if (!storageAvailable()) return false;

  try {
    await new Promise<void>((resolve, reject) => {
      chrome.storage.sync.set({ v: 1, hidden: [...prefs.hidden], order: [...prefs.order] }, () => {
        const error = chrome.runtime?.lastError;
        if (error) reject(new Error(error.message));
        else resolve();
      });
    });
    return true;
  } catch {
    return false;
  }
}
