const { chromium } = require('playwright');
const { existsSync, mkdirSync } = require('fs');
const path = require('path');

const screenshotsDir = 'C:/CODE/Paperclip-MSPRO-org/departments/website/posts/designer/vault/references/calculator-2026-04/screenshots';
if (!existsSync(screenshotsDir)) mkdirSync(screenshotsDir, { recursive: true });

const sites = [
  { file: '01-stripe-pricing.png',        url: 'https://stripe.com/pricing' },
  { file: '02-linear-pricing.png',         url: 'https://linear.app/pricing' },
  { file: '03-vercel-pricing.png',         url: 'https://vercel.com/pricing' },
  { file: '04-posthog-pricing.png',        url: 'https://posthog.com/pricing' },
  { file: '05-aircall-pricing.png',        url: 'https://aircall.io/pricing' },
  { file: '06-coda-pricing.png',           url: 'https://coda.io/pricing' },
  { file: '07-chemcentre-calculator.png',  url: 'https://chemcentre.ru/kalkulyator-ognezashhity/' },
  { file: '08-germoizol-calculator.png',   url: 'https://germoizol.ru/kalkulyator/', skipIfAuth: true },
  { file: '09-metallozaschita-site.png',   url: 'https://metallozaschita.ru/antikorroziynaya-zashita-metallokonstrukciy/' },
  { file: '10-actat-calculator.png',       url: 'https://actat.ru/calculator' },
];

async function run() {
  const results = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  for (const site of sites) {
    const outPath = path.join(screenshotsDir, site.file);
    console.log(`→ ${site.file}`);
    const page = await context.newPage();
    try {
      const resp = await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const status = resp ? resp.status() : 0;

      if (site.skipIfAuth && (status === 401 || status === 403)) {
        console.log(`  ⚠ skip (HTTP ${status})`);
        results.push({ file: site.file, status: `skip-auth-${status}` });
        await page.close();
        continue;
      }

      await page.waitForTimeout(2500);
      await page.screenshot({ path: outPath, fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 900 } });
      console.log(`  ✓ saved`);
      results.push({ file: site.file, status: 'ok' });
    } catch (err) {
      console.log(`  ✗ ${err.message.slice(0, 80)}`);
      results.push({ file: site.file, status: `error` });
    }
    await page.close();
  }

  await browser.close();

  console.log('\n=== Results ===');
  for (const r of results) {
    console.log(`${r.status === 'ok' ? '✓' : '○'} ${r.file}: ${r.status}`);
  }
  return results;
}

run().catch(e => { console.error(e); process.exit(1); });
