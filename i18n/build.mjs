/**
 * Build localized static pages for Vulcet.
 * English HTML remains the structural source. Locales live in /locales/{lang}.json.
 *
 * Usage: node i18n/build.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { load } from 'cheerio';
import {
  SITE, DEFAULT_LANG, LANGS, ROUTES,
  localePrefix, localizedPath, absoluteUrl, EXTERNAL_HOSTS,
} from './config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const GENERATED_MARKER = '<!-- vulcet-i18n:generated -->';

const ASSET_EXT = /\.(css|js|mjs|map|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|mp4|webm|json|webmanifest)(\?|$)/i;
const SITE_PATHS = new Set(ROUTES.map((r) => (r.path === '/404.html' ? '/404.html' : r.path)));

function readLocale(lang) {
  const file = path.join(ROOT, 'locales', `${lang}.json`);
  if (!fs.existsSync(file)) throw new Error(`Missing locale file: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function outputPath(lang, route) {
  if (route.path === '/404.html') {
    return lang === DEFAULT_LANG
      ? path.join(ROOT, '404.html')
      : path.join(ROOT, lang, '404.html');
  }
  if (route.path === '/') {
    return lang === DEFAULT_LANG
      ? path.join(ROOT, 'index.html')
      : path.join(ROOT, lang, 'index.html');
  }
  const rel = route.path.replace(/^\//, '').replace(/\/$/, '');
  return lang === DEFAULT_LANG
    ? path.join(ROOT, rel, 'index.html')
    : path.join(ROOT, lang, rel, 'index.html');
}

function resolveHref(pagePath, href) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
    return null;
  }
  try {
    if (/^https?:\/\//i.test(href)) {
      const u = new URL(href);
      if (u.hostname === 'vulcet.com' || u.hostname === 'www.vulcet.com') {
        return u.pathname.endsWith('/') || path.extname(u.pathname) ? u.pathname + u.search + u.hash : `${u.pathname}/${u.search}${u.hash}`;
      }
      return null;
    }
  } catch {
    return null;
  }
  if (href.startsWith('/')) {
    return href;
  }
  // Relative to current English page directory
  const base = pagePath === '/' ? '/' : pagePath;
  const baseDir = base.endsWith('/') ? base : base.replace(/\/[^/]+$/, '/');
  const abs = new URL(href, `https://vulcet.com${baseDir}`).pathname + (href.includes('?') ? '?' + href.split('?')[1].split('#')[0] : '') + (href.includes('#') ? '#' + href.split('#')[1] : '');
  return abs;
}

function isInternalPagePath(pathname) {
  if (!pathname) return false;
  const clean = pathname.split('?')[0].split('#')[0];
  if (ASSET_EXT.test(clean)) return false;
  if (clean === '/sitemap.xml' || clean === '/robots.txt' || clean === '/llms.txt') return false;
  // Strip existing locale prefix if present
  const stripped = clean.replace(/^\/(pl|de|fr|az)(?=\/|$)/, '') || '/';
  const normalized = stripped.endsWith('/') || path.extname(stripped) ? stripped : `${stripped}/`;
  if (SITE_PATHS.has(normalized) || SITE_PATHS.has(stripped)) return true;
  // Treat directory-like site paths as internal even if not in ROUTES (e.g. query variants)
  if (
    normalized.startsWith('/work/') ||
    normalized.startsWith('/services/') ||
    normalized.startsWith('/blog/') ||
    normalized.startsWith('/redesigns/') ||
    normalized === '/studio/' ||
    normalized === '/contact/' ||
    normalized === '/privacy/' ||
    normalized === '/site-map/' ||
    normalized === '/'
  ) return true;
  return false;
}

function stripLocale(pathname) {
  const [pathPart, ...rest] = pathname.split('?');
  const hashIdx = pathPart.indexOf('#');
  const pure = hashIdx >= 0 ? pathPart.slice(0, hashIdx) : pathPart;
  const hash = hashIdx >= 0 ? pathPart.slice(hashIdx) : '';
  const query = rest.length ? `?${rest.join('?')}` : '';
  const stripped = pure.replace(/^\/(pl|de|fr|az)(?=\/|$)/, '') || '/';
  const normalized = stripped === '/404.html' || path.extname(stripped)
    ? stripped
    : (stripped.endsWith('/') ? stripped : `${stripped}/`);
  return { path: normalized === '' ? '/' : normalized, query, hash };
}

function localizeInternalPath(lang, pathnameWithExtras) {
  const { path: p, query, hash } = stripLocale(pathnameWithExtras);
  if (p === '/404.html') return `${localizedPath(lang, '/404.html')}${query}${hash}`;
  return `${localizedPath(lang, p)}${query}${hash}`;
}

function assetUrl(pageLang, pagePath, href) {
  if (!href || href.startsWith('data:') || href.startsWith('blob:') || href.startsWith('#')) return href;
  if (/^https?:\/\//i.test(href) || href.startsWith('//')) return href;
  if (href.startsWith('/')) return href; // already root-absolute
  const resolved = resolveHref(pagePath, href);
  if (!resolved) return href;
  // Keep assets root-absolute so depth under /pl/... does not break
  if (ASSET_EXT.test(resolved.split('?')[0]) || resolved.startsWith('/blog/assets/') || resolved.includes('favicon') || resolved.includes('vulcet-') || resolved.includes('og-') || resolved.includes('founderclub') || resolved.includes('anadolu') || resolved.includes('service-')) {
    return resolved;
  }
  return href;
}

function buildPhraseMap(locale, pageId) {
  const map = new Map();
  const add = (obj) => {
    if (!obj) return;
    for (const [en, translated] of Object.entries(obj)) {
      if (typeof translated === 'string' && en) map.set(en, translated);
    }
  };
  add(locale.phrases);
  add(locale.common);
  if (locale.pages?.[pageId]?.phrases) add(locale.pages[pageId].phrases);
  return map;
}

function applyPhrases($, phraseMap) {
  if (!phraseMap.size) return;

  // Sort longest first for any HTML-level replacements
  const entries = [...phraseMap.entries()].sort((a, b) => b[0].length - a[0].length);

  const replaceExact = (value) => {
    if (value == null) return value;
    const trimmed = value.replace(/\s+/g, ' ').trim();
    if (phraseMap.has(trimmed)) return phraseMap.get(trimmed);
    if (phraseMap.has(value)) return phraseMap.get(value);
    return value;
  };

  // Meta / title
  $('title').each((_, el) => {
    const t = $(el).text();
    const next = replaceExact(t);
    if (next !== t) $(el).text(next);
  });
  $('meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[property="og:image:alt"], meta[name="twitter:title"], meta[name="twitter:description"], meta[name="twitter:image:alt"]').each((_, el) => {
    const c = $(el).attr('content');
    if (!c) return;
    const next = replaceExact(c);
    if (next !== c) $(el).attr('content', next);
  });

  // Attributes
  $('[alt], [aria-label], [placeholder], [title]').each((_, el) => {
    for (const attr of ['alt', 'aria-label', 'placeholder', 'title']) {
      const v = $(el).attr(attr);
      if (!v) continue;
      const next = replaceExact(v);
      if (next !== v) $(el).attr(attr, next);
    }
  });

  // Option labels
  $('option').each((_, el) => {
    const t = $(el).text();
    const next = replaceExact(t);
    if (next !== t) $(el).text(next);
  });

  // Text nodes — walk every content node (cheerio root type is "root", not "tag")
  const skipTags = new Set(['script', 'style', 'svg', 'path', 'noscript', 'code', 'pre']);
  $('*').each((_, el) => {
    if (skipTags.has(el.name)) return;
    const $el = $(el);
    const html = $el.html();
    if (html && /<[a-z]/i.test(html)) {
      const compact = html.replace(/\s+/g, ' ').trim();
      if (phraseMap.has(compact)) {
        $el.html(phraseMap.get(compact));
        return;
      }
    }
  });
  $('*').contents().each((_, node) => {
    if (node.type !== 'text') return;
    const parentName = node.parent?.name;
    if (parentName && skipTags.has(parentName)) return;
    const raw = node.data || '';
    const trimmed = raw.replace(/\s+/g, ' ').trim();
    if (!trimmed || !phraseMap.has(trimmed)) return;
    const leading = raw.match(/^\s*/)?.[0] || '';
    const trailing = raw.match(/\s*$/)?.[0] || '';
    node.data = `${leading}${phraseMap.get(trimmed)}${trailing}`;
  });

  // JSON-LD: replace string values that match phrases (not @id / urls / names that must stay)
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const transform = (value, key) => {
        if (typeof value === 'string') {
          if (key === '@id' || key === 'url' || key === 'item' || key === 'logo' || key === 'image' || key === 'email' || value.startsWith('http') || value.startsWith('https://vulcet.com')) {
            return value;
          }
          if (key === 'name' && value === 'Vulcet') return value;
          return replaceExact(value);
        }
        if (Array.isArray(value)) return value.map((v) => transform(v, key));
        if (value && typeof value === 'object') {
          const out = {};
          for (const [k, v] of Object.entries(value)) out[k] = transform(v, k);
          return out;
        }
        return value;
      };
      $(el).html(JSON.stringify(transform(data)));
    } catch {
      // leave as-is
    }
  });
}

