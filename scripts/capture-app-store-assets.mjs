#!/usr/bin/env node
// Captures App Store review assets from a running `vite preview`.
// Phone stills are 1290×2796 (accepted 6.9-inch). iPad stills are 2064×2752.
// Previews are 15–30s H.264. Header is 3840×1646. Search is 3840×2560.
// No alpha channel on any image.
import { spawn } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'docs/store-assets/apple');
const phoneDir = path.join(out, 'iphone-6.9');
const padDir = path.join(out, 'ipad-13');
const previewDir = path.join(out, 'previews');
const rawDir = path.join(out, '.raw');
const base = process.env.STORE_CAPTURE_URL || 'http://127.0.0.1:4178';

const phone = { width: 430, height: 932, scale: 3 }; // 1290×2796
const pad = { width: 1032, height: 1376, scale: 2 }; // 2064×2752

const shots = [
  { name: '01-home', path: '/', ready: 'heading' },
  { name: '02-route-trace', path: '/trace/journey-ministry', ready: 'map' },
  { name: '03-atlas', path: '/atlas', ready: 'map' },
  { name: '04-timeline', path: '/timeline', ready: 'timeline' },
  { name: '05-bible', path: '/bible', ready: 'text' },
  { name: '06-lesson', path: '/lessons/lesson-galilean-ministry', ready: 'text' },
  { name: '07-quiz', path: '/quiz/quiz-foundations', ready: 'text' },
];

async function settle(page, ready) {
  if (ready === 'heading') {
    await page.getByRole('heading', { level: 1, name: 'Journeys' }).waitFor({ timeout: 20_000 });
  } else if (ready === 'map') {
    await page.getByTestId('map-canvas').locator('canvas').waitFor({ timeout: 20_000 });
    await page.waitForTimeout(2500);
  } else if (ready === 'timeline') {
    const jump = page.getByRole('link', { name: 'The life of Jesus' });
    await jump.waitFor({ timeout: 20_000 });
    await jump.click();
    await page.locator('#era-jesus .tl-era__title').waitFor({ timeout: 20_000 });
    await page.waitForTimeout(900);
  } else {
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(600);
}

async function flatten(file) {
  const image = sharp(file).flatten({ background: '#f4ecd8' }).removeAlpha();
  const meta = await image.metadata();
  await image.png().toFile(file + '.flat.png');
  const { rename, unlink } = await import('node:fs/promises');
  await unlink(file);
  await rename(file + '.flat.png', file);
  return meta;
}

async function captureStills(browser, viewport, dir) {
  await mkdir(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.scale,
    colorScheme: 'light',
  });
  const page = await context.newPage();
  const chosen = process.env.STORE_SHOTS
    ? shots.filter((shot) => process.env.STORE_SHOTS.split(',').includes(shot.name))
    : shots;
  for (const shot of chosen) {
    await page.goto(base + shot.path, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await settle(page, shot.ready);
    const file = path.join(dir, `${shot.name}.png`);
    await page.screenshot({ path: file, type: 'png' });
    const meta = await flatten(file);
    console.log(`${path.relative(root, file)} ${meta.width}x${meta.height}`);
  }
  await context.close();
}

async function recordFlow(browser, name, viewport, steps) {
  await mkdir(rawDir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    recordVideo: { dir: rawDir, size: { width: viewport.width, height: viewport.height } },
    colorScheme: 'light',
  });
  const page = await context.newPage();
  const started = Date.now();
  await steps(page);
  const elapsed = Date.now() - started;
  if (elapsed < 16_000) await page.waitForTimeout(16_000 - elapsed);
  const video = page.video();
  await context.close();
  const webm = await video.path();
  return { webm, name };
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => {
      out += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      err += chunk.toString();
    });
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(err.slice(-800) || out.slice(-800)))));
  });
}

function ffmpeg(args) {
  return run('ffmpeg', ['-y', ...args]);
}

