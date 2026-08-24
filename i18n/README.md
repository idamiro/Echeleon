# Vulcet i18n

Static multilingual build for EN (root), PL, DE, FR, AZ.

## Commands

```bash
npm run i18n:build   # regenerate /pl /de /fr /az + patch EN + sitemap
npm test             # verify localized files, hreflang, lang switcher
```

## Layout

- `locales/{lang}.json` — merged common + per-page phrases (source of translations)
- `locales/{lang}/pages/*.json` — editable per-page phrase maps (English key → translation)
- `i18n/build.mjs` — clones English HTML, applies phrases, rewrites links, injects hreflang + language switcher
- English stays at `/`; other languages at `/{lang}/...`

Re-run `npm run i18n:build` after editing English HTML or locale JSON files.
