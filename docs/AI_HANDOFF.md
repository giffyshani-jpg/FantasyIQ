# FantasyIQ — AI Handoff

## Latest Session Summary

Verification / smoke-test session (2026-07-28). No code changes — all prior fixes confirmed in place.

- TypeScript: clean (0 errors)
- Build: successful (`PORT=3000 BASE_PATH=/ vite build`) — chunk-size warning only
- Basketball: Recent / Today / Tomorrow confirmed — no Day After anywhere
- Cricket: Recent / Today / Tomorrow confirmed — no Day After anywhere
- Cricket Recent logic: `recentCompleted` backward scan confirmed correct
- Basketball Recent logic: `findRecentDate()` 30-day backward walk confirmed correct
- Cricket box score back-nav: `<Link href="/cricket">` (line 344 of cricket-box-score.tsx) — no 404
- Cricket optimizer back-nav: returns to cricket box score correctly
- All routes return HTTP 200 from the running dev server

Previous: Documentation consolidation session (commit `cda7e85`).
Before that: Bug-fix session (commit `9e8f22d`) — removed Day After tab, fixed Recent logic, fixed cricket header, fixed 404 nav.
Before that: Basketball Recent tab (commit `1b04523`).
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

**Important:** `/cricket/:competition` (competition-level page) has NO route intentionally —
`LeagueGames` expects a `league` param. `CricketBoxScore` back-nav links to `/cricket`.

**Important:** Cricket routes in `App.tsx` MUST appear before `/:league` catch-all.

### File Layout
```
artifacts/hoopiq/
  src/
    api.js                    — adapter boundary; ALL provider calls go through here
    App.tsx                   — routes; cricket routes MUST come before /:league catch-all
    providers/
      cricket.js              — TheSportsDB multi-league + day-based auto-discovery
      espn.js                 — ESPN provider (NBA, WNBA, NBL, FIBA, Summer)
      nba.js / wnba.js        — league wrappers around espn.js
      nbadotcom.js            — NBA CDN fallback (todaysScoreboard_00.json)
      thesportsdb.js          — TheSportsDB basketball (NZ NBL)
      nznbl.js                — NZ NBL (TheSportsDB primary)
      football.js             — TheSportsDB Soccer (infrastructure only)
    lib/
      date-utils.ts           ← single source of truth for ALL local-timezone helpers
      types.ts                — LeagueKey union, Game, Player types
      cricket-types.ts        — CricketGame, CricketPlayer, CricketInnings, etc.
      cricket-scoring.ts      — scoring engine (T20/ODI/Test/Hundred/T10 profiles)
      format-filter.ts        — filterStatsByFormat(), computeRollingStats(), format groups
      provider-manager.ts     — createProviderManager() with reliability scoring
      provider-health.ts      — per-provider health tracking
      stats.ts                — basketball fantasy points formula (source of truth)
      pregame-intel.ts        — pre-game intelligence heuristics
      ai-coach.ts             — AI Fantasy Coach 12 named picks
    pages/
      home.tsx                — FantasyIQ home hub (3 sport cards)
      basketball.tsx          — /basketball — Recent/Today/Tomorrow tabs + NBA/WNBA sections
      cricket-schedule.tsx    — /cricket — Recent/Today/Tomorrow tabs
      cricket-box-score.tsx   — /cricket/:competition/game/:id
      cricket-optimizer.tsx   — /cricket/:competition/game/:id/optimizer
      football.tsx            — /football — coming soon banner
  docs/                       ← DO NOT CREATE — root docs/ is the only location
```

### Key Invariants — NEVER BREAK THESE

1. **`safeCall()` wraps every provider call** in `api.js`. Never remove.
2. **UI never imports from providers directly** — only from `src/api.js`.
3. **Cricket routes in `App.tsx` before `/:league`** — `/cricket/:competition/game/:id` must be listed before `/:league/game/:id`.
4. **`mapTsdbStatus()` never infers `in_progress` from time** — only from TSDB's explicit `strStatus` field.
5. **`isGameSoon(game)`** in `basketball.tsx` — 48h window filter for NBA/WNBA cards. Do not remove.
6. **`fetchGamesByLeagueAndLocalDate()`** in `api.js` — fetches both local date AND prev ESPN date, merges by ID. Do not revert to single-date fetch.
7. **StatusBadge "Starting" window = 8h** in `cricket-schedule.tsx`. Do not reduce.
8. **All date/time helpers live in `src/lib/date-utils.ts`** — do NOT add new local date helpers in page files.
9. **Basketball DayTabs use `localDayOffset(selected)`** — tab index maps directly to day offset (0=today, 1=tomorrow for non-Recent tabs).
10. **`PORT` and `BASE_PATH` are required** for both `vite dev` and `vite build` — vite.config.ts throws if missing.

### Dev Commands
```bash
pnpm --filter @workspace/hoopiq run typecheck         # must pass before every commit
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev    # starts Vite on port 3000
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/hoopiq run build  # production build
```

