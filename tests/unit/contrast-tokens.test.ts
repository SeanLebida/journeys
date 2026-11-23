import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** WCAG 2 contrast for #rrggbb colours, with optional alpha mixing onto a base. */
type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const mix = (a: RGB, base: RGB, t: number): RGB => a.map((v, i) => v * t + base[i] * (1 - t)) as RGB;

const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const block = (selector: string) => {
  const start = css.indexOf(selector);
  return css.slice(start, css.indexOf('}', start));
};
const tokens = (text: string, base: Record<string, string> = {}) => {
  const out: Record<string, string> = { ...base };
  for (const m of text.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  const resolve = (v: string): string => (v.startsWith('var(--') ? resolve(out[v.slice(6, -1)]) : v);
  return (name: string) => hex(resolve(out[name]));
};

const rootText = block(':root {');
const light = tokens(rootText);
const dark = tokens(block(":root[data-theme='dark'] {"), Object.fromEntries([...rootText.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()])));

describe('muted text contrast (WCAG AAA, 7:1)', () => {
  for (const [name, t] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    it(`${name}: on every surface and its own chip tint`, () => {
      const muted = t('text-muted');
      for (const surface of ['bg', 'surface', 'surface-raised']) {
        expect(ratio(muted, t(surface))).toBeGreaterThanOrEqual(7);
        // `.journey-so-far__num`-style chips tint the surface with 14% of the muted colour.
        expect(ratio(muted, mix(muted, t(surface), 0.14))).toBeGreaterThanOrEqual(7);
      }
    });
  }

  it('keeps the dark and system-dark blocks identical', () => {
    const media = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
    expect(media).toContain(`--text-muted: ${block(":root[data-theme='dark'] {").match(/--text-muted:\s*([^;]+);/)![1]};`);
  });
});
