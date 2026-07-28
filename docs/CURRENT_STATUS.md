# FantasyIQ — Current Status

**Last updated:** 2026-07-28 (Feature Session 3 — Task 1 AI Insights Panel + Task 2 Player AI Badges)
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

## AI Engine (Feature Session 3)

### ✅ Task 1 — AI Insights Panel (rebuilt)

**Files modified:**
- `artifacts/hoopiq/src/lib/cricket-ai-intelligence.ts` — added `riskPick` + `teamConfidencePct` to `CaptainVCEngine`; `CaptainLabel` now includes `RISK_PICK`
- `artifacts/hoopiq/src/components/cricket-match-intelligence.tsx` — new polished `AIInsightsPanel` section

**New `AIInsightsPanel` inside the Cricket Match Intelligence card:**
| Signal | What it shows |
|--------|---------------|
| ⭐ Best Captain | Player name, AI rating, score, confidence |
| ⭐ Best VC | Player name, AI rating, score, confidence |
| 🔥 Differential Pick | Compact pick chip (last name + AI rating) |
| 🛡 Safe Pick | Compact pick chip |
| ⚠ Risk Pick | Compact pick chip (new — high-variance boom-or-bust) |
| 📈 Team Confidence % | Bar + percentage |
| 🎯 Match Difficulty | Level label + /100 score + bar |
| 🌤 Weather | Label (placeholder until API wired) |
| 🏟 Pitch | Surface label + batting % bar |
| 🪙 Toss Importance | Label + importance % bar |

**New engine fields:**
- `riskPick: CaptainVCPick` — 5th pick, high-variance batter/bowler outside main 4
- `teamConfidencePct: number` — avg of C+VC confidence, adjusted by format risk level

**Commit:** `0ad74c2`

### ✅ Task 2 — Player AI Badges (new)

**Files modified:**
- `artifacts/hoopiq/src/lib/ai-player-rating.ts` — new `PlayerBadge` type + `computePlayerBadge()` function
- `artifacts/hoopiq/src/pages/cricket-box-score.tsx` — `PlayerBadgeChip` component; badges on batting + bowling rows
- `artifacts/hoopiq/src/pages/cricket-optimizer.tsx` — `AIRatingChip` + `PlayerBadgeChip` on every PlayerRow

**Badge classification (exclusive, priority order):**
| Badge | Colour | Condition |
|-------|--------|-----------|
| 🔥 HOT | Orange | overall ≥ 78 |
| 🛡 SAFE | Green | riskScore ≥ 68 AND overall ≥ 55 |
| 💎 VALUE PICK | Cyan | overall ≥ 58 AND credits < 8.5 |
| ⚠ RISKY | Red | overall < 44 |
| ⚡ DIFF | Purple | overall ≥ 52 (catch-all for strong-but-not-hot players) |

**Commit:** see latest

## AI Engine (Feature Session 2)

### ✅ Task 1 — AI Player Rating Engine
**Files:** `ai-player-rating.ts`, `cricket-box-score.tsx`
**Commits:** `2760a91`, `c46bd17`

### ✅ Task 2 — Captain & VC Engine
**Files:** `cricket-ai-intelligence.ts`, `cricket-match-intelligence.tsx`
**Commit:** `9bb1273`

### ✅ Task 3 — Match Conditions
**Files:** `cricket-ai-intelligence.ts`, `cricket-match-intelligence.tsx`
**Commit:** `9bb1273`

## TypeScript / Build

- TypeScript: ✅ Clean (0 errors) after Session 3 Tasks 1 + 2
- Build: ✅ Success (chunk-size warning only — pre-existing)

## Commit Hashes (Feature Session 3)

| Task | Commit |
|------|--------|
| Task 1 — AI Insights Panel | `0ad74c2` |
| Task 2 — Player AI Badges | `d916180` |

## Known Issues / Limitations

- Cricket live scores: TSDB free tier only returns NS/FT — games show "Starting"
- Football fantasy logic not implemented
- Provider manager (`provider-manager.ts`) implemented but not yet wired
- AI intelligence/ratings are mock/heuristic — no live pitch, weather, player history, or ML data
- Weather section in AI Insights shows "Awaiting data" (placeholder until weather API wired)
- See `docs/KNOWN_ISSUES.md` for full tracking
