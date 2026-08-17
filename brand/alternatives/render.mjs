import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({
  executablePath: '/opt/google/chrome/chrome',
  args: ['--no-sandbox','--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 150 }, deviceScaleFactor: 3 });
await page.goto('file://' + path.join(__dirname, 'render-a.html'), { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.locator('#a').screenshot({ path: path.join(__dirname, 'A-raw.png') });
await browser.close();
console.log('A-raw.png');
