import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({
  executablePath: '/opt/google/chrome/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({
  viewport: { width: 512, height: 512 },
  deviceScaleFactor: 1,
});
await page.goto('file://' + path.join(__dirname, 'render.html'), { waitUntil: 'networkidle' });
await page.waitForTimeout(200);
await page.locator('#i').screenshot({
  path: path.join(__dirname, 'master-512.png'),
  omitBackground: true,
  type: 'png',
});
await browser.close();
console.log('master-512.png');
