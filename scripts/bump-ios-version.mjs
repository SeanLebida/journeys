#!/usr/bin/env node
// Aligns the iOS target with package.json and a monotonic build number.
// App Store Connect rejects a reused CFBundleVersion. Same rule as
// scripts/bump-android-version.mjs: git commit count, or IOS_BUILD_NUMBER.
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const pbxPath = path.resolve(projectRoot, 'ios/App/App.xcodeproj/project.pbxproj');
const pkg = JSON.parse(await readFile(path.resolve(projectRoot, 'package.json'), 'utf8'));

const overrideRaw = process.env.IOS_BUILD_NUMBER;
const override = overrideRaw && /^\d+$/.test(overrideRaw) ? parseInt(overrideRaw, 10) : null;

let commitCount = null;
try {
  const raw = execSync('git rev-list --count HEAD', {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim();
  commitCount = /^\d+$/.test(raw) ? parseInt(raw, 10) : null;
} catch {
  console.warn('Unable to read git commit count; build number increments by 1.');
}

let pbx = await readFile(pbxPath, 'utf8');
const currentMatch = pbx.match(/CURRENT_PROJECT_VERSION = (\d+);/);
if (!currentMatch) {
  console.error('CURRENT_PROJECT_VERSION not found in project.pbxproj');
  process.exit(1);
}
const current = parseInt(currentMatch[1], 10);
let next = Number.isFinite(current) ? current + 1 : 1;
if (override) next = override;
else if (Number.isFinite(commitCount)) next = Math.max(commitCount, next);

pbx = pbx.replaceAll(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${next};`);
if (pkg.version) {
  pbx = pbx.replaceAll(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${pkg.version};`);
}
await writeFile(pbxPath, pbx);
console.log(`iOS marketing ${pkg.version} build ${next}`);
