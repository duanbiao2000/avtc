import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

const resolvePath = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

const DIST = resolvePath('./dist');

/**
 * Vite mirrors the input path under `root`, so the pages would land in
 * `dist/popup/popup.html`. The manifest points at `popup.html` / `options.html`
 * in the extension root, so after writing we move each page up one level and
 * rewrite its relative asset URLs (`../assets/x` -> `assets/x`).
 *
 * A `generateBundle` rename does not work here: Vite emits HTML through
 * `this.emitFile({ fileName })`, and Rollup resolves that name at write time
 * regardless of bundle-key mutations.
 */
const PAGES: readonly { nested: string; flat: string }[] = [
  { nested: 'popup/popup.html', flat: 'popup.html' },
  { nested: 'options/options.html', flat: 'options.html' },
];

function flattenHtmlOutput(): Plugin {
  return {
    name: 'avtc-flatten-html-output',
    closeBundle() {
      for (const { nested, flat } of PAGES) {
        const from = join(DIST, nested);
        const to = join(DIST, flat);
        if (!existsSync(from)) continue;

        const html = readFileSync(from, 'utf8').replace(/(?:\.\.\/)+assets\//g, 'assets/');
        writeFileSync(to, html, 'utf8');
        rmSync(from, { force: true });

        // drop the now-empty directory Vite created for the nested page
        rmSync(join(from, '..'), { recursive: true, force: true });
      }

      // keep the rename visible in the build summary
      const moved = PAGES.filter(({ flat }) => existsSync(join(DIST, flat)));
      if (moved.length > 0) {
        console.log(
          `\n  ${moved.map(({ nested, flat }) => `${nested} → ${flat}`).join('\n  ')}\n`,
        );
      }
    },
  };
}

export default defineConfig({
  // src/popup/popup.html is the entry; flattenHtmlOutput() puts it at dist/popup.html.
  root: 'src',
  publicDir: resolvePath('./public'),
  base: './',
  plugins: [flattenHtmlOutput()],
  build: {
    outDir: DIST,
    emptyOutDir: true,
    target: 'chrome114',
    modulePreload: false,
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolvePath('./src/popup/popup.html'),
        options: resolvePath('./src/options/options.html'),
      },
    },
  },
  test: {
    root: resolvePath('./'),
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: resolvePath('./coverage'),
      reporter: ['text', 'json-summary'],
      include: ['src/core/**/*.ts', 'src/storage.ts'],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
      },
    },
  },
});
