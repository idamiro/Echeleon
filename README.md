# Echeleon → Vulcet.com

Static site for **[Vulcet](https://vulcet.com)** (repo name: Echeleon).

## Layout

```
├── index.html                 Site home
├── style.css / script.js      Global site CSS & JS
├── blog.css / editorial.css   Section styles
├── consent.*                  Cookie consent
├── 404.html / robots.txt / sitemap.xml / llms.txt
├── favicon.* / apple-touch-icon.png / site.webmanifest
├── _redirects                 Legacy media URL → new paths
├── .assetsignore              Keep non-site folders off the CDN
│
├── assets/brand/              Live wordmark + Open Graph images
│
├── work/<case>/media/         Case-study photography
├── services/  studio/  contact/  privacy/  site-map/
├── blog/                      Articles + blog/assets covers
├── redesigns/                 Case Studio, Nike, PlayStation, etc.
│
├── brand/                     Brand kit source (not deployed)
├── social/                    Social post artwork (not deployed)
├── linkedin-posts/            LinkedIn drafts (not deployed)
└── drafts/                    Unpublished writing (not deployed)
```

## Conventions

- Favicons stay at the **site root**.
- Case images live in `work/<slug>/media/` next to the page.
- Live brand rasters live in `assets/brand/`.
- `brand/`, `social/`, `linkedin-posts/`, and `drafts/` are source/work folders — excluded from Cloudflare Pages via `.assetsignore`.

## Local

```bash
npx serve .
```

## Deploy

Cloudflare Pages tracks the production branch configured in the dashboard
(currently `cursor/vulcet-wordmark-refresh-af87` for vulcet.com).
