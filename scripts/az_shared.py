"""Shared HTML helpers for generated Azerbaijani commercial pages."""
from __future__ import annotations

import html
import json
from typing import Iterable

SITE = "https://vulcet.com"
AZ_PREFIX = "/az"
SCRIPT_VER = "20260823-visible"
CONSENT_VER = "20260724-18"
FAVICON_VER = "20260821-mark4"
WORDMARK_VER = "20260809-2"

FOOTER_TAGLINE = "Brendlər, rəqəmsal məhsullar və veb-saytlar üçün strategiya, dizayn və proqramlaşdırma."
FOOTER_INTERNATIONAL = "Beynəlxalq layihələrlə işləyirik"
CTA_START = "Layihəyə başlayaq"

NAV = (
    ("work", "İşlər", f"{AZ_PREFIX}/work/"),
    ("experiments", "Eksperimentlər", "/redesigns/"),
    ("services", "Xidmətlər", f"{AZ_PREFIX}/services/"),
    ("studio", "Studiya", f"{AZ_PREFIX}/studio/"),
    ("blog", "Bloq", "/blog/"),
    ("contact", "Əlaqə", f"{AZ_PREFIX}/contact/"),
)

SERVICE_LINKS = (
    ("brand-strategy", "Brend strategiyası"),
    ("visual-identity", "Vizual kimlik"),
    ("product-design", "Məhsul dizaynı"),
    ("web-development", "Veb proqramlaşdırma"),
)

# az_path (no trailing slash except root) -> en_path
EN_EQUIVALENTS: dict[str, str] = {
    "": "/",
    "404": "/404.html",
    "services": "/services/",
    "services/brand-strategy": "/services/brand-strategy/",
    "services/visual-identity": "/services/visual-identity/",
    "services/product-design": "/services/product-design/",
    "services/web-development": "/services/web-development/",
    "studio": "/studio/",
    "work": "/work/",
    "work/founderclub": "/work/founderclub/",
    "work/anadolu-qida": "/work/anadolu-qida/",
    "contact": "/contact/",
    "privacy": "/privacy/",
    "site-map": "/site-map/",
}

FOOTER_SOCIAL = """
<ul class="footer-social"><li><a href="https://www.instagram.com/thevulcet/" target="_blank" rel="noreferrer noopener" aria-label="Vulcet Instagram-da"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5.2"></rect><circle cx="12" cy="12" r="4.2"></circle><circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none"></circle></svg></a></li><li><a href="https://x.com/thevulcet" target="_blank" rel="noreferrer noopener" aria-label="Vulcet X-də"><svg class="is-solid" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M17.53 3h3.2l-6.99 7.99L22 21h-6.44l-5.04-6.59L4.75 21H1.54l7.48-8.55L2 3h6.6l4.56 6.03L17.53 3Zm-1.12 16.06h1.77L7.68 4.84H5.78l10.63 14.22Z"></path></svg></a></li><li><a href="https://dribbble.com/thevulcet" target="_blank" rel="noreferrer noopener" aria-label="Vulcet Dribbble-da"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"></circle><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"></path></svg></a></li><li><a href="https://www.linkedin.com/company/vulcet/" target="_blank" rel="noreferrer noopener" aria-label="Vulcet LinkedIn-də"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4V8h4v1.4A6 6 0 0 1 16 8Z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg></a></li></ul>
"""


def az_canonical(az_path: str) -> str:
    if not az_path:
        return f"{SITE}/az/"
    if az_path == "404":
        return f"{SITE}/az/404.html"
    return f"{SITE}/az/{az_path}/"


def en_href(az_path: str) -> str:
    en_path = EN_EQUIVALENTS.get(az_path, "/")
    if en_path == "/404.html":
        return f"{SITE}/404.html"
    if en_path.endswith("/") and en_path != "/":
        return f"{SITE}{en_path}"
    if en_path == "/":
        return f"{SITE}/"
    return f"{SITE}{en_path}"


def dump_schema(obj: dict | list) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def _nav_link(key: str, label: str, href: str, current: str | None) -> str:
    current_attr = ' aria-current="page"' if current == key else ""
    return f'<a href="{href}"{current_attr}>{label}</a>'


def render_lang_switch(az_path: str) -> str:
    en = en_href(az_path)
    az = az_canonical(az_path)
    return (
        f'<nav class="lang-switch" aria-label="Dil">'
        f'<a class="lang-switch__link" href="{en}" lang="en" hreflang="en">EN</a>'
        f'<span class="lang-switch__sep" aria-hidden="true">/</span>'
        f'<a class="lang-switch__link is-active" href="{az}" lang="az" hreflang="az" aria-current="page">AZ</a>'
        f"</nav>"
    )


