# FantasyIQ — AI Handoff

## Latest Session Summary

Session 8 — Task 1 (Football Live Mode) complete — 2026-08-01.
Tasks 2 (Football Fantasy Engine), 3 (Football Optimizer), and 4 (Basketball AI Analysis) are not started.

---

## Session 8 Changes

### Task 1 — Football Live Mode
**Commit:** `dc26f0306e27eed3779f88f4542d7d4ed6d9da06`

**Root cause:** The football page only showed a limited overview with one recent result, lacked match navigation, and discarded optional match metadata from TheSportsDB.

**Implemented:**
- Replaced the football hub with a live match centre ordered as Live Now, Upcoming, and Finished.
- Grouped matches by league in each section.
- Added clickable match cards with team logos, league badges, kickoff/date, venue, current score, status, and provider-supplied minute text.
- Preserved and displayed provider-supplied yellow cards, red cards, penalty shootout scores, and extra-time scores when available.
- Added `/football/:leagueId/game/:id` match details with the same optional event data.
- Added shared football types for provider-backed match and team data.
- Added `fetchFootballGame()` through the existing `safeCall()` API boundary.
- Did not fabricate missing scores, minutes, cards, penalties, or extra-time values.

**Verification:**
- TypeScript: ✅ 0 errors
- Production build: ✅ success
- Runtime smoke check: ✅ `/football` returned HTTP 200
- Workflow: ✅ HoopIQ running without browser or workflow errors

**Remaining football limitations:**
- TheSportsDB free data may omit live minute text, lineups, cards, penalties, and extra-time fields; the UI hides unavailable values.
- Football player statistics, fantasy scoring, and optimizer remain future tasks.

---

## Session 7 Changes

### Task 1 — Football Foundation Audit + Fix
**File:** `artifacts/hoopiq/src/pages/football.tsx`
**Commit:** `36f7f8d`

**Root cause:** `football.tsx` had a `setTimeout` stub in `useEffect` that never called
the provider. `fetchFootballOverview()` was fully wired in `api.js` but the page
discarded it entirely.

**Fix:**
```typescript
// BEFORE (broken stub):
useEffect(() => {
  const t = setTimeout(() => {
    setStatus({ loaded: true, error: null, competitions: SEEDED_COMPETITIONS });
  }, 400);
  return () => clearTimeout(t);
}, []);

// AFTER (real provider call):
const load = useCallback(async () => {
  setState(s => ({ ...s, loading: true, error: null }));
  const overview = await fetchFootballOverview() as FootballOverview;
  setState({ overview, loading: false, error: null, lastRefreshed: Date.now() });
}, []);

useEffect(() => { void load(); }, [load]);
```

**New interfaces added to football.tsx (local, not yet a shared lib):**
- `FootballTeam` — `{ id, name, abbreviation, score: string|null }`
- `FootballGame` — `{ id, leagueId, leagueName, homeTeam, awayTeam, startTimeIso, status, venue, result, league }`
- `FootballOverview` — `{ live: FootballGame[], upcoming: FootballGame[], lastPlayed: FootballGame|null }`
- `FootballPageState` — `{ overview, loading, error, lastRefreshed }`

**New UI sections:**
- `MatchCard` — renders home vs away, score (or kickoff time), venue, league name, live pill
- `StatusPill` — animated green dot for LIVE, "FT" muted for final
- Live Now / Upcoming / Recent Result sections
- Refresh button
- Provider error display

**Gap analysis (not fixed — requires Task 2):**

| Gap | Detail |
|-----|--------|
| `football-types.ts` | Missing — no shared `FootballPlayer`, `FootballLineup` |
| `football-scoring.ts` | Missing — no fantasy points engine |
| Match detail route | `/football/:leagueId/game/:id` does not exist |
| Optimizer route | `/football/:leagueId/game/:id/optimizer` does not exist |
| `getPlayerGameLog()` | Permanent stub returning `[]` |
| `getTeamSchedule()` | Permanent stub returning `[]` |
| Standings | TSDB `lookuptable.php` not wired |
| Lineups / player stats | Not in provider |
| Tab pattern (Recent/Today/Tomorrow) | Not on football page |

