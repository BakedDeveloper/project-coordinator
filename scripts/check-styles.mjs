// Checks the colour rules of the app (run by `pnpm lint`):
// 1. component CSS (src/app/**/*.css) contains no literal colour: only tokens;
// 2. the two dark-theme blocks of src/styles.css are identical;
// 3. every text/background pair is at least 4.5:1, in both themes;
// 4. the inline theme script of src/index.html uses the same storage key as ThemeService.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const errors = [];

// 1. No literal colours in component CSS ------------------------------------
// Colour names count only as whole words: `white-space` is not a colour.

const LITERAL_COLOR =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|(?<![\w-])(?:white|black|red|green|blue|gray|grey|purple|orange|yellow|pink)(?![\w-])/i;

function cssFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

for (const file of cssFiles(join(root, 'src', 'app'))) {
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, index) => {
      const code = line.replace(/\/\*.*?\*\//g, '');
      if (LITERAL_COLOR.test(code)) {
        errors.push(
          `${relative(root, file)}:${index + 1}: literal colour, use a token from src/styles.css`,
        );
      }
    });
}

// 2 and 3. Theme tokens -----------------------------------------------------

// Git on Windows may check the file out with CRLF line endings.
const styles = readFileSync(join(root, 'src', 'styles.css'), 'utf8').replace(/\r\n/g, '\n');

function block(selector) {
  const start = styles.indexOf(`${selector} {`);
  if (start === -1) {
    errors.push(`src/styles.css: block "${selector}" not found`);
    return {};
  }
  const body = styles.slice(start + selector.length + 2, styles.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

const base = block(':root');
const light = { ...base, ...block(":root,\n:root[data-theme='light']") };
const darkMedia = block("  :root:not([data-theme='light'])");
const darkForced = block(":root[data-theme='dark']");

if (JSON.stringify(darkMedia) !== JSON.stringify(darkForced)) {
  errors.push('src/styles.css: the two dark-theme blocks differ, keep them identical');
}
const dark = { ...light, ...darkForced };

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const TEXT_ON_SURFACES = [
  '--color-text',
  '--color-text-secondary',
  '--color-status-done',
  '--color-status-in-progress-text',
  '--color-status-todo',
  '--color-status-blocked',
  '--color-line-today',
  '--color-line-checkpoint',
];
const SURFACES = ['--color-background', '--color-surface', '--color-surface-muted'];
const PAIRS = [
  ...TEXT_ON_SURFACES.flatMap((text) => SURFACES.map((surface) => [text, surface])),
  ['--color-on-accent', '--color-accent'],
  ['--color-status-blocked', '--color-error-surface'],
  // Side menu (issue #66)
  ['--color-text', '--color-sidebar'],
  ['--color-text-secondary', '--color-sidebar'],
  ['--color-nav-active-text', '--color-nav-active'],
];

for (const [name, tokens] of [
  ['light', light],
  ['dark', dark],
]) {
  for (const [text, surface] of PAIRS) {
    const [fg, bg] = [tokens[text], tokens[surface]];
    if (!/^#[0-9a-f]{6}$/i.test(fg ?? '') || !/^#[0-9a-f]{6}$/i.test(bg ?? '')) {
      errors.push(`${name} theme: ${text} or ${surface} is missing or not #rrggbb`);
      continue;
    }
    const ratio = contrast(fg, bg);
    if (ratio < 4.5) {
      errors.push(`${name} theme: ${text} on ${surface} is ${ratio.toFixed(2)}:1, below 4.5:1`);
    }
  }
}

// 4. Theme storage key ------------------------------------------------------

const themeService = readFileSync(join(root, 'src', 'app', 'theme', 'theme.service.ts'), 'utf8');
const storageKey = /THEME_STORAGE_KEY = '([^']+)'/.exec(themeService)?.[1];
const indexHtml = readFileSync(join(root, 'src', 'index.html'), 'utf8');
if (!storageKey || !indexHtml.includes(`localStorage.getItem('${storageKey}')`)) {
  errors.push(
    'src/index.html: the inline theme script must read THEME_STORAGE_KEY of ThemeService',
  );
}

if (errors.length > 0) {
  console.error('Style check failed:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`Style check passed (${PAIRS.length} colour pairs in 2 themes).`);
