# FantasyIQ — Current Status

**Last updated:** 2026-07-28
**HEAD:** commit pending push (doc consolidation session)
**Repo:** https://github.com/giffyshani-jpg/FantasyIQ

## Running

| Workflow | Status | Port |
|---|---|---|
| HoopIQ | ✅ Running | 21534 |

**Correct workflow:** `HoopIQ` (`PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev`).
Do **not** start `artifacts/hoopiq: web` — it conflicts on port 21534.

## What Works

- Home page — 3-sport hub (Cricket / Basketball / Football)
- Basketball page — NBA + WNBA with **Recent / Today / Tomorrow** tabs
  - Recent tab: backward search (`findRecentDate`) finds latest day with completed games
- Cricket schedule — **Recent / Today / Tomorrow** tabs
  - Recent tab: backward search on `recentCompleted` for latest completed-match date
- Cricket box score → back button navigates to `/cricket` (fixed 404)
- Cricket optimizer → back-nav label is "Match Details"
- Football page — infrastructure only, no fantasy logic
- All individual league pages (NBA, WNBA, NBL, NZNBL, FIBA, NBA Summer)
- Box score, optimizer, play-by-play, player comparison, player detail
- AI Fantasy Coach (12 named picks with data-backed explanations)

## TypeScript

Clean — `tsc --noEmit` exits 0 (verified July 28, 2026).

## Documentation

**`docs/` is the ONLY documentation location.** Do not create docs elsewhere.

| File | Purpose |
|------|---------|
| `docs/AI_HANDOFF.md` | Full handoff: routing, file map, key invariants, TheSportsDB league IDs |
| `docs/CURRENT_STATUS.md` | This file — live state |
| `docs/CHANGELOG.md` | All commits across all sessions |
| `docs/KNOWN_ISSUES.md` | Bug tracker with IDs (Cricket-001, Basketball-001, Optimizer-001 …) |
| `docs/PROJECT_CONTEXT.md` | Architecture, stack, caching, coding standards |
| `docs/ROADMAP.md` | Completed, near-term, and medium-term planned work |
| `docs/TECHNICAL_NOTES.md` | ESPN slugs, gamelog API, pregame arch, provider chain, cricket scoring |

Previously duplicate locations (`artifacts/hoopiq/docs/`, `hoopiq-repo/`) have been deleted.

## Known Issues / Limitations

- Cricket live scores: TSDB free tier only returns NS/FT — games show "Starting" until TSDB confirms FT
- Football fantasy logic not implemented
- Provider manager (`provider-manager.ts`) implemented but not yet wired to live providers
- See `docs/KNOWN_ISSUES.md` for full tracking (Cricket-001..003, Basketball-001..006, Optimizer-001..006)

## Cricket Tab Details

Tabs: Recent (0) · Today (1) · Tomorrow (2)

Recent tab logic (inline in `cricket-schedule.tsx`):
- Scans `overview.recentCompleted` — no extra API calls
- Finds single most-recent date among all completed games
- Shows ALL games from that date

## Basketball Tab Details

Tabs: Recent (0) · Today (1) · Tomorrow (2)

`findRecentDate()` walks backwards up to 30 days, stops at first day with a `status === "final"` game. Uses AbortController so tab switches cancel the in-flight search.