function applyPageMeta($, locale, pageId, lang, route) {
  const page = locale.pages?.[pageId] || {};
  const meta = page.meta || {};
  const langMeta = LANGS.find((l) => l.code === lang);

  if (meta.title) $('title').text(meta.title);
  if (meta.description) $('meta[name="description"]').attr('content', meta.description);
  if (meta.ogTitle) $('meta[property="og:title"]').attr('content', meta.ogTitle);
  if (meta.ogDescription) $('meta[property="og:description"]').attr('content', meta.ogDescription);
  if (meta.twitterTitle) $('meta[name="twitter:title"]').attr('content', meta.twitterTitle);
  if (meta.twitterDescription) $('meta[name="twitter:description"]').attr('content', meta.twitterDescription);

  const canonical = absoluteUrl(lang, route.path === '/404.html' ? '/' : route.path);
  if (route.path !== '/404.html') {
    let link = $('link[rel="canonical"]');
    if (!link.length) {
      $('head').append(`<link rel="canonical" href="${canonical}">`);
      link = $('link[rel="canonical"]');
    }
    link.attr('href', canonical);
    $('meta[property="og:url"]').attr('content', canonical);
  }

  $('meta[property="og:locale"]').remove();
  $('head').append(`<meta property="og:locale" content="${langMeta.ogLocale}">`);
  for (const other of LANGS) {
    if (other.code === lang) continue;
    $('head').append(`<meta property="og:locale:alternate" content="${other.ogLocale}">`);
  }

  // inLanguage in JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      const setLang = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) return obj.forEach(setLang);
        if ('inLanguage' in obj) obj.inLanguage = lang;
        if (obj['@type'] === 'WebSite' || (Array.isArray(obj['@type']) && obj['@type'].includes('WebSite'))) {
          obj.inLanguage = lang;
        }
        for (const v of Object.values(obj)) setLang(v);
      };
      setLang(data);
      // Update absolute vulcet URLs inside JSON-LD to localized where they point to pages
      const fixUrls = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) return obj.forEach(fixUrls);
        for (const [k, v] of Object.entries(obj)) {
          if (typeof v === 'string' && v.startsWith('https://vulcet.com/')) {
            try {
              const u = new URL(v);
              if (isInternalPagePath(u.pathname)) {
                obj[k] = absoluteUrl(lang, stripLocale(u.pathname).path);
              }
            } catch { /* ignore */ }
          } else if (v && typeof v === 'object') fixUrls(v);
        }
      };
      if (!route.noindex) fixUrls(data);
      // availableLanguage on contact point
      const enrich = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) return obj.forEach(enrich);
        if (obj.contactPoint && typeof obj.contactPoint === 'object') {
          obj.contactPoint.availableLanguage = LANGS.map((l) => l.name);
        }
        for (const v of Object.values(obj)) enrich(v);
      };
      enrich(data);
      $(el).html(JSON.stringify(data));
    } catch { /* ignore */ }
  });
}