async function verifyAssets() {
  const pngs = [
    ...shots.map((shot) => [path.join(phoneDir, `${shot.name}.png`), 1290, 2796]),
    ...shots.map((shot) => [path.join(padDir, `${shot.name}.png`), 2064, 2752]),
    [path.join(out, 'header-3840x1646.png'), 3840, 1646],
    [path.join(out, 'search-3840x2560.png'), 3840, 2560],
  ];
  for (const [file, width, height] of pngs) {
    const meta = await sharp(file).metadata();
    if (meta.width !== width || meta.height !== height || meta.hasAlpha) {
      throw new Error(`${path.relative(root, file)} is ${meta.width}x${meta.height} alpha=${meta.hasAlpha}`);
    }
  }
  const clips = [
    ['iphone-trace.mp4', 886, 1920],
    ['iphone-timeline-bible.mp4', 886, 1920],
    ['iphone-lesson-quiz.mp4', 886, 1920],
    ['ipad-trace.mp4', 1200, 1600],
    ['ipad-timeline-bible.mp4', 1200, 1600],
    ['ipad-lesson-quiz.mp4', 1200, 1600],
  ];
  for (const [name, width, height] of clips) {
    const file = path.join(previewDir, name);
    const raw = await run('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,width,height',
      '-of', 'json',
      file,
    ]);
    const info = JSON.parse(raw);
    const duration = Number(info.format?.duration);
    const video = (info.streams || []).find((stream) => stream.codec_type === 'video');
    const audio = (info.streams || []).find((stream) => stream.codec_type === 'audio');
    if (!video || video.width !== width || video.height !== height || !audio || duration < 15 || duration > 30) {
      throw new Error(`${name} failed review spec: ${raw}`);
    }
    console.log(`${name} ${video.width}x${video.height} ${duration.toFixed(1)}s`);
  }
}

async function encodePreview(webm, dest, width, height) {
  await mkdir(path.dirname(dest), { recursive: true });
  await ffmpeg([
    '-i', webm,
    '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
    '-vf', `scale=${width}:${height}:flags=lanczos:force_original_aspect_ratio=disable,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=2`,
    '-t', '22',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-level', '4.0',
    '-pix_fmt', 'yuv420p',
    '-b:v', '8M',
    '-c:a', 'aac',
    '-b:a', '256k',
    '-ac', '2',
    '-shortest',
    '-movflags', '+faststart',
    dest,
  ]);
  console.log(path.relative(root, dest));
}

async function svgText(width, height, lines) {
  const body = lines
    .map(
      (line) =>
        `<text x="${line.x}" y="${line.y}" text-anchor="${line.anchor || 'start'}" fill="${line.fill}" font-family="Palatino, Georgia, serif" font-size="${line.size}" font-weight="${line.weight || 500}">${line.text}</text>`,
    )
    .join('');
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`,
  );
}

async function marketing(phoneShot, padShot) {
  const icon = path.join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
  const headerW = 3840;
  const headerH = 1646;
  const phone = await sharp(phoneShot)
    .resize({ height: 1500, withoutEnlargement: false })
    .png()
    .toBuffer();
  const phoneMeta = await sharp(phone).metadata();
  const iconSize = 280;
  const iconRadius = Math.round(iconSize * 0.2237);
  const iconBuf = await sharp(icon)
    .resize(iconSize, iconSize)
    .composite([
      {
        input: Buffer.from(
          `<svg width="${iconSize}" height="${iconSize}" xmlns="http://www.w3.org/2000/svg"><rect width="${iconSize}" height="${iconSize}" rx="${iconRadius}" ry="${iconRadius}" fill="#fff"/></svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();
  const headerText = await svgText(headerW, headerH, [
    { x: 180, y: 620, size: 148, fill: '#faf5e9', text: 'Journeys', weight: 600 },
    { x: 184, y: 760, size: 64, fill: '#c9a227', text: 'Biblical Atlas' },
    { x: 184, y: 880, size: 42, fill: '#e8dcc0', text: 'Cited offline maps, from the patriarchs to the apostles.' },
  ]);
  const header = path.join(out, 'header-3840x1646.png');
  await sharp({
    create: { width: headerW, height: headerH, channels: 3, background: '#0a0a0a' },
  })
    .composite([
      { input: iconBuf, left: 184, top: 220 },
      { input: headerText, left: 0, top: 0 },
      { input: phone, left: headerW - phoneMeta.width - 180, top: Math.round((headerH - phoneMeta.height) / 2) },
    ])
    .flatten({ background: '#0a0a0a' })
    .removeAlpha()
    .png()
    .toFile(header);
  console.log(`header ${headerW}x${headerH}`);

  const searchW = 3840;
  const searchH = 2560;
  const map = await sharp(padShot)
    .resize({ width: 2400, height: 2100, fit: 'cover' })
    .png()
    .toBuffer();
  const search = path.join(out, 'search-3840x2560.png');
  await sharp({
    create: { width: searchW, height: searchH, channels: 3, background: '#0a0a0a' },
  })
    .composite([
      { input: map, left: 720, top: 180 },
      {
        input: Buffer.from(
          `<svg width="${searchW}" height="${searchH}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="1680" width="${searchW}" height="880" fill="#0a0a0a"/></svg>`,
        ),
        left: 0,
        top: 0,
      },
      {
        input: await svgText(searchW, searchH, [
          { x: 1920, y: 1980, size: 140, fill: '#faf5e9', text: 'Journeys', weight: 600, anchor: 'middle' },
          { x: 1920, y: 2140, size: 56, fill: '#c9a227', text: 'Cited offline Bible atlas', anchor: 'middle' },
          { x: 1920, y: 2260, size: 40, fill: '#e8dcc0', text: 'Patriarchs, battles, the ministry of Jesus, and the apostles.', anchor: 'middle' },
        ]),
        left: 0,
        top: 0,
      },
    ])
    .flatten({ background: '#0a0a0a' })
    .removeAlpha()
    .png()
    .toFile(search);
  console.log(`search ${searchW}x${searchH}`);
}

