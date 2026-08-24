/** Multilingual config for the static Vulcet site. English has no /en/ prefix. */

export const SITE = 'https://vulcet.com';
export const DEFAULT_LANG = 'en';

export const LANGS = [
  { code: 'en', hreflang: 'en', ogLocale: 'en_US', dir: 'ltr', label: 'EN', name: 'English' },
  { code: 'pl', hreflang: 'pl', ogLocale: 'pl_PL', dir: 'ltr', label: 'PL', name: 'Polski' },
  { code: 'de', hreflang: 'de', ogLocale: 'de_DE', dir: 'ltr', label: 'DE', name: 'Deutsch' },
  { code: 'fr', hreflang: 'fr', ogLocale: 'fr_FR', dir: 'ltr', label: 'FR', name: 'Français' },
  { code: 'az', hreflang: 'az', ogLocale: 'az_AZ', dir: 'ltr', label: 'AZ', name: 'Azərbaycan' },
];

/** Indexable public routes mirrored under /{lang}/ (except EN at root). */
export const ROUTES = [
  { id: 'home', path: '/', source: 'index.html', priority: '1.0', changefreq: 'weekly' },
  { id: 'work', path: '/work/', source: 'work/index.html', priority: '0.9', changefreq: 'weekly' },
  { id: 'founderclub', path: '/work/founderclub/', source: 'work/founderclub/index.html', priority: '0.8', changefreq: 'monthly' },
  { id: 'anadolu-qida', path: '/work/anadolu-qida/', source: 'work/anadolu-qida/index.html', priority: '0.8', changefreq: 'monthly' },
  { id: 'experiments', path: '/redesigns/', source: 'redesigns/index.html', priority: '0.8', changefreq: 'weekly' },
  { id: 'kinetic-clarity', path: '/redesigns/kinetic-clarity/', source: 'redesigns/kinetic-clarity/index.html', priority: '0.8', changefreq: 'monthly' },
  { id: 'nike', path: '/redesigns/nike/', source: 'redesigns/nike/index.html', priority: '0.8', changefreq: 'monthly' },
  { id: 'playstation', path: '/redesigns/playstation/', source: 'redesigns/playstation/index.html', priority: '0.8', changefreq: 'monthly' },
  { id: 'case-studio', path: '/redesigns/case-studio/', source: 'redesigns/case-studio/index.html', priority: '0.8', changefreq: 'monthly' },
  { id: 'hold', path: '/redesigns/hold/', source: 'redesigns/hold/index.html', priority: '0.7', changefreq: 'monthly', chromeOnly: true },
  { id: 'services', path: '/services/', source: 'services/index.html', priority: '0.9', changefreq: 'weekly' },
  { id: 'brand-strategy', path: '/services/business-websites/', source: 'services/business-websites/index.html', priority: '0.8', changefreq: 'monthly' },
  { id: 'visual-identity', path: '/services/growth-websites/', source: 'services/growth-websites/index.html', priority: '0.8', changefreq: 'monthly' },
  { id: 'product-design', path: '/services/custom-digital-products/', source: 'services/custom-digital-products/index.html', priority: '0.7', changefreq: 'monthly' },
  { id: 'web-development', path: '/services/website-care/', source: 'services/website-care/index.html', priority: '0.7', changefreq: 'monthly' },
  { id: 'studio', path: '/studio/', source: 'studio/index.html', priority: '0.7', changefreq: 'monthly' },
  { id: 'blog', path: '/blog/', source: 'blog/index.html', priority: '0.8', changefreq: 'weekly' },
  { id: 'blog-system', path: '/blog/your-brand-isnt-outdated-your-system-is/', source: 'blog/your-brand-isnt-outdated-your-system-is/index.html', priority: '0.8', changefreq: 'monthly' },
  { id: 'blog-business-vs-growth', path: '/blog/business-website-vs-growth-website/', source: 'blog/business-website-vs-growth-website/index.html', priority: '0.8', changefreq: 'monthly' },
  { id: 'blog-redesign', path: '/blog/when-a-business-website-needs-a-redesign/', source: 'blog/when-a-business-website-needs-a-redesign/index.html', priority: '0.8', changefreq: 'monthly' },
  { id: 'contact', path: '/contact/', source: 'contact/index.html', priority: '0.8', changefreq: 'monthly' },
  { id: 'privacy', path: '/privacy/', source: 'privacy/index.html', priority: '0.3', changefreq: 'yearly' },
  { id: 'site-map', path: '/site-map/', source: 'site-map/index.html', priority: '0.4', changefreq: 'monthly' },
  { id: 'not-found', path: '/404.html', source: '404.html', priority: null, changefreq: null, noindex: true },
];

/** Paths that should not receive a locale prefix (external or assets). */
export const EXTERNAL_HOSTS = new Set([
  'founderclub.az',
  'anadoluqida.com',
  'www.instagram.com',
  'x.com',
  'dribbble.com',
  'www.linkedin.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.googletagmanager.com',
  'api.web3forms.com',
]);

export function localePrefix(lang) {
  return lang === DEFAULT_LANG ? '' : `/${lang}`;
}

export function localizedPath(lang, path) {
  if (path === '/404.html') {
    return lang === DEFAULT_LANG ? '/404.html' : `${localePrefix(lang)}/404.html`;
  }
  const clean = path.endsWith('/') || path === '/' ? path : `${path}/`;
  return `${localePrefix(lang)}${clean === '/' ? '/' : clean}`;
}

export function absoluteUrl(lang, path) {
  const p = localizedPath(lang, path);
  return `${SITE}${p === '/' ? '/' : p}`;
}
