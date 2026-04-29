import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const concepts = [
  {
    name: 'concept-A',
    html: join(__dirname, 'concept-A', 'mockup.html'),
    screens: join(__dirname, 'concept-A', 'screens'),
    clips: [
      { file: 'screen-01-mockup.png', y: 0 },
      { file: 'screen-02-mockup.png', y: 700 },
      { file: 'screen-03-mockup.png', y: 1400 },
      { file: 'screen-04-mockup.png', y: 2200 },
      { file: 'screen-05-mockup.png', y: 3000 },
    ],
  },
  {
    name: 'concept-B',
    html: join(__dirname, 'concept-B', 'mockup.html'),
    screens: join(__dirname, 'concept-B', 'screens'),
    clips: [
      { file: 'screen-01-mockup.png', y: 0 },
      { file: 'screen-02-mockup.png', y: 700 },
      { file: 'screen-03-mockup.png', y: 1500 },
      { file: 'screen-05-mockup.png', y: 2300 },
    ],
  },
  {
    name: 'concept-C',
    html: join(__dirname, 'concept-C', 'mockup.html'),
    screens: join(__dirname, 'concept-C', 'screens'),
    clips: [
      { file: 'screen-01-mockup.png', y: 0 },
      { file: 'screen-02-mockup.png', y: 750 },
      { file: 'screen-03-mockup.png', y: 1450 },
      { file: 'screen-04-mockup.png', y: 1900 },
      { file: 'screen-05-mockup.png', y: 2700 },
    ],
  },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 1,
});

for (const concept of concepts) {
  console.log(`\n→ ${concept.name}`);
  if (!existsSync(concept.screens)) mkdirSync(concept.screens, { recursive: true });

  const page = await context.newPage();
  const fileUrl = pathToFileURL(concept.html).href;

  try {
    await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(500);

    // Full page screenshot
    const fullPath = join(__dirname, concept.name, 'mockup-full.png');
    await page.screenshot({ path: fullPath, fullPage: true });
    console.log(`  ✓ full page → ${concept.name}/mockup-full.png`);

    // Per-screen clips from offsets
    for (const clip of concept.clips) {
      const outPath = join(concept.screens, clip.file);
      await page.screenshot({
        path: outPath,
        clip: { x: 0, y: clip.y, width: 1280, height: 860 },
      });
      console.log(`  ✓ ${clip.file}`);
    }
  } catch (err) {
    console.log(`  ✗ error: ${err.message}`);
  }
  await page.close();
}

await browser.close();
console.log('\n=== Done ===');
