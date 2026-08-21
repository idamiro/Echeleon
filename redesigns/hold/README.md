# HOLD

Purchase decision / cooling-off experiment by Vulcet.

**Scope (MVP):** product entry → assessment → independent scores → supporting signals vs concerns → recommendation → HOLD → countdown → revisit → final decision → dashboard/history.

Not in scope: AI, scraping, price tracking, social, gamification, native apps, browser extensions.

## Ruleset highlights (v1)

- **Category** (Clothing / Tech / Home / Hobby / Other) only soft-nudges Value via cost-per-use interpretation.
- **Need** weights ownership overlap, frequency, importance, and consideration time ahead of stated reason.
- Result shows **Why it makes sense** and **What gives us pause** (1–2 each), deterministically from inputs.
- **Confidence** (HIGH / MEDIUM / LOW) = signal consistency, not predictive certainty.
- No single overall purchase score — recommendation combines Utility, Need, Value, Impulse Risk, affordability, consideration, and contradictions.
- **Money not spent** increases only after explicit **Let it go**.
- Auth only when first creating/persisting a HOLD.
- **Hold again** keeps original assessment/scores + new wait; **Something changed** reassesses.
- Currency is a real ISO field with locale-based default.

## Develop

```bash
cd redesigns/hold
npm install
npm test
npm run dev
```

## Build (static site)

```bash
npm run build
```

Publishes `index.html` + `assets/` for Cloudflare at `/redesigns/hold/`.

Routing uses **HashRouter** (`/#/...`) so deep links work without `_redirects` (Workers rejects `/* → index.html` as an infinite loop).
