# FantasyIQ — AI Handoff

## Latest Session Summary

Basketball page "Recent" tab implemented (commit `1b04523`).
Previous: 13 tasks completed — full rebrand, home screen, basketball hub, cricket schedule, provider system, timezone fix, cricket enhancements, format-aware stats, football infrastructure, UI polish, documentation.

## Architecture (as of this session)

### Routing
```
/              → Home (3 sport hub cards)
/basketball    → BasketballPage (NBA + WNBA sub-sections)
/cricket       → CricketSchedule (TODAY/TOMORROW/DAY AFTER tabs)
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
- All pushes to GitHub main via git remote with GITHUB_TOKEN secret

## Basketball Tab System (as of this session)

Tabs are now: **Recent (0) · Today (1) · Tomorrow (2)**

**Recent tab logic** (`findRecentDate` in basketball.tsx):
- Walks backwards from today (offset 0, -1, -2 … -30)
- For each date fetches NBA + WNBA games in parallel
- Stops at the first date that has at least one `status === "final"` game
- Shows ALL games from that date (not just completed ones)
- Falls back to empty lists if no completed game found in 30 days
- Uses AbortController — switching tabs cancels the in-flight search

**Live indicator** and count badge are now correctly wired to Today (tab index 1), not Recent.

**Empty-state messages** are tab-aware: "No recent completed NBA games" / "No NBA games today" / "No NBA games tomorrow".

## Files Modified This Session

### Modified
- `artifacts/hoopiq/src/pages/basketball.tsx` — Recent/Today/Tomorrow tabs, `findRecentDate` backward search

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
It is documented and tested but currently the existing provider chain (single ESPN primary) is still used.
To adopt it: wrap any multi-provider sport (e.g. cricket with ESPN + TSDB) with `createProviderManager([provider1, provider2])`.

### Format filter is available for use
`src/lib/format-filter.ts` is implemented and ready.
It's not yet called from the cricket optimizer UI — integrate it when adding Recent Form panel or player history view.

## Next Suggested Tasks
1. Live cricket score provider (CricAPI free tier — 100 req/day)
2. Playing XI confirmation UI on cricket match page
3. Player recent form panel using `computeRollingStats()` from format-filter.ts
4. Football live scores via TheSportsDB
5. Captain/VC recommendation algorithm for cricket
