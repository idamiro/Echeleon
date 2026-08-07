import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, 'carousel.html');
const outDir = __dirname;
const url = `file://${htmlPath}`;

async function chromeShot(slideId, outFile) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    `--screenshot=${outFile}`,
    `--window-size=1080,1350`,
    `--virtual-time-budget=5000`,
    `${url}#${slideId}`,
  ];

  // Use CDP via a short Node puppeteer-less approach: chrome --screenshot captures full page.
  // We need element screenshots; use DevTools Protocol via chrome --remote-debugging-port.
  return args;
}

async function withChrome(fn) {
  const port = 9222;
  const chrome = spawn('/opt/google/chrome/chrome', [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  await waitFor(() => fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.ok).catch(() => false), 15000);

  try {
    await fn(port);
  } finally {
    chrome.kill('SIGTERM');
  }
}

async function waitFor(check, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await check()) return;
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('Chrome CDP not ready');
}

async function cdp(wsUrl, method, params = {}) {
  const { default: WebSocket } = await import('ws');
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();

    ws.on('open', () => {
      const send = (m, p = {}) => new Promise((res, rej) => {
        const msgId = ++id;
        pending.set(msgId, { res, rej });
        ws.send(JSON.stringify({ id: msgId, method: m, params: p }));
      });

      (async () => {
        try {
          const result = await method(send);
          ws.close();
          resolve(result);
        } catch (e) {
          ws.close();
          reject(e);
        }
      })();
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
      }
    });

    ws.on('error', reject);
  });
}

const slides = [
  ['slide-1', 'vulcet-carousel-01-cover.png'],
  ['slide-2', 'vulcet-carousel-02-the-gap.png'],
  ['slide-3', 'vulcet-carousel-03-what-we-do.png'],
  ['slide-4', 'vulcet-carousel-04-how-we-work.png'],
  ['slide-5', 'vulcet-carousel-05-close.png'],
];

await mkdir(outDir, { recursive: true });

// Prefer playwright-core if available; else CDP
let used = 'cdp';
try {
  const { chromium } = await import('playwright-core');
  used = 'playwright';
  const browser = await chromium.launch({
    executablePath: '/opt/google/chrome/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1350 },
    deviceScaleFactor: 2,
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  // wait for fonts
  await page.evaluate(async () => { await document.fonts.ready; });
  await new Promise(r => setTimeout(r, 400));

  for (const [id, file] of slides) {
    const el = await page.$(`#${id}`);
    if (!el) throw new Error(`Missing #${id}`);
    await el.scrollIntoViewIfNeeded();
    await el.screenshot({ path: path.join(outDir, file), type: 'png' });
    console.log('wrote', file);
  }
  await browser.close();
} catch (err) {
  console.log('playwright unavailable, using CDP:', err.message);
  // Install ws if needed
  try { await import('ws'); } catch {
    await new Promise((res, rej) => {
      const p = spawn('npm', ['install', 'ws', '--no-save'], { cwd: outDir, stdio: 'inherit' });
      p.on('exit', code => code === 0 ? res() : rej(new Error('npm install ws failed')));
    });
  }

  await withChrome(async (port) => {
    const targets = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`).then(r => r.json());
    const wsUrl = targets.webSocketDebuggerUrl;
    await cdp(wsUrl, async (send) => {
      await send('Page.enable');
      await send('Runtime.enable');
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1080,
        height: 1350,
        deviceScaleFactor: 2,
        mobile: false,
      });
      await send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, 2000));
      await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });

      for (const [id, file] of slides) {
        const { result } = await send('Runtime.evaluate', {
          expression: `(() => {
            const el = document.getElementById('${id}');
            el.scrollIntoView();
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height };
          })()`,
          returnByValue: true,
        });
        const box = result.value;
        const shot = await send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true,
          clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale: 1 },
        });
        await writeFile(path.join(outDir, file), Buffer.from(shot.data, 'base64'));
        console.log('wrote', file);
      }
    });
  });
}

console.log('done via', used);
