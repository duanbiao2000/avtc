/**
 * Popup controller: read the active tab, parse the repo, render the action rows,
 * and jump on click / Enter / digit key. A click either opens a tab or shows a
 * one-line hint in the footer — never anything in between.
 */
import { GROUP_LABEL_KEY, type Action } from '../core/actions';
import { buildUrl } from '../core/buildUrl';
import { openTarget, type OpenFailure } from '../core/openTarget';
import { parseRepo, type RepoRef } from '../core/parseRepo';
import { applyI18n, msg, setText } from '../i18n';
import { groupedActions, loadPrefs, type ActionGroupView } from '../storage';

function byId<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

const els = {
  project: byId<HTMLElement>('current-project'),
  actions: byId<HTMLElement>('actions'),
  options: byId<HTMLButtonElement>('open-options'),
  footer: byId<HTMLElement>('footer'),
  footerText: byId<HTMLElement>('footer-text'),
};

const TOAST_MS = 1500;

let repoRef: RepoRef | null = null;
/** Rows the digit keys can reach, in display order (hidden actions do not count). */
let activatable: Action[] = [];
let toastTimer: number | undefined;

function openOptionsPage(): void {
  void chrome.runtime.openOptionsPage();
}

function createTab(url: string, active: boolean): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    try {
      chrome.tabs.create({ url, active }, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve();
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/* ---------- footer states (hint / alert / toast) ---------- */

function resetFooter(): void {
  if (toastTimer !== undefined) {
    window.clearTimeout(toastTimer);
    toastTimer = undefined;
  }
  els.footer?.classList.remove('footer--alert');
  els.footer?.setAttribute('role', 'status');
  els.footer?.setAttribute('aria-live', 'polite');
}

function showAlert(failure: OpenFailure, tool: string): void {
  resetFooter();
  els.footer?.classList.add('footer--alert');
  els.footer?.setAttribute('role', 'alert');
  els.footer?.setAttribute('aria-live', 'assertive');
  if (failure === 'invalid-target') setText(els.footerText, 'errInvalidTarget', [tool]);
  else setText(els.footerText, 'errOpenFailed');
}

function showToast(tool: string): void {
  resetFooter();
  setText(els.footerText, 'toastOpened', [tool]);
  toastTimer = window.setTimeout(() => {
    toastTimer = undefined;
    setText(els.footerText, 'footerOpenInNewTab');
  }, TOAST_MS);
}

/* ---------- activation ---------- */

function isBackgroundClick(event: MouseEvent): boolean {
  return event.ctrlKey || event.metaKey || event.button === 1;
}

async function activate(action: Action, background: boolean): Promise<void> {
  const repo = repoRef;
  if (repo === null) return;

  resetFooter();

  const result = await openTarget(action, repo, { background }, { createTab });

  if (!result.ok) {
    showAlert(result.failure, result.tool);
    return;
  }
  // Foreground: the popup closes by losing focus, nothing else to do.
  // Background: keep the popup open so several tools can be opened in a row.
  if (!result.active) showToast(result.tool);
}

/* ---------- rendering ---------- */

function createRow(action: Action, repo: RepoRef | null): { row: HTMLAnchorElement; enabled: boolean } {
  const row = document.createElement('a');
  row.className = 'row';
  row.dataset['actionId'] = action.id;

  const label = document.createElement('span');
  label.className = 'row__label';
  label.textContent = msg(action.labelKey);

  const tool = document.createElement('span');
  tool.className = 'row__tool';
  tool.textContent = action.tool;

  const arrow = document.createElement('span');
  arrow.className = 'row__arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';

  row.append(label, tool, arrow);

  if (repo === null) {
    // State B: not a repository page.
    row.classList.add('row--disabled');
    row.setAttribute('aria-disabled', 'true');
    row.tabIndex = -1;
    return { row, enabled: false };
  }

  const url = buildUrl(action.template, repo);
  if (url === null) {
    // State D: this action's address is unusable (defensive; templates are constants).
    row.classList.add('row--invalid');
    row.setAttribute('aria-disabled', 'true');
    row.tabIndex = -1;
    row.title = msg('errInvalidTarget', [action.tool]);
    return { row, enabled: false };
  }

  row.href = url;
  row.target = '_blank';
  row.rel = 'noopener';
  row.addEventListener('click', (event) => {
    event.preventDefault();
    void activate(action, isBackgroundClick(event));
  });
  row.addEventListener('auxclick', (event) => {
    if (event.button === 1) {
      event.preventDefault();
      void activate(action, true);
    }
  });

  return { row, enabled: true };
}

function renderAllHidden(container: HTMLElement): void {
  const empty = document.createElement('div');
  empty.className = 'empty';

  const text = document.createElement('p');
  text.className = 'empty__text';
  text.textContent = msg('stateAllHidden');

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button';
  button.textContent = msg('openOptions');
  button.addEventListener('click', openOptionsPage);

  empty.append(text, button);
  container.append(empty);
}

function renderActions(views: ActionGroupView[]): void {
  const container = els.actions;
  if (container === null) return;

  container.textContent = '';
  activatable = [];

  if (views.length === 0) {
    renderAllHidden(container); // State C
    return;
  }

  for (const view of views) {
    const heading = document.createElement('div');
    heading.className = 'group__title';

    const tick = document.createElement('span');
    tick.className = 'group__tick';
    tick.setAttribute('aria-hidden', 'true');

    const title = document.createElement('span');
    title.textContent = msg(GROUP_LABEL_KEY[view.group]);

    heading.append(tick, title);
    container.append(heading);

    for (const action of view.actions) {
      const { row, enabled } = createRow(action, repoRef);
      if (enabled) activatable.push(action);
      container.append(row);
    }
  }
}

function renderProject(): void {
  if (els.project === null) return;
  if (repoRef === null) {
    els.project.textContent = '—';
    els.project.classList.add('is-empty');
    return;
  }
  els.project.textContent = `${repoRef.owner}/${repoRef.repo}`;
  els.project.classList.remove('is-empty');
}

/* ---------- keyboard ---------- */

function wireKeyboard(): void {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      window.close();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1 || event.key < '1' || event.key > '8') return;

    const action = activatable[Number(event.key) - 1];
    if (action === undefined) return;

    event.preventDefault();
    void activate(action, false);
  });
}

/* ---------- bootstrap ---------- */

async function main(): Promise<void> {
  applyI18n();
  els.options?.addEventListener('click', openOptionsPage);

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  repoRef = parseRepo(tab?.url);

  renderProject();

  const prefs = await loadPrefs();
  renderActions(groupedActions(prefs));

  if (repoRef === null) setText(els.footerText, 'stateNoRepo');
  else setText(els.footerText, 'footerOpenInNewTab');

  wireKeyboard();
}

void main();
