import { chromium, type Browser } from '@playwright/test';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const storeDir = path.join(rootDir, 'docs', 'store-assets');

// Subdirectories for each Google Play device form factor
const dirs = {
  branding: path.join(storeDir, 'branding'),
  phone: path.join(storeDir, 'phone'),
  tablet7: path.join(storeDir, 'tablet-7inch'),
  tablet10: path.join(storeDir, 'tablet-10inch'),
  chromebook: path.join(storeDir, 'chromebook'),
};

for (const dir of Object.values(dirs)) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function copyBrandingAssets() {
  console.log('Copying logo, icon, and branding visual assets...');
  
  // 1. App Icon (512x512)
  fs.copyFileSync(
    path.join(rootDir, 'public', 'icon.png'),
    path.join(dirs.branding, 'icon-512x512.png')
  );
  // Also keep root copy in storeDir for backwards convenience
  fs.copyFileSync(
    path.join(rootDir, 'public', 'icon.png'),
    path.join(storeDir, 'icon-512x512.png')
  );

  // 2. Vector Logos
  fs.copyFileSync(
    path.join(rootDir, 'public', 'icon.svg'),
    path.join(dirs.branding, 'logo.svg')
  );
  fs.copyFileSync(
    path.join(rootDir, 'assets', 'icon-only.svg'),
    path.join(dirs.branding, 'logo-mark.svg')
  );

  // 3. Splash Screens
  fs.copyFileSync(
    path.join(rootDir, 'public', 'splash.svg'),
    path.join(dirs.branding, 'splash.svg')
  );
  fs.copyFileSync(
    path.join(rootDir, 'public', 'splash.png'),
    path.join(dirs.branding, 'splash-1080x1920.png')
  );

  console.log('Branding assets copied to docs/store-assets/branding/');
}

async function generateFeatureGraphic(browser: Browser) {
  console.log('Rendering Feature Graphic (1024x500)...');
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1024, height: 500 });

  const featureHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1024px;
    height: 500px;
    background: radial-gradient(circle at 75% 30%, #1e2b4d 0%, #0b1020 70%, #060913 100%);
    color: #f1f5f9;
    font-family: 'Inter', system-ui, sans-serif;
    display: flex;
    position: relative;
    overflow: hidden;
  }

  .grid-overlay {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(to right, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
    background-size: 48px 48px;
    opacity: 0.7;
  }

  .compass-circle {
    position: absolute;
    right: -40px;
    top: 50%;
    transform: translateY(-50%);
    width: 460px;
    height: 460px;
    border-radius: 50%;
    border: 2px dashed rgba(212, 175, 55, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .compass-inner {
    width: 380px;
    height: 380px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle, rgba(212, 175, 55, 0.05) 0%, transparent 70%);
  }
  .compass-star {
    font-size: 160px;
    color: rgba(212, 175, 55, 0.4);
    user-select: none;
    line-height: 1;
  }

  .route-svg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .content {
    position: relative;
    z-index: 10;
    width: 650px;
    padding: 60px 0 60px 64px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .badge-tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(212, 175, 55, 0.15);
    border: 1px solid rgba(212, 175, 55, 0.4);
    color: #e2c974;
    padding: 6px 14px;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 18px;
    align-self: flex-start;
  }

  h1 {
    font-family: 'Cinzel', serif;
    font-size: 58px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #ffffff;
    line-height: 1.1;
    margin-bottom: 6px;
    text-shadow: 0 4px 20px rgba(0,0,0,0.6);
  }

  .subtitle {
    font-size: 24px;
    font-weight: 500;
    color: #cbd5e1;
    letter-spacing: 0.02em;
    margin-bottom: 24px;
  }

  .pills-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .pill {
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.25);
    backdrop-filter: blur(8px);
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
    color: #e2e8f0;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pill-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #e2c974;
  }
</style>
</head>
<body>
  <div class="grid-overlay"></div>
  
  <svg class="route-svg" viewBox="0 0 1024 500" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M 520,380 C 620,310 680,410 780,300 C 860,210 880,140 980,160" stroke="#e2c974" stroke-width="3" stroke-dasharray="8 6" opacity="0.6"/>
    <circle cx="520" cy="380" r="6" fill="#e2c974"/>
    <circle cx="780" cy="300" r="5" fill="#e2c974"/>
    <circle cx="980" cy="160" r="6" fill="#e2c974"/>
  </svg>

  <div class="compass-circle">
    <div class="compass-inner">
      <div class="compass-star">✦</div>
    </div>
  </div>

  <div class="content">
    <div class="badge-tag">
      <span>Interactive Atlas</span>
    </div>
    <h1>Journeys</h1>
    <div class="subtitle">Atlas of the Apostles</div>
    <div class="pills-row">
      <div class="pill"><span class="pill-dot"></span>100% Offline Scripture DB</div>
      <div class="pill"><span class="pill-dot"></span>Archaeologically Grounded</div>
      <div class="pill"><span class="pill-dot"></span>Interactive Route Tracing</div>
      <div class="pill"><span class="pill-dot"></span>Biblical Timeline & Eras</div>
    </div>
  </div>
</body>
</html>`;

  await page.setContent(featureHtml);
  await page.waitForTimeout(1000);

  const outBranding = path.join(dirs.branding, 'feature-graphic-1024x500.png');
  const outRoot = path.join(storeDir, 'feature-graphic-1024x500.png');
  await page.screenshot({ path: outBranding });
  fs.copyFileSync(outBranding, outRoot);
  console.log(`Generated: ${outBranding}`);
  await page.close();
}

async function captureSet(
  browser: Browser,
  port: number,
  category: string,
  targetDir: string,
  viewport: { width: number; height: number },
  screens: Array<{ name: string; urlPath: string; waitSelector?: string; delay?: number }>
) {
  console.log(`\nCapturing ${category} screenshots (${viewport.width}x${viewport.height})...`);
  const page = await browser.newPage();
  await page.setViewportSize(viewport);

  for (const s of screens) {
    try {
      const fullUrl = `http://localhost:${port}${s.urlPath}`;
      console.log(`  [${category}] -> ${s.name}`);
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 20000 });
      if (s.waitSelector) {
        await page.waitForSelector(s.waitSelector, { timeout: 8000 }).catch(() => {});
      }
      await page.waitForTimeout(s.delay ?? 1500);
      const outPath = path.join(targetDir, s.name);
      await page.screenshot({ path: outPath });
    } catch (err) {
      console.warn(`  Failed capturing ${s.name}:`, err);
    }
  }

  await page.close();
}