function injectHreflang($, route) {
  $('link[rel="alternate"][hreflang]').remove();
  if (route.noindex || route.path === '/404.html') return;
  const tags = LANGS.map((l) => `<link rel="alternate" hreflang="${l.hreflang}" href="${absoluteUrl(l.code, route.path)}">`);
  tags.push(`<link rel="alternate" hreflang="x-default" href="${absoluteUrl(DEFAULT_LANG, route.path)}">`);
  const canonical = $('link[rel="canonical"]');
  if (canonical.length) canonical.after(tags.join(''));
  else $('head').append(tags.join(''));
}

function langSwitcherHtml(lang, route, locale) {
  const label = locale.common?.['Language'] || locale.phrases?.['Language'] || 'Language';
  const links = LANGS.map((l) => {
    const href = localizedPath(l.code, route.path === '/404.html' ? '/' : route.path);
    const current = l.code === lang;
    return `<a href="${href}" lang="${l.code}" hreflang="${l.hreflang}"${current ? ' aria-current="page" class="is-active"' : ''} data-lang="${l.code}">${l.label}</a>`;
  }).join('');
  return `<nav class="lang-switch" aria-label="${label}">${links}</nav>`;
}

function injectLangSwitcher($, lang, route, locale) {
  $('.lang-switch').remove();
  const html = langSwitcherHtml(lang, route, locale);
  const label = locale.common?.['Language'] || 'Language';
  const mobileHtml = `<div class="lang-switch lang-switch--mobile" aria-label="${label}">${LANGS.map((l) => {
    const href = localizedPath(l.code, route.path === '/404.html' ? '/' : route.path);
    const current = l.code === lang;
    return `<a href="${href}" lang="${l.code}" hreflang="${l.hreflang}"${current ? ' aria-current="page" class="is-active"' : ''} data-lang="${l.code}">${l.label}</a>`;
  }).join('')}</div>`;

  // Desktop header: before CTA
  const cta = $('.header-grid > .header-cta').first();
  if (cta.length) cta.before(html);
  else if ($('.header-grid').length) $('.header-grid').append(html);

  // Mobile nav
  const mobileNav = $('#mobile-nav nav').first();
  if (mobileNav.length) mobileNav.after(mobileHtml);

  // Fallback for pages without the standard header (HOLD shell, 404, etc.)
  if (!$('.lang-switch').length) {
    if ($('header').length) $('header').first().append(html);
    else $('body').prepend(`<div class="shell" style="padding:16px 0">${html}</div>`);
  }
}

