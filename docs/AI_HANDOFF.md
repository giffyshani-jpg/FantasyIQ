# FantasyIQ — AI Handoff

## Latest Session Summary

13 tasks completed: full rebrand (HoopIQ→FantasyIQ), home screen redesign, basketball hub, cricket schedule page, provider system, timezone fix, cricket match enhancements, format-aware stats, recent stats engine, football infrastructure, UI polish, documentation.

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
- Dev server: via workflow `fantasyiq-repo/artifacts/hoopiq: web`
- All pushes to GitHub main via git-remote skill

## Files Modified This Session

### New files
- `artifacts/hoopiq/src/pages/basketball.tsx` — Basketball hub page
- `artifacts/hoopiq/src/pages/cricket-schedule.tsx` — Cricket schedule with day tabs
- `artifacts/hoopiq/src/pages/football.tsx` — Football hub (infrastructure)
- `artifacts/hoopiq/src/providers/football.js` — TheSportsDB Football provider
- `artifacts/hoopiq/src/lib/provider-manager.ts` — Multi-provider priority system
- `artifacts/hoopiq/src/lib/format-filter.ts` — Format-aware statistics filter

### Modified
- `artifacts/hoopiq/index.html` — FantasyIQ title/meta (Task 1)
- `artifacts/hoopiq/src/components/layout.tsx` — FantasyIQ logo, lightning bolt icon
- `artifacts/hoopiq/src/pages/home.tsx` — 3-sport hub redesign (Task 2)
- `artifacts/hoopiq/src/App.tsx` — New routes for basketball/cricket/football
- `artifacts/hoopiq/src/api.js` — Football provider, fantasyiq: cache key, exports
- `artifacts/hoopiq/src/providers/cricket.js` — Timezone fix (Task 6)
- `artifacts/hoopiq/src/index.css` — UI polish, animations, chips (Task 11)
- `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/AI_HANDOFF.md`

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
