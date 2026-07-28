# FantasyIQ — AI Handoff

## Latest Session Summary

Feature Session 3 — Tasks 1 + 2 built (2026-07-28).

**Task 1 — AI Insights Panel (rebuilt from scratch):**
- `src/lib/cricket-ai-intelligence.ts`:
  - Added `riskPick: CaptainVCPick` to `CaptainVCEngine` — 5th pick, high-variance boom-or-bust (batter/bowler outside main 4 picks)
  - Added `teamConfidencePct: number` to `CaptainVCEngine` — average of C+VC confidence % adjusted by format risk level
  - `CaptainLabel` union extended with `"RISK_PICK"`
  - `CAPTAIN_LABEL_CONFIG` record updated with `RISK_PICK` entry (icon ⚠, short "RISK")
- `src/components/cricket-match-intelligence.tsx`:
  - New `AIInsightsPanel` component rendered at top of expanded card
  - `CaptainInsightCard` — compact 2-col card for C+VC (AI rating, score, confidence)
  - `PickChip` — small 3-col chip for Differential / Safe / Risk picks
  - `MetricRow` — icon + label + optional progress bar for 5 match metrics
  - Captain/VC Engine detail section now renders all 5 picks including `riskPick`
- TypeScript: clean | Build: success

**Task 2 — Player AI Badges:**
- `src/lib/ai-player-rating.ts`:
  - New `PlayerBadge` type: `"HOT" | "SAFE" | "DIFFERENTIAL" | "RISKY" | "VALUE PICK"`
  - New `computePlayerBadge(rating, player): PlayerBadge | null` — exclusive classification, priority: HOT → SAFE → VALUE PICK → RISKY → DIFFERENTIAL
- `src/pages/cricket-box-score.tsx`:
  - New `PlayerBadgeChip` component (reusable, colour-coded)
  - Badge shown below player name on batting rows and bowling rows
  - AI Rating badge stays inline with name; badge chip goes on next line
- `src/pages/cricket-optimizer.tsx`:
  - New `AIRatingChip` (compact version for tighter rows)
  - New `PlayerBadgeChip` (same config as box score)
  - `PlayerRow` accepts `aiRating: PlayerAIRating | null` and `badge: PlayerBadge | null`
  - AI ratings computed via `useMemo` over `allPlayers` + game format context
- TypeScript: clean | Build: success

Previous sessions summarised in CURRENT_STATUS.md.

## Architecture (as of Feature Session 3)

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
/cricket/:competition/game/:id             → CricketBoxScore  ← AI Insights + Rating + Badges
/cricket/:competition/game/:id/optimizer   → CricketOptimizer  ← AI Rating + Badges on PlayerRow
```

### File Layout
```
artifacts/hoopiq/
  src/
    api.js                    — adapter boundary; ALL provider calls go through here
    App.tsx                   — routes; cricket routes MUST come before /:league catch-all
    providers/
      cricket.js              — TheSportsDB multi-league + day-based auto-discovery
      espn.js                 — ESPN provider (NBA, WNBA, NBL, FIBA, Summer)
      nba.js / wnba.js        — league wrappers around espn.js
      nbadotcom.js            — NBA CDN fallback
      thesportsdb.js          — TheSportsDB basketball (NZ NBL)
      nznbl.js                — NZ NBL (TheSportsDB primary)
      football.js             — TheSportsDB Soccer (infrastructure only)
    lib/
      date-utils.ts           ← single source of truth for ALL local-timezone helpers
      types.ts                — LeagueKey union, Game, Player types
      cricket-types.ts        — CricketGame, CricketPlayer, CricketInnings, etc.
      cricket-scoring.ts      — scoring engine (T20/ODI/Test/Hundred/T10 profiles)
      cricket-ai-intelligence.ts  ← AI Match Intelligence + Captain/VC Engine (5 picks) + Match Conditions
      ai-player-rating.ts     ← per-player 0–100 AI rating + PlayerBadge classification
      format-filter.ts        — filterStatsByFormat(), computeRollingStats()
      provider-manager.ts     — createProviderManager() — not yet wired
      stats.ts                — basketball fantasy points formula
      pregame-intel.ts        — pre-game intelligence heuristics
      ai-coach.ts             — AI Fantasy Coach 12 named picks
    pages/
      home.tsx                — FantasyIQ home hub (3 sport cards)
      basketball.tsx          — /basketball — Recent/Today/Tomorrow tabs
      cricket-schedule.tsx    — /cricket — Recent/Today/Tomorrow tabs
      cricket-box-score.tsx   — /cricket/:competition/game/:id  ← AI Insights + Badges
      cricket-optimizer.tsx   — /cricket/:competition/game/:id/optimizer  ← AI Badges
      football.tsx            — /football — coming soon banner
    components/
      cricket-match-intelligence.tsx  ← AI Insights Panel + full Captain/VC detail
