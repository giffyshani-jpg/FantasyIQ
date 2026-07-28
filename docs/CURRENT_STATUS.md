# FantasyIQ — Current Status

**Last updated:** 2026-07-28
**HEAD:** `9e8f22d` on `origin/main`
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
- Cricket schedule — **Recent / Today / Tomorrow** tabs (Day After removed)
  - Recent tab: backward search finds latest date in `recentCompleted` with matches
- Cricket box score → back button navigates to `/cricket` (fixed 404)
- Cricket optimizer → back-nav label is now "Match Details" (was "Box Score")
- Football page — infrastructure only, no fantasy logic
- All individual league pages (NBA, WNBA, NBL, NZNBL, FIBA, NBA Summer)
- Box score, optimizer, play-by-play, player comparison, player detail

## TypeScript

Clean — `tsc --noEmit` exits 0.

## Known Issues / Limitations

- `hoopiq-repo/` directory exists at workspace root — accidental duplicate; doesn't affect the app. Can be cleaned with `git rm -r hoopiq-repo/`.
- Cricket live scores: TSDB free tier only returns NS/FT — no in-progress scores. Games show "Starting" until TSDB confirms FT.
- Football fantasy logic not implemented.

## Cricket Tab Details

Tabs: Recent (0) · Today (1) · Tomorrow (2)

Recent tab logic (inline in `cricket-schedule.tsx`):
- Scans `overview.recentCompleted` (all completed games from provider)
- Finds the single most-recent date among those games
- Shows ALL games from that date
- If today has completed matches they naturally become the most-recent date
- No separate API calls needed — data comes from the existing overview fetch

## Basketball Tab Details

Tabs: Recent (0) · Today (1) · Tomorrow (2)

Recent tab `findRecentDate()` walks backwards up to 30 days, stops at first day with a `status === "final"` game. Uses AbortController so tab switches cancel the in-flight search.
