# FantasyIQ — Current Status

**Last updated:** 2026-07-29 (Session 6 — Tasks 1, 2, 3 complete)
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
- **Basketball optimizer — Auto Pick now assigns Captain and Vice Captain automatically** ✅ Task 1 (`88f0198`)
- Cricket schedule — **Recent / Today / Tomorrow** tabs (no Day After)
  - Recent tab: scans `overview.recentCompleted`, finds most-recent date
- Cricket box score → back button navigates to `/cricket` ✅ (no 404)
- Cricket optimizer → back-nav "Match Details" → returns to cricket box score ✅
- **Cricket optimizer — no football items; format auto-detected; cricket-only scoring** ✅ Task 2 (done in Session 4, `878b817`)
- **Cricket box score — SR, Economy, Fielding card, fantasy points for completed matches** ✅ Task 3
- **Cricket box score — "Player statistics unavailable from current provider." shown when no stats** ✅ Task 3
- Football page — infrastructure only
- All individual league pages (NBA, WNBA, NBL, NZNBL, FIBA, NBA Summer)
- Box score, optimizer, play-by-play, player comparison, player detail
- AI Fantasy Coach (12 named picks with data-backed explanations)
- **Cricket match details pipeline fully reliable** — opening any schedule match
  never shows UNK vs UNK or Unknown teams (Session 5 fix)

---

## Session 6 — Tasks 1, 2, 3 (2026-07-29)

### Task 1 — Basketball Auto Pick Fix
**Commit:** `88f0198`

**Problem:** `handleAutoPick()` hard-coded `captainId: null` and `viceCaptainId: null`.

**Fix:** After picking 8 players, sort by `baseFpts` descending:
- `captainId` = highest FPTS picked player
- `viceCaptainId` = second highest FPTS picked player

Total effective FPTS updates correctly via existing `fptsMultiplier(role)` logic.

| Check | Result |
|-------|--------|
| TypeScript | ✅ 0 errors |
| Production build | ✅ |
| Commit pushed | ✅ `88f0198` on `origin/main` |

---

### Task 2 — Cricket Optimizer Football Cleanup
**Status:** Already complete from Session 4 (`878b817`).

No football-specific items were ever present in `cricket-optimizer.tsx`. Verified:
- Roles: BAT / BOWL / ALL / WK (cricket only)
- Scoring: `calculateCricketFantasyPoints()` — cricket only
- Format: `DetectedFormatCard` — auto-detected, no manual selector
- No football positions, scoring, labels, or calculations present

---

### Task 3 — Completed Match Fantasy Points
**Commit:** (see below — committed after build)

**Changes to `cricket-box-score.tsx`:**

| Feature | Before | After |
|---------|--------|-------|
| Batting SR column | ❌ missing | ✅ SR column (green ≥150, red <70) |
| Bowling Economy column | ❌ missing | ✅ Econ column (green <6, red >10) |
| Fielding card | ❌ missing | ✅ `FieldingCard` — C / St / RO / FPTS(fielding) |
| No-stats message for completed matches | "Detailed scorecard not available…" | ✅ "Player statistics unavailable from current provider." |

**Batting card now shows:** Runs, Balls, 4s, 6s, Strike Rate, Fantasy Points

**Bowling card now shows:** Overs, Maidens, Runs, Wickets, Economy, Fantasy Points

**Fielding card now shows:** Catches (C), Stumpings (St), Run Outs (RO), Fantasy Points (fielding portion only)

**No fabrication:** All fantasy points are calculated from real `CricketPlayerStats` via `calculateCricketFantasyPoints()`. If no innings data exists (`game.innings.length === 0`), shows "Player statistics unavailable from current provider." — never invents numbers.

---

## Feature Session 5 — Cricket Match Details Pipeline (2026-07-29)

**Commit:** `ecf6015` — UNK vs UNK fix (3 bugs)

---

## Feature Session 4 — Cricket Data Engine (2026-07-28)

**Commits:** `240859e`, `878b817`, `cc0f57c`, `9828fc7`

---

## TypeScript / Build

- TypeScript: ✅ Clean (0 errors) after Session 6
- Build: ✅ Success (chunk-size warning only — pre-existing)

## Known Issues / Limitations

- Cricket live scores: TSDB free tier only returns NS/FT — games show "Starting" status
- Football fantasy logic not implemented
- AI intelligence/ratings are mock/heuristic — no live pitch, weather, player history, or ML data
- Weather/pitch/conditions in AI Insights show ESTIMATED badge (derived from format heuristics, not live API)
- Player of Match, Toss result not available from TSDB free tier
- Innings scorecard not available from TSDB free tier (completed matches show "Player statistics unavailable from current provider.")
- Provider 3 (minimal fallback) uses "Team (home)"/"Team (away)" — only reached if game absent from all caches
