# FantasyIQ — AI Handoff

## Latest Session Summary

Feature Session 5 — Cricket Match Details Pipeline Reliability — 2026-07-29.

### Root Cause + Fix (Session 5)

**Problem:** Opening some schedule matches showed UNK vs UNK, Unknown teams, empty optimizer, missing venue/competition/format.

**Three independent bugs, all fixed:**

#### Bug 1 — Abbreviation (normalizeTsdbEvent)
```
Before: abbreviation: makeAbbreviation(ev.strHomeTeam)  // null → "UNK"
After:  const homeName = ev.strHomeTeam || "Home";
        abbreviation: makeAbbreviation(homeName)         // "Home" → "HOM"
```

#### Bug 2 — Provider 1 weak data not enriched (fetchGameById)
TSDB `lookupevent.php` sometimes returns events with empty `strHomeTeam`/`strAwayTeam` even though `eventsday.php` had real team names. Added `enrichFromCache(game)` helper:
- Called immediately after Provider 1 normalizes an event
- If `homeTeam.name === "Home"` → replace from cache if available
- Also fills `venue`, `competitionName`, `competitionSlug`, `format` from cache
- Only overwrites placeholders — real Provider 1 data is preserved

#### Bug 3 — Direct navigation / page refresh (fetchGameById + api.js)
`DAY_CACHE` and `LEAGUE_CACHE` are in-memory module singletons — empty on fresh browser load. On refresh or shared-link navigation, Provider 2 (cache scan) always missed → Provider 3 returned "Unknown"/"UNK" shell.

**Fix part A — seedGameCache export:**
- New `export function seedGameCache(game)` in `cricket.js`
- `api.js` calls it for every game in `fetchCricketOverview()` result (live + upcoming + recentCompleted + lastPlayed)
- `GAME_CACHE` is pre-populated immediately after overview loads
- Normal schedule→box-score navigation now hits Provider 0 (GAME_CACHE) with full schedule data

**Fix part B — Provider 2.5:**
- If Provider 2 (cache scan) misses: call `await getLeagueOverview()` to repopulate DAY_CACHE + LEAGUE_CACHE, then retry `findInCache(gameId)`
- Handles direct URL navigation / page refresh
- Adds ~1–2s latency on first direct load but guarantees real team names

### Files Modified (Session 5)

**`artifacts/hoopiq/src/providers/cricket.js`:**
- `normalizeTsdbEvent()`: resolve `homeName`/`awayName` before `makeAbbreviation`
- `enrichFromCache(game)`: new helper — supplements placeholder names/venue/competition from cache
- `buildMinimalGame(gameId)`: no longer uses "Unknown"/"UNK"; uses "Team (home)"/"Team (away)" + `_providerNote`
- `seedGameCache(game)`: new **export** — writes to `GAME_CACHE`; skips overwriting fresher entries
- `fetchGameById()`: upgraded to 4-tier chain (Provider 0 → 1 + enrichment → 2 → 2.5 → 3); all tiers log source + team names

**`artifacts/hoopiq/src/api.js`:**
- `fetchCricketOverview()`: seeds all games into `GAME_CACHE` via `cricketProvider.seedGameCache()`

---

## Architecture (as of Feature Session 5)

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

### Match ID Format
```
game.id = "tsdb:{idEvent}"          e.g. "tsdb:1234567"
URL     = /cricket/{competitionSlug}/game/tsdb%3A1234567
Box-score extracts: decodeURIComponent(params.id) → "tsdb:1234567"
fetchGameById receives: "tsdb:1234567"
lookupevent call uses: "1234567" (strips "tsdb:" prefix)
```

### fetchGameById — 4-tier Fallback Chain (Session 5)

```
Provider 0: GAME_CACHE
  ✓ hit  → return (src logged: overview-seed / tsdb-lookupevent / cache-scan / overview-triggered)
  ✗ miss → continue

Provider 1: TSDB lookupevent.php?id={eventId}
  → normalizeTsdbEvent(ev)                          [Bug 1 fixed: homeName resolved first]
  → enrichFromCache(game)                           [Bug 2 fixed: fills placeholder names]
  ✓ success → setCachedGame() → return, logs home/away names
  ✗ fail    → continue

Provider 2: findInCache(gameId)
  Searches DAY_CACHE (dateStr → games[]) + LEAGUE_CACHE (leagueId → events[])
  ✓ hit  → setCachedGame(_provider="cache-scan") → return, logs home/away names
  ✗ miss → console.warn with cache sizes → continue

Provider 2.5: await getLeagueOverview() → retry findInCache(gameId)
  [Bug 3b fixed: handles direct URL navigation / page refresh]
  ✓ hit  → setCachedGame(_provider="overview-triggered") → return, logs home/away names
  ✗ miss → console.warn → continue

Provider 3: buildMinimalGame(gameId)
  Last resort — "Team (home)"/"Team (away)" + _providerNote with event ID
  NOT cached (retry fresh on next navigation)
```

