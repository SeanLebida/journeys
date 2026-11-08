import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeMapPadding, paddingsEqual } from './viewportPadding';

function mockMatchMedia(query: string, matches: boolean) {
  return {
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  } satisfies MediaQueryList;
}

describe('computeMapPadding', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    document.body.innerHTML = '';
  });

  it('pads the left for the desktop sidebar', () => {
    window.matchMedia = ((q: string) =>
      mockMatchMedia(q, q.includes('min-width: 1024px'))) as typeof window.matchMedia;
    document.body.innerHTML = `<div class="app-shell" style="--dock-h: 56px; --safe-top: 0px"></div><div class="app-main"></div>`;
    expect(computeMapPadding()).toEqual({ top: 0, bottom: 56, left: 450, right: 0 });
  });

  it('pads the bottom by sheet + dock on a portrait phone', () => {
    window.matchMedia = ((q: string) =>
      mockMatchMedia(
        q,
        q.includes('max-width: 1023px') && q.includes('orientation: portrait'),
      )) as typeof window.matchMedia;
    document.body.innerHTML = `
      <div class="app-shell" style="--dock-h: 64px; --safe-top: 12px">
        <div class="app-main" style="--sheet-h: 400px; height: 800px">
          <section class="mode-panel"></section>
        </div>
      </div>`;
    // jsdom does not compute CSS custom props from style attributes via getComputedStyle
    // the same way browsers do for inherited vars on children — set on the elements we read.
    const shell = document.querySelector('.app-shell') as HTMLElement;
    const main = document.querySelector('.app-main') as HTMLElement;
    shell.style.setProperty('--dock-h', '64px');
    shell.style.setProperty('--safe-top', '12px');
    main.style.setProperty('--sheet-h', '400px');
    Object.defineProperty(main, 'clientHeight', { configurable: true, value: 800 });

    expect(computeMapPadding()).toEqual({ top: 12, bottom: 464, left: 0, right: 0 });
  });

  it('skips sheet pad on page modes (Home/Bible/Timeline)', () => {
    window.matchMedia = ((q: string) =>
      mockMatchMedia(
        q,
        q.includes('max-width: 1023px') && q.includes('orientation: portrait'),
      )) as typeof window.matchMedia;
    document.body.innerHTML = `
      <div class="app-shell" style="--dock-h: 64px; --safe-top: 0px">
        <div class="app-main" style="--sheet-h: 700px">
          <section class="mode-panel mode-panel--page"></section>
        </div>
      </div>`;
    const shell = document.querySelector('.app-shell') as HTMLElement;
    const main = document.querySelector('.app-main') as HTMLElement;
    shell.style.setProperty('--dock-h', '64px');
    shell.style.setProperty('--safe-top', '0px');
    main.style.setProperty('--sheet-h', '700px');
    expect(computeMapPadding()).toEqual({ top: 0, bottom: 64, left: 0, right: 0 });
  });

  it('uses the resolved dock and clamped sheet height rather than CSS expressions', () => {
    window.matchMedia = (q: string) => mockMatchMedia(q, q.includes('orientation: portrait'));
    document.body.innerHTML = `
      <div class="app-shell" style="--dock-h: calc(48px + 0.8rem); --safe-top: 0px">
        <div class="app-main" style="--sheet-h: 736px">
          <section class="mode-panel" style="bottom: 60px"></section>
        </div>
      </div>`;
    const panel = document.querySelector('.mode-panel');
    if (!panel) throw new Error('missing panel');
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 8, 390, 732));
    expect(computeMapPadding()).toEqual({ top: 0, bottom: 792, left: 0, right: 0 });
  });

  it('measures a landscape rail whose width is a CSS calc/min expression', () => {
    window.matchMedia = (q: string) => mockMatchMedia(q, q.includes('orientation: landscape'));
    document.body.innerHTML = `
      <div class="app-shell" style="--dock-h: calc(44px + 0.5rem); --safe-top: 0px">
        <div class="app-main" style="--rail-w: calc(min(54vw, 360px) + 0px)">
          <section class="mode-panel" style="bottom: 52px"></section>
        </div>
      </div>`;
    const panel = document.querySelector('.mode-panel');
    if (!panel) throw new Error('missing panel');
    vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 360, 338));
    expect(computeMapPadding()).toEqual({ top: 0, bottom: 52, left: 360, right: 0 });
  });

  it('pads the left for the landscape rail', () => {
    window.matchMedia = ((q: string) =>
      mockMatchMedia(
        q,
        q.includes('max-width: 1023px') && q.includes('orientation: landscape'),
      )) as typeof window.matchMedia;
    document.body.innerHTML = `
      <div class="app-shell" style="--dock-h: 40px; --safe-top: 0px">
        <div class="app-main" style="--rail-w: 200px"></div>
      </div>`;
    const shell = document.querySelector('.app-shell') as HTMLElement;
    const main = document.querySelector('.app-main') as HTMLElement;
    shell.style.setProperty('--dock-h', '40px');
    shell.style.setProperty('--safe-top', '0px');
    main.style.setProperty('--rail-w', '200px');
    expect(computeMapPadding()).toEqual({ top: 0, bottom: 40, left: 200, right: 0 });
  });
});

describe('paddingsEqual', () => {
  it('compares all four edges', () => {
    expect(paddingsEqual({ top: 1, bottom: 2, left: 3, right: 4 }, { top: 1, bottom: 2, left: 3, right: 4 })).toBe(true);
    expect(paddingsEqual({ top: 1, bottom: 2, left: 3, right: 4 }, { top: 1, bottom: 2, left: 0, right: 4 })).toBe(false);
  });
});
