# FantasyIQ — Roadmap

## ✅ Completed (Previous Sessions)

### Basketball Features
- [x] NBA + WNBA premium full-width gradient cards on home page
- [x] Date navigator (yesterday / today / tomorrow)
- [x] Game cards with live scores, team abbreviations, status
- [x] Full box score with player stats (PTS, REB, AST, STL, BLK, TO, MIN)
- [x] Live polling every 5s for in-progress games
- [x] Play-by-play view
- [x] Player comparison (up to 2 players side-by-side)
- [x] Player detail sheet (game log chart, recent form)
- [x] Pre-Game Intelligence panel (starter status, projected minutes, injury report, back-to-back, blowout risk)
- [x] Fantasy Optimizer — 8-player lineup (max 4 per team), C/VC roles, budget management, auto-pick, OCR import
- [x] Off-season banner with "Next scheduled game" + actual date (never fake)
- [x] Live auto-refresh every 30s during active games

### Cricket Features
- [x] Cricket section on home page via TheSportsDB auto-discovery
- [x] Cricket box score — batting + bowling scorecards with FPTS
- [x] Cricket Fantasy Optimizer
- [x] Format-aware scoring (T20 / The Hundred / ODI / Test / T10)
- [x] Day-based + league-based dual strategy for coverage

### Data & Provider
- [x] ESPN NBA, WNBA, NBL, FIBA providers
- [x] ESPN NBA Summer League (type-3 filter + CDN fallback)
- [x] TheSportsDB NZ NBL provider
- [x] TheSportsDB Cricket (17 known leagues + day-based auto-discovery)
- [x] Graceful safeCall fallback on all providers
- [x] Provider health tracking (success rate, avg response time)

## ✅ Completed (This Session — Tasks 1–13)

### Task 1: Rebrand — HoopIQ → FantasyIQ
- [x] App title, meta tags, OG tags, Twitter cards → FantasyIQ
- [x] Logo mark: lightning bolt (multi-sport, not basketball-specific)
- [x] Logo text: "FantasyIQ" + "Multi-Sport Fantasy" tagline
- [x] SessionStorage cache key: `fantasyiq:overview:`
- [x] All documentation updated

### Task 2: Home Screen Redesign
- [x] Three sport hub cards: 🏏 Cricket / 🏀 Basketball / ⚽ Football
- [x] Premium card design — emoji tile + gradient + live count
- [x] No dropdown expansion — navigate to dedicated sport pages
- [x] Global LIVE NOW banner across all sports
- [x] Loading skeletons per card

### Task 3: Basketball Page
- [x] Dedicated `/basketball` route
- [x] NBA + WNBA as separate sub-sections (not on home)
- [x] Per-section date navigator
- [x] Off-season: "Next scheduled game" with actual date (never fake)
- [x] "More Basketball" section (NBL, NZ NBL, FIBA, Summer)

### Task 4: Cricket Schedule Page
- [x] Dedicated `/cricket` route
- [x] TODAY / TOMORROW / DAY AFTER TOMORROW tabs
- [x] Per-tab game count badges + live indicators
- [x] Competitions auto-discovered (no hardcoded list required)
- [x] Grouped by competition, sorted live-first
- [x] Format badge (T20 / ODI / Test / The Hundred / T10)
- [x] Collapsible competition groups

