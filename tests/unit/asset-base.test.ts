import { describe, expect, it } from 'vitest';
import { routerBasename, withBase } from '../../src/platform/bridge';

describe('withBase', () => {
  it('leaves root-absolute paths alone when base is /', () => {
    expect(withBase('/', '/dist-content/bundle.json')).toBe('/dist-content/bundle.json');
  });

  it('prefixes a trailing-slash base', () => {
    expect(withBase('/app/', '/dist-content/bundle.json')).toBe('/app/dist-content/bundle.json');
  });

  it('prefixes a base without a trailing slash', () => {
    expect(withBase('/app', '/fonts/ubuntu-400.woff2')).toBe('/app/fonts/ubuntu-400.woff2');
  });

  it('leaves absolute URLs and relative paths unchanged', () => {
    expect(withBase('/app/', 'https://example.com/x')).toBe('https://example.com/x');
    expect(withBase('/app/', 'relative.png')).toBe('relative.png');
  });
});

describe('routerBasename', () => {
  it('omits the default root', () => {
    expect(routerBasename('/')).toBeUndefined();
    expect(routerBasename('')).toBeUndefined();
  });

  it('strips one trailing slash', () => {
    expect(routerBasename('/app/')).toBe('/app');
  });
});