function rewriteLinks($, lang, route) {
  const pagePath = route.path === '/404.html' ? '/' : route.path;

  $('a[href], area[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
    if (href.startsWith('#')) return;

    // External non-vulcet
    if (/^https?:\/\//i.test(href)) {
      try {
        const u = new URL(href);
        if (EXTERNAL_HOSTS.has(u.hostname)) return;
        if (u.hostname !== 'vulcet.com' && u.hostname !== 'www.vulcet.com') return;
        const next = localizeInternalPath(lang, u.pathname + u.search + u.hash);
        $(el).attr('href', next);
      } catch { /* ignore */ }
      return;
    }

    const resolved = resolveHref(pagePath, href);
    if (!resolved) return;

    const pathOnly = resolved.split('?')[0].split('#')[0];
    if (ASSET_EXT.test(pathOnly)) {
      $(el).attr('href', pathOnly.startsWith('/') ? resolved : assetUrl(lang, pagePath, href));
      return;
    }

    if (isInternalPagePath(pathOnly) || pathOnly === '/404.html') {
      $(el).attr('href', localizeInternalPath(lang, resolved));
      return;
    }

    // Relative asset-like or unknown — make root absolute when possible
    if (!href.startsWith('/')) {
      const abs = resolveHref(pagePath, href);
      if (abs && ASSET_EXT.test(abs.split('?')[0])) $(el).attr('href', abs);
    }
  });

  // Assets: link, script, img, source, use
  $('link[href], script[src], img[src], source[src], video[src], audio[src], use[href]').each((_, el) => {
    const attr = $(el).attr('href') != null ? 'href' : 'src';
    const val = $(el).attr(attr);
    if (!val || /^https?:\/\//i.test(val) || val.startsWith('data:') || val.startsWith('#')) return;
    const resolved = resolveHref(pagePath, val);
    if (resolved) $(el).attr(attr, resolved);
  });

  // srcset
  $('[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset');
    if (!srcset) return;
    const next = srcset.split(',').map((part) => {
      const bits = part.trim().split(/\s+/);
      const url = bits[0];
      if (!url || /^https?:\/\//i.test(url) || url.startsWith('/')) return part.trim();
      const resolved = resolveHref(pagePath, url);
      if (!resolved) return part.trim();
      bits[0] = resolved;
      return bits.join(' ');
    }).join(', ');
    $(el).attr('srcset', next);
  });
}

function injectRuntimeI18n($, locale, lang) {
  $('script[data-vulcet-i18n]').remove();
  const payload = {
    lang,
    openMenu: locale.common?.['Open menu'] || 'Open menu',
    closeMenu: locale.common?.['Close menu'] || 'Close menu',
    consent: {
      eyebrow: locale.common?.['Privacy choice'] || 'Privacy choice',
      title: locale.common?.['Help improve the website?'] || 'Help improve the website?',
      body: locale.common?.consentBody || 'Vulcet uses Google Analytics only with your permission. Necessary site functions remain available either way. Read the <a href="__PRIVACY__">privacy notice</a>.',
      decline: locale.common?.['Decline analytics'] || 'Decline analytics',
      allow: locale.common?.['Allow analytics'] || 'Allow analytics',
      privacyLabel: locale.common?.['privacy notice'] || 'privacy notice',
    },
    contact: locale.pages?.contact?.runtime || null,
  };
  $('head').append(`<script data-vulcet-i18n>window.__VULCET_I18N__=${JSON.stringify(payload)};</script>`);
}

