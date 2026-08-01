# FantasyIQ — Current Status

**Last updated:** 2026-07-29 (Session 7 — Task 1 complete, Tasks 2 & 3 in progress)
**HEAD:** (see commits below)
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
- **Basketball optimizer — Auto Pick now assigns Captain and Vice Captain automatically** ✅ Session 6 (`88f0198`)
- Cricket schedule — **Recent / Today / Tomorrow** tabs (no Day After)
  - Recent tab: scans `overview.recentCompleted`, finds most-recent date
- Cricket box score → back button navigates to `/cricket` ✅ (no 404)
- Cricket optimizer → back-nav "Match Details" → returns to cricket box score ✅
- **Cricket optimizer — no football items; format auto-detected; cricket-only scoring** ✅ Session 4 (`878b817`)
- **Cricket box score — SR, Economy, Fielding card, fantasy points for completed matches** ✅ Session 6 (`31b6b57`)
- **Cricket box score — "Player statistics unavailable from current provider." shown when no stats** ✅ Session 6
- **Football page — live scores, upcoming matches, recent results from TheSportsDB** ✅ Session 7 (`36f7f8d`)
- All individual league pages (NBA, WNBA, NBL, NZNBL, FIBA, NBA Summer)
- Box score, optimizer, play-by-play, player comparison, player detail
- AI Fantasy Coach (12 named picks with data-backed explanations)
- **Cricket match details pipeline fully reliable** — opening any schedule match
  never shows UNK vs UNK or Unknown teams (Session 5 fix)

---

## Session 7 — Football Foundation Audit (2026-07-29)

### Task 1 — Football Foundation Audit + Fix
**Commit:** `36f7f8d`

**Audit findings:**

| Layer | Status |
|-------|--------|
| `providers/football.js` | ✅ Functional — TSDB `eventsday.php?s=Soccer` wired |
| `api.js` exports | ✅ `fetchFootballOverview()`, `fetchFootballGamesByDate()` wired + safeCall |
| `football.tsx` (page) | ❌ BROKEN — used `setTimeout` stub, never called provider |
| Football types lib | ❌ MISSING — no `football-types.ts` |
| Football scoring engine | ❌ MISSING — no `football-scoring.ts` |
| Match detail page | ❌ MISSING — no `/football/:leagueId/game/:id` route |
| Optimizer page | ❌ MISSING — Task 2 |
| `getPlayerGameLog()` | ❌ STUB — always returns `[]` |
| `getTeamSchedule()` | ❌ STUB — always returns `[]` |
| Lineups / stats | ❌ NOT IMPLEMENTED |
| Standings | ❌ NOT IMPLEMENTED (`lookuptable.php` available but not wired) |

**What was fixed:**
- Removed `setTimeout` stub from `football.tsx`
- Now calls `fetchFootballOverview()` from `api.js` on mount
- Displays: Live Now, Upcoming (up to 10), Recent Result sections
- Added `FootballGame`, `FootballTeam`, `FootballOverview` interfaces
- Added Refresh button
- Replaced "Coming Soon" hard-stop with "Fantasy optimizer coming next" notice

| Check | Result |
|-------|--------|
| TypeScript | ✅ 0 errors |
| Production build | ✅ |
| Commit pushed | ✅ `36f7f8d` on `origin/main` |

### Football Gap Analysis (full)

**Not broken — not yet implemented (gap list for future sessions):**

1. No football types library — `FootballPlayer`, `FootballLineup`, `FootballOptimizerState` all missing
2. No football scoring engine — no fantasy points calculation (Task 2)
3. No match detail page — no `/football/:leagueId/game/:id` route
4. No football optimizer — no Auto Pick, no Captain/VC, no formation validation (Task 2)
5. No Recent/Today/Tomorrow tab pattern matching cricket/basketball
6. `getPlayerGameLog()` stub — always returns `[]`
7. `getTeamSchedule()` stub — always returns `[]`
8. No lineups from TSDB (TSDB `lookupevent.php` has lineup data in some matches but not wired)
9. No player statistics
10. No standings (TSDB `lookuptable.php` available but not wired)
11. No competition-specific sub-pages
12. No football-specific AI intelligence

---

## Session 6 — Tasks 1, 2, 3 (2026-07-29)

### Task 1 — Basketball Auto Pick Fix
**Commit:** `88f0198`

**Fix:** After picking 8 players, sort by `baseFpts` descending:
- `captainId` = highest FPTS picked player
- `viceCaptainId` = second highest FPTS picked player

---

### Task 2 — Cricket Optimizer Football Cleanup
**Status:** Already complete from Session 4 (`878b817`). No action needed.

---

### Task 3 — Completed Match Fantasy Points
**Commit:** `31b6b57`

| Feature | Before | After |
|---------|--------|-------|
| Batting SR column | ❌ missing | ✅ SR column (green ≥150, red <70) |
| Bowling Economy column | ❌ missing | ✅ Econ column (green <6, red >10) |
| Fielding card | ❌ missing | ✅ `FieldingCard` — C / St / RO / FPTS(fielding) |
| No-stats message | generic | ✅ "Player statistics unavailable from current provider." |

---

## Feature Session 5 — Cricket Match Details Pipeline (2026-07-29)

**Commit:** `ecf6015` — UNK vs UNK fix (3 bugs)

---

## Feature Session 4 — Cricket Data Engine (2026-07-28)

**Commits:** `240859e`, `878b817`, `cc0f57c`, `9828fc7`

---

## TypeScript / Build

- TypeScript: ✅ Clean (0 errors) after Session 7 Task 1
- Build: ✅ Success (chunk-size warning only — pre-existing)

## Known Issues / Limitations

- Cricket live scores: TSDB free tier only returns NS/FT — games show "Starting" status
- Football fantasy logic not implemented (Task 2)
- Football match detail pages not implemented
- AI intelligence/ratings are mock/heuristic — no live pitch, weather, player history, or ML data
- Weather/pitch/conditions in AI Insights show ESTIMATED badge (derived from format heuristics, not live API)
- Player of Match, Toss result not available from TSDB free tier
- Innings scorecard not available from TSDB free tier (completed matches show "Player statistics unavailable from current provider.")
- Provider 3 (minimal fallback) uses "Team (home)"/"Team (away)" — only reached if game absent from all caches
