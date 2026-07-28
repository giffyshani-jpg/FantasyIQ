# FantasyIQ — Current Status

**Last updated:** 2026-07-28
**HEAD:** cda7e85 (verified clean — doc consolidation session)
**Repo:** https://github.com/giffyshani-jpg/FantasyIQ

## Running

| Workflow | Status | Port |
|---|---|---|
| HoopIQ | ✅ Running | 3000 (dev) |

**Correct command:** `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev`

**Build command:** `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/hoopiq run build`

Note: `PORT` and `BASE_PATH` are **required** for both dev and build — vite.config.ts enforces this.

## What Works

- Home page — 3-sport hub (Cricket / Basketball / Football)
- Basketball page — NBA + WNBA with **Recent / Today / Tomorrow** tabs (no Day After)
  - Recent tab: `findRecentDate()` walks backwards up to 30 days, stops at first day with `status === "final"` game
- Cricket schedule — **Recent / Today / Tomorrow** tabs (no Day After)
  - Recent tab: scans `overview.recentCompleted`, finds single most-recent date, shows ALL games from that date
- Cricket box score → back button navigates to `/cricket` ✅ (no 404)
- Cricket optimizer → back-nav label "Match Details" → returns to cricket box score ✅
- Football page — infrastructure only, no fantasy logic
- All individual league pages (NBA, WNBA, NBL, NZNBL, FIBA, NBA Summer)
- Box score, optimizer, play-by-play, player comparison, player detail
- AI Fantasy Coach (12 named picks with data-backed explanations)

## Verification Session (2026-07-28)

Full smoke-test session confirmed no regressions:

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | ✅ Clean — 0 errors |
| Build (`PORT=3000 BASE_PATH=/ vite build`) | ✅ Success (chunk-size warning only, not an error) |
| Basketball tabs | ✅ Recent / Today / Tomorrow — no Day After |
| Cricket tabs | ✅ Recent / Today / Tomorrow — no Day After |
| Cricket Recent logic | ✅ `recentCompleted` backward scan confirmed |
| Basketball Recent logic | ✅ `findRecentDate()` 30-day walk confirmed |
| Cricket box score back-nav | ✅ `<Link href="/cricket">` at line 344 |
| Cricket optimizer back-nav | ✅ Returns to cricket box score |
| App serving | ✅ All routes return HTTP 200 |
| HEAD matches origin/main | ✅ cda7e85 |

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