const traceSteps = async (page) => {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { level: 1, name: 'Journeys' }).waitFor();
  await page.waitForTimeout(2800);
  await page.locator('a.home__mode-card[href="/trace"]').click();
  const ministry = page.getByText('The Ministry of Jesus').first();
  await ministry.waitFor({ timeout: 20_000 });
  await ministry.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await ministry.click();
  await page.getByTestId('map-canvas').locator('canvas').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(5500);
  const cont = page.getByRole('button', { name: /Continue to/ });
  if (await cont.count()) {
    await cont.click();
    await page.waitForTimeout(4500);
  }
};

const studySteps = async (page) => {
  await page.goto(base + '/timeline', { waitUntil: 'domcontentloaded' });
  const jump = page.getByRole('link', { name: 'The life of Jesus' });
  await jump.waitFor({ timeout: 20_000 });
  await page.waitForTimeout(2200);
  await jump.click();
  await page.locator('#era-jesus').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(4500);
  await page.goto(base + '/bible', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { level: 1, name: 'Bible' }).waitFor();
  await page.waitForTimeout(4500);
};

const lessonSteps = async (page) => {
  await page.goto(base + '/lessons/lesson-galilean-ministry', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { level: 2, name: 'The Galilean Ministry' }).waitFor();
  await page.waitForTimeout(3000);
  const next = page.getByRole('button', { name: 'Next →', exact: true });
  await next.click();
  await page.waitForTimeout(2800);
  await page.goto(base + '/quiz/quiz-foundations', { waitUntil: 'domcontentloaded' });
  const answer = page.getByRole('button', { name: 'Prefect', exact: true });
  await answer.waitFor({ timeout: 20_000 });
  await answer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await answer.click();
  await page.waitForTimeout(4000);
};

const flows = [
  { name: 'trace', steps: traceSteps },
  { name: 'timeline-bible', steps: studySteps },
  { name: 'lesson-quiz', steps: lessonSteps },
];

const args = process.argv.slice(2).filter((arg) => arg !== 'stills' && arg !== 'marketing');
const stillsOnly = process.argv.includes('stills');
const selected = args.length ? flows.filter((flow) => args.includes(flow.name)) : flows;
if (args.length && selected.length !== args.length) {
  throw new Error(`Unknown flow. Choose from: ${flows.map((flow) => flow.name).join(', ')}`);
}

if (process.argv.includes('marketing')) {
  await marketing(path.join(phoneDir, '02-route-trace.png'), path.join(padDir, '03-atlas.png'));
  const headerMeta = await sharp(path.join(out, 'header-3840x1646.png')).metadata();
  if (headerMeta.width !== 3840 || headerMeta.height !== 1646 || headerMeta.hasAlpha) {
    throw new Error(`header ${headerMeta.width}x${headerMeta.height} alpha=${headerMeta.hasAlpha}`);
  }
  process.exit(0);
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
try {
  if (!args.length) {
    await captureStills(browser, phone, phoneDir);
    await captureStills(browser, pad, padDir);
  }
  await mkdir(previewDir, { recursive: true });
  if (!stillsOnly) {
    for (const flow of selected) {
      const phoneTake = await recordFlow(browser, flow.name, { width: 430, height: 932 }, flow.steps);
      await encodePreview(phoneTake.webm, path.join(previewDir, `iphone-${flow.name}.mp4`), 886, 1920);
      const padTake = await recordFlow(browser, flow.name, { width: 900, height: 1200 }, flow.steps);
      await encodePreview(padTake.webm, path.join(previewDir, `ipad-${flow.name}.mp4`), 1200, 1600);
    }
  }
  await marketing(
    path.join(phoneDir, '02-route-trace.png'),
    path.join(padDir, '03-atlas.png'),
  );
  await verifyAssets();
} finally {
  await browser.close();
  await rm(rawDir, { recursive: true, force: true });
}
