import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Root-absolute public URLs (`/images/...`, `/fonts/...`) skip Vite's base.
 * On the web deploy that base is `/app/`, so the request hits the site origin
 * (a 404) instead of the app. Map code must keep those paths in
 * `ASSET_PATHS` and resolve them with `resolveAssetUrl` / `import.meta.env.BASE_URL`.
 */
const ROOT_ASSET = /(['"`])\/(?:images|fonts|data|dist-content|badges)\//;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
    out.push(path);
  }
  return out;
}

describe('map asset URLs', () => {
  it('does not use a root-absolute asset path in map source', () => {
    const hits: string[] = [];
    for (const file of sourceFiles('src/map')) {
      const code = stripComments(readFileSync(file, 'utf8'));
      if (ROOT_ASSET.test(code) || /fetch\(\s*['"`]\//.test(code)) hits.push(file);
    }
    expect(hits).toEqual([]);
  });
});