function setDocumentLang($, lang, route) {
  const prefix = localePrefix(lang);
  $('html').attr('lang', lang);
  $('html').attr('data-lang', lang);
  $('html').attr('data-root', prefix ? `${prefix}/` : '/');
}

function localizePage(lang, route, locales, sourceHtml) {
  if (!sourceHtml) {
    console.warn('skip missing', route.source);
    return;
  }
  const $ = load(sourceHtml, { decodeEntities: false });
  const locale = locales[lang];
  const phraseMap = buildPhraseMap(locale, route.id);

  setDocumentLang($, lang, route);
  applyPageMeta($, locale, route.id, lang, route);
  injectHreflang($, route);

  if (!route.chromeOnly) {
    applyPhrases($, phraseMap);
  } else {
    applyPhrases($, buildPhraseMap({ common: locale.common, phrases: locale.phrases, pages: {} }, route.id));
  }

  rewriteLinks($, lang, route);
  injectLangSwitcher($, lang, route, locale);
  injectRuntimeI18n($, locale, lang);

  if (route.noindex) {
    if (!$('meta[name="robots"]').length) $('head').append('<meta name="robots" content="noindex">');
  }

  let out = $.html();
  if (!out.includes(GENERATED_MARKER) && lang !== DEFAULT_LANG) {
    out = out.replace(/<head>/i, `<head>\n  ${GENERATED_MARKER}`);
  }

  const dest = outputPath(lang, route);
  ensureDir(dest);
  fs.writeFileSync(dest, out);
}

function buildSitemap(locales) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const urls = ROUTES.filter((r) => !r.noindex && r.priority);
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;
  for (const route of urls) {
    for (const lang of LANGS) {
      const loc = absoluteUrl(lang.code, route.path);
      xml += `  <url>\n`;
      xml += `    <loc>${loc}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
      xml += `    <priority>${route.priority}</priority>\n`;
      for (const alt of LANGS) {
        xml += `    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${absoluteUrl(alt.code, route.path)}"/>\n`;
      }
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${absoluteUrl(DEFAULT_LANG, route.path)}"/>\n`;
      xml += `  </url>\n`;
    }
  }
  xml += `</urlset>\n`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
}

function cleanGeneratedLocales() {
  for (const lang of ['pl', 'de', 'fr', 'az']) {
    const dir = path.join(ROOT, lang);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  const locales = {};
  for (const lang of LANGS) locales[lang.code] = readLocale(lang.code);

  // Snapshot English sources before any writes so EN patching cannot poison other langs
  const sources = new Map();
  for (const route of ROUTES) {
    const sourcePath = path.join(ROOT, route.source);
    if (!fs.existsSync(sourcePath)) {
      console.warn('skip missing', route.source);
      continue;
    }
    let html = fs.readFileSync(sourcePath, 'utf8');
    // Strip any previous generated i18n injections if re-running on patched EN files
    html = html
      .replace(/\s*<!-- vulcet-i18n:generated -->\s*/g, '\n')
      .replace(/<link rel="alternate" hreflang="[^"]*" href="[^"]*">/g, '')
      .replace(/<meta property="og:locale:alternate"[^>]*>/g, '')
      .replace(/<script data-vulcet-i18n>[\s\S]*?<\/script>/g, '')
      .replace(/<nav class="lang-switch"[\s\S]*?<\/nav>/g, '')
      .replace(/<div class="lang-switch lang-switch--mobile"[\s\S]*?<\/div>/g, '');
    sources.set(route.id, html);
  }

  cleanGeneratedLocales();

  for (const route of ROUTES) {
    const sourceHtml = sources.get(route.id);
    if (!sourceHtml) continue;
    for (const lang of LANGS) {
      localizePage(lang.code, route, locales, sourceHtml);
    }
  }

  buildSitemap(locales);
  console.log(`Built ${ROUTES.length} routes × ${LANGS.length} languages`);
  console.log('Updated sitemap.xml with hreflang annotations');
}

main();
