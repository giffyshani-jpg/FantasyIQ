# FantasyIQ — Current Status

**Last updated:** 2026-07-28 (Feature Session 2 — Tasks 1–3 complete, Task 4 smoke-tested)
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

## AI Engine (Feature Session 2)

### ✅ Task 1 — AI Player Rating Engine

**Files added/modified:**
- `artifacts/hoopiq/src/lib/ai-player-rating.ts` — new reusable engine
- `artifacts/hoopiq/src/pages/cricket-box-score.tsx` — AI Rating badges on player rows

**Per-player 0–100 composite score, role-aware (Bat / Bowl / AR / WK):**

| Factor | Weight (Bat) | Weight (Bowl) | Weight (AR) | Weight (WK) |
|--------|-------------|--------------|------------|------------|
| Recent Form | 28% | 28% | 25% | 26% |
| Venue Record | 10% | 10% | 10% | 8% |
| Opposition Strength | 10% | 12% | 10% | 8% |
| Batting Position | 15% | 0% | 10% | 18% |
| Bowling Opportunity | 0% | 18% | 10% | 0% |
| Fantasy Consistency | 18% | 17% | 20% | 20% |
| Expected Playing Time | 12% | 10% | 10% | 12% |
| Risk Score | 7% | 5% | 5% | 8% |

**Rating labels:** Elite (85+) · Excellent (72+) · Good (58+) · Average (44+) · Risky (30+) · Poor (<30)

**Display:** Colour-coded `AI XX` badge on every batting and bowling scorecard row.

**Architecture:** Each factor is an isolated function — swap for live provider without changing interfaces.

### ✅ Task 2 — Captain & VC Engine

**Files modified:**
- `artifacts/hoopiq/src/lib/cricket-ai-intelligence.ts` — `CaptainVCEngine` + `CaptainVCPick` types
- `artifacts/hoopiq/src/components/cricket-match-intelligence.tsx` — Captain/VC Engine card section

**New `CaptainVCEngine` fields per pick:**
| Field | Description |
|-------|-------------|
| `captainScore` | 0–100 composite captain suitability |
| `riskPct` | 0–100 risk (high = volatile) |
| `confidencePct` | 0–100 AI confidence |
| `aiRating` | 0–100 from player rating model |
| `label` | BEST_CAPTAIN / BEST_VC / SAFE_PICK / GRAND_LEAGUE |

**Four recommendations:** ⭐ Best Captain · ⭐ Best VC · ⭐ Safe Pick · ⭐ Grand League Differential

### ✅ Task 3 — Match Conditions

**Files modified:**
- `artifacts/hoopiq/src/lib/cricket-ai-intelligence.ts` — `MatchConditions`, `PitchReport`, `WeatherCondition` types
- `artifacts/hoopiq/src/components/cricket-match-intelligence.tsx` — new sections rendered

**New `MatchConditions` sections in card:**
| Section | Status |
|---------|--------|
| Pitch Report (surface label + batting/bowling % bars) | ✅ Format-aware (PLACEHOLDER) |
| Pace vs Spin Advantage | ✅ Format-aware badge |
| Weather | ✅ Extended (PLACEHOLDER — needs API) |
| Dew Factor | ✅ Format-aware DewImpact: NONE/LOW/MODERATE/HIGH |
| Toss Bias | ✅ Replaced legacy toss with rich section |
| Batting Friendly % | ✅ Derived from surface profile |
| Bowling Friendly % | ✅ Derived from surface profile |

### ✅ Task 4 — Smoke Test

- TypeScript: ✅ Clean (0 errors) after all tasks
- Build: ✅ Success (chunk-size warning only — pre-existing)
- Cricket tab: ✅ Works
- Basketball tab: ✅ Works
- Optimizer: ✅ Works
- AI card: ✅ Renders (expanded shows all new sections)
- Player ratings: ✅ Badge visible on scorecard rows
- Captain suggestions: ✅ All 4 picks shown with scores

## Feature Session 1 AI Engine

### ✅ Task 1 (Session 1) — AI Match Intelligence Card
See archived notes in `docs/AI_HANDOFF.md`.

## TypeScript / Build

- TypeScript: ✅ Clean (0 errors) after Tasks 1–3
- Build: ✅ Success after Tasks 1–3 (chunk-size warning only)

## Commit Hashes (Feature Session 2)

| Task | Commit |
|------|--------|
| Task 1 — AI Player Rating Engine (engine file) | `2760a91` |
| Task 2+3 — Captain/VC Engine + Match Conditions | `9bb1273` |
| Task 1 — AI Rating badge on box score rows | `c46bd17` |

## Known Issues / Limitations

- Cricket live scores: TSDB free tier only returns NS/FT — games show "Starting"
- Football fantasy logic not implemented
- Provider manager (`provider-manager.ts`) implemented but not yet wired
- AI intelligence/ratings are mock/heuristic — no live pitch, weather, player history, or ML data
- See `docs/KNOWN_ISSUES.md` for full tracking
