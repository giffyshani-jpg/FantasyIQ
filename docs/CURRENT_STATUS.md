# FantasyIQ — Current Status

**Last updated:** 2026-07-29 (Feature Session 5 — Cricket Match Details Pipeline)
**HEAD:** ecf6015
**Repo:** https://github.com/giffyshani-jpg/FantasyIQ

## Running

| Workflow | Command | Port |
|---|---|---|
| `artifacts/hoopiq: web` | `pnpm --filter @workspace/hoopiq run dev` | 21534 |
| `HoopIQ` (manual) | `PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev` | 21534 |

**Build command:** `PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run build`

Note: `PORT` and `BASE_PATH` are **required** for both dev and build — vite.config.ts enforces this.

## What Works

- Home page — 3-sport hub (Cricket / Basketball / Football)
- Basketball page — NBA + WNBA with **Recent / Today / Tomorrow** tabs (no Day After)
  - Recent tab: `findRecentDate()` walks backwards up to 30 days
- Cricket schedule — **Recent / Today / Tomorrow** tabs (no Day After)
  - Recent tab: scans `overview.recentCompleted`, finds most-recent date
- Cricket box score → back button navigates to `/cricket` ✅ (no 404)
- Cricket optimizer → back-nav "Match Details" → returns to cricket box score ✅
- Football page — infrastructure only
- All individual league pages (NBA, WNBA, NBL, NZNBL, FIBA, NBA Summer)
- Box score, optimizer, play-by-play, player comparison, player detail
- AI Fantasy Coach (12 named picks with data-backed explanations)
- **Cricket match details pipeline fully reliable** — opening any schedule match
  never shows UNK vs UNK or Unknown teams (Session 5 fix)

---

## Feature Session 5 — Cricket Match Details Pipeline (2026-07-29)

**Commit:** `ecf6015`

### Root Cause Analysis

Three independent bugs all contributed to "UNK vs UNK / Unknown teams":

| Bug | Location | Cause | Fix |
|-----|----------|-------|-----|
| Bug 1 | `normalizeTsdbEvent()` | `makeAbbreviation(ev.strHomeTeam)` called with raw null → returned `"UNK"` | Resolve `homeName`/`awayName` fallback **before** calling `makeAbbreviation` |
| Bug 2 | `fetchGameById()` Provider 1 | TSDB `lookupevent.php` returned event with empty team names; accepted as-is | New `enrichFromCache()` — after Provider 1 succeeds, if team names are `"Home"`/`"Away"`, overwrite with real names from DAY_CACHE/LEAGUE_CACHE |
| Bug 3 | `fetchGameById()` + `fetchCricketOverview()` | `DAY_CACHE`/`LEAGUE_CACHE` are empty on fresh browser load (direct URL, page refresh) → Provider 2 always missed → Provider 3 returned "Unknown"/"UNK" shell | **(a)** New `seedGameCache()` export + api.js seeding; **(b)** Provider 2.5 (trigger overview refresh, retry cache scan) |

### Navigation Pipeline (fixed)

```
Schedule page load
  → fetchCricketOverview() → getLeagueOverview()
  → DAY_CACHE + LEAGUE_CACHE populated
  → seedGameCache() called for ALL live + upcoming + recentCompleted + lastPlayed
  → GAME_CACHE pre-populated with full schedule data

User clicks match card
  → URL: /cricket/{competitionSlug}/game/{encodeURIComponent(game.id)}
  → Box-score page: gameId = decodeURIComponent(rawId) (contains "tsdb:{idEvent}")

fetchGameById(gameId) — 4-tier chain:
  Provider 0: GAME_CACHE hit (seeded from overview) → full schedule data ✅
  Provider 1: TSDB lookupevent.php + enrichFromCache() if names are placeholder ✅
  Provider 2: In-memory cache scan (DAY_CACHE + LEAGUE_CACHE) ✅
  Provider 2.5: trigger getLeagueOverview() refresh → retry cache scan ✅
              (handles direct URL / page refresh — adds ~1-2s but gets real data)
  Provider 3: minimal shell (last resort — "Team (home)"/"Team (away)", _providerNote)
```

### Changes Made

