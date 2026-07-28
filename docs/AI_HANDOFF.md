# FantasyIQ — AI Handoff

## Latest Session Summary

Feature Session 4 — Tasks 1–6 (Cricket Data Engine) — 2026-07-28.

### Task 1 — Fix Cricket Date/Time Engine
- `providers/cricket.js`:
  - `fmtDate()`: UTC (`toISOString().slice(0,10)`) → local (`toLocaleDateString("en-CA")`)
  - Day-based query window: `[-1..+3]` → `[-2..+3]`
  - `normalizeTsdbEvent()` fallback startTimeIso: UTC noon proxy (`T12:00:00Z`) replaces venue-local strTime
  - `recentCompleted` filtered to 48h window (was all completed ever)
  - `KNOWN_LEAGUES` expanded: The Hundred (M/W), ICC T20I/ODI/Test, ICC T20WC/ODIWC/CT, WPL, WBBL, Abu Dhabi T10
  - `detectFormat()`: ODI regex excludes T20WC; T10 catches Abu Dhabi T10
- `pages/cricket-schedule.tsx`:
  - Recent tab: all completed last 48h (not just most-recent-date's games)
  - Today/Tomorrow tabs: include completed from recentCompleted matching target date; dedup by id

### Task 2 — Auto-detect Match Format
- `pages/cricket-optimizer.tsx`:
  - Removed `ProfileSelector` (manual picker)
  - Added `DetectedFormatCard` (read-only: format badge + "AUTO-DETECTED from {competition}")
  - `FORMAT_COLORS` map for format badge colours
  - `SCORING_PROFILES` import removed (was unused after selector removal)
  - Internal `profile` state + auto-set from `getScoringProfile()` on game load — unchanged

### Task 3 — Cricket Data Fallback Engine
- `providers/cricket.js`:
  - Added `GAME_CACHE` (2 min scheduled / 10 min final TTL)
  - `findInCache()` — scans DAY_CACHE + LEAGUE_CACHE for game by ID
  - `buildMinimalGame(gameId)` — constructs minimal game shell (never null)
  - `fetchGameById()` now has 3-tier fallback: TSDB lookupevent → cache scan → minimal shell
  - Logs: `console.info` on success, `console.warn` on miss/fallback
- `pages/cricket-box-score.tsx`:
  - `NoScorecard` → `InfoRow`-based pre-match / no-scorecard panel
  - Shows venue, competition, format, start time for scheduled; result + note for completed
- `pages/cricket-optimizer.tsx`:
  - Context-aware empty player pool message (scheduled / in-progress / final)
  - Shows venue + competition from game even when no players available

### Tasks 4+5 — Match Details & Optimizer Data
- `lib/cricket-ai-intelligence.ts`:
  - Added `deriveWeatherFromHeuristic(h)` — derives weather label + impact from dew factor
  - `buildMatchConditions()`: weather.label + weather.condition now set from heuristic (not hardcoded "UNKNOWN")
  - `isPlaceholder: true` stays on weather/pitch — flag means "not from live API", not "no data"
- `components/cricket-match-intelligence.tsx`:
  - Weather section: header with derived label + ESTIMATED badge; always shows impact text
  - Pitch Report: PLACEHOLDER badge → ESTIMATED
  - AIInsightsPanel Weather MetricRow: `weather.label` (not `"Awaiting data"`)
- `pages/cricket-box-score.tsx`:
  - Added `MatchSummaryCard` — shown for `final`-status matches above AI card
  - Displays: Result, Venue, Competition, Format + POTM/Toss unavailable note

### Task 6 — Smoke Test
- TypeScript: ✅ 0 errors
- Build: ✅ Success
- All 13 invariants confirmed — see CURRENT_STATUS.md

---

## Architecture (as of Feature Session 4)

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
/cricket/:competition/game/:id             → CricketBoxScore  ← Match Summary + AI Insights + Rating + Badges
/cricket/:competition/game/:id/optimizer   → CricketOptimizer  ← AI Rating + Badges on PlayerRow
```

### File Layout
```
artifacts/hoopiq/
  src/
    api.js                    — adapter boundary; ALL provider calls go through here
    App.tsx                   — routes; cricket routes MUST come before /:league catch-all
    providers/
      cricket.js              — TheSportsDB multi-league + day-based; 3-tier fetchGameById fallback
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
      cricket-ai-intelligence.ts  ← AI Match Intelligence + Captain/VC Engine + Match Conditions + weather heuristic
      ai-player-rating.ts     ← per-player 0–100 AI rating + PlayerBadge classification
      format-filter.ts        — filterStatsByFormat(), computeRollingStats()
      provider-manager.ts     — createProviderManager() — implemented, not yet wired into api.js
      stats.ts                — basketball fantasy points formula
      pregame-intel.ts        — pre-game intelligence heuristics
      ai-coach.ts             — AI Fantasy Coach 12 named picks
    pages/
      home.tsx                — FantasyIQ home hub (3 sport cards)
      basketball.tsx          — /basketball — Recent/Today/Tomorrow tabs
      cricket-schedule.tsx    — /cricket — Recent/Today/Tomorrow tabs
      cricket-box-score.tsx   — /cricket/:competition/game/:id  ← MatchSummaryCard + AI + Badges
      cricket-optimizer.tsx   — /cricket/:competition/game/:id/optimizer  ← DetectedFormatCard + AI Badges
      football.tsx            — /football — coming soon banner
    components/
      cricket-match-intelligence.tsx  ← AI Insights Panel + full Captain/VC detail + Estimated weather
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
11. **`isPlaceholder: true`** on `surface`, `weather`, `pitchReport` in MatchConditions — means "not from live API". Values ARE derived from heuristics. Do not remove flag until real pitch/weather API wired.
12. **`computePlayerAIRating()` returns `isMock: true`** — keep until real player-history provider wired.
13. **`computePlayerBadge()` is exclusive** — returns one badge or null, priority: HOT→SAFE→VALUE PICK→RISKY→DIFFERENTIAL. Do not change priority without updating docs.
14. **`fetchGameById()` 3-tier fallback** — Provider 1 (TSDB) → Provider 2 (cache scan) → Provider 3 (minimal shell). Never return null from fetchGameById. Tier 3 must always produce a renderable game object.
15. **`fmtDate()` in cricket.js** uses `toLocaleDateString("en-CA")` for local timezone. Do NOT revert to UTC (`toISOString().slice(0,10)`).

### Dev Commands
```bash
pnpm --filter @workspace/hoopiq run typecheck         # must pass before every commit
PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev    # Vite dev server
PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run build  # production build
git push origin main   # from /home/runner/FantasyIQ
```

### Workflow Notes
- Managed workflow: `artifacts/hoopiq: web` (use WorkflowsRestart to start)
- Manual workflow: `HoopIQ` — `PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev`
- Push: `git push origin main` from the cloned repo directory (`/home/runner/FantasyIQ`)

---

## Cricket Provider Architecture (Feature Session 4)

### `fetchGameById()` Fallback Chain

```
Provider 1: TSDB lookupevent.php?id={eventId}
  ✓ success → normalizeTsdbEvent() → setCachedGame() → return
  ✗ fail    → console.warn + fall through

Provider 2: In-memory cache scan (findInCache)
  Searches: DAY_CACHE (Map keyed by date string) + LEAGUE_CACHE (Map keyed by leagueId)
  ✓ hit  → spread + allPlayers=[] + _provider="cache-scan" → setCachedGame() → return
  ✗ miss → console.warn + fall through

Provider 3: buildMinimalGame(gameId)
  Always succeeds — constructs minimal CricketGame shell
  _provider = "minimal-fallback"
  status = "scheduled", teams = "Unknown"
  NOT cached (retry fresh on next navigation)
```

### GAME_CACHE TTLs
- Scheduled / in-progress: 2 minutes
- Final: 10 minutes

---

## Weather Derivation (Feature Session 4)

`deriveWeatherFromHeuristic(h: FormatHeuristic)` in `cricket-ai-intelligence.ts`:

| Dew Factor | condition | label |
|------------|-----------|-------|
| HIGH | HUMID | "Warm & Humid (Est.)" |
| MODERATE | HUMID | "Partly Overcast (Est.)" |
| LOW | CLEAR | "Mostly Clear (Est.)" |
| NONE | CLEAR | "Clear / Variable (Est.)" |

Impact text is format/dew-aware. `isPlaceholder: true` stays set (label says "Est." to signal estimation). To plug in real weather, replace `deriveWeatherFromHeuristic()` return values with live API data and set `isPlaceholder: false`.

---

## PlayerBadge System

**File:** `src/lib/ai-player-rating.ts`

| Badge | Condition |
|-------|-----------|
| HOT | overall ≥ 78 |
| SAFE | riskScore ≥ 68 AND overall ≥ 55 |
| VALUE PICK | overall ≥ 58 AND credits < 8.5 |
| RISKY | overall < 44 |
| DIFFERENTIAL | overall ≥ 52 (catch-all) |
| null | 44–51 range — no badge |

---

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
  { id: 5561, name: "The Hundred (Men's)",             format: "The Hundred" },
  { id: 5562, name: "The Hundred (Women's)",           format: "The Hundred" },
  { id: 4464, name: "ICC International T20I",          format: "T20"  },
  { id: 4465, name: "ICC International ODI",           format: "ODI"  },
  { id: 4466, name: "ICC International Test",          format: "Test" },
  { id: 4455, name: "ICC T20 World Cup",               format: "T20"  },
  { id: 4456, name: "ICC Cricket World Cup (ODI)",     format: "ODI"  },
  { id: 4457, name: "ICC Champions Trophy",            format: "ODI"  },
  { id: 4902, name: "ICC Women's T20 World Cup",       format: "T20"  },
  { id: 4903, name: "ICC Women's Cricket World Cup",   format: "ODI"  },
  { id: 4904, name: "ICC Women's T20I",                format: "T20"  },
  { id: 4905, name: "ICC Women's ODI",                 format: "ODI"  },
  { id: 5560, name: "Women's Premier League",          format: "T20"  },
  { id: 5607, name: "WBBL",                            format: "T20"  },
  { id: 5563, name: "Abu Dhabi T10",                   format: "T10"  },
];
```

Note: IDs for The Hundred, ICC Internationals, Women's competitions are best-guess.
Day-based auto-discovery catches any games from competitions with unknown IDs.