async function main() {
  const port = 4193;
  console.log(`Starting preview server on port ${port}...`);
  const server = spawn('npm', ['run', 'preview', '--', '--port', String(port)], {
    cwd: rootDir,
    stdio: 'ignore'
  });

  await new Promise(res => setTimeout(res, 2000));

  const browser = await chromium.launch();
  try {
    // 1. Copy Logo, Splash & Icons into docs/store-assets/branding/
    await copyBrandingAssets();

    // 2. Generate Play Store Feature Graphic (1024x500)
    await generateFeatureGraphic(browser);

    // 3. Phone Screenshots (1080x1920)
    const phoneScreens = [
      { name: 'screenshot-1-home-atlas.png', urlPath: '/', waitSelector: 'h1' },
      { name: 'screenshot-2-route-trace.png', urlPath: '/trace/journey-paul-1', waitSelector: 'text=Paul' },
      { name: 'screenshot-3-timeline.png', urlPath: '/timeline', waitSelector: '#main' },
      { name: 'screenshot-4-bible-reader.png', urlPath: '/bible', waitSelector: '#main' },
      { name: 'screenshot-5-lesson-mode.png', urlPath: '/lessons/lesson-galilean-ministry', waitSelector: '#main' },
      { name: 'screenshot-6-quiz-mode.png', urlPath: '/quiz/quiz-foundations', waitSelector: '#main' },
      { name: 'screenshot-7-sandbox-atlas.png', urlPath: '/atlas', waitSelector: '#main' },
    ];
    await captureSet(browser, port, 'Phone', dirs.phone, { width: 1080, height: 1920 }, phoneScreens);

    // Also copy to root of store-assets for backwards compatibility
    for (const s of phoneScreens) {
      const src = path.join(dirs.phone, s.name);
      const dest = path.join(storeDir, s.name);
      if (fs.existsSync(src)) fs.copyFileSync(src, dest);
    }

    // 4. 7-inch Tablet Screenshots (1200x1920 portrait)
    const tablet7Screens = [
      { name: 'tablet-7-1-atlas.png', urlPath: '/atlas', waitSelector: '#main' },
      { name: 'tablet-7-2-route-trace.png', urlPath: '/trace/journey-paul-1', waitSelector: 'text=Paul' },
      { name: 'tablet-7-3-timeline.png', urlPath: '/timeline', waitSelector: '#main' },
      { name: 'tablet-7-4-bible.png', urlPath: '/bible', waitSelector: '#main' },
      { name: 'tablet-7-5-lesson.png', urlPath: '/lessons/lesson-galilean-ministry', waitSelector: '#main' },
    ];
    await captureSet(browser, port, '7-inch Tablet', dirs.tablet7, { width: 1200, height: 1920 }, tablet7Screens);

    // 5. 10-inch Tablet Screenshots (1920x1200 widescreen landscape)
    const tablet10Screens = [
      { name: 'tablet-10-1-atlas-widescreen.png', urlPath: '/atlas', waitSelector: '#main' },
      { name: 'tablet-10-2-route-trace.png', urlPath: '/trace/journey-paul-1', waitSelector: 'text=Paul' },
      { name: 'tablet-10-3-timeline-panoramic.png', urlPath: '/timeline', waitSelector: '#main' },
      { name: 'tablet-10-4-bible-reader.png', urlPath: '/bible', waitSelector: '#main' },
    ];
    await captureSet(browser, port, '10-inch Tablet', dirs.tablet10, { width: 1920, height: 1200 }, tablet10Screens);

    // 6. Chromebook / Desktop Screenshots (1920x1080 16:9 landscape)
    const chromebookScreens = [
      { name: 'chromebook-1-atlas.png', urlPath: '/atlas', waitSelector: '#main' },
      { name: 'chromebook-2-route-trace.png', urlPath: '/trace/journey-paul-1', waitSelector: 'text=Paul' },
      { name: 'chromebook-3-timeline.png', urlPath: '/timeline', waitSelector: '#main' },
      { name: 'chromebook-4-bible.png', urlPath: '/bible', waitSelector: '#main' },
    ];
    await captureSet(browser, port, 'Chromebook', dirs.chromebook, { width: 1920, height: 1080 }, chromebookScreens);

    console.log('\nAll multi-device Play Store assets generated successfully in docs/store-assets/!');
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch(err => {
  console.error('Store asset generation failed:', err);
  process.exit(1);
});