**`artifacts/hoopiq/src/providers/cricket.js`:**
- `normalizeTsdbEvent()`: resolve `homeName`/`awayName` before `makeAbbreviation` (Bug 1)
- `enrichFromCache()`: new helper — fills placeholder team names + missing venue/competition/format from cache (Bug 2)
- `buildMinimalGame()`: no longer uses `"Unknown"`/`"UNK"` strings; uses `"Team (home)"`/`"Team (away)"` + `_providerNote` with event ID for debugging
- `seedGameCache()`: new **export** — writes to `GAME_CACHE` from overview callers (Bug 3a); skips overwriting real detail-fetch results
- `fetchGameById()`: upgraded to 4-tier chain — Provider 0 (GAME_CACHE) + Provider 1 (TSDB + enrichment) + Provider 2 (cache scan) + Provider 2.5 (overview-triggered refresh) + Provider 3 (minimal shell). All tiers log which source and team names they supplied.

**`artifacts/hoopiq/src/api.js`:**
- `fetchCricketOverview()`: after successful result, seeds all games (live + upcoming + recentCompleted + lastPlayed) into `GAME_CACHE` via `cricketProvider.seedGameCache()` (Bug 3a)

### Verification

| Check | Result |
|-------|--------|
| TypeScript | ✅ 0 errors |
| Production build | ✅ Success (chunk-size warning only — pre-existing) |
| safeCall() intact | ✅ |
| Key invariants 1–15 | ✅ All confirmed |
| Commit pushed | ✅ `ecf6015` on `origin/main` |

---

## Feature Session 4 — Cricket Data Engine (2026-07-28)

### ✅ Task 1 — Fix Cricket Date/Time Engine
**Commit:** `240859e`

- `fmtDate()` in cricket.js: UTC → local timezone via `toLocaleDateString("en-CA")`
- Day-based query window expanded from `[-1..+3]` to `[-2..+3]` (48h Recent support)
- `normalizeTsdbEvent()` fallback `startTimeIso` uses UTC noon proxy
- `recentCompleted` capped at 48h (was: all completed games ever)
- `KNOWN_LEAGUES` expanded: The Hundred M/W, ICC Int'l T20I/ODI/Test, ICC T20WC/ODIWC/CT, WPL, WBBL, Abu Dhabi T10
- `cricket-schedule.tsx` Recent tab: all completed last 48h; Today/Tomorrow: include completed from recentCompleted; dedup by id

### ✅ Task 2 — Auto-detect Match Format
**Commit:** `878b817`

- Removed `ProfileSelector` (manual picker); added `DetectedFormatCard` (read-only)
- `FORMAT_COLORS` map for colour-coded format badges; `SCORING_PROFILES` import removed

### ✅ Task 3 — Cricket Data Fallback Engine
**Commit:** `cc0f57c`

- 3-tier `fetchGameById()` fallback (upgraded to 4-tier in Session 5)
- `GAME_CACHE`, `findInCache()`, `buildMinimalGame()`
- `NoScorecard` → rich pre-match panel with venue/competition/format

### ✅ Tasks 4+5 — Match Details & Optimizer Data
**Commit:** `9828fc7`

- `MatchSummaryCard` for completed matches
- `deriveWeatherFromHeuristic()` — weather label from dew factor
- Pitch: PLACEHOLDER → ESTIMATED badge; Weather: always shows derived label

### ✅ Task 6 — Smoke Test
- TypeScript: ✅ | Build: ✅ | All invariants confirmed

---

## TypeScript / Build

- TypeScript: ✅ Clean (0 errors) after Session 5
- Build: ✅ Success (chunk-size warning only — pre-existing)

## Known Issues / Limitations

- Cricket live scores: TSDB free tier only returns NS/FT — games show "Starting" status
- Football fantasy logic not implemented
- AI intelligence/ratings are mock/heuristic — no live pitch, weather, player history, or ML data
- Weather/pitch/conditions in AI Insights show ESTIMATED badge (derived from format heuristics, not live API)
- Player of Match, Toss result not available from TSDB free tier
- Innings scorecard not available from TSDB free tier
- Provider 3 (minimal fallback) now uses "Team (home)"/"Team (away)" rather than "Unknown"/"UNK" — only reached if game is truly absent from TSDB and all schedule caches