def render_header(
    *,
    az_path: str,
    nav_current: str | None = None,
    cta_href: str | None = None,
    cta_arrow: str = "↗",
    wordmark_href: str | None = None,
    mobile_cta: bool = True,
) -> str:
    cta_href = cta_href or f"{AZ_PREFIX}/contact/"
    wordmark_href = wordmark_href or (f"{AZ_PREFIX}/" if az_path else f"{AZ_PREFIX}/#top")
    if az_path == "":
        wordmark_href = "#top"
    desktop_nav = "".join(_nav_link(k, label, href, nav_current) for k, label, href in NAV)
    mobile_nav = desktop_nav
    lang = render_lang_switch(az_path)
    mobile_cta_html = (
        f'<a class="button button--primary" href="{cta_href}">{CTA_START} <span aria-hidden="true">{cta_arrow}</span></a>'
        if mobile_cta
        else ""
    )
    return f"""<header class="site-header">
    <div class="shell header-grid">
      <a class="wordmark" href="{wordmark_href}" aria-label="Vulcet — ana səhifə"><img src="/vulcet-wordmark.png?v={WORDMARK_VER}" alt="Vulcet"></a>
      <nav class="desktop-nav" aria-label="Əsas naviqasiya">{desktop_nav}</nav>
      {lang}
      <a class="button button--primary header-cta" href="{cta_href}">{CTA_START} <span aria-hidden="true">{cta_arrow}</span></a>
      <button class="menu-trigger" type="button" aria-expanded="false" aria-controls="mobile-nav"><span class="sr-only">Menyunu aç</span><span class="menu-icon" aria-hidden="true"><i></i><i></i></span></button>
    </div>
    <div id="mobile-nav" class="mobile-nav" aria-hidden="true" inert="">
      <nav aria-label="Mobil naviqasiya">{mobile_nav}</nav>
      <div class="lang-switch lang-switch--mobile" aria-label="Dil"><a class="lang-switch__link" href="{en_href(az_path)}" lang="en" hreflang="en">EN</a><span class="lang-switch__sep" aria-hidden="true">/</span><a class="lang-switch__link is-active" href="{az_canonical(az_path)}" lang="az" hreflang="az" aria-current="page">AZ</a></div>
      {mobile_cta_html}
    </div>
  </header>"""


def render_footer(
    *,
    az_path: str,
    nav_current: str | None = None,
    home_href: str = f"{AZ_PREFIX}/",
    home_current: bool = False,
    service_current: str | None = None,
    more_current: str | None = None,
    utility_line2: str = "Strategiya, dizayn və proqramlaşdırma — birbaşa prosesdə.",
    utility_line3: str = FOOTER_INTERNATIONAL,
) -> str:
    navigate = [f'<a href="{home_href}"{" aria-current=\"page\"" if home_current else ""}>Ana səhifə</a>']
    for key, label, href in NAV:
        cur = ' aria-current="page"' if nav_current == key else ""
        navigate.append(f'<a href="{href}"{cur}>{label}</a>')
    services = []
    for slug, label in SERVICE_LINKS:
        cur = ' aria-current="page"' if service_current == slug else ""
        services.append(f'<a href="{AZ_PREFIX}/services/{slug}/"{cur}>{label}</a>')
    privacy_cur = ' aria-current="page"' if more_current == "privacy" else ""
    sitemap_cur = ' aria-current="page"' if more_current == "site-map" else ""
    return f"""<footer class="footer">
    <div class="footer-signal" aria-hidden="true"><span></span><b></b></div>
    <div class="shell footer-grid">
      <div class="footer-brand"><a class="wordmark" href="{home_href}" aria-label="Vulcet — ana səhifə"><img src="/vulcet-wordmark.png?v={WORDMARK_VER}" alt="Vulcet"></a><p>{FOOTER_TAGLINE}</p>{FOOTER_SOCIAL}</div>
      <nav class="footer-nav" aria-label="Alt naviqasiya"><div><span>Naviqasiya</span>{"".join(navigate)}</div><div><span>Xidmətlər</span>{"".join(services)}</div><div><span>Digər</span><a href="{AZ_PREFIX}/privacy/"{privacy_cur}>Məxfilik</a><a href="{AZ_PREFIX}/site-map/"{sitemap_cur}>Sayt xəritəsi</a><button class="footer-cookie-link" type="button" data-cookie-settings="">Kuki ayarları</button></div></nav>
      <div class="footer-contact"><span>Əlaqə</span><a href="mailto:studio@vulcet.com">studio@vulcet.com</a><p>{FOOTER_INTERNATIONAL}</p></div>
      <div class="footer-utility"><small>© <span id="year"></span> Vulcet</small><small>{utility_line2}</small><small>{utility_line3}</small></div>
    </div>
  </footer>"""


