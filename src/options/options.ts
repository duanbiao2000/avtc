/**
 * Options page: hide/show actions, reorder inside a group, reset to defaults.
 * Auto-saves on every change; a damaged configuration simply renders as defaults.
 */
import { ACTIONS, GROUP_LABEL_KEY, GROUP_ORDER, type Action } from '../core/actions';
import { applyI18n, msg, setText } from '../i18n';
import {
  defaultPrefs,
  loadPrefs,
  moveWithinGroup,
  savePrefs,
  toggleHidden,
  type Prefs,
} from '../storage';

const STATUS_MS = 1500;

const groupsHost = document.getElementById('groups');
const statusEl = document.getElementById('status');
const resetButton = document.getElementById('reset');

let prefs: Prefs = defaultPrefs();
let statusTimer: number | undefined;

function setStatus(key: string, alert = false): void {
  if (statusTimer !== undefined) window.clearTimeout(statusTimer);
  statusEl?.classList.toggle('status--alert', alert);
  setText(statusEl, key);
  statusTimer = window.setTimeout(() => {
    statusTimer = undefined;
    if (statusEl !== null) statusEl.textContent = '';
  }, STATUS_MS);
}

async function persist(): Promise<void> {
  const ok = await savePrefs(prefs);
  if (ok) setStatus('optionsSaved');
  else setStatus('optionsSaveFailed', true);
}

function actionsInGroup(group: Action['group']): Action[] {
  const ordered = prefs.order
    .map((id) => ACTIONS.find((a) => a.id === id))
    .filter((a): a is Action => a !== undefined)
    .filter((a) => a.group === group);
  return ordered;
}

function createItem(action: Action, index: number, total: number): HTMLLIElement {
  const hidden = prefs.hidden.includes(action.id);

  const item = document.createElement('li');
  item.className = hidden ? 'item item--hidden' : 'item';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'item__check';
  checkbox.id = `toggle-${action.id}`;
  checkbox.checked = !hidden;
  checkbox.addEventListener('change', () => {
    prefs = toggleHidden(prefs, action.id);
    render();
    void persist();
  });

  const text = document.createElement('label');
  text.className = 'item__text';
  text.htmlFor = checkbox.id;

  const label = document.createElement('span');
  label.className = 'item__label';
  label.textContent = msg(action.labelKey);

  const tool = document.createElement('span');
  tool.className = 'item__tool';
  tool.textContent = action.tool;

  text.append(label, tool);

  const move = document.createElement('div');
  move.className = 'item__move';

  const up = document.createElement('button');
  up.type = 'button';
  up.id = `up-${action.id}`;
  up.className = 'item__button';
  up.textContent = '↑';
  up.disabled = index === 0;
  up.setAttribute('aria-label', msg('optionsMoveUp', [tool.textContent]));
  up.addEventListener('click', () => {
    prefs = moveWithinGroup(prefs, action.id, -1);
    render();
    void persist();
  });

  const down = document.createElement('button');
  down.type = 'button';
  down.id = `down-${action.id}`;
  down.className = 'item__button';
  down.textContent = '↓';
  down.disabled = index === total - 1;
  down.setAttribute('aria-label', msg('optionsMoveDown', [tool.textContent]));
  down.addEventListener('click', () => {
    prefs = moveWithinGroup(prefs, action.id, 1);
    render();
    void persist();
  });

  move.append(up, down);
  item.append(checkbox, text, move);
  return item;
}

function render(): void {
  if (groupsHost === null) return;

  // Re-rendering rebuilds every node, which would drop keyboard focus on each
  // toggle or move. Elements carry stable ids, so put focus back where it was.
  const focusedId = document.activeElement instanceof HTMLElement ? document.activeElement.id : '';

  groupsHost.textContent = '';

  for (const group of GROUP_ORDER) {
    const actions = actionsInGroup(group);
    if (actions.length === 0) continue;

    const section = document.createElement('section');
    section.dataset['group'] = group;

    const name = document.createElement('div');
    name.className = 'group__name';
    const tick = document.createElement('span');
    tick.className = 'group__tick';
    tick.setAttribute('aria-hidden', 'true');
    const title = document.createElement('span');
    title.textContent = msg(GROUP_LABEL_KEY[group]);
    name.append(tick, title);

    const list = document.createElement('ul');
    list.className = 'group__items';
    actions.forEach((action, index) => {
      list.append(createItem(action, index, actions.length));
    });

    section.append(name, list);
    groupsHost.append(section);
  }

  if (focusedId !== '') document.getElementById(focusedId)?.focus();
}

async function main(): Promise<void> {
  applyI18n();
  prefs = await loadPrefs();
  render();

  resetButton?.addEventListener('click', () => {
    prefs = defaultPrefs();
    render();
    void persist();
  });
}

void main();
