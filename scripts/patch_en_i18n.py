#!/usr/bin/env python3
"""Patch English HTML pages with language switcher, hreflang, and og:locale:alternate."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://vulcet.com"

# EN path (relative to ROOT, no leading slash) -> AZ URL path
AZ_EQUIVALENTS: dict[str, str] = {
    "index.html": "/az/",
    "services/index.html": "/az/services/",
    "services/brand-strategy/index.html": "/az/services/brand-strategy/",
    "services/visual-identity/index.html": "/az/services/visual-identity/",
    "services/product-design/index.html": "/az/services/product-design/",
    "services/web-development/index.html": "/az/services/web-development/",
    "studio/index.html": "/az/studio/",
    "work/index.html": "/az/work/",
    "work/founderclub/index.html": "/az/work/founderclub/",
    "work/anadolu-qida/index.html": "/az/work/anadolu-qida/",
    "contact/index.html": "/az/contact/",
    "privacy/index.html": "/az/privacy/",
    "site-map/index.html": "/az/site-map/",
}

PAGES = [
    ROOT / "index.html",
    ROOT / "services/index.html",
    ROOT / "services/brand-strategy/index.html",
    ROOT / "services/visual-identity/index.html",
    ROOT / "services/product-design/index.html",
    ROOT / "services/web-development/index.html",
    ROOT / "studio/index.html",
    ROOT / "work/index.html",
    ROOT / "work/founderclub/index.html",
    ROOT / "work/anadolu-qida/index.html",
    ROOT / "contact/index.html",
    ROOT / "privacy/index.html",
    ROOT / "site-map/index.html",
    ROOT / "blog/index.html",
    ROOT / "blog/human-check-captcha-alternative/index.html",
    ROOT / "blog/your-brand-isnt-outdated-your-system-is/index.html",
    ROOT / "blog/what-is-product-design/index.html",
    ROOT / "blog/why-most-saas-websites-look-the-same/index.html",
    ROOT / "blog/why-ai-products-look-the-same/index.html",
    ROOT / "blog/what-redesign-experiments-teach/index.html",
    ROOT / "blog/business-website-vs-growth-website/index.html",
    ROOT / "blog/when-a-business-website-needs-a-redesign/index.html",
    ROOT / "redesigns/index.html",
    ROOT / "redesigns/kinetic-clarity/index.html",
    ROOT / "redesigns/nike/index.html",
    ROOT / "redesigns/playstation/index.html",
    ROOT / "redesigns/case-studio/index.html",
    ROOT / "redesigns/hold/index.html",
    ROOT / "experiments/human-check/index.html",
]

LANG_SWITCHER_CSS = '<link rel="stylesheet" href="/lang-switcher.css">'


def rel_key(path: Path) -> str:
    return str(path.relative_to(ROOT)).replace("\\", "/")


def en_canonical(html: str) -> str | None:
    match = re.search(r'<link rel="canonical" href="([^"]+)">', html)
    return match.group(1) if match else None


def render_switcher(en_url: str, az_url: str) -> str:
    return (
        f'<nav class="lang-switch" aria-label="Language">'
        f'<a class="lang-switch__link is-active" href="{en_url}" lang="en" hreflang="en" aria-current="page">EN</a>'
        f'<span class="lang-switch__sep" aria-hidden="true">/</span>'
        f'<a class="lang-switch__link" href="{az_url}" lang="az" hreflang="az">AZ</a>'
        f"</nav>"
    )


def render_mobile_switcher(en_url: str, az_url: str) -> str:
    return (
        f'<div class="lang-switch lang-switch--mobile" aria-label="Language">'
        f'<a class="lang-switch__link is-active" href="{en_url}" lang="en" hreflang="en" aria-current="page">EN</a>'
        f'<span class="lang-switch__sep" aria-hidden="true">/</span>'
        f'<a class="lang-switch__link" href="{az_url}" lang="az" hreflang="az">AZ</a>'
        f"</div>"
    )


def patch_html(path: Path) -> bool:
    html = path.read_text(encoding="utf-8")
    original = html
    key = rel_key(path)
    canonical = en_canonical(html)
    if not canonical:
        print(f"  skip (no canonical): {key}")
        return False

    az_path = AZ_EQUIVALENTS.get(key, "/az/")
    az_url = f"{SITE}{az_path}"
    en_url = canonical

    if 'href="/lang-switcher.css"' not in html:
        html = html.replace(
            '<link rel="stylesheet" href="/consent.css?v=20260807-1">',
            '<link rel="stylesheet" href="/consent.css?v=20260807-1">\n  ' + LANG_SWITCHER_CSS,
            1,
        )

    if key in AZ_EQUIVALENTS and 'hreflang="az"' not in html:
        hreflang = (
            f'  <link rel="alternate" hreflang="en" href="{en_url}">\n'
            f'  <link rel="alternate" hreflang="az" href="{az_url}">\n'
            f'  <link rel="alternate" hreflang="x-default" href="{en_url}">'
        )
        html = html.replace(
            f'  <link rel="canonical" href="{canonical}">',
            f'  <link rel="canonical" href="{canonical}">\n{hreflang}',
            1,
        )

    if key in AZ_EQUIVALENTS and 'og:locale:alternate' not in html:
        html = html.replace(
            '<meta property="og:locale" content="en_US">',
            '<meta property="og:locale" content="en_US">\n  <meta property="og:locale:alternate" content="az_AZ">',
            1,
        )

    switcher = render_switcher(en_url, az_url)
    if 'class="lang-switch"' not in html:
        html = html.replace(
            '</nav>\n      <a class="button button--primary header-cta"',
            f'</nav>\n      {switcher}\n      <a class="button button--primary header-cta"',
            1,
        )
        html = html.replace(
            '</nav><a class="button button--primary header-cta"',
            f'</nav>{switcher}<a class="button button--primary header-cta"',
            1,
        )

    mobile_switcher = render_mobile_switcher(en_url, az_url)
    if 'lang-switch--mobile' not in html:
        html = html.replace(
            '</nav>\n      <a class="button button--primary" href="/contact/">Start a project',
            f'</nav>\n      {mobile_switcher}\n      <a class="button button--primary" href="/contact/">Start a project',
            1,
        )
        html = html.replace(
            '</nav><a class="button button--primary" href="/contact/">Start a project',
            f'</nav>{mobile_switcher}<a class="button button--primary" href="/contact/">Start a project',
            1,
        )

    if key == "index.html" and '"availableLanguage":["English"]' in html:
        html = html.replace(
            '"availableLanguage":["English"]',
            '"availableLanguage":["English","Azərbaycan"]',
        )

    if html != original:
        path.write_text(html, encoding="utf-8")
        return True
    return False


def main() -> None:
    patched = 0
    for path in PAGES:
        if not path.exists():
            print(f"missing: {path.relative_to(ROOT)}")
            continue
        if patch_html(path):
            patched += 1
            print(f"patched: {path.relative_to(ROOT)}")
        else:
            print(f"unchanged: {path.relative_to(ROOT)}")
    print(f"\nPatched {patched} pages")


if __name__ == "__main__":
    main()
