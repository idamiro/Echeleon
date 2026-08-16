import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'carousel.html');
const url = `file://${htmlPath}`;

const slides = [
  ['slide-1', '01-clearer-home.png'],
  ['slide-2', '02-anadolu-qida.png'],
  ['slide-3', '03-what-we-built.png'],
  ['slide-4', '04-live-site.png'],
];

const browser = await chromium.launch({
  executablePath: '/opt/google/chrome/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage({
  viewport: { width: 1080, height: 1350 },
  deviceScaleFactor: 2,
});

await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all(
    [...document.images].map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve, reject) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', () => reject(new Error(img.src)), { once: true });
      });
    })
  );
});
await page.waitForTimeout(800);

for (const [id, file] of slides) {
  const el = await page.$(`#${id}`);
  if (!el) throw new Error(`Missing #${id}`);
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await el.screenshot({ path: path.join(__dirname, file), type: 'png' });
  console.log('wrote', file);
}

await browser.close();
console.log('done');
