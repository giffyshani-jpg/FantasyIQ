# FantasyIQ — Current Status

**Last updated**: July 28, 2026  
**Build status**: ✅ TypeScript clean · Vite server running (HoopIQ workflow, port 21534)  
**Git**: ✅ Local = GitHub = `318fbc8` — fully synchronized  

---

## Git Synchronization

| Item | Status |
|------|--------|
| Local branch | `main` at `318fbc8` |
| Remote (`origin/main`) | `318fbc8` |
| Uncommitted changes | None |
| Unpushed commits | None |
| Last pushed commit | `fix(bug5-routes): remove broken /cricket/:competition catch-all route` |

**Local and GitHub are fully in sync.** Nothing is missing from either side.

---

## What's Working (on GitHub)

### FantasyIQ Rebrand ✅
- App title, meta tags, OG/Twitter cards → "FantasyIQ"
- Lightning bolt logo, "Multi-Sport Fantasy" tagline
- SessionStorage cache key: `fantasyiq:overview:`

### Cricket ✅
- **Dedicated `/cricket` route** — CricketSchedule page with Today/Tomorrow/Day-After tabs
- **TheSportsDB dual strategy**: day-based (`eventsday.php`) + 17 known league IDs
- **Format badges**: T20 / ODI / Test / The Hundred / T10
- **Competition auto-discovery**: no hardcoded list required
- **Cricket box score** (`/cricket/:competition/game/:id`) — batting + bowling scorecards with FPTS
- **Cricket fantasy optimizer** (`/cricket/:competition/game/:id/optimizer`) — 11-player lineup, C/VC roles, 100-credit budget
- **Format-aware scoring**: `src/lib/cricket-scoring.ts` — T20, ODI, Test, Hundred, T10 profiles
- **Format filter library**: `src/lib/format-filter.ts` — `filterStatsByFormat()`, `computeRollingStats()`, format groups

### Basketball ✅
- **Dedicated `/basketball` route** — NBA + WNBA sub-sections with separate date navigators
- **Off-season handling**: "Next game: Mon, Oct 5" text; `isGameSoon()` 48h filter prevents fake game cards
- **Local date in date navigator**: `eca4e0d` — WNBA/NBA pages use local date (not UTC)
- **Prev-day ESPN scoreboard fetch**: `c1f889f` — fetches both local date and prev ESPN date, merges/deduplicates to avoid IST/AEST miss

### Cricket Bug Fixes ✅
- **StatusBadge -8h window** (`cae2320`): matches provider's upcoming cutoff; no raw stale timestamps shown
- **Local date for day tabs** (`87446ee`): Today/Tomorrow/Day-After use `toLocaleDateString` not UTC
- **Upcoming window +8h** (`4c9377b`): covers T20 (~3.5h) and ODI (~8h) durations

### Route Fix ✅
- **`318fbc8`**: Removed broken `/cricket/:competition` catch-all that caused "League not found" for any `/cricket/ipl`-style URL

### Football ✅ (infrastructure only)
- `/football` route with coming-soon banner
- `src/providers/football.js` — TheSportsDB Soccer provider (no fantasy logic yet)

### Shared Infrastructure ✅
- `src/lib/provider-manager.ts` — `createProviderManager()` with reliability scoring
- `src/lib/provider-health.ts` — per-provider health tracking
- `src/lib/format-filter.ts` — format-aware stats
- `src/lib/cricket-types.ts` — `CricketGame`, `CricketPlayer`, `CricketInnings`, etc.
- `src/lib/cricket-scoring.ts` — scoring rule engine

---

## What Was Lost (NOT on GitHub)

During the previous Replit session, 6 cricket enhancement tasks were implemented and committed locally but **never pushed**. They were wiped when the local branch was reset to `origin/main` to resolve a divergence, and the temporary `/tmp` backup was cleared between sessions.

These features need to be re-implemented:

| Task | Feature | New Files Needed |
|------|---------|-----------------|
| Task 1 | Dual-provider fallback manager wired into `api.js` | `src/providers/cricket-backup.js` |
| Task 2 | Match Intelligence panel (toss/weather/pitch/H2H/PlayingXI tabs on box score) | updates to `cricket-types.ts`, `cricket-box-score.tsx` |
| Task 3 | Format-aware stat badges in optimizer (`FormatGroupBadge`) | updates to `cricket-optimizer.tsx` |
| Task 4 | Per-player fantasy intel panel in optimizer (`PlayerIntelPanel`) | updates to `cricket-optimizer.tsx` |
| Task 5 | Captain/VC/Safe/Differential/GL recommendation engine | `src/lib/cricket-recommendations.ts`, `cricket-optimizer.tsx` |
| Task 6 | Schedule timezone audit (documentation + verification) | comments in `cricket-schedule.tsx` |

---

## Known Limitations

### Cricket Data Quality
- **No live scores**: TheSportsDB free tier → status is always "NS" (scheduled) or "FT" (final), never "in_progress"
- **No innings scorecard**: TSDB free tier doesn't provide batting/bowling breakdowns — box score page shows empty scorecard for live/upcoming games
- **No player data**: Fantasy optimizer has no player list for TSDB-sourced games
- **ESPNcricinfo blocked**: Requires `x-hsci-auth-token` header + CORS restricted to `espncricinfo.com`

### Workflows
- `artifacts/hoopiq: web` fails (port 21534 conflict — `HoopIQ` workflow already holds that port)
- `hoopiq-repo/*` workflows all fail (missing `node_modules` — these are duplicate artifact registrations from a platform event and should be ignored)
- The correct running workflow is **`HoopIQ`** at port 21534

---

## Provider Architecture (current)

```
Cricket:
  fetchCricketOverview()   → cricketProvider.getLeagueOverview()
  fetchCricketGame()       → cricketProvider.fetchGameById()
  (no fallback manager yet — Tasks 1-6 were lost)

Basketball:
  fetchLeagueOverview()    → ESPN provider per league via safeCall()
  fetchGamesByLeague...()  → ESPN scoreboard (prev-day merge for timezone correctness)
```

---

## File Changes Since Last docs Update (July 25 → July 28)

| Commit | File(s) Changed | What |
|--------|----------------|------|
| `ef818ef` | `index.html`, `layout.tsx`, `api.js`, docs | FantasyIQ rebrand |
| `4c9377b` | `src/providers/cricket.js` | Extend upcoming window to 8h |
| `eca4e0d` | `src/pages/basketball.tsx` | Local date in date navigator |
| `87446ee` | `src/pages/cricket-schedule.tsx` | Local date for day tabs |
| `9cc461c` | `vite.config.ts` | PORT alignment (21534) |
| `cae2320` | `src/pages/cricket-schedule.tsx` | StatusBadge -8h window |
| `c1f889f` | `src/api.js`, `src/pages/basketball.tsx` | Prev-day ESPN scoreboard merge |
| `318fbc8` | `src/App.tsx` | Remove broken `/cricket/:competition` catch-all route |