---

## Session 6 Changes

### Task 1 — Basketball Auto Pick: Captain + Vice Captain
**File:** `artifacts/hoopiq/src/pages/fantasy-optimizer.tsx`
**Commit:** `88f0198`

**Fix (lines ~753–772):**
```javascript
const pickedPlayers = finalIds
  .map((id) => pool.find((p) => p.id === id)!)
  .filter(Boolean)
  .sort((a, b) =>
    b.baseFpts !== a.baseFpts
      ? b.baseFpts - a.baseFpts
      : a.name.localeCompare(b.name),
  );

const autoCaptainId = pickedPlayers[0]?.id ?? null;
const autoVCId = pickedPlayers[1]?.id ?? null;

applyLineup({ playerIds: finalIds, captainId: autoCaptainId, viceCaptainId: autoVCId });
```

---

### Task 2 — Cricket Optimizer Football Cleanup
**Status:** Already complete from Session 4 (`878b817`). No action needed.

---

### Task 3 — Completed Match Fantasy Points
**File:** `artifacts/hoopiq/src/pages/cricket-box-score.tsx`
**Commit:** `31b6b57`

- BattingCard: added SR column (green ≥150, red <70)
- BowlingCard: added Econ column (green <6.00, red >10.00)
- New FieldingCard: C / St / RO / FPTS (fielding only, no fabrication)
- InningsSection: renders FieldingCard after batting/bowling
- NoScorecard: message updated to "Player statistics unavailable from current provider."

---

## Architecture (as of Session 7)

### Routing
```
/              → Home (3 sport hub cards)
/basketball    → BasketballPage (NBA + WNBA sub-sections)
/cricket       → CricketSchedule (Recent / Today / Tomorrow tabs)
/football      → FootballPage (live scores wired; optimizer TBD — Task 2)
/:league       → LeagueGames (nba, wnba, nbl, nznbl, fiba, nba-summer)
/:league/game/:id              → BoxScore
/:league/game/:id/optimizer    → FantasyOptimizer (basketball)
/:league/game/:id/plays        → PlayByPlay
/:league/game/:id/compare      → PlayerComparison
/:league/player/:playerId      → PlayerDetail
/cricket/:competition/game/:id             → CricketBoxScore
/cricket/:competition/game/:id/optimizer   → CricketOptimizer
```

### Football Provider Architecture
```
Provider: TheSportsDB (free, CORS-open)
Endpoint: eventsday.php?d=YYYY-MM-DD&s=Soccer
Status map: NS→scheduled, FT/AET/PEN→final, 1H/2H/HT/ET/live→in_progress
ID format: "tsdb-football:{idEvent}"
Cache: DAY_CACHE (3 min TTL) in providers/football.js
api.js: fetchFootballOverview() — cached 2 min, safeCall-wrapped
api.js: fetchFootballGamesByDate(dateStr) — safeCall-wrapped
```

### Match ID Format (cricket)
```
game.id = "tsdb:{idEvent}"          e.g. "tsdb:1234567"
URL     = /cricket/{competitionSlug}/game/tsdb%3A1234567
Box-score extracts: decodeURIComponent(params.id) → "tsdb:1234567"
fetchGameById receives: "tsdb:1234567"
lookupevent call uses: "1234567" (strips "tsdb:" prefix)
```

### fetchGameById — 4-tier Fallback Chain (Session 5)

```
Provider 0: GAME_CACHE (pre-seeded by overview)
Provider 1: TSDB lookupevent.php + enrichFromCache()
Provider 2: findInCache() — DAY_CACHE + LEAGUE_CACHE
Provider 2.5: getLeagueOverview() refresh → retry findInCache()
Provider 3: buildMinimalGame() — "Team (home)"/"Team (away)" + _providerNote
```