def render_head(
    *,
    az_path: str,
    title: str,
    description: str,
    og_title: str | None = None,
    og_description: str | None = None,
    og_type: str = "website",
    og_image: str = f"{SITE}/og-vulcet.png",
    og_image_alt: str | None = None,
    twitter_title: str | None = None,
    twitter_description: str | None = None,
    robots: str = "index,follow",
    theme_color: str = "#f2eee6",
    extra_stylesheets: Iterable[str] = (),
    extra_scripts: Iterable[str] = (),
    schema: dict | list | None = None,
    include_gtag: bool = True,
    style_css: str = "20260824-hero",
) -> str:
    canonical = az_canonical(az_path)
    en = en_href(az_path)
    og_title = og_title or title
    og_description = og_description or description
    twitter_title = twitter_title or og_title
    twitter_description = twitter_description or og_description
    styles = [
        f"/style.css?v={style_css}",
        "/lang-switcher.css",
        "/consent.css?v=20260807-1",
        *extra_stylesheets,
    ]
    style_tags = "".join(f'\n  <link rel="stylesheet" href="{href}">' for href in styles)
    script_tags = "".join(
        f'\n  <script src="{src}" defer=""></script>'
        for src in (
            f"/script.js?v={SCRIPT_VER}",
            f"/consent.js?v={CONSENT_VER}",
            *extra_scripts,
        )
    )
    gtag = ""
    if include_gtag:
        gtag = """
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500
    });
    gtag('js', new Date());
    gtag('config', 'G-BD641SSN63', { anonymize_ip: true });
  </script>
  <script async="" src="https://www.googletagmanager.com/gtag/js?id=G-BD641SSN63"></script>"""
    schema_tag = ""
    if schema is not None:
        schema_tag = f'\n  <script type="application/ld+json">{dump_schema(schema)}</script>'
    og_image_alt_tag = ""
    if og_image_alt:
        og_image_alt_tag = f'\n  <meta property="og:image:alt" content="{html.escape(og_image_alt, quote=True)}">'
    return f"""<!DOCTYPE html><html lang="az" data-root="/az/"><head>
  <meta charset="utf-8"><meta name="robots" content="{robots}">
  <meta name="viewport" content="width=device-width, initial-scale=1">{gtag}
  <meta name="description" content="{html.escape(description, quote=True)}">
  <link rel="canonical" href="{canonical}">
  <link rel="alternate" hreflang="en" href="{en}">
  <link rel="alternate" hreflang="az" href="{canonical}">
  <link rel="alternate" hreflang="x-default" href="{en}">
  <meta property="og:title" content="{html.escape(og_title, quote=True)}">
  <meta property="og:description" content="{html.escape(og_description, quote=True)}">
  <meta property="og:type" content="{og_type}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:site_name" content="Vulcet">
  <meta property="og:locale" content="az_AZ">
  <meta property="og:locale:alternate" content="en_US">
  <meta property="og:image" content="{og_image}">{og_image_alt_tag}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{html.escape(twitter_title, quote=True)}">
  <meta name="twitter:description" content="{html.escape(twitter_description, quote=True)}">
  <meta name="twitter:image" content="{og_image}">
  <meta name="theme-color" content="{theme_color}">
  <title>{html.escape(title, quote=False)}</title>
  <link rel="icon" href="/favicon.ico?v={FAVICON_VER}" sizes="any"><link rel="icon" href="/favicon-48.png?v={FAVICON_VER}" type="image/png" sizes="48x48"><link rel="icon" href="/favicon.svg?v={FAVICON_VER}" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png?v={FAVICON_VER}"><link rel="manifest" href="/site.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&amp;family=Inter:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">{style_tags}{script_tags}{schema_tag}
</head>"""


def render_page(
    *,
    az_path: str,
    head: str,
    body_class: str = "",
    header: str,
    main: str,
    footer: str,
) -> str:
    cls = f' class="{body_class}"' if body_class else ""
    return f"""{head}
<body{cls}>
  <a class="skip-link" href="#main">Məzmuna keç</a>
  {header}
  {main}
  {footer}


</body></html>"""
