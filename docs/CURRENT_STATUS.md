# FantasyIQ — Current Status

**Last updated:** 2026-07-28 (Feature Session 1 — Task 1 complete)
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

## AI Engine (Feature Session 1)

### ✅ Task 1 — AI Match Intelligence Card

**Files added/modified:**
- `artifacts/hoopiq/src/lib/cricket-ai-intelligence.ts` — AI engine + types
- `artifacts/hoopiq/src/components/cricket-match-intelligence.tsx` — UI card
- `artifacts/hoopiq/src/pages/cricket-box-score.tsx` — wired in after MatchHeader

**9 intelligence signals per match:**
| Signal | Status |
|--------|--------|
| Match Difficulty | ✅ Format-aware (0–100 score + EASY/MEDIUM/HARD) |
| Pitch Profile | ✅ Format-aware batting/bowling bars (PLACEHOLDER badge) |
| Weather | ✅ Present (PLACEHOLDER — needs weather API) |
| Toss Importance | ✅ Format-aware score + preferred decision |
| Batting/Bowling Friendly | ✅ Derived from surface profile |
| Captain Picks | ✅ Ranked by fantasy pts (scorecard) or credits (pre-match) |
| Vice Captain Picks | ✅ Same ranking, slots 3–4 |
| Differential Picks | ✅ Prefers all-rounders/WKs outside C/VC pool |
| Risk Level | ✅ LOW/MEDIUM/HIGH/EXTREME per format |

**Architecture:**
- `computeMatchIntelligence(game)` → `MatchIntelligence` — single entry point
- `isMock: true` flag on all outputs — consumers show MOCK badge
- `isPlaceholder: true` on surface and weather — explicit until real data wired
- Format profiles in `FORMAT_HEURISTICS` record — swap values to use live data

### 🔜 Task 2 — AI Player Rating (next)
- 0–100 per-player rating
- Weighted: recent form, venue record, opponent strength, batting position, bowling overs, fantasy consistency
- Reusable interfaces for Batters / Bowlers / All-rounders / WKs
- Display AI Rating on player cards

## TypeScript / Build

- TypeScript: ✅ Clean (0 errors) after Task 1
- Build: ✅ Success after Task 1 (chunk-size warning only)

## Known Issues / Limitations

- Cricket live scores: TSDB free tier only returns NS/FT — games show "Starting"
- Football fantasy logic not implemented
- Provider manager (`provider-manager.ts`) implemented but not yet wired
- AI intelligence is mock/heuristic — no live pitch, weather, or ML data
- See `docs/KNOWN_ISSUES.md` for full tracking
