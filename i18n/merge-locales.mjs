/**
 * Merge locales/{lang}/common.json + pages/*.json into locales/{lang}.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LANGS, ROUTES } from './config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

for (const lang of LANGS) {
  const dir = path.join(ROOT, 'locales', lang.code);
  const commonPath = path.join(dir, 'common.json');
  if (!fs.existsSync(commonPath)) {
    throw new Error(`Missing ${commonPath}`);
  }
  const common = loadJson(commonPath);
  const pages = {};
  let missing = [];
  for (const route of ROUTES) {
    const pageFile = path.join(dir, 'pages', `${route.id}.json`);
    if (!fs.existsSync(pageFile)) {
      missing.push(route.id);
      pages[route.id] = { meta: {}, phrases: {} };
      continue;
    }
    pages[route.id] = { meta: {}, phrases: loadJson(pageFile) };
  }
  if (missing.length) {
    console.warn(`[${lang.code}] missing page files: ${missing.join(', ')}`);
  }
  const out = {
    meta: { language: lang.code, ogLocale: lang.ogLocale },
    common,
    phrases: {},
    pages,
  };
  const outPath = path.join(ROOT, 'locales', `${lang.code}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}
