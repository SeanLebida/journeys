import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ModePanel } from './ModePanel';

window.matchMedia ??= ((q: string) => ({
  matches: false,
  media: q,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;

function setup(rememberScroll: boolean) {
  const calls: number[] = [];
  let top = 0;
  const desc = {
    configurable: true,
    get: () => top,
    set: (v: number) => (top = v),
  };
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', desc);
  HTMLElement.prototype.scrollTo = vi.fn(function (o?: ScrollToOptions | number) {
    const t = typeof o === 'object' ? (o.top ?? 0) : 0;
    top = t;
    calls.push(t);
  }) as typeof HTMLElement.prototype.scrollTo;
  const ui = (k: string) => (
    <ModePanel title="Atlas" scrollKey={k} rememberScroll={rememberScroll}>
      body
    </ModePanel>
  );
  const r = render(ui('atlas'));
  return { calls, scrollTo: (v: number) => (top = v), show: (k: string) => r.rerender(ui(k)) };
}

describe('ModePanel scroll memory', () => {
  it('opens details at the top and closing returns to the saved spot', () => {
    const p = setup(true);
    p.scrollTo(240); // reader scrolled down the layer controls
    p.show('site:athens');
    expect(p.calls.at(-1)).toBe(0);
    p.show('atlas');
    expect(p.calls.at(-1)).toBe(240);
  });

  it('without rememberScroll every key change goes to the top', () => {
    const p = setup(false);
    p.scrollTo(240);
    p.show('site:athens');
    p.show('atlas');
    expect(p.calls.at(-1)).toBe(0);
  });
});
