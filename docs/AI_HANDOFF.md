# FantasyIQ — AI Handoff

## Latest Session Summary

Feature Session 2 — Tasks 1–3 built, Task 4 smoke-tested (2026-07-28).

**Task 1 — AI Player Rating Engine:**
- `src/lib/ai-player-rating.ts` — new file: `computePlayerAIRating()`, `computeAllPlayerRatings()`, `PlayerAIRating`, `PlayerRatingFactors`
- `src/pages/cricket-box-score.tsx` — `AIRatingBadge` component; badges on batting + bowling rows
- TypeScript: clean | Build: success

**Task 2 — Captain/VC Engine:**
- `src/lib/cricket-ai-intelligence.ts` — `CaptainVCEngine`, `CaptainVCPick`, `CaptainLabel` types; `buildCaptainEngine()` function
- `src/components/cricket-match-intelligence.tsx` — `CaptainVCPickRow` component; Captain/VC Engine section in card
- TypeScript: clean | Build: success

**Task 3 — Match Conditions:**
- `src/lib/cricket-ai-intelligence.ts` — `MatchConditions`, `PitchReport`, `WeatherCondition`, `PaceSpinBias`, `DewImpact` types; `buildMatchConditions()` function; `FORMAT_HEURISTICS` extended with `paceSpinBias`, `dewFactor`, `paceSpinRationale`, `dewRationale`
- `src/components/cricket-match-intelligence.tsx` — `PaceSpinBadge`, `DewBadge` components; Pitch Report / Weather+Dew / Toss Bias / Match Conditions sections
- TypeScript: clean | Build: success

**Task 4 — Smoke Test:** All tabs, AI card, ratings, captain picks verified. 0 TypeScript errors. Build clean.

Previous (Feature Session 1): AI Match Intelligence card (9 signals). Commit `19cbef1`.

## Architecture (as of Feature Session 2)

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
/cricket/:competition/game/:id             → CricketBoxScore  ← AI card + Rating badges
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
      cricket-ai-intelligence.ts  ← AI Match Intelligence + Captain/VC Engine + Match Conditions
      ai-player-rating.ts     ← NEW (Task 1): per-player 0–100 AI rating model
      format-filter.ts        — filterStatsByFormat(), computeRollingStats()
      provider-manager.ts     — createProviderManager() — not yet wired
      stats.ts                — basketball fantasy points formula
      pregame-intel.ts        — pre-game intelligence heuristics
      ai-coach.ts             — AI Fantasy Coach 12 named picks
    pages/
      home.tsx                — FantasyIQ home hub (3 sport cards)
      basketball.tsx          — /basketball — Recent/Today/Tomorrow tabs
      cricket-schedule.tsx    — /cricket — Recent/Today/Tomorrow tabs
      cricket-box-score.tsx   — /cricket/:competition/game/:id  ← AI Rating badges added
      cricket-optimizer.tsx   — /cricket/:competition/game/:id/optimizer
      football.tsx            — /football — coming soon banner
    components/
      cricket-match-intelligence.tsx  ← AI card (Match Conditions + Captain/VC Engine)
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
11. **`isPlaceholder: true`** on `surface`, `weather`, `pitchReport`, `weather` in MatchConditions — explicit flag, do not remove until real pitch/weather API wired.
12. **`computePlayerAIRating()` returns `isMock: true`** — keep until real player-history provider wired.

### Dev Commands
```bash
pnpm --filter @workspace/hoopiq run typecheck         # must pass before every commit
PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev    # Vite dev server
PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run build  # production build
```

### Workflow Notes
- Managed workflow: `artifacts/hoopiq: web` (use WorkflowsRestart to start)
- Manual workflow: `HoopIQ` — `PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev`
- Push: `git push origin main` from `/home/runner/FantasyIQ` (or wherever repo is cloned)

## AI Player Rating System (Task 1)

**File:** `src/lib/ai-player-rating.ts`

**Public interface:**
```typescript
export interface PlayerAIRating {
  overall: number;          // 0–100 weighted composite
  factors: PlayerRatingFactors; // per-factor breakdown
  role: CricketRole;
  label: RatingLabel;       // Elite / Excellent / Good / Average / Risky / Poor
  isMock: true;
}

// Entry points:
computePlayerAIRating(player, { format, competitionName, isBattingFriendly }): PlayerAIRating
computeAllPlayerRatings(players, ctx): Map<string, PlayerAIRating>
```

