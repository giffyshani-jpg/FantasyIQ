# FantasyIQ — AI Handoff

## Latest Session Summary

Feature Session 1 — AI Engine work (2026-07-28).

**Task 1 complete:** AI Match Intelligence card for cricket.
- `src/lib/cricket-ai-intelligence.ts` — engine + public interfaces
- `src/components/cricket-match-intelligence.tsx` — collapsible UI card
- `src/pages/cricket-box-score.tsx` — card wired in after MatchHeader
- TypeScript: clean | Build: success

**Task 2 in progress:** AI Player Rating model.

Previous: Verification session (commit `6276126`) — no code changes, all fixes confirmed.
Before that: Bug-fix session (commit `9e8f22d`) — Day After removed, Recent fixed, 404 fixed.

## Architecture (as of Feature Session 1)

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
/cricket/:competition/game/:id             → CricketBoxScore  ← AI card here
/cricket/:competition/game/:id/optimizer   → CricketOptimizer
```

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
      nbadotcom.js            — NBA CDN fallback
      thesportsdb.js          — TheSportsDB basketball (NZ NBL)
      nznbl.js                — NZ NBL (TheSportsDB primary)
      football.js             — TheSportsDB Soccer (infrastructure only)
    lib/
      date-utils.ts           ← single source of truth for ALL local-timezone helpers
      types.ts                — LeagueKey union, Game, Player types
      cricket-types.ts        — CricketGame, CricketPlayer, CricketInnings, etc.
      cricket-scoring.ts      — scoring engine (T20/ODI/Test/Hundred/T10 profiles)
      cricket-ai-intelligence.ts  ← NEW: AI Match Intelligence engine + types
      format-filter.ts        — filterStatsByFormat(), computeRollingStats()
      ai-player-rating.ts     ← NEW (Task 2): per-player 0–100 AI rating model
      provider-manager.ts     — createProviderManager() — not yet wired
      stats.ts                — basketball fantasy points formula
      pregame-intel.ts        — pre-game intelligence heuristics
      ai-coach.ts             — AI Fantasy Coach 12 named picks
    pages/
      home.tsx                — FantasyIQ home hub (3 sport cards)
      basketball.tsx          — /basketball — Recent/Today/Tomorrow tabs
      cricket-schedule.tsx    — /cricket — Recent/Today/Tomorrow tabs
      cricket-box-score.tsx   — /cricket/:competition/game/:id  ← AI card added
      cricket-optimizer.tsx   — /cricket/:competition/game/:id/optimizer
      football.tsx            — /football — coming soon banner
    components/
      cricket-match-intelligence.tsx  ← NEW: MatchIntelligenceCard UI
```

### Key Invariants — NEVER BREAK THESE

1. **`safeCall()` wraps every provider call** in `api.js`. Never remove.
2. **UI never imports from providers directly** — only from `src/api.js`.
3. **Cricket routes in `App.tsx` before `/:league`** — `/cricket/:competition/game/:id` must be listed before `/:league/game/:id`.
4. **`mapTsdbStatus()` never infers `in_progress` from time** — only from TSDB's explicit `strStatus` field.
5. **`isGameSoon(game)`** in `basketball.tsx` — 48h window filter. Do not remove.
6. **`fetchGamesByLeagueAndLocalDate()`** in `api.js` — fetches both local date AND prev ESPN date. Do not revert.
7. **StatusBadge "Starting" window = 8h** in `cricket-schedule.tsx`. Do not reduce.
8. **All date/time helpers live in `src/lib/date-utils.ts`** — do NOT add new local date helpers in page files.
9. **`PORT` and `BASE_PATH` are required** for both `vite dev` and `vite build`.
10. **AI intelligence `isMock: true`** on all outputs — consumers must show MOCK badge. Do not remove until real AI provider wired.
11. **`isPlaceholder: true`** on `surface` and `weather` in MatchIntelligence — explicit flag, do not remove until real pitch/weather API wired.

