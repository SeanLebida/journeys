import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const iconSvgPath = path.join(rootDir, 'public', 'icon.svg');
const splashSvgPath = path.join(rootDir, 'public', 'splash.svg');

async function main() {
  console.log('Generating PNG assets from icon.svg and splash.svg using Playwright Chromium...');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 1. Render icon.png (512x512) for PWA / Web
  await page.setViewportSize({ width: 512, height: 512 });
  await page.goto(`file://${iconSvgPath}`);
  const iconPngPath = path.join(rootDir, 'public', 'icon.png');
  await page.screenshot({ path: iconPngPath, omitBackground: false });
  console.log(`Generated: ${iconPngPath}`);

  // 2. Render splash.png (1080x1920) for Web / PWA / Android root drawable
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.goto(`file://${splashSvgPath}`);
  const splashPngPath = path.join(rootDir, 'public', 'splash.png');
  await page.screenshot({ path: splashPngPath, omitBackground: false });
  console.log(`Generated: ${splashPngPath}`);

  // 3. Android Splash Screens
  const androidResDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res');
  
  const splashTargets = [
    { dir: 'drawable', width: 1080, height: 1920 },
    { dir: 'drawable-port-mdpi', width: 320, height: 480 },
    { dir: 'drawable-port-hdpi', width: 480, height: 800 },
    { dir: 'drawable-port-xhdpi', width: 720, height: 1280 },
    { dir: 'drawable-port-xxhdpi', width: 960, height: 1600 },
    { dir: 'drawable-port-xxxhdpi', width: 1280, height: 1920 },
    { dir: 'drawable-land-mdpi', width: 480, height: 320 },
    { dir: 'drawable-land-hdpi', width: 800, height: 480 },
    { dir: 'drawable-land-xhdpi', width: 1280, height: 720 },
    { dir: 'drawable-land-xxhdpi', width: 1600, height: 960 },
    { dir: 'drawable-land-xxxhdpi', width: 1920, height: 1280 },
  ];

  for (const target of splashTargets) {
    const targetDir = path.join(androidResDir, target.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    await page.setViewportSize({ width: target.width, height: target.height });
    await page.goto(`file://${splashSvgPath}`);
    const targetFile = path.join(targetDir, 'splash.png');
    await page.screenshot({ path: targetFile, omitBackground: false });
    console.log(`Generated Android splash: ${target.dir}/splash.png (${target.width}x${target.height})`);
  }

  // 4. Android App Launcher Mipmap Icons
  const iconTargets = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];

  for (const target of iconTargets) {
    const targetDir = path.join(androidResDir, target.dir);
    if (!fs.existsSync(targetDir)) fillDir(targetDir);

    await page.setViewportSize({ width: target.size, height: target.size });
    await page.goto(`file://${iconSvgPath}`);
    const icLauncherFile = path.join(targetDir, 'ic_launcher.png');
    const icLauncherRoundFile = path.join(targetDir, 'ic_launcher_round.png');
    const icLauncherForeFile = path.join(targetDir, 'ic_launcher_foreground.png');

    await page.screenshot({ path: icLauncherFile, omitBackground: false });
    await page.screenshot({ path: icLauncherRoundFile, omitBackground: false });
    await page.screenshot({ path: icLauncherForeFile, omitBackground: false });
    console.log(`Generated Android icon: ${target.dir} (${target.size}x${target.size})`);
  }

  await browser.close();
  console.log('Asset generation completed successfully!');
}

function fillDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

main().catch((err) => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
