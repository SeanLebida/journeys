#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

async function main() {
  const projectRoot = process.cwd();
  const gradlePath = path.resolve(
    projectRoot,
    'android',
    'app',
    'build.gradle'
  );
  const pkgPath = path.resolve(projectRoot, 'package.json');

  const [gradleRaw, pkgRaw] = await Promise.all([
    readFile(gradlePath, 'utf8'),
    readFile(pkgPath, 'utf8').catch(() => null),
  ]);

  if (!gradleRaw) {
    console.error('Could not find android/app/build.gradle');
    process.exit(1);
  }

  const pkg = pkgRaw ? JSON.parse(pkgRaw) : null;
  const pkgVersion = pkg?.version;

  let nextVersionCode = null;
  const overrideArg = process.argv.find(a => a.startsWith('--code='));
  const overrideEnv = process.env.ANDROID_VERSION_CODE;
  const overrideRaw = overrideArg ? overrideArg.split('=')[1] : overrideEnv;
  const overrideNumeric =
    overrideRaw && /^\d+$/.test(overrideRaw) ? parseInt(overrideRaw, 10) : null;

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
    console.warn(
      'Unable to read git commit count; falling back to incremental versionCode.'
    );
  }

  let newGradle = gradleRaw.replace(/versionCode\s+(\d+)/, (_, code) => {
    const current = parseInt(code, 10);
    let proposed = Number.isFinite(current) ? current + 1 : 1;

    if (overrideNumeric) {
      proposed = overrideNumeric;
    } else if (Number.isFinite(commitCount)) {
      proposed = Math.max(commitCount, Number.isFinite(current) ? current + 1 : 1);
    }

    nextVersionCode = proposed;
    return `versionCode ${proposed}`;
  });

  if (pkgVersion) {
    newGradle = newGradle.replace(/versionName\s+"([^"]+)"/, () => {
      return `versionName "${pkgVersion}"`;
    });
  }

  if (!/versionCode\s+\d+/.test(gradleRaw)) {
    console.error('Could not find versionCode in android/app/build.gradle');
    process.exit(1);
  }

  if (newGradle !== gradleRaw) {
    await writeFile(gradlePath, newGradle, 'utf8');
  }

  const sourceLabel = overrideNumeric
    ? 'override'
    : Number.isFinite(commitCount)
      ? `git commit count (${commitCount})`
      : 'incremental fallback';

  console.log('Updated android/app/build.gradle:');
  console.log(
    `  versionCode -> ${nextVersionCode ?? 'unchanged'} [source: ${sourceLabel}]`
  );
  console.log(`  versionName -> ${pkgVersion ?? 'unchanged'}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
