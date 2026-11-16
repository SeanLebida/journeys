import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';

const MAX_STORE_NOTES = 500;
const changelogPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../CHANGELOG.md');

function topChangelogSection(changelog: string): { version: string; body: string } | null {
  const match = changelog.match(/##\s+\[([^\]]+)\][^\n]*\n([\s\S]*?)(?=\n##\s+\[|$)/);
  return match ? { version: match[1], body: match[2] } : null;
}

function storeNotes(sectionBody: string): string | null {
  const match = sectionBody.match(/(?:^|\n)###\s+Store notes[ \t]*\n([\s\S]*?)(?=\n###\s+|$)/);
  if (!match) return null;
  return match[1].trim() || null;
}

describe('CHANGELOG Store notes', () => {
  const changelog = readFileSync(changelogPath, 'utf8');
  const top = topChangelogSection(changelog);

  it('has a Store notes subsection on the version being shipped', () => {
    expect(top).not.toBeNull();
    expect(top!.version).toBe(pkg.version);
    const notes = storeNotes(top!.body);
    expect(notes, 'Add a ### Store notes subsection to the top CHANGELOG version').toBeTruthy();
    expect(notes!.length).toBeLessThanOrEqual(MAX_STORE_NOTES);
  });
});
