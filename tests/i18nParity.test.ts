/**
 * Guards the "two locales, one set of keys" rule: a typo in a message key would
 * otherwise surface as a blank label in the UI.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('..', import.meta.url).pathname;
const LOCALES = ['zh_CN', 'en'] as const;
const TOOL_NAMES = [
  'GitDiagram',
  'DeepWiki',
  'Zread',
  'GitReverse',
  'Gitingest',
  'GitHub1s',
  'GitHub.dev',
  'StackBlitz',
];

type Messages = Record<string, { message: string }>;

function readMessages(locale: string): Messages {
  const file = join(ROOT, 'public', '_locales', locale, 'messages.json');
  return JSON.parse(readFileSync(file, 'utf8')) as Messages;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|html)$/.test(entry) ? [full] : [];
  });
}

function sourceText(): string {
  const files = [...walk(join(ROOT, 'src')), join(ROOT, 'public', 'manifest.json')];
  return files.map((file) => readFileSync(file, 'utf8')).join('\n');
}

/** Keys passed to msg()/setText()/setStatus(), or declared in HTML / the manifest. */
function referencedKeys(): Set<string> {
  const text = sourceText();
  const keys = new Set<string>();
  const patterns = [
    /(?:msg|setText|setStatus)\(\s*[^,)]*?,?\s*'([A-Za-z][A-Za-z0-9]*)'/g,
    /data-i18n(?:-title|-aria)?="([A-Za-z][A-Za-z0-9]*)"/g,
    /__MSG_([A-Za-z0-9_]+)__/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match[1] !== undefined) keys.add(match[1]);
    }
  }
  return keys;
}

describe('locales', () => {
  const zh = readMessages('zh_CN');
  const en = readMessages('en');

  it('ship the same key set in both languages', () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it('never ship an empty message', () => {
    for (const locale of LOCALES) {
      const messages = readMessages(locale);
      for (const [key, entry] of Object.entries(messages)) {
        expect(entry.message.trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('resolve every key referenced by the source', () => {
    const missing: string[] = [];
    for (const key of referencedKeys()) {
      if (zh[key] === undefined) missing.push(`zh_CN.${key}`);
      if (en[key] === undefined) missing.push(`en.${key}`);
    }
    expect(missing).toEqual([]);
  });

  it('have no unused keys left in the locale files', () => {
    // Label keys are data-driven (`action.labelKey`), so look at literal occurrences
    // anywhere in the sources rather than only inside msg() calls.
    const text = sourceText();
    const unused = Object.keys(zh).filter(
      (key) => !text.includes(`'${key}'`) && !text.includes(`"${key}"`) && !text.includes(`__MSG_${key}__`),
    );
    expect(unused).toEqual([]);
  });

  it('keeps every tool name in English in both locales', () => {
    for (const key of Object.keys(zh)) {
      const zhMessage = zh[key]?.message ?? '';
      const enMessage = en[key]?.message ?? '';
      for (const tool of TOOL_NAMES) {
        if (!zhMessage.includes(tool)) continue;
        expect(enMessage, `en.${key} should keep "${tool}" in English`).toContain(tool);
      }
    }
  });

  it('uses the same substitution placeholders in both languages', () => {
    for (const key of Object.keys(zh)) {
      const placeholders = (value: string) => (value.match(/\$\d/g) ?? []).sort();
      expect(placeholders(en[key]?.message ?? ''), key).toEqual(
        placeholders(zh[key]?.message ?? ''),
      );
    }
  });
});
