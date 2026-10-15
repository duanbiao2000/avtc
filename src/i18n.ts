/**
 * Thin wrapper over chrome.i18n plus a `data-i18n*` applier, so HTML stays
 * declarative and no remote resource is ever loaded (no web fonts, no CDN).
 */

export function msg(key: string, substitutions?: string[]): string {
  if (typeof chrome === 'undefined' || chrome.i18n === undefined) return key;
  const text = chrome.i18n.getMessage(key, substitutions);
  return text === '' ? key : text;
}

export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset['i18n'];
    if (key !== undefined) el.textContent = msg(key);
  });

  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset['i18nTitle'];
    if (key !== undefined) el.title = msg(key);
  });

  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.dataset['i18nAria'];
    if (key !== undefined) el.setAttribute('aria-label', msg(key));
  });
}

/** Sets text and returns the element, tolerating a missing node. */
export function setText(el: HTMLElement | null, key: string, substitutions?: string[]): void {
  if (el !== null) el.textContent = msg(key, substitutions);
}