### Workflow Notes
- Use command: `PORT=3000 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev`
- Push: requires GITHUB_TOKEN secret — `git push origin main` from repo root
- When running in a Replit environment, configure a workflow named `HoopIQ` with the above command

## Cricket Tab System

Tabs: **Recent (0) · Today (1) · Tomorrow (2)**

**Recent tab logic** (inline in `cricket-schedule.tsx`, both in `DayGames` and `recentCount`):
- Reads `overview.recentCompleted` (already fetched — no extra API calls)
- Finds the single most-recent `startTimeIso` date among all completed games
- Shows ALL games from that date
- If today has completed matches, today is the most-recent date

**Important:** Cricket Recent does NOT walk backwards via API calls (no per-date cricket API exists).
It derives the most-recent date purely from the `recentCompleted` array in the existing overview.
Basketball Recent (`findRecentDate`) does walk backwards via API calls — different implementation,
same user-visible behaviour.

**Live indicator** and count badge wired to Today (tab index 1) only.

## Basketball Tab System

Tabs: **Recent (0) · Today (1) · Tomorrow (2)**

`findRecentDate` in `basketball.tsx` walks backwards (offset 0, -1, … -30), fetches NBA+WNBA in
parallel per date, stops at first date with a `status === "final"` game, returns ALL games from that
date. Uses AbortController — switching tabs cancels the in-flight search.

## TheSportsDB Cricket League IDs

These are the known cricket league IDs used by `cricket.js` for targeted fetches:

```javascript
const KNOWN_LEAGUES = [
  { id: 4460, name: "Indian Premier League",           format: "T20"  },
  { id: 4461, name: "Big Bash League",                 format: "T20"  },
  { id: 4463, name: "Vitality T20 Blast",              format: "T20"  },
  { id: 4458, name: "County Championship Div 1",       format: "Test" },
  { id: 4459, name: "County Championship Div 2",       format: "Test" },
  { id: 4462, name: "SA T20 Challenge",                format: "T20"  },
  { id: 5067, name: "Pakistan Super League",           format: "T20"  },
  { id: 5174, name: "Super Smash",                     format: "T20"  },
  { id: 5175, name: "Lanka Premier League",            format: "T20"  },
  { id: 5176, name: "Caribbean Premier League",        format: "T20"  },
  { id: 5529, name: "Bangladesh Premier League",       format: "T20"  },
  { id: 5530, name: "Sheffield Shield",                format: "Test" },
  { id: 5532, name: "SA20",                            format: "T20"  },
  { id: 5533, name: "Nepal Premier League",            format: "T10"  },
  { id: 5534, name: "Shpageeza Cricket League",        format: "T20"  },
  { id: 5535, name: "Zimbabwe T20",                    format: "T20"  },
  { id: 5606, name: "Ireland T20 Trophy",              format: "T20"  },
];
```

The cricket provider also uses day-based auto-discovery via TheSportsDB's `eventsday.php?s=Cricket`
endpoint which catches any active competition not in the above list.

## What the Next Session Should Know

### Documentation is consolidated
- `docs/` (root) is the ONLY documentation location
- `artifacts/hoopiq/docs/` was deleted — do NOT recreate it
- `hoopiq-repo/` was deleted — do NOT recreate it
- Future sessions: always read `docs/CURRENT_STATUS.md` and `docs/AI_HANDOFF.md` only

### Cricket data limitation
TheSportsDB free tier has no live scores — status is "NS"/"FT" only.
Live cricket games will show as "Starting" (not LIVE) until TSDB confirms FT.
To get real live cricket scores, integrate CricAPI or Cricbuzz (auth required).

### Football is infrastructure only
`/football` shows competition list and coming-soon banner.
`providers/football.js` has `getLeagueOverview()` and `getGamesByDate()` wired to TheSportsDB Soccer.
Fantasy logic NOT implemented. Next step: wire live data, then build lineup optimizer.

### Provider manager is available but not yet wired into providers
`src/lib/provider-manager.ts` exports `createProviderManager()`.
Currently unused — existing single-ESPN provider chain is still active.
To adopt: wrap any multi-provider sport with `createProviderManager([provider1, provider2])`.

### Format filter is available for use
`src/lib/format-filter.ts` is implemented and ready.
Not yet called from the cricket optimizer UI — integrate when adding Recent Form panel.

### Technical reference
See `docs/TECHNICAL_NOTES.md` for:
- ESPN API slug reference (which slugs work vs return 400)
- ESPN player game log endpoint documentation
- Pre-game intelligence architecture details
- Provider chain and retry logic
- Player availability derivation from ESPN

## Next Suggested Tasks
1. Live cricket score provider (CricAPI free tier — 100 req/day)
2. Playing XI confirmation UI on cricket match page
3. Player recent form panel using `computeRollingStats()` from format-filter.ts
4. Football live scores via TheSportsDB
5. Captain/VC recommendation algorithm for cricket