### File Layout
```
artifacts/hoopiq/
  src/
    api.js                    — adapter boundary; seeds GAME_CACHE from overview
    App.tsx                   — routes; cricket routes MUST come before /:league catch-all
    providers/
      cricket.js              — TheSportsDB; 4-tier fetchGameById; seedGameCache export
      football.js             — TheSportsDB Soccer; getLeagueOverview/getGame/getGamesByDate
      espn.js / nba.js / wnba.js / nbadotcom.js / thesportsdb.js / nznbl.js
    lib/
      date-utils.ts           ← single source of truth for ALL local-timezone helpers
      cricket-types.ts        — CricketGame, CricketPlayer, CricketInnings, etc.
      cricket-scoring.ts      — scoring engine (T20/ODI/Test/Hundred/T10 profiles)
      cricket-ai-intelligence.ts  ← AI Match Intelligence + weather heuristic
      ai-player-rating.ts     ← per-player AI rating + PlayerBadge classification
      provider-manager.ts     — createProviderManager() — not yet wired into api.js
      [MISSING] football-types.ts   ← needed for Task 2
      [MISSING] football-scoring.ts ← needed for Task 2
    pages/
      cricket-schedule.tsx    — /cricket — Recent/Today/Tomorrow tabs
      cricket-box-score.tsx   — BattingCard(SR) + BowlingCard(Econ) + FieldingCard
      cricket-optimizer.tsx   — DetectedFormatCard + cricket-only scoring + Auto-Pick
      fantasy-optimizer.tsx   — basketball optimizer; Auto Pick assigns C + VC
      football.tsx            — /football — live scores wired; optimizer TBD
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
11. **`isPlaceholder: true`** on `pitchReport`/`weather` in MatchConditions — values ARE derived from heuristics. Do not remove until real API wired.
12. **`computePlayerAIRating()` returns `isMock: true`** — keep until real player-history provider wired.
13. **`computePlayerBadge()` is exclusive** — HOT→SAFE→VALUE PICK→RISKY→DIFFERENTIAL. Do not change priority without updating docs.
14. **`fetchGameById()` never returns null** — Provider 3 always returns a renderable shell.
15. **`fmtDate()` in cricket.js** uses `toLocaleDateString("en-CA")`. Do NOT revert to UTC.
16. **`normalizeTsdbEvent()` resolves `homeName`/`awayName` before `makeAbbreviation`** — never pass raw `ev.strHomeTeam` to `makeAbbreviation` directly (Bug 1 fix).
17. **`seedGameCache()` is called in `fetchCricketOverview()`** after every successful overview load — do not remove.
18. **`enrichFromCache(game)` is called after Provider 1 normalization** in `fetchGameById()` — do not remove.
19. **`handleAutoPick()` assigns C + VC** — `autoCaptainId = pickedPlayers[0]?.id`, `autoVCId = pickedPlayers[1]?.id`. Never set these to null in Auto Pick.
20. **`FieldingCard` does NOT fabricate** — only renders when real `CricketFieldingStats` exists; FPTS from `pts.fielding` breakdown only.
21. **`football.tsx` must call `fetchFootballOverview()`** — never revert to the setTimeout stub. The provider is fully wired.
22. **Football scoring is SEPARATE from basketball and cricket** — when `football-scoring.ts` is created (Task 2), it must not import or call cricket/basketball scoring functions.

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
| `"overview-seed"` | `seedGameCache()` | Seeded from overview result |
| `"tsdb-lookupevent"` | Provider 1 | Direct TSDB event lookup + enrichment |
| `"cache-scan"` | Provider 2 | Found in DAY_CACHE or LEAGUE_CACHE |
| `"overview-triggered"` | Provider 2.5 | Found after triggering overview refresh |
| `"minimal-fallback"` | Provider 3 | Last resort — game not found anywhere |

### TheSportsDB Cricket League IDs (KNOWN_LEAGUES)
See Session 5 handoff for full list (unchanged).

### Weather Derivation
| Dew Factor | condition | label |
|------------|-----------|-------|
| HIGH | HUMID | "Warm & Humid (Est.)" |
| MODERATE | HUMID | "Partly Overcast (Est.)" |
| LOW | CLEAR | "Mostly Clear (Est.)" |
| NONE | CLEAR | "Clear / Variable (Est.)" |