**8 weighted factors per role (Bat/Bowl/AR/WK):**
- recentForm, venueRecord, oppositionStrength, battingPosition
- bowlingOpportunity, fantasyConsistency, expectedPlayingTime, riskScore

**To plug in live data:** Replace each factor helper function individually. No interface changes needed.

## Captain/VC Engine (Task 2)

**File:** `src/lib/cricket-ai-intelligence.ts` — `buildCaptainEngine()`

**Output: `CaptainVCEngine`**
```typescript
export interface CaptainVCEngine {
  bestCaptain: CaptainVCPick;    // ⭐ Highest ceiling
  bestVC: CaptainVCPick;         // ⭐ Strong alternative
  safePick: CaptainVCPick;       // ⭐ Low-risk floor (prefers WK/AR)
  grandLeagueDiff: CaptainVCPick;// ⭐ Low-ownership upside
  isMock: true;
}

export interface CaptainVCPick {
  captainScore: number;    // 0–100
  riskPct: number;         // 0–100 (high = volatile)
  confidencePct: number;   // 0–100
  aiRating: number;        // 0–100
  label: CaptainLabel;     // BEST_CAPTAIN | BEST_VC | SAFE_PICK | GRAND_LEAGUE
  rationale: string;
}
```

**To plug in live data:**
- Replace `buildAIRating(fantasyPts)` with live player-rating model output
- Replace `buildPickRationale()` with ML-generated rationale text
- Set `isMock: false` once real provider is wired

## Match Conditions (Task 3)

**File:** `src/lib/cricket-ai-intelligence.ts` — `buildMatchConditions()`

**Output: `MatchConditions`**
```typescript
export interface MatchConditions {
  pitchReport: PitchReport;         // surface, batting%, bowling%, pace/spin bias
  weather: WeatherCondition;        // condition, dew factor, impact
  battingFriendlyPct: number;       // 0–100
  bowlingFriendlyPct: number;       // 0–100
  tossBias: { importanceScore, preferredDecision, label, rationale };
  isMock: true;
}
```

**Format-aware heuristics in `FORMAT_HEURISTICS`:**
- `paceSpinBias: PaceSpinBias` — PACE_DOMINANT / SLIGHT_PACE / BALANCED / SLIGHT_SPIN / SPIN_DOMINANT
- `dewFactor: DewImpact` — NONE / LOW / MODERATE / HIGH
- `paceSpinRationale` + `dewRationale` — human-readable format explanation

**To plug in live data:**
1. Replace `FORMAT_HEURISTICS` values with pitch/weather API per-venue values
2. Set `pitchReport.isPlaceholder = false` when real pitch API is connected
3. Set `weather.isPlaceholder = false` when real weather API is connected

## AI Match Intelligence System (Task 1 — Feature Session 1)

**Entry point:** `computeMatchIntelligence(game: CricketGame): MatchIntelligence`

**MatchIntelligence now includes:**
- Legacy: `matchDifficulty`, `surface`, `weather`, `toss`, `captainPicks`, `viceCaptainPicks`, `differentialPicks`, `riskLevel`
- NEW Task 2: `captainEngine: CaptainVCEngine`
- NEW Task 3: `matchConditions: MatchConditions`

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
- Working directory: the cloned repo (e.g. `/home/runner/FantasyIQ` if newly cloned)
- Source code: `artifacts/hoopiq/src/`
- Docs: `docs/` (repo root — only documentation location)
- Push via: `git push origin main`
- Run `pnpm install` first if `node_modules/` is missing after a fresh clone

### AI work remaining
1. Wire real pitch data provider (e.g. Cricbuzz API) — set `pitchReport.isPlaceholder = false`
2. Wire real weather provider — set `weather.isPlaceholder = false`
3. Extend AI Player Rating to Basketball
4. Extend Captain/VC Engine to Basketball box score
5. Replace mock `venueRecord` / `oppositionStrength` with real player-history API
6. Replace mock captain rationale with ML-generated text
7. Add AI Rating to cricket-optimizer.tsx player selection cards

### Cricket data limitation
TheSportsDB free tier: NS/FT only — no live scores. Games show "Starting" until FT confirmed.

### Football
Infrastructure only. Fantasy logic NOT implemented.
