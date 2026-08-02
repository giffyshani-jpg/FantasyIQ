# FantasyIQ — Roadmap

## ✅ Completed (All Sessions to Date)

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
- [x] AI Fantasy Coach — 12 named picks with data-backed explanations
- [x] Shared Basketball hub page with Recent / Today / Tomorrow tabs
- [x] Recent tab backward search (`findRecentDate`) — finds latest date with completed games, up to 30 days back

### Cricket Features
- [x] Cricket section on home page via TheSportsDB auto-discovery
- [x] Cricket schedule page — Recent / Today / Tomorrow tabs
- [x] Recent tab: backward search on `recentCompleted` for most-recent date with matches
- [x] Cricket box score — batting + bowling scorecards with FPTS
- [x] Cricket Fantasy Optimizer — 11-player, C/VC, 100-credit budget
- [x] Format-aware scoring (T20 / The Hundred / ODI / Test / T10)
- [x] Day-based + league-based dual strategy for coverage
- [x] Competition auto-discovery (no hardcoded list required)

### Data & Provider
- [x] ESPN NBA, WNBA, NBL, FIBA providers
- [x] ESPN NBA Summer League (type-3 filter + CDN fallback)
- [x] TheSportsDB NZ NBL provider
- [x] TheSportsDB Cricket (17 known leagues + day-based auto-discovery)
- [x] Graceful safeCall fallback on all providers
- [x] Provider health tracking (success rate, avg response time)
- [x] `createProviderManager()` with reliability scoring

### Platform
- [x] Rebrand HoopIQ → FantasyIQ
- [x] Multi-sport home page
- [x] `src/lib/date-utils.ts` — single source of truth for timezone-safe date helpers
- [x] Timezone fix: never infer live from time alone
- [x] Format-aware statistics (`format-filter.ts`)

---

## 📋 Next / Priority Work

### Cricket (Priority)
- [ ] **Live score provider**: CricAPI or Cricbuzz (requires auth — 100 req/day free tier)
- [ ] **Playing XI confirmation**: 11 confirmed players before lineup lock
- [ ] **Player recent form panel** on cricket match page (uses `computeRollingStats()` from format-filter.ts)
- [ ] **Captain / Vice-Captain recommendation engine** — data-driven C/VC picks based on form + matchup
- [ ] **Venue weather integration** (OpenWeatherMap)
- [ ] **Pitch report data** (manual or scraped)
- [ ] **Head-to-head team history**
- [ ] **Differential pick detector** (lightly-owned players for GPP lineups)
- [ ] **Grand League pick strategy**
- [ ] **ESPN slug validation** — pre-validate which slugs are active; avoid wasted requests on every home load
- [ ] **Cricket player game log** — ESPN cricket gamelog endpoint for individual history
- [ ] **Pre-game intel for cricket** — batting/bowling form, pitch conditions, head-to-head stats
- [ ] **CricketGameCard in LeagueGames** — cricket-specific card for `/cricket/:competition` page (needs new route + page)
- [ ] **Cricket live banner** — show live cricket games in LIVE NOW banner alongside basketball
- [ ] **Scorecard polish** — fall of wickets, partnership data, extras

### Basketball
- [ ] **EuroLeague / EuroCup** (blocked: no public API)
- [ ] **Push notifications** for live game start
- [ ] **Multi-game DFS optimizer**
- [ ] **Player headshots** (ESPN CDN)
- [ ] **Home/away split indicators** in pre-game panel
- [ ] **Opponent defensive rating** — heuristic matchup rating without paid source
- [ ] **Export lineup to clipboard** — copy DraftKings CSV format
- [ ] **Injury report timestamp** — show when ESPN last updated injury report

### Football
- [x] **Live scores** via TheSportsDB
- [x] **Fantasy football logic foundation** (scoring engine, formations, position/team validation, Captain/VC, provider-backed Auto-Pick path)
- [ ] **Real football lineup/statistics provider** (required before a usable XI can be generated; TheSportsDB free events omit these fields)
- [ ] **Auto-discover active competitions** (seasonal)
- [x] **Detailed match page** — live score and provider-supplied match events

---

## 💡 Medium-Term Ideas

- [ ] Dark/light theme toggle
- [ ] User preferences (favorite sport, favorite teams)
- [ ] Share lineup URL
- [ ] PWA manifest + offline cache
- [ ] Roster differentiation score — suggest lightly-owned players for lineup diversity
- [ ] DFS contest presets — GPP vs. cash game credit allocation strategy
- [ ] Notification for confirmed starters — push when Questionable player is confirmed
- [ ] Multi-game slate optimizer — currently one-game; slate view for multi-match contests
- [ ] Women's cricket — WBBL, Women's T20 World Cup, Women's IPL via ESPN
- [ ] Background refresh — stale-while-revalidate for league overviews
- [ ] Mobile animations — micro-interactions, screen transitions
- [ ] Dark theme polish — card depth, color hierarchy improvements

---

## 🚫 Explicitly NOT Planned / Won't Fix

- Position-limit enforcement in basketball optimizer (showdown format has no position limits)
- Standalone App Avg improvement (by-design: "—" for new users, not a fake average)
- TheSportsDB live cricket scores without upgrading to paid tier