```

### Key Invariants — NEVER BREAK THESE

1. **`safeCall()` wraps every provider call** in `api.js`. Never remove.
2. **UI never imports from providers directly** — only from `src/api.js`.
3. **Cricket routes in `App.tsx` before `/:league`** — `/cricket/:competition/game/:id` must be listed before `/:league/game/:id`.
4. **`mapTsdbStatus()` never infers `in_progress` from time** — only from TSDB's explicit `strStatus` field.
5. **`isGameSoon(game)`** in `basketball.tsx` — 48h window filter. Do not remove.
6. **`fetchGamesByLeagueAndLocalDate()`** in `api.js` — fetches both local date AND prev ESPN date. Do not revert.
7. **StatusBadge "Starting" window = 8h** in `cricket-schedule.tsx`. Do not reduce.
8. **All date/time helpers live in `src/lib/date-utils.ts`** — do NOT add new local date helpers in page files.
9. **`PORT` and `BASE_PATH` are required** for both `vite dev` and `vite build`.
10. **AI intelligence `isMock: true`** on all outputs — consumers must show MOCK badge. Do not remove until real AI provider wired.
11. **`isPlaceholder: true`** on `surface`, `weather`, `pitchReport`, `weather` in MatchConditions — explicit flag, do not remove until real pitch/weather API wired.
12. **`computePlayerAIRating()` returns `isMock: true`** — keep until real player-history provider wired.
13. **`computePlayerBadge()` is exclusive** — returns one badge or null, priority: HOT→SAFE→VALUE PICK→RISKY→DIFFERENTIAL. Do not change priority without updating docs.

### Dev Commands
```bash
pnpm --filter @workspace/hoopiq run typecheck         # must pass before every commit
PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev    # Vite dev server
PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run build  # production build
```

### Workflow Notes
- Managed workflow: `artifacts/hoopiq: web` (use WorkflowsRestart to start)
- Manual workflow: `HoopIQ` — `PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev`
- Push: `git push origin main` from the cloned repo directory

## PlayerBadge System (Task 2)

**File:** `src/lib/ai-player-rating.ts`

**Public interface:**
```typescript
export type PlayerBadge = "HOT" | "SAFE" | "DIFFERENTIAL" | "RISKY" | "VALUE PICK";

