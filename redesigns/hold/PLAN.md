# HOLD — approved MVP plan (implementation locked)

## Flow

Product entry → Assessment → Scores → Why it makes sense / What gives us pause → Recommendation (+ confidence) → HOLD → Countdown → Revisit → Final decision → Dashboard/history

## Locked decisions

1. **Category** input: Clothing / Tech / Home / Hobby / Other — only soft Value/CPU nudge; no category-specific buy advice.
2. **Need** driven mainly by overlap, frequency, importance, consideration time; stated reason is a small tilt.
3. Result sections: **WHY IT MAKES SENSE** and **WHAT GIVES US PAUSE** (1–2 each), deterministic from assessment inputs.
4. **Confidence** HIGH/MEDIUM/LOW = consistency of user signals (contradictions lower it), not predictive certainty.
5. **No** collapsed overall purchase score — Utility, Need, Value, Impulse Risk, affordability, consideration, contradictions stay independent; recommendation is combinatorial.
6. **Money not spent** only after explicit Let it go (not expired/ignored holds).
7. **Auth** only when first creating/persisting a HOLD; full assess → result is anonymous.
8. **Hold again** default: keep original assessment/scores + new wait; secondary **Something changed** → reassess.
9. **Currency**: proper ISO field; locale-based default (not hardcoded to EUR/USD/GBP only).
10. **Out of scope**: AI, scraping deps, price tracking, social, gamification, native apps, browser extensions.

## Technical notes

- Ruleset id: `v1` under `src/scoring/`
- Persistence: IndexedDB (`idb`) + local auth gate for holds
- Static Vite SPA published to `/redesigns/hold/`
