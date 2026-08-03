# FantasyIQ — Changelog

All notable changes are documented here in reverse-chronological order.

---

## [fb7c62f] — Player Comparison AI Head-to-Head Intelligence (August 3, 2026)

### Added

- New `src/hooks/use-player-comparison-intel.ts`: fetches real ESPN game-log metrics for selected players and, for scheduled games, derives projected FPTS, confidence, and risk from the same transparent heuristics as the basketball prediction pipeline.
- Rewrote `src/pages/player-comparison.tsx` with `HeadToHeadPanel` component: visible when exactly 2 players are selected; existing box-score stat grid preserved for 2–4 players.
- Side-by-side comparison rows: Projected FPTS, Confidence, Risk, Last 5 Avg, Last 10 Avg, Minutes Trend, Recent Form, Injury Status, Home/Away Split, Head-to-Head History.
- Per-row winner highlighting; ties shown distinctly; score tally in panel header.
- Summary cards: Better Fantasy Pick, Safer Pick, Higher Upside.
- AI Explanation narrative auto-generated from real provider signals.

### No-fabrication behavior

- Every null field renders as "Unavailable" — no stats, scores, or projections are fabricated.
- Head-to-Head History is always Unavailable; no current provider supplies player-vs-opponent records.
- Projected FPTS, Confidence, and Risk are pregame-only; they show as Unavailable once the game starts.
- Optimizer, prediction engine, and learning engine are not modified.

### Verification

- TypeScript: passed with 0 errors.
- Production build: passed; existing sourcemap/chunk-size warnings only.
- Runtime smoke check: home and compare routes returned HTTP 200.
- Code commit pushed: `fb7c62f`.

---

## [f6b90b8] — Basketball AI Prediction and Analysis (August 3, 2026)

### Added

- Provider-backed pregame Basketball AI prediction panel for scheduled games.
- Best predicted fantasy XI with Captain and Vice Captain.
- Confidence percentage, projected fantasy score, risk level, value picks, lock picks, injury impact, and projected minutes.
- Real game-log windows for last 5, last 10, last 20, season average, and home/away splits.
- Saved pregame prediction snapshots.
- Post-game analysis route comparing the AI prediction with the perfect fantasy team.
- Captain/VC comparison, correct and missed picks, fantasy-point difference, team similarity, surprises, disappointments, and lessons learned.
- Local prediction evaluations as the foundation for continuous learning.

### No-fabrication behavior

- Differential picks are shown as `Unavailable` because current providers do not supply contest ownership.
- Usage, opponent defense, pace, rest days, and matchup history are shown as unavailable until real provider data exists.
- No synthetic players, credits, ownership, statistics, or scores are generated.

### Verification

- TypeScript: passed with 0 errors.
- Production build: passed; only existing sourcemap/chunk-size warnings remain.
- Runtime smoke check: home and Basketball analysis routes returned HTTP 200.
- Code commit pushed: `f6b90b8`.

---

## [0ee4372] — Football Fantasy Optimizer (August 1, 2026)

### Added

- Football-only fantasy scoring engine based on the public FantasyGo football scoring reference.
- Provider-backed football player/stat types with optional fields.
- Formation validation for 4-4-2, 4-3-3, 3-4-3, 3-5-2, 4-5-1, 5-3-2, and 5-4-1.
- XI-size, position, maximum-seven-per-team, Captain/VC, and optional-budget validation.
- Auto-Pick logic that considers only real players with provider statistics.
- Football optimizer route: `/football/:leagueId/game/:id/optimizer`.
- Football match-details link to the optimizer.

### No-fabrication behavior

- TheSportsDB free football events currently contain no lineup, positions, player statistics, or fantasy credits.
- The optimizer shows an explicit unavailable state instead of generating fake players, ratings, points, or credits.
- No reliable free football-credit feed was verified for Fantasy11, FantasyWala, Dafa Fantasy, Vision11, My11Circle Football, or other checked public sources; budget validation is disabled until real credits are supplied.

### Verification

- TypeScript: passed with 0 errors.
- Production build: passed; only existing sourcemap/chunk-size warnings remain.
- Optimizer route smoke test: HTTP 200.
- Code commit pushed: `0ee43721cf975fd5b70a1613d932b54c3d5f1c7`.

---

## [9e8f22d] — Bug-Fix Session (July 28, 2026)

### Bug Fixes
- **Cricket: removed Day After tab** — Cricket tabs are now Recent / Today / Tomorrow only (matching Basketball)
- **Cricket Recent logic fixed** — now uses backward-search on `recentCompleted`: finds the most-recent date with completed matches and shows ALL matches from that date (not just yesterday/today filter)
- **Cricket Optimizer header** — back-nav label changed from "Box Score" → "Match Details"
- **Broken navigation (404) fixed** — `CricketBoxScore` back-nav linked to `/cricket/${competition}` which had no registered route; now links to `/cricket`

---

## [1b04523] — Basketball Recent Tab (July 28, 2026)

