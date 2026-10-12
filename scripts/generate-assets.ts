import { chromium, type Page } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const iconSvgPath = path.join(rootDir, 'public', 'icon.svg');
const splashSvgPath = path.join(rootDir, 'public', 'splash.svg');
const iosIconPath = path.join(
  rootDir,
  'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
);
const iosSplashDir = path.join(rootDir, 'ios/App/App/Assets.xcassets/Splash.imageset');

// iOS masks the icon itself. A pre-rounded squircle leaves transparent corners,
// which App Store Connect rejects, and a square gold rim would be clipped.
function iosMarketingSvg(svg: string): string {
  const rounded = '<rect width="512" height="512" rx="108" fill="url(#bgGrad)"/>';
  const bleed = '<rect width="512" height="512" fill="url(#bgGrad)"/>';
  if (!svg.includes(rounded)) {
    throw new Error('public/icon.svg no longer has the rx=108 background; refusing to guess the iOS crop');
  }
  return svg
    .replace(rounded, bleed)
    .replace(
      /\n\s*<rect x="6" y="6" width="500" height="500" rx="102" fill="none" stroke="url\(#goldGrad\)" stroke-width="2" stroke-opacity="0\.35"\/>/,
      '',
    );
}

async function screenshotSvg(page: Page, svg: string, width: number, height: number): Promise<Buffer> {
  const file = path.join(os.tmpdir(), `journeys-asset-${width}x${height}.svg`);
  fs.writeFileSync(file, svg);
  await page.setViewportSize({ width, height });
  await page.goto(`file://${file}`);
  const shot = await page.screenshot({ omitBackground: false, type: 'png' });
  fs.unlinkSync(file);
  return shot;
}

async function writeIosMarketingIcon(page: Page) {
  const svg = iosMarketingSvg(fs.readFileSync(iconSvgPath, 'utf8'));
  const shot = await screenshotSvg(page, svg, 1024, 1024);
  await sharp(shot)
    .flatten({ background: '#090d16' })
    .removeAlpha()
    .png()
    .toFile(iosIconPath);
  console.log(`Generated iOS marketing icon: ${iosIconPath}`);
}

async function writeIosSplash(page: Page) {
  const svg = fs.readFileSync(splashSvgPath, 'utf8');
  const side = 2732;
  const portraitW = Math.round((1080 * side) / 1920);
  const shot = await screenshotSvg(page, svg, portraitW, side);
  const portrait = await sharp(shot).flatten({ background: '#070a10' }).removeAlpha().png().toBuffer();
  const square = await sharp({
    create: { width: side, height: side, channels: 3, background: '#070a10' },
  })
    .composite([{ input: portrait, gravity: 'centre' }])
    .removeAlpha()
    .png()
    .toBuffer();
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    fs.writeFileSync(path.join(iosSplashDir, name), square);
    console.log(`Generated iOS splash: ${name}`);
  }
}

async function generateIosBrandAssets() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await writeIosMarketingIcon(page);
    await writeIosSplash(page);
  } finally {
    await browser.close();
  }
}

async function main() {
  if (process.argv.includes('--ios-icon')) {
    await generateIosBrandAssets();
    return;
  }

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

  await writeIosMarketingIcon(page);
  await writeIosSplash(page);

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
