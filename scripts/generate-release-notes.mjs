#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const MAX_LENGTH = 500;

export function extractTopSection(rawChangelog) {
  const match = rawChangelog.match(/##\s+\[[^\]]+\][^\n]*\n([\s\S]*?)(?=\n##\s+\[|$)/);
  return match?.[1] ?? '';
}

/** Body of the ### Store notes subsection, or null if it is missing. */
export function extractStoreNotes(section) {
  const match = section.match(/(?:^|\n)###\s+Store notes[ \t]*\n([\s\S]*?)(?=\n###\s+|$)/);
  if (!match) return null;
  return match[1].trim() || null;
}

export function cleanNotes(text) {
  return text
    .replace(/^>.*$/gm, '')
    .replace(/^###+\s+(.*)$/gm, '$1:')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function notesFromChangelog(rawChangelog, warn = console.warn) {
  if (!rawChangelog) return '';
  const section = extractTopSection(rawChangelog);
  if (!section) return '';
  const storeNotes = extractStoreNotes(section);
  if (storeNotes != null) {
    return cleanNotes(storeNotes);
  }
  warn(
    'Warning: the top CHANGELOG section has no ### Store notes subsection. ' +
      'Falling back to the full section. Play/TestFlight notes may include internal details. ' +
      'Add ### Store notes with plain, user-facing text (under 500 characters).',
  );
  return cleanNotes(section);
}

export function clipNotes(notes) {
  if (notes.length <= MAX_LENGTH) return notes;
  return notes.slice(0, MAX_LENGTH - 4).replace(/\s+\S*$/, '') + '...';
}

async function main() {
  const projectRoot = process.cwd();
  const changelogPath = path.resolve(projectRoot, 'CHANGELOG.md');
  const outputDir = path.resolve(projectRoot, 'android', 'release-notes');
  const outputPath = path.resolve(outputDir, 'whatsnew-en-US');

  let rawChangelog = '';
  try {
    rawChangelog = await readFile(changelogPath, 'utf8');
  } catch {
    console.warn('Could not read CHANGELOG.md, using default release notes.');
    rawChangelog = '';
  }

  let notes = notesFromChangelog(rawChangelog);

  if (!notes) {
    notes = 'Initial testing release of Journeys — Atlas of the Apostles: biblically, geographically, and archaeologically grounded interactive atlas with offline maps, journey routes, timeline, and public-domain Scriptures.';
  }

  notes = clipNotes(notes);

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, notes + '\n', 'utf8');

  console.log(`Generated Play Store release notes (${notes.length} chars) at:`);
  console.log(`   ${path.relative(projectRoot, outputPath)}`);
  console.log('--- Content ---');
  console.log(notes);
  console.log('---------------');
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  main().catch(err => {
    console.error('Failed to generate release notes:', err);
    process.exit(1);
  });
}