### Dev Commands
```bash
pnpm --filter @workspace/hoopiq run typecheck         # must pass before every commit
PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev    # Vite dev server
PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run build  # production build
```

### Workflow Notes
- Managed workflow: `artifacts/hoopiq: web` (use WorkflowsRestart to start)
- Manual workflow: `HoopIQ` — `PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev`
- Push: `git push origin main` from workspace root (`/home/runner/workspace`)

## AI Match Intelligence System (Task 1)

**Entry point:** `computeMatchIntelligence(game: CricketGame): MatchIntelligence`

**9 signals:**
| Signal | Source | Placeholder? |
|--------|--------|-------------|
| matchDifficulty | FORMAT_HEURISTICS + game.status | No (mock) |
| surface.battingScore / bowlingScore | FORMAT_HEURISTICS | Yes (isPlaceholder: true) |
| weather | Hardcoded UNKNOWN | Yes (isPlaceholder: true) |
| toss.importanceScore | FORMAT_HEURISTICS | No (mock) |
| isBattingFriendly | surface comparison | No (mock) |
| captainPicks | Fantasy pts ranking (scorecard) / credits (pre-match) | No (mock) |
| viceCaptainPicks | Same, slots 3–4 | No (mock) |
| differentialPicks | AR/WK preference outside C/VC pool | No (mock) |
| riskLevel | FORMAT_HEURISTICS | No (mock) |

**To plug in real data:**
1. Replace `FORMAT_HEURISTICS` values with live pitch/weather API responses
2. Replace `scoreAndRankPlayers()` with ML model outputs
3. Set `isMock: false` once a real provider is wired

**UI Card:** `MatchIntelligenceCard` in `cricket-match-intelligence.tsx`
- Collapsed by default (tap to expand)
- MOCK badge always shown while `isMock: true`
- PLACEHOLDER badges on weather and pitch sections

## AI Player Rating System (Task 2 — in progress)

**File:** `src/lib/ai-player-rating.ts`

**Interface design (to be built):**
```typescript
export interface PlayerAIRating {
  overall: number;          // 0–100 weighted composite
  recentForm: number;       // 0–100
  venueRecord: number;      // 0–100 (placeholder)
  opponentStrength: number; // 0–100 (placeholder)
  battingPosition?: number; // 1–11 (bat only)
  bowlingOvers?: number;    // allocation (bowl only)
  fantasyConsistency: number; // 0–100
  role: CricketRole;
  isMock: true;
}
```

**Display:** Rating badge on player rows in cricket-box-score.tsx (batting + bowling scorecards)

## Cricket Tab System

Tabs: **Recent (0) · Today (1) · Tomorrow (2)**

Recent tab (cricket): reads `overview.recentCompleted` — no extra API calls.
Recent tab (basketball): `findRecentDate()` walks backwards up to 30 days via API.

## TheSportsDB Cricket League IDs

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

## What the Next Session Should Know

### Git / workspace
- Working directory: `/home/runner/workspace` (workspace root IS the git repo)
- Source code: `artifacts/hoopiq/src/`
- Docs: `docs/` (root — only documentation location)
- Push via: `git push origin main` from `/home/runner/workspace`
- The `FantasyIQ/` subdirectory that appears is a stale clone — work in `artifacts/hoopiq/` instead

### AI work remaining
1. **Task 2 (next):** AI Player Rating model in `src/lib/ai-player-rating.ts`
   - 0–100 rating, 6 weighted sub-scores
   - Interfaces for Bat / Bowl / AR / WK
   - Show rating badge on player cards in box score
2. Extend Match Intelligence to Basketball (after cricket is solid)
3. Wire real pitch data provider (e.g. Cricbuzz API)
4. Wire real weather provider
5. Replace mock rankings with ML model
6. Captain/VC recommendation for cricket optimizer UI

### Cricket data limitation
TheSportsDB free tier: NS/FT only — no live scores. Games show "Starting" until FT confirmed.

### Football
Infrastructure only. Fantasy logic NOT implemented.
