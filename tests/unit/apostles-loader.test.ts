import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('apostles content files', () => {
  it('build-content merges a *.apostles.json array after the extra file', () => {
    const src = readFileSync('scripts/build-content.ts', 'utf8');
    expect(src).toContain('.apostles.json');
  });
});
