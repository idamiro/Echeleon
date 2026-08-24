import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LANGS, ROUTES, DEFAULT_LANG, localizedPath } from './config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let errors = 0;
function fail(msg) { console.error('FAIL', msg); errors++; }
function ok(msg) { console.log('OK', msg); }

for (const lang of LANGS) {
  const localePath = path.join(ROOT, 'locales', `${lang.code}.json`);
  if (!fs.existsSync(localePath)) fail(`missing locale ${lang.code}`);
  else ok(`locale ${lang.code}`);
}

for (const route of ROUTES) {
  for (const lang of LANGS) {
    const rel = localizedPath(lang.code, route.path);
    const file = route.path === '/404.html'
      ? (lang.code === DEFAULT_LANG ? '404.html' : path.join(lang.code, '404.html'))
      : (lang.code === DEFAULT_LANG
          ? (route.path === '/' ? 'index.html' : path.join(route.path.replace(/^\//,'').replace(/\/$/,''), 'index.html'))
          : path.join(lang.code, route.path === '/' ? 'index.html' : path.join(route.path.replace(/^\//,'').replace(/\/$/,''), 'index.html')));
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) fail(`missing ${file}`);
    else {
      const html = fs.readFileSync(full, 'utf8');
      if (!html.includes(`lang="${lang.code}"`)) fail(`${file} missing lang=${lang.code}`);
      if (route.path !== '/404.html' && !html.includes('hreflang="x-default"')) fail(`${file} missing hreflang`);
      if (!html.includes('lang-switch')) fail(`${file} missing lang-switch`);
    }
  }
}

const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
if (!sm.includes('xmlns:xhtml')) fail('sitemap missing xhtml');
if (!sm.includes('/pl/')) fail('sitemap missing /pl/');
else ok('sitemap multilingual');

if (errors) { console.error(`\n${errors} failures`); process.exit(1); }
console.log('\nAll checks passed');