### Task 5: Provider System
- [x] `src/lib/provider-manager.ts` — `createProviderManager()`
- [x] Reliability score: 60% success rate + 40% speed bonus
- [x] Priority chain: highest score tried first
- [x] Providers below 0.2 score skipped (unless last resort)
- [x] Exponential back-off retry (400ms × attempt, max `retries` per provider)
- [x] 4xx errors not retried (provider doesn't support request)
- [x] `logHealth()` debug helper
- [x] Football provider registered in api.js

### Task 6: Timezone Fix
- [x] `mapTsdbStatus()` rewritten — NEVER infers "in_progress" from time
- [x] Only TSDB's explicit strStatus drives live detection
- [x] "NS" → always "scheduled" regardless of clock time
- [x] `startTimeIso` always stored as UTC ISO 8601
- [x] TSDB strTime treated as UTC (not local) for day calculation
- [x] UI shows "Starting" for past start time + unconfirmed status (not "NOW"/"LIVE")
- [x] Verified for India / UK / Australia / USA timezone correctness

### Task 7: Cricket Match Page
- [x] Batting + bowling scorecards with FPTS column
- [x] Live score header with competition, format badge, venue
- [x] Status (LIVE / FT / vs) + result text
- [x] Fantasy Optimizer link from match header
- [x] Loading skeleton + polling for live matches

### Task 8: Format-Aware Statistics
- [x] `src/lib/format-filter.ts` — format groups (T20 / ODI / Test / T10)
- [x] The Hundred → T20 group
- [x] `filterStatsByFormat()` — filters stat rows to matching group only
- [x] `computeRollingStats()` — L5/L10, avg, SR, economy, FPTS per format
- [x] `isSameFormatGroup()`, `isT20Format()`, `isODIFormat()`, `isTestFormat()`
- [x] `detectFormatFromName()` — derives format from competition name

### Task 9: Recent Match Statistics
- [x] `computeRollingStats()` in format-filter.ts computes L5/L10
- [x] Batting: runs average, strike rate average (same format group only)
- [x] Bowling: economy average (same format group only)
- [x] Fantasy points average (same format group only)
- [x] `sampleSize` tracked so UI knows data confidence

### Task 10: Football
- [x] `/football` route → `FootballPage`
- [x] `src/providers/football.js` — TheSportsDB Soccer provider
- [x] 10 seeded competitions across leagues/cups/international
- [x] Auto-discovery via `eventsday.php?s=Soccer`
- [x] Future-ready architecture: `getLeagueOverview()`, `getGamesByDate()`, `getGame()`
- [x] `fetchFootballOverview()` + `fetchFootballGamesByDate()` in api.js
- [x] Provider health tracking via `recordSuccess`/`recordFailure`
- [x] "Coming Soon" banner with feature roadmap

### Task 11: UI Polish
- [x] `index.css` — skeleton shimmer, live pulse dot, fade-in-up animation
- [x] Staggered card entrance (`.stagger-children`)
- [x] Status chips (`.chip-live`, `.chip-final`, `.chip-upcoming`)
- [x] Competition badge (`.comp-badge`)
- [x] Touch feedback (`active:scale-[0.99]`)
- [x] Reduced motion support (`prefers-reduced-motion`)
- [x] Focus ring styling
- [x] Dark scrollbar (4px, minimal)
- [x] `--radius: 0.625rem` (slightly more rounded)
- [x] Layout logo: lightning bolt icon, "Multi-Sport Fantasy" tagline
- [x] All new pages use consistent card/gradient patterns

### Task 12: Documentation
- [x] `docs/PROJECT_CONTEXT.md` — rewritten for FantasyIQ multi-sport
- [x] `docs/ROADMAP.md` — all 13 tasks documented
- [x] `docs/AI_HANDOFF.md` — updated handoff for next session
- [x] `docs/KNOWN_ISSUES.md` — updated known limitations

### Task 13: Git Workflow
- [x] typecheck before commit
- [x] Commit after each completed task group
- [x] Push to GitHub main

## 📋 Next / Future Work

### Cricket (Priority)
- [ ] Live score provider: CricAPI or Cricbuzz (requires auth)
- [ ] Playing XI confirmation (11 players confirmed)
- [ ] Player recent form panel on cricket match page
- [ ] Venue weather integration (OpenWeatherMap)
- [ ] Pitch report data (manual or scraped)
- [ ] Head-to-head team history
- [ ] Captain / Vice-Captain recommendation engine
- [ ] Differential pick detector
- [ ] Grand League pick strategy

### Basketball
- [ ] EuroLeague / EuroCup (blocked: no public API)
- [ ] Push notifications for live game start
- [ ] Multi-game DFS optimizer
- [ ] Player headshots (ESPN CDN)

### Football
- [ ] Live scores via TheSportsDB or LiveScore API
- [ ] Fantasy football logic (starting XI, formation, captain)
- [ ] Auto-discover active competitions (seasonal)

### Platform
- [ ] Dark/light theme toggle
- [ ] User preferences (favorite sport, favorite teams)
- [ ] Share lineup URL
- [ ] PWA manifest + offline cache