- **Basketball Recent tab** added — backward search (`findRecentDate`) walks up to 30 days to find latest date with a `status === "final"` game
- Tabs now: **Recent (0) · Today (1) · Tomorrow (2)**
- Live indicator wired to Today tab only (not Recent)
- Empty-state messages are tab-aware
- Uses AbortController so switching tabs cancels in-flight search

---

## [c19b81e] — Basketball Day Tabs Navigation Fix (July 28, 2026)

- Basketball `DayTabs` now use `localDayOffset(selected)` → `localDateKey()` for ESPN endpoint — always LOCAL calendar day
- Tab counts via `localDateString(localDayOffset(offset))` — timezone-correct
- Live games always counted on Today

---

## [4126cc4] — Basketball Schedule Redesign (July 28, 2026)

- Basketball hub redesigned to match Cricket UI
- Shared DayTabs (Today / Tomorrow / Day After) at page level
- `LeagueSection` redesigned as cricket `CompetitionGroup`-style header (collapsible, count badge, live pulse dot)
- Same card style, spacing, animations as `cricket-schedule.tsx`

---

## [e4f7f20] — Cricket Recent Tab (July 28, 2026)

- Cricket schedule tabs: Recent / Today / Tomorrow / Day After
- Recent tab shows completed matches from yesterday + today, newest first
- Default tab changed to Today

---

## [33f556a] — Shared Date/Timezone Utility (July 28, 2026)

- New `src/lib/date-utils.ts` — single source of truth for all local-timezone helpers
- Exports: `localDateString`, `localDateStringFromIso`, `localDateKey`, `relativeDate`, `fmtDisplayDate`, `fmtTime`, `localDayOffset`
- All page files updated to import from date-utils instead of inline helpers

---

## Tasks 1–13 — FantasyIQ Multi-Sport Platform (July 28, 2026)

### Task 1: Rebrand — HoopIQ → FantasyIQ
- App title, meta tags, OG tags, Twitter cards → FantasyIQ
- Logo mark: lightning bolt (multi-sport, not basketball-specific)
- Logo text: "FantasyIQ" + "Multi-Sport Fantasy" tagline
- SessionStorage cache key: `fantasyiq:overview:`

### Task 2: Home Screen Redesign
- Three sport hub cards: 🏏 Cricket / 🏀 Basketball / ⚽ Football
- Premium card design — emoji tile + gradient + live count
- No dropdown expansion — navigate to dedicated sport pages
- Global LIVE NOW banner across all sports
- Loading skeletons per card

### Task 3: Basketball Page
- Dedicated `/basketball` route
- NBA + WNBA as separate sub-sections
- Per-section date navigator
- Off-season: "Next scheduled game" with actual date (never fake)
- "More Basketball" section (NBL, NZ NBL, FIBA, Summer)

### Task 4: Cricket Schedule Page
- Dedicated `/cricket` route
- TODAY / TOMORROW / DAY AFTER tabs
- Per-tab game count badges + live indicators
- Competitions auto-discovered (no hardcoded list required)
- Grouped by competition, sorted live-first
- Format badge (T20 / ODI / Test / The Hundred / T10)
- Collapsible competition groups

### Task 5: Provider System
- `src/lib/provider-manager.ts` — `createProviderManager()`
- Reliability score: 60% success rate + 40% speed bonus
- Priority chain: highest score tried first
- Providers below 0.2 score skipped (unless last resort)
- Exponential back-off retry (400ms × attempt)
- Football provider registered in api.js

### Task 6: Timezone Fix
- `mapTsdbStatus()` rewritten — NEVER infers "in_progress" from time
- Only TSDB's explicit strStatus drives live detection
- "NS" → always "scheduled" regardless of clock time
- UI shows "Starting" for past start time + unconfirmed status

### Task 7: Cricket Match Page
- Batting + bowling scorecards with FPTS column
- Live score header with competition, format badge, venue
- Fantasy Optimizer link from match header
- Loading skeleton + polling for live matches

### Task 8: Format-Aware Statistics
- `src/lib/format-filter.ts` — format groups (T20 / ODI / Test / T10)
- The Hundred → T20 group
- `filterStatsByFormat()`, `computeRollingStats()`, format detection helpers
- Stats from different groups are NEVER combined

### Task 9: Recent Match Statistics
- `computeRollingStats()` computes L5/L10 per format group
- Batting: runs average, strike rate average
- Bowling: economy average
- Fantasy points average with `sampleSize`

### Task 10: Football
- `/football` route → `FootballPage`
- `src/providers/football.js` — TheSportsDB Soccer provider
- 10 seeded competitions across leagues/cups/international
- "Coming Soon" banner with feature roadmap

### Task 11: UI Polish
- `index.css` — skeleton shimmer, live pulse dot, fade-in-up animation
- Staggered card entrance, status chips, competition badge
- Touch feedback, reduced motion support, focus ring styling
- Dark scrollbar, `--radius: 0.625rem`
- Layout logo: lightning bolt icon, "Multi-Sport Fantasy" tagline

### Task 12: Documentation
- `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/AI_HANDOFF.md`, `docs/KNOWN_ISSUES.md` created

