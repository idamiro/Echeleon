#!/usr/bin/env python3
"""Generate sitemap.xml from scripts/site_manifest.json (single source of truth)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = Path(__file__).resolve().parent / "site_manifest.json"
OUT = ROOT / "sitemap.xml"

XHTML = "http://www.w3.org/1999/xhtml"


def main() -> None:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    base = data["base"].rstrip("/")
    lastmod = data["lastmod"]
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
        f'        xmlns:xhtml="{XHTML}">',
    ]
    for entry in data["urls"]:
        loc = f"{base}{entry['path']}"
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append(f"    <changefreq>{entry['changefreq']}</changefreq>")
        lines.append(f"    <priority>{entry['priority']}</priority>")
        alternates = entry.get("alternates")
        if alternates:
            for alt in alternates:
                lines.append(
                    f'    <xhtml:link rel="alternate" hreflang="{alt["lang"]}" href="{base}{alt["path"]}"/>'
                )
        lines.append("  </url>")
    lines.append("</urlset>")
    lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT} ({len(data['urls'])} URLs)")


if __name__ == "__main__":
    main()
