# FantasyIQ — AI Handoff

## Latest Session Summary

Session 6 — Tasks 1, 2, 3 complete — 2026-07-29.

---

## Session 6 Changes

### Task 1 — Basketball Auto Pick: Captain + Vice Captain
**File:** `artifacts/hoopiq/src/pages/fantasy-optimizer.tsx`
**Commit:** `88f0198`

**Problem:** `handleAutoPick()` hard-coded `captainId: null` and `viceCaptainId: null` after picking 8 players. Captain and VC were never assigned.

**Fix (lines ~753–772):**
```javascript
const finalIds = picked.slice(0, LINEUP_SIZE);

// Rank picked players by baseFpts descending to auto-assign C and VC.
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

applyLineup({
  playerIds: finalIds,
  captainId: autoCaptainId,
  viceCaptainId: autoVCId,
});
```

Works for both the greedy-within-budget path and the no-credits path. Total FPTS is correct because `applyLineup` triggers `totalEffectiveFpts` which already applies `fptsMultiplier(role)` (×2.0 captain, ×1.5 VC).

---

### Task 2 — Cricket Optimizer Football Cleanup
**Status:** Already complete from Session 4 (`878b817`). No action needed.

Verified: no football items exist anywhere in `cricket-optimizer.tsx`. Format is auto-detected via `DetectedFormatCard`. Cricket-only roles (BAT/BOWL/ALL/WK) and cricket-only scoring (`calculateCricketFantasyPoints`).

---

### Task 3 — Completed Match Fantasy Points
**File:** `artifacts/hoopiq/src/pages/cricket-box-score.tsx`
**Commit:** `31b6b57`

#### BattingCard — new Strike Rate column
- Added `SR` column header (7th column, `w-9`)
- Grid changed: `grid-cols-[1fr_auto_auto_auto_auto_auto_auto]`
- Value: `bat.strikeRate.toFixed(1)` or `"—"` if null
- Colour: green ≥150, red <70, muted otherwise

#### BowlingCard — new Economy column
- Added `Econ` column header (7th column, `w-9`)  
- Grid changed: `grid-cols-[1fr_auto_auto_auto_auto_auto_auto]`
- Value: `bowl.economy.toFixed(2)` or `"—"` if null
- Colour: green <6.00, red >10.00, muted otherwise

#### New FieldingCard component
- Gathers players from both batting+bowling teams, deduplicates by id
- Only renders when ≥1 player has catches/stumpings/runOuts
- Columns: Fielder | C | St | RO | FPTS
- RO = runOutsDirect + runOutsIndirect
- FPTS shows `pts.fielding` from `calculateCricketFantasyPoints()` breakdown
- No fabrication — all values come from `CricketFieldingStats`

#### InningsSection — wires in FieldingCard
```tsx
<BattingCard innings={innings} profile={profile} ratings={ratings} />
<BowlingCard innings={innings} profile={profile} ratings={ratings} />
<FieldingCard innings={innings} profile={profile} />
```

#### NoScorecard — updated message for completed matches
**Before:** "Detailed scorecard not available — TheSportsDB free tier provides results only"
**After:**
```
Player statistics unavailable from current provider.
TheSportsDB free tier returns match results only — no detailed scorecard data.
```
The "Player statistics unavailable" line uses `text-sm font-semibold text-amber-300/80` so it's prominent and clearly readable.

---

## Architecture (as of Session 6)

### Routing
```
/              → Home (3 sport hub cards)
/basketball    → BasketballPage (NBA + WNBA sub-sections)
/cricket       → CricketSchedule (Recent / Today / Tomorrow tabs)
/football      → FootballPage (coming soon, infrastructure ready)
/:league       → LeagueGames (nba, wnba, nbl, nznbl, fiba, nba-summer)
/:league/game/:id              → BoxScore
/:league/game/:id/optimizer    → FantasyOptimizer (basketball)
/:league/game/:id/plays        → PlayByPlay
/:league/game/:id/compare      → PlayerComparison
/:league/player/:playerId      → PlayerDetail
/cricket/:competition/game/:id             → CricketBoxScore
/cricket/:competition/game/:id/optimizer   → CricketOptimizer
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

### seedGameCache — Overview Seeding (Session 5)
```
fetchCricketOverview() [api.js]
  → for each game: cricketProvider.seedGameCache(game)
     → GAME_CACHE.set(game.id, { game: {..., _provider:"overview-seed"}, fetchedAt })
     → Skips if existing entry has _provider NOT in ["minimal-fallback", "overview-seed"]
```

### File Layout
```
artifacts/hoopiq/
  src/
    api.js                    — adapter boundary; seeds GAME_CACHE from overview
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
      cricket-box-score.tsx   — BattingCard(SR) + BowlingCard(Econ) + FieldingCard + unavailable msg
      cricket-optimizer.tsx   — DetectedFormatCard + cricket-only scoring + Auto-Pick with C/VC
      fantasy-optimizer.tsx   — basketball optimizer; Auto Pick assigns C + VC automatically
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
