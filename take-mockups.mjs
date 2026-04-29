import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

const BASE = 'C:/CODE/MSProLtd-MSPRO-org/departments/website/posts/designer/vault/concepts/calculator-2026-04';

const concepts = [
  { name: 'concept-A' },
  { name: 'concept-B' },
  { name: 'concept-C' },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });

for (const c of concepts) {
  const htmlPath = join(BASE, c.name, 'mockup.html');
  const outDir = join(BASE, c.name);
  console.log(`\n→ ${c.name}`);
  const page = await context.newPage();
  try {
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(800);
    const fullPath = join(outDir, 'mockup-full.png');
    await page.screenshot({ path: fullPath, fullPage: true });
    console.log(`  ✓ saved mockup-full.png`);
  } catch(e) { console.log(`  ✗ ${e.message}`); }
  await page.close();
}
await browser.close();
console.log('\nDone.');
