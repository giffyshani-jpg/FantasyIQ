# FantasyIQ — Current Status

**Last updated:** 2026-07-28 (Feature Session 4 — Tasks 1–6 Cricket Data Engine)
**HEAD:** see latest commit
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

## Feature Session 4 — Cricket Data Engine (2026-07-28)

### ✅ Task 1 — Fix Cricket Date/Time Engine
**Commit:** `240859e`

- `fmtDate()` in cricket.js: UTC → local timezone via `toLocaleDateString("en-CA")`
- Day-based query window expanded from `[-1..+3]` to `[-2..+3]` (48h Recent support)
- `normalizeTsdbEvent()` fallback `startTimeIso` uses UTC noon proxy instead of treating strTime as UTC
- `recentCompleted` capped at 48h (was: all completed games ever)
- `KNOWN_LEAGUES` expanded: The Hundred M/W, ICC Int'l T20I/ODI/Test, ICC T20WC/ODIWC/CT, WPL, WBBL, Abu Dhabi T10
- `cricket-schedule.tsx` Recent tab: all completed last 48h (not just most-recent date)
- Today/Tomorrow tabs: include completed games from recentCompleted matching the target date
- Deduplication by id added for Today/Tomorrow
- `detectFormat()` improved: ODI excludes T20WC false positives; T10 catches Abu Dhabi T10

**Files modified:**
- `artifacts/hoopiq/src/providers/cricket.js`
- `artifacts/hoopiq/src/pages/cricket-schedule.tsx`

---

### ✅ Task 2 — Auto-detect Match Format
**Commit:** `878b817`

- Removed `ProfileSelector` (manual ODI/Test/T20/T10/Hundred picker) from cricket-optimizer.tsx
- Added `DetectedFormatCard` (read-only) showing format name badge + "AUTO-DETECTED from {competition}" label
- `FORMAT_COLORS` map for colour-coded format badges (orange/blue/amber/purple/pink)
- `profile` state kept internally — still drives scoring calculations — only UI selector removed
- Auto-selection on game load via `getScoringProfile(g.format, g.competitionName)` unchanged
- Removed unused `SCORING_PROFILES` import

**Files modified:**
- `artifacts/hoopiq/src/pages/cricket-optimizer.tsx`

---

### ✅ Task 3 — Cricket Data Fallback Engine
**Commit:** `cc0f57c`

**Provider fallback chain in `fetchGameById()`:**
| Tier | Provider | Behaviour |
|------|----------|-----------|
| 1 | TSDB lookupevent.php | Primary — logs success |
| 2 | In-memory cache scan | Searches DAY_CACHE + LEAGUE_CACHE from getLeagueOverview |
| 3 | Minimal game shell | Never returns null — always renderable |

- Added `GAME_CACHE` (2 min for scheduled / 10 min for final)
- `findInCache()` scans all in-memory DAY_CACHE + LEAGUE_CACHE entries
- `buildMinimalGame()` constructs a displayable game shell with `_provider: "minimal-fallback"`
- `console.info/warn` logs which provider succeeded or fell through

**UI improvements — no more blank pages:**
- `NoScorecard` → full pre-match / no-scorecard panel with venue, competition, format, start time
- Scheduled: start time + "scoring data will appear once match begins"
- Completed without scorecard: result text + venue + data-tier note
- Optimizer: context-aware empty state (per scheduled/in-progress/final status + venue/competition)

**Files modified:**
- `artifacts/hoopiq/src/providers/cricket.js`
- `artifacts/hoopiq/src/pages/cricket-box-score.tsx`
- `artifacts/hoopiq/src/pages/cricket-optimizer.tsx`

---

### ✅ Tasks 4+5 — Match Details & Optimizer Data
**Commit:** `9828fc7`

**Task 4 — Match Details:**
- `MatchSummaryCard` added to cricket-box-score.tsx — shown for all `final`-status matches above AI card
  - Displays: Result, Venue, Competition, Format + note that POTM/Toss are not in TSDB free tier
- NoScorecard (Task 3) already handles upcoming/in-progress pre-match panels

**Task 5 — Optimizer Data (remove Awaiting data):**
- `cricket-ai-intelligence.ts`: added `deriveWeatherFromHeuristic()` — derives weather condition + label + impact from dew factor:
  - HIGH dew → "Warm & Humid (Est.)"
  - MODERATE dew → "Partly Overcast (Est.)"
  - LOW dew → "Mostly Clear (Est.)"
  - NONE dew → "Clear / Variable (Est.)"
- `cricket-match-intelligence.tsx`:
  - Weather section: shows derived label + ESTIMATED badge instead of dashed PlaceholderPill
  - Pitch Report badge: PLACEHOLDER → ESTIMATED
  - AIInsightsPanel Weather MetricRow: shows derived label (not "Awaiting data")

**Files modified:**
- `artifacts/hoopiq/src/lib/cricket-ai-intelligence.ts`
- `artifacts/hoopiq/src/components/cricket-match-intelligence.tsx`
- `artifacts/hoopiq/src/pages/cricket-box-score.tsx`

---

### ✅ Task 6 — Smoke Test + Zero Runtime Errors
**Date:** 2026-07-28

| Check | Result |
|-------|--------|
| TypeScript | ✅ 0 errors (all 6 tasks) |
| Production build | ✅ Success (chunk-size warning only — pre-existing) |
| safeCall() intact | ✅ 10 usages in api.js |
| mapTsdbStatus() — no time inference | ✅ Only uses TSDB strStatus |
| Cricket routes before /:league | ✅ Lines 36–37 before lines 43–48 in App.tsx |
| date-utils.ts single source | ✅ No new local date helpers in page files |
| UI never imports from providers | ✅ 0 direct imports from providers/ in pages/*.tsx |
| All key invariants (1–13) | ✅ Confirmed |

---

## TypeScript / Build

- TypeScript: ✅ Clean (0 errors) after Session 4 all 6 tasks
- Build: ✅ Success (chunk-size warning only — pre-existing)

## Commit Hashes (Feature Session 4)

| Task | Commit |
|------|--------|
| Task 1 — Cricket Date/Time Engine | `240859e` |
| Task 2 — Auto-detect Match Format | `878b817` |
| Task 3 — Data Fallback Engine | `cc0f57c` |
| Tasks 4+5 — Match Details + Optimizer Data | `9828fc7` |
| Task 6 — Smoke Test (this doc update) | see HEAD |

## Known Issues / Limitations

- Cricket live scores: TSDB free tier only returns NS/FT — games show "Starting" status
- Football fantasy logic not implemented
- AI intelligence/ratings are mock/heuristic — no live pitch, weather, player history, or ML data
- Weather/pitch/conditions in AI Insights show ESTIMATED badge (not from live API — derived from format heuristics)
- Player of Match, Toss result not available from TSDB free tier (noted in MatchSummaryCard)
- Innings scorecard not available from TSDB free tier (noted in NoScorecard panel)
- See `docs/KNOWN_ISSUES.md` for full tracking
