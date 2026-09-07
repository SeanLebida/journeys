#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const MAX_LENGTH = 500;

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

  let notes = '';

  if (rawChangelog) {
    const match = rawChangelog.match(/##\s+\[[^\]]+\][^\n]*\n([\s\S]*?)(?=\n##\s+\[|$)/);
    if (match && match[1]) {
      const section = match[1];
      const cleaned = section
        .replace(/^>.*$/gm, '')
        .replace(/^###+\s+(.*)$/gm, '$1:')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      notes = cleaned;
    }
  }

  if (!notes) {
    notes = 'Initial testing release of Journeys — Atlas of the Apostles: biblically, geographically, and archaeologically grounded interactive atlas with offline maps, journey routes, timeline, and public-domain Scriptures.';
  }

  if (notes.length > MAX_LENGTH) {
    notes = notes.slice(0, MAX_LENGTH - 4).replace(/\s+\S*$/, '') + '...';
  }

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, notes + '\n', 'utf8');

  console.log(`Generated Play Store release notes (${notes.length} chars) at:`);
  console.log(`   ${path.relative(projectRoot, outputPath)}`);
  console.log('--- Content ---');
  console.log(notes);
  console.log('---------------');
}

main().catch(err => {
  console.error('Failed to generate release notes:', err);
  process.exit(1);
});
