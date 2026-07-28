# FantasyIQ — Current Status

**Last updated:** 2026-07-28
**HEAD:** `1b04523` on `origin/main`
**Repo:** https://github.com/giffyshani-jpg/FantasyIQ

## Running

| Workflow | Status | Port |
|---|---|---|
| HoopIQ | ✅ Running | 21534 |

**Correct workflow:** `HoopIQ` (`PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev`).
Do **not** start `artifacts/hoopiq: web` — it conflicts on port 21534.

## What Works

- Home page — 3-sport hub (Basketball / Cricket / Football)
- Basketball page — NBA + WNBA with **Recent / Today / Tomorrow** tabs
  - Recent tab: backward search finds latest day with completed games
- Cricket schedule — day tabs, competition groups, live badges
- Football page — infrastructure only, no fantasy logic
- All individual league pages (NBA, WNBA, NBL, NZNBL, FIBA, NBA Summer)
- Box score, optimizer, play-by-play, player comparison, player detail

## TypeScript

Clean — `tsc --noEmit` exits 0.

## Known Issues / Limitations

- `hoopiq-repo/` directory exists at workspace root — accidental duplicate; doesn't affect the app. Can be cleaned with `git rm -r hoopiq-repo/`.
- Cricket live scores: TSDB free tier only returns NS/FT — no in-progress scores. Games show "Starting" until TSDB confirms FT.
- Football fantasy logic not implemented.

## Basketball Tab Details

Tabs: Recent (0) · Today (1) · Tomorrow (2)

Recent tab `findRecentDate()` walks backwards up to 30 days, stops at first day with a `status === "final"` game. Uses AbortController so tab switches cancel the in-flight search.