### seedGameCache — Overview Seeding (Session 5)

```
fetchCricketOverview() [api.js]
  → cricketProvider.getLeagueOverview()
  → result: { live[], upcoming[], recentCompleted[], lastPlayed }
  → for each game: cricketProvider.seedGameCache(game)
     → GAME_CACHE.set(game.id, { game: {..., _provider:"overview-seed"}, fetchedAt })
     → Skips if existing entry has _provider NOT in ["minimal-fallback", "overview-seed"]
       (preserves fresher detail-fetch results)
```

### File Layout
```
artifacts/hoopiq/
  src/
    api.js                    — adapter boundary; seeds GAME_CACHE from overview (Session 5)
    App.tsx                   — routes; cricket routes MUST come before /:league catch-all
    providers/
      cricket.js              — TheSportsDB; 4-tier fetchGameById; seedGameCache export
      espn.js / nba.js / wnba.js / nbadotcom.js / thesportsdb.js / nznbl.js / football.js
    lib/
      date-utils.ts           ← single source of truth for ALL local-timezone helpers
      cricket-types.ts        — CricketGame, CricketPlayer, CricketInnings, etc.
      cricket-scoring.ts      — scoring engine (T20/ODI/Test/Hundred/T10 profiles)
      cricket-ai-intelligence.ts  ← AI Match Intelligence + weather heuristic
      ai-player-rating.ts     ← per-player AI rating + PlayerBadge classification
      provider-manager.ts     — createProviderManager() — not yet wired into api.js
    pages/
      cricket-schedule.tsx    — /cricket — Recent/Today/Tomorrow tabs
      cricket-box-score.tsx   — MatchSummaryCard + AI Insights + Badges
      cricket-optimizer.tsx   — DetectedFormatCard + AI Badges
    components/
      cricket-match-intelligence.tsx  ← AI Insights Panel + Captain/VC + Estimated weather
```

### Key Invariants — NEVER BREAK THESE

1. **`safeCall()` wraps every provider call** in `api.js`. Never remove.
2. **UI never imports from providers directly** — only from `src/api.js`.
3. **Cricket routes in `App.tsx` before `/:league`** — `/cricket/:competition/game/:id` before `/:league/game/:id`.
4. **`mapTsdbStatus()` never infers `in_progress` from time** — only from TSDB strStatus.
5. **`isGameSoon(game)`** in `basketball.tsx` — 48h window filter. Do not remove.
6. **`fetchGamesByLeagueAndLocalDate()`** in `api.js` — fetches both local date AND prev ESPN date.
7. **StatusBadge "Starting" window = 8h** in `cricket-schedule.tsx`. Do not reduce.
8. **All date/time helpers live in `src/lib/date-utils.ts`** — no new helpers in page files.
9. **`PORT` and `BASE_PATH` are required** for both `vite dev` and `vite build`.
10. **AI intelligence `isMock: true`** on all outputs — show MOCK badge until real AI wired.
11. **`isPlaceholder: true`** on `pitchReport`/`weather` in MatchConditions — values ARE derived from heuristics; flag means "not from live API". Do not remove until real API wired.
12. **`computePlayerAIRating()` returns `isMock: true`** — keep until real player-history provider wired.
13. **`computePlayerBadge()` is exclusive** — HOT→SAFE→VALUE PICK→RISKY→DIFFERENTIAL. Do not change priority without updating docs.
14. **`fetchGameById()` never returns null** — Provider 3 always returns a renderable shell.
15. **`fmtDate()` in cricket.js** uses `toLocaleDateString("en-CA")`. Do NOT revert to UTC.
16. **`normalizeTsdbEvent()` resolves `homeName`/`awayName` before `makeAbbreviation`** — never pass raw `ev.strHomeTeam` to `makeAbbreviation` directly (Bug 1 fix).
17. **`seedGameCache()` is called in `fetchCricketOverview()`** after every successful overview load — do not remove. This seeding is what prevents UNK vs UNK on normal navigation (Bug 3 fix).
18. **`enrichFromCache(game)` is called after Provider 1 normalization** in `fetchGameById()` — do not remove. This fills placeholder team names from schedule cache (Bug 2 fix).

