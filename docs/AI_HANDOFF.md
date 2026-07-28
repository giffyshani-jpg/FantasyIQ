# FantasyIQ — AI Handoff

## Latest Session Summary

Bug-fix session (commit `9e8f22d`). Five tasks completed:
1. Removed Day After tab from Cricket
2. Fixed Recent logic for Cricket (backward search matching Basketball)
3. Fixed Cricket Optimizer header — "Box Score" → "Match Details"
4. Fixed broken navigation — `/cricket/:competition` back-link produced 404; now links to `/cricket`
5. Verified TypeScript clean; push confirmed to origin/main

Previous: Basketball "Recent" tab implemented (commit `1b04523`).
Before that: 13 tasks — full rebrand, home screen, basketball hub, cricket schedule, provider system, timezone fix, cricket enhancements, format-aware stats, football infrastructure, UI polish, documentation.

## Architecture (as of this session)

### Routing
```
/              → Home (3 sport hub cards)
/basketball    → BasketballPage (NBA + WNBA sub-sections)
/cricket       → CricketSchedule (Recent / Today / Tomorrow tabs)
/football      → FootballPage (coming soon, infrastructure ready)
/:league       → LeagueGames (nba, wnba, nbl, nznbl, fiba, nba-summer)
/:league/game/:id              → BoxScore
/:league/game/:id/optimizer    → FantasyOptimizer
/:league/game/:id/plays        → PlayByPlay
/:league/game/:id/compare      → PlayerComparison
/:league/player/:playerId      → PlayerDetail
/cricket/:competition/game/:id             → CricketBoxScore
/cricket/:competition/game/:id/optimizer   → CricketOptimizer
```

NOTE: `/cricket/:competition` (competition-level page) intentionally has no route — LeagueGames
expects a `league` param. CricketBoxScore back-nav now correctly links to `/cricket`.

### Key Invariants
- `safeCall()` in api.js wraps EVERY provider call — never remove
- UI never imports from providers directly — only from `src/api.js`
- `LINEUP_SIZE = 8`, `MAX_SAME_TEAM = 4` (basketball optimizer)
- `mapTsdbStatus()` NEVER infers live from time — only from TSDB strStatus
- Never mix cricket format groups (T20/ODI/Test/T10) in stats
- The Hundred is T20 group for stat purposes
- Football is infrastructure only — no fantasy logic yet

### Dev Commands
- Typecheck: `pnpm --filter @workspace/hoopiq run typecheck`
- Dev server: via workflow `HoopIQ` (PORT=21534 BASE_PATH=/)
- Push: requires GITHUB_TOKEN secret — `git push origin main` from repo root

## Cricket Tab System (as of this session)

Tabs are now: **Recent (0) · Today (1) · Tomorrow (2)**

**Recent tab logic** (inline in `cricket-schedule.tsx`, both in `DayGames` and `recentCount`):
- Reads `overview.recentCompleted` (already fetched — no extra API calls)
- Finds the single most-recent `startTimeIso` date among all completed games
- Shows ALL games from that date
- If today has completed matches, today is the most-recent date and shows
- Badge count uses the same logic

**Important:** Cricket Recent does NOT walk backwards via API calls (no per-date cricket API exists).
It derives the most-recent date purely from the `recentCompleted` array in the existing overview.
Basketball Recent (`findRecentDate`) does walk backwards via API calls — different implementation,
same user-visible behaviour.

**Live indicator** and count badge wired to Today (tab index 1) only.

**Empty-state message** for Recent: "No completed matches found".

## Basketball Tab System

Tabs: **Recent (0) · Today (1) · Tomorrow (2)**

`findRecentDate` in `basketball.tsx` walks backwards (offset 0, -1, … -30), fetches NBA+WNBA in
parallel per date, stops at first date with a `status === "final"` game, returns ALL games from that
date. Uses AbortController — switching tabs cancels the in-flight search.

## Files Modified This Session

- `artifacts/hoopiq/src/pages/cricket-schedule.tsx`
  — DAY_LABELS: removed "Day After" (now 3 tabs)
  — counts/hasLive arrays trimmed to 3 entries
  — Recent logic: scans recentCompleted for most-recent date
  — recentCount badge: same algorithm
  — Empty-state copy updated

- `artifacts/hoopiq/src/pages/cricket-optimizer.tsx`
  — Back-nav label: "Box Score" → "Match Details"

- `artifacts/hoopiq/src/pages/cricket-box-score.tsx`
  — Back-nav link: `/cricket/${competition}` (404) → `/cricket`
  — Back-nav label: competition name → "Cricket"

## What the Next Session Should Know

### Cricket data limitation
TheSportsDB free tier has no live scores — status is "NS"/"FT" only.
Live cricket games will show as "Starting" (not LIVE) until TSDB confirms FT.
To get real live cricket scores, integrate CricAPI or Cricbuzz (auth required).

### Football is infrastructure only
`/football` shows competition list and coming-soon banner.
`providers/football.js` has `getLeagueOverview()` and `getGamesByDate()` wired to TheSportsDB Soccer.
Fantasy logic is NOT implemented. Next step: wire live data, then build lineup optimizer.

### Provider manager is available but not yet wired into providers
`src/lib/provider-manager.ts` exports `createProviderManager()`.
Currently unused — the existing single-ESPN provider chain is still active.
To adopt: wrap any multi-provider sport with `createProviderManager([provider1, provider2])`.

### Format filter is available for use
`src/lib/format-filter.ts` is implemented and ready.
Not yet called from the cricket optimizer UI — integrate when adding Recent Form panel.

## Next Suggested Tasks
1. Live cricket score provider (CricAPI free tier — 100 req/day)
2. Playing XI confirmation UI on cricket match page
3. Player recent form panel using `computeRollingStats()` from format-filter.ts
4. Football live scores via TheSportsDB
5. Captain/VC recommendation algorithm for cricket
