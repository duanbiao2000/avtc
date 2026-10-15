/**
 * The jump decision, isolated from the DOM and from the chrome.* namespace so it
 * can be unit-tested with an injected `createTab`.
 *
 * Contract: a click either opens a tab, or it does not open a tab and reports
 * why. There is no third state, and no retry.
 */
import { buildUrl } from './buildUrl';
import type { Action } from './actions';
import type { RepoRef } from './parseRepo';

export type OpenFailure =
  /** Local validation refused the URL (template/protocol/host/encoding). Nothing was opened. */
  | 'invalid-target'
  /** The browser refused the address. Nothing was opened. */
  | 'open-failed';

export interface OpenSuccess {
  readonly ok: true;
  readonly url: string;
  /** true = foreground tab, false = background tab. */
  readonly active: boolean;
  readonly tool: string;
}

export interface OpenError {
  readonly ok: false;
  readonly failure: OpenFailure;
  readonly tool: string;
}

export type OpenResult = OpenSuccess | OpenError;

export interface OpenDeps {
  /** Browser side effect. In the popup: chrome.tabs.create({ url, active }). */
  createTab(url: string, active: boolean): Promise<void>;
}

export interface OpenOptions {
  /** Ctrl/Cmd + click (and middle click) open in a background tab. */
  readonly background: boolean;
}

export async function openTarget(
  action: Action,
  repo: RepoRef,
  options: OpenOptions,
  deps: OpenDeps,
): Promise<OpenResult> {
  const url = buildUrl(action.template, repo);
  if (url === null) {
    return { ok: false, failure: 'invalid-target', tool: action.tool };
  }

  const active = !options.background;

  try {
    await deps.createTab(url, active);
  } catch {
    return { ok: false, failure: 'open-failed', tool: action.tool };
  }

  return { ok: true, url, active, tool: action.tool };
}