### Dev Commands
```bash
pnpm --filter @workspace/hoopiq run typecheck         # must pass before every commit
PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev    # Vite dev server
PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run build  # production build
git push origin main   # from /home/runner/FantasyIQ
```

---

## Cricket Provider Architecture

### GAME_CACHE TTLs
- Scheduled / in-progress: 2 minutes
- Final: 10 minutes
- overview-seed entries: follow the scheduled TTL (2 min)

### _provider field values
| Value | Set by | Meaning |
|-------|--------|---------|
| `"overview-seed"` | `seedGameCache()` | Seeded from overview result; may be overwritten by detail fetch |
| `"tsdb-lookupevent"` | Provider 1 | Direct TSDB event lookup; enriched if team names were placeholders |
| `"cache-scan"` | Provider 2 | Found in DAY_CACHE or LEAGUE_CACHE |
| `"overview-triggered"` | Provider 2.5 | Found after triggering overview refresh (direct URL navigation) |
| `"minimal-fallback"` | Provider 3 | Last resort — game not found anywhere |

### Weather Derivation
| Dew Factor | condition | label |
|------------|-----------|-------|
| HIGH | HUMID | "Warm & Humid (Est.)" |
| MODERATE | HUMID | "Partly Overcast (Est.)" |
| LOW | CLEAR | "Mostly Clear (Est.)" |
| NONE | CLEAR | "Clear / Variable (Est.)" |

### TheSportsDB Cricket League IDs (KNOWN_LEAGUES)
```javascript
[
  { id: 4460, name: "Indian Premier League",        format: "T20"  },
  { id: 4461, name: "Big Bash League",              format: "T20"  },
  { id: 4463, name: "Vitality T20 Blast",           format: "T20"  },
  { id: 4458, name: "County Championship Div 1",    format: "Test" },
  { id: 4459, name: "County Championship Div 2",    format: "Test" },
  { id: 4462, name: "SA T20 Challenge",             format: "T20"  },
  { id: 5067, name: "Pakistan Super League",        format: "T20"  },
  { id: 5174, name: "Super Smash",                  format: "T20"  },
  { id: 5175, name: "Lanka Premier League",         format: "T20"  },
  { id: 5176, name: "Caribbean Premier League",     format: "T20"  },
  { id: 5529, name: "Bangladesh Premier League",    format: "T20"  },
  { id: 5530, name: "Sheffield Shield",             format: "Test" },
  { id: 5532, name: "SA20",                         format: "T20"  },
  { id: 5533, name: "Nepal Premier League",         format: "T10"  },
  { id: 5534, name: "Shpageeza Cricket League",     format: "T20"  },
  { id: 5535, name: "Zimbabwe T20",                 format: "T20"  },
  { id: 5606, name: "Ireland T20 Trophy",           format: "T20"  },
  { id: 5561, name: "The Hundred (Men's)",          format: "The Hundred" },
  { id: 5562, name: "The Hundred (Women's)",        format: "The Hundred" },
  { id: 4464, name: "ICC International T20I",       format: "T20"  },
  { id: 4465, name: "ICC International ODI",        format: "ODI"  },
  { id: 4466, name: "ICC International Test",       format: "Test" },
  { id: 4455, name: "ICC T20 World Cup",            format: "T20"  },
  { id: 4456, name: "ICC Cricket World Cup (ODI)",  format: "ODI"  },
  { id: 4457, name: "ICC Champions Trophy",         format: "ODI"  },
  { id: 4902, name: "ICC Women's T20 World Cup",    format: "T20"  },
  { id: 4903, name: "ICC Women's Cricket World Cup",format: "ODI"  },
  { id: 4904, name: "ICC Women's T20I",             format: "T20"  },
  { id: 4905, name: "ICC Women's ODI",              format: "ODI"  },
  { id: 5560, name: "Women's Premier League",       format: "T20"  },
  { id: 5607, name: "WBBL",                         format: "T20"  },
  { id: 5563, name: "Abu Dhabi T10",                format: "T10"  },
]
```
Note: Some ICC/Women's/Hundred IDs are best-guess. Day-based auto-discovery catches any games with unknown IDs.