// Entry point:
computePlayerBadge(rating: PlayerAIRating, player: CricketPlayer): PlayerBadge | null
```

**Classification thresholds (exclusive, priority order):**
| Badge | Condition |
|-------|-----------|
| HOT | overall ≥ 78 |
| SAFE | factors.riskScore ≥ 68 AND overall ≥ 55 |
| VALUE PICK | overall ≥ 58 AND player.credits < 8.5 |
| RISKY | overall < 44 |
| DIFFERENTIAL | overall ≥ 52 (catch-all) |
| null | average player, 44–51 range |

**UI chip config in both box-score and optimizer:**
```
HOT          → 🔥 HOT   orange
SAFE         → 🛡 SAFE  green
DIFFERENTIAL → ⚡ DIFF  purple
RISKY        → ⚠ RISKY  red
VALUE PICK   → 💎 VALUE  cyan
```

**To plug in live data:**
- Replace `computeRiskScore()` with real lineup confirmation status
- Replace `computeFantasyConsistency()` with historical points-per-game data
- Adjust thresholds once real ownership % data is available

## AI Insights Panel (Task 1)

**Component:** `AIInsightsPanel` in `src/components/cricket-match-intelligence.tsx`

**Sub-components:**
- `CaptainInsightCard` — 2-column grid (Best Captain + Best VC) with role pill, AI rating, score, confidence
- `PickChip` — 3-column grid with variant="differential"|"safe"|"risk" — shows last name + AI rating
- `MetricRow` — icon + 24px label + progress bar + value text

**10 signals displayed:**
1. ⭐ Best Captain (from captainEngine.bestCaptain)
2. ⭐ Best VC (from captainEngine.bestVC)
3. 🔥 Differential (from captainEngine.grandLeagueDiff)
4. 🛡 Safe Pick (from captainEngine.safePick)
5. ⚠ Risk Pick (from captainEngine.riskPick — new)
6. 📈 Team Confidence % (from captainEngine.teamConfidencePct — new)
7. 🎯 Match Difficulty (score + level)
8. 🌤 Weather (placeholder label until API)
9. 🏟 Pitch (label + batting %)
10. 🪙 Toss Importance (label + importance %)

## AI Match Intelligence System (prior sessions)

See CURRENT_STATUS.md for details on Session 1 (AI Match Intelligence Card) and Session 2 (Rating Engine + Captain/VC Engine + Match Conditions).

## Cricket Tab System

Tabs: **Recent (0) · Today (1) · Tomorrow (2)**

Recent tab (cricket): reads `overview.recentCompleted` — no extra API calls.
Recent tab (basketball): `findRecentDate()` walks backwards up to 30 days via API.

## TheSportsDB Cricket League IDs

```javascript
const KNOWN_LEAGUES = [
  { id: 4460, name: "Indian Premier League",           format: "T20"  },
  { id: 4461, name: "Big Bash League",                 format: "T20"  },
  { id: 4463, name: "Vitality T20 Blast",              format: "T20"  },
  { id: 4458, name: "County Championship Div 1",       format: "Test" },
  { id: 4459, name: "County Championship Div 2",       format: "Test" },
  { id: 4462, name: "SA T20 Challenge",                format: "T20"  },
  { id: 5067, name: "Pakistan Super League",           format: "T20"  },
  { id: 5174, name: "Super Smash",                     format: "T20"  },
  { id: 5175, name: "Lanka Premier League",            format: "T20"  },
  { id: 5176, name: "Caribbean Premier League",        format: "T20"  },
  { id: 5529, name: "Bangladesh Premier League",       format: "T20"  },
  { id: 5530, name: "Sheffield Shield",                format: "Test" },
  { id: 5532, name: "SA20",                            format: "T20"  },
  { id: 5533, name: "Nepal Premier League",            format: "T10"  },
  { id: 5534, name: "Shpageeza Cricket League",        format: "T20"  },
  { id: 5535, name: "Zimbabwe T20",                    format: "T20"  },
  { id: 5606, name: "Ireland T20 Trophy",              format: "T20"  },
];
```

## What the Next Session Should Know

### Git / workspace
- Working directory: the cloned repo (e.g. `/tmp/fantasyiq` or wherever freshly cloned)
- Source code: `artifacts/hoopiq/src/`
- Docs: `docs/` (repo root — only documentation location)
- Push via: `git push origin main`
- Run `pnpm install` first if `node_modules/` is missing after a fresh clone

### AI work remaining
1. Wire real pitch data provider (e.g. Cricbuzz API) — set `pitchReport.isPlaceholder = false`
2. Wire real weather provider — set `weather.isPlaceholder = false`
3. Extend AI Player Rating to Basketball
4. Extend Captain/VC Engine to Basketball box score
5. Replace mock `venueRecord` / `oppositionStrength` with real player-history API
6. Replace mock captain rationale with ML-generated text
7. Add AI Badges to cricket-schedule.tsx player preview cards (pre-match context)
8. Plug real ownership % data into `computePlayerBadge()` thresholds

### Cricket data limitation
TheSportsDB free tier: NS/FT only — no live scores. Games show "Starting" until FT confirmed.

### Football
Infrastructure only. Fantasy logic NOT implemented.
