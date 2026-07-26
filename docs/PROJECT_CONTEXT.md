# FantasyIQ — Project Context

## Vision
FantasyIQ is a mobile-first multi-sport fantasy hub for serious fantasy players and fans. It aggregates live scores, schedules, player stats, and pre-game intelligence from Cricket, Basketball, and Football. The core differentiator is the Fantasy Optimizer — an AI-powered lineup-building tool with format-aware statistics, provider priority fallback, and accurate timezone handling.

## Architecture

### Stack
- **Frontend**: React + Vite, TypeScript, Tailwind CSS v4, shadcn/ui components
- **Routing**: Wouter (lightweight SPA routing)
- **State**: React useState/useEffect (no Redux), raw fetch in hooks
- **Persistence**: Browser localStorage only (no backend, no database)
- **Build**: pnpm monorepo, artifact at `artifacts/hoopiq/`

### Data Sources
| Sport | Source | Status |
|-------|--------|--------|
| NBA | ESPN Site API (`nba`) | Off-season; next Oct 2026 |
| WNBA | ESPN Site API (`wnba`) | Active ✅ |
| NBA Summer League | ESPN NBA scoreboard filtered for type-3 events | Active July ✅ |
| NBL (Australia) | ESPN Site API (`nbl`) | Off-season |
| NZ NBL | TheSportsDB ID 5066 + ESPN fallback | Active May–Aug ✅ |
| FIBA | ESPN Site API (`fiba`) | Varies by tournament |
| Cricket | TheSportsDB (day-based + league-based) | Active ✅ |
| Football | TheSportsDB (infrastructure only) | Coming Soon |

### Key Files
| Path | Purpose |
|------|---------|
| `src/api.js` | Adapter layer — UI imports only from here |
| `src/providers/espn.js` | All ESPN API logic (shared by NBA, WNBA, NBL, FIBA, Summer) |
| `src/providers/cricket.js` | Cricket: TheSportsDB day+league strategy, timezone-safe |
| `src/providers/football.js` | Football: TheSportsDB infrastructure skeleton |
| `src/providers/thesportsdb.js` | TheSportsDB basketball (NZ NBL) |
| `src/lib/provider-manager.ts` | Multi-provider priority, reliability scoring, auto-retry |
| `src/lib/format-filter.ts` | Format-aware stats (never mix T20/ODI/Test) |
| `src/pages/home.tsx` | Home — Cricket / Basketball / Football sport hub cards |
| `src/pages/basketball.tsx` | Basketball hub — NBA + WNBA sub-sections |
| `src/pages/cricket-schedule.tsx` | Cricket — TODAY/TOMORROW/DAY AFTER tabs, auto-discovery |
| `src/pages/football.tsx` | Football hub — infrastructure only, competition list |
| `src/pages/cricket-box-score.tsx` | Cricket match detail — scorecard, fantasy AI |
| `src/pages/fantasy-optimizer.tsx` | Basketball Fantasy Optimizer (1500+ lines) |
| `src/lib/pregame-intel.ts` | Pre-game intelligence heuristics |
| `src/lib/stats.ts` | Fantasy points formula (basketball) |
| `src/lib/cricket-scoring.ts` | Cricket fantasy points formula |
| `src/lib/lineup-storage.ts` | Lineup validation (8 players, max 4 per team, C/VC) |

### Routing (Wouter)
```
/                           → Home (Cricket / Basketball / Football cards)
/basketball                 → Basketball hub (NBA + WNBA)
/cricket                    → Cricket schedule (TODAY/TOMORROW/DAY AFTER)
/football                   → Football hub (coming soon)
/:league                    → LeagueGames (nba, wnba, nbl, etc.)
/:league/game/:id           → Box Score
/:league/game/:id/optimizer → Fantasy Optimizer
/:league/game/:id/plays     → Play-by-Play
/:league/game/:id/compare   → Player Comparison
/:league/player/:playerId   → Player Detail
/cricket/:competition/game/:id           → Cricket Box Score
/cricket/:competition/game/:id/optimizer → Cricket Optimizer
```

## Sport Priorities (Home Page Order)
1. **Cricket** — top card (most global audience, most active competition)
2. **Basketball** — second card (NBA + WNBA hub)
3. **Football** — third card (infrastructure ready, coming soon)

## Provider System (Task 5)
- `src/lib/provider-manager.ts` — `createProviderManager()` chains providers by reliability
- Reliability score = 60% success rate + 40% speed bonus
- Providers below 0.2 score are skipped (unless last resort)
- Exponential back-off retry (400ms × attempt)
- All provider calls still guarded by `safeCall()` in api.js

## Timezone Handling (Task 6)
- All internal timestamps stored in UTC (ISO 8601)
- Never infer "in_progress" from time arithmetic — only from provider status field
- `mapTsdbStatus()` in cricket.js: "NS" always → "scheduled" regardless of clock
- UI shows "Starting" for matches where start time has passed but status unconfirmed
- Display conversion happens only at render time (Intl.DateTimeFormat)

## Format-Aware Statistics (Task 8)
- `src/lib/format-filter.ts` — `filterStatsByFormat()`, `getFormatGroup()`
- Groups: T20 (includes The Hundred), ODI, Test, T10
- The Hundred → T20 group (same player skills and fantasy scoring)
- Stats from different groups are NEVER combined
- `computeRollingStats()` handles L5 / L10 automatically filtered by format

## Coding Standards
- TypeScript for all new files; JS preserved for providers/api to avoid migration churn
- No backend — all data from public ESPN/TheSportsDB APIs via browser fetch (CORS open)
- `safeCall()` wraps every provider call so one failure never crashes the app
- `src/api.js` is the only import boundary (UI never imports from providers directly)
- Provider contract: `getLeagueOverview`, `getGame`, `getGamesByDate`, `getPlayerGameLog`, `getTeamSchedule`

## Things That Should NEVER Be Rewritten
- `src/providers/espn.js` — battle-tested ESPN API normalization
- `src/lib/stats.ts` — basketball fantasy points formula (source of truth)
- `src/lib/cricket-scoring.ts` — cricket FPTS formula
- `src/lib/pregame-intel.ts` — carefully calibrated heuristics
- `src/lib/lineup-storage.ts` — lineup validation rules
- The `safeCall()` wrapper in api.js — must stay around every provider invocation
- `mapTsdbStatus()` timezone fix in cricket.js — never infer live from time alone