### Task 13: Git Workflow
- typecheck before commit; commit after each task group; push to GitHub main

---

## [67a6aa4] — Other Basketball Polish (pre-Tasks 1–13)

- NZ NBL box score: provider-specific message explaining TheSportsDB doesn't include player stats
- FIBA league page: dedicated empty state explaining international tournament windows (Feb/Jun/Aug/Nov)
- `thesportsdb.js`: smarter status detection — handles AET, AP, PSO, "Abandoned", "Postponed", "Cancelled"
- `thesportsdb.js`: extracted `makeAbbreviation()` helper
- Postponed/cancelled events stay "scheduled" to avoid polluting Last Played slot

## [17f42e1] — NBA and WNBA Reliability and Polish

- Off-season banner on league pages for leagues with `active: false` (NBA, NBL)
- Live auto-refresh every 30s on the league page when games are in progress
- "Next game: [date]" subtitle when next game is > 7 days away
- Fixed inaccurate "next 45 days" message → now says "next 6 months"
- Auto-refresh timestamp indicator when live games are present

## [eb8ee2b] — Fantasy Intelligence UX

- Added Auto-Pick Best button (⚡): greedy fill of highest-FPTS active players within budget
- Added Clear Lineup button: visible only when lineup has players
- Added lineup progress bar
- Remaining credits now amber when 1–19% of budget left, red when negative
- Improved player list empty state with onboarding hint

---

## [AI Fantasy Coach Task] — AI Fantasy Coach

- New `src/lib/ai-coach.ts`: pure computation layer for 12 named fantasy picks
  - Picks: Best Captain 🔥, Best VC ⚡, Best Value 💎, Sleeper 😴, Fade ⚠️, Trending Up 📈, Trending Down 📉, Safest 🛡️, Highest Ceiling 🚀, Home Advantage 🏠, Back-to-Back Fatigue ✈️, Injury Impact 🚑
  - All picks include short data-backed explanations; individual picks hidden when data unavailable
  - Requires ≥3 scoreable active players to show any picks
- New `src/components/ai-fantasy-coach.tsx`: collapsible horizontal-scroll pick cards
  - Scheduled games: uses `usePregameIntel` (game-log metrics, trends, B2B, consistency)
  - Live/final games: uses current box-score stats
  - Per-kind color-coded left border; loading skeleton while pregame intel fetches
- Integrated into `src/pages/fantasy-optimizer.tsx` above the budget section
- Fixed live indicator in optimizer and box-score from `red-400` to theme primary orange

---

## [UI/UX Redesign + Provider Reliability Session]

- `src/index.css`: Full dark sports theme — deep navy bg, basketball orange primary, skeleton shimmer animation
- `src/providers/espn.js`: 2-retry exponential backoff (600ms/1200ms), 9-second timeout; 4xx not retried
- `src/providers/nba.js`: ESPN primary + NBA CDN `todaysScoreboard_00.json` fallback
- `src/providers/nbadotcom.js`: Added `getNbaOverview()`, `getNbaTodayGames()`, `getSummerLeagueOverview()`
- `src/providers/thesportsdb.js`: Timezone-safe date matching; AET/AP/PSO/Abandoned status handling
- `src/providers/nznbl.js`: Always uses TheSportsDB primary (ESPN returns 400); date format fix
- `src/components/game-card.tsx`: Live pulse dot, leading team highlighted in orange, winner in bold white
- `src/components/layout.tsx`: Basketball SVG logo, "FANTASY INTELLIGENCE" tagline, frosted header
- `src/pages/home.tsx`: LiveNowBanner, PremiumCardSkeleton, PageHeader with date
- `src/pages/box-score.tsx`: Premium scoreboard header (large scores, winner/leader highlight)
- `artifacts/hoopiq/tsconfig.json`: Added `allowJs: true`, `noImplicitAny: false` for JS provider imports
- `artifacts/hoopiq/package.json`: Added `tesseract.js` dependency for OCR

---

## Earlier Sessions — pre-reliability pass

- AI Fantasy Coach (12 picks from real data)
- Auto-Pick Best, Suggest Credits, lineup progress bar
- Saved lineups with live stats, OCR import
- Compare bar, player detail game log
- Pre-Game Intel panel
- Game-log sessionStorage cache (45-min TTL)
- Back-to-back detection, blowout risk, skeleton loading states

---

## [c028048] — Phase 1+2: Home Page Redesign

- NBA/WNBA full-width premium gradient cards
- Other Basketball collapsible group (NBL, NZ NBL, FIBA, Summer League)
- NBA Summer League auto-hides when season is inactive
- Inline game expand on premium cards
- Last-played game shown on home cards

## [39c4235] — Summer League Game.league Fix

- `game.league` field now correctly set to `"nba-summer"` for Summer League games
- Router-aware back navigation on box score pages

## [fc25968] — Home Page Last-Played + Fantasy Optimizer Suggest-Credits

- Home page premium cards now show last played game
- Fantasy Optimizer "Suggest Credits" button added

## [9006314] — NZ NBL Game Pages Fixed

- NZ NBL game pages now open correctly via TheSportsDB lookup
