# FantasyIQ — Current Status

**Last updated**: July 28, 2026  
**Build status**: ✅ TypeScript clean · Vite server running (HoopIQ workflow, port 21534)  
**Git**: ✅ Local = GitHub = `4126cc4` — fully synchronized  

---

## Git Synchronization

| Item | Status |
|------|--------|
| Local branch | `main` at `4126cc4` |
| Remote (`origin/main`) | `4126cc4` |
| Uncommitted changes | None |
| Unpushed commits | None |
| Last pushed commit | `feat(basketball): redesign schedule pages to match Cricket UI` |

**Local and GitHub are fully in sync.** Nothing is missing from either side.

---

## What's Working (on GitHub)

### Basketball Schedule Redesign ✅ (NEW — `4126cc4`)
- **`/basketball` now matches Cricket UI exactly**
- **Shared DayTabs** (Today / Tomorrow / Day After) replace per-league arrow DateNav
  - Same pill-tab style: `bg-muted/30 rounded-xl p-1`, `bg-card shadow-sm` active state
  - Count badges with `bg-primary/15 text-primary` when selected
  - `animate-ping` live dot on Today tab when games are live
- **LeagueSection redesigned** as cricket `CompetitionGroup`-style header:
  - `text-[10px] font-black uppercase tracking-widest` label
  - Collapsible with chevron, count badge, live pulse dot
  - Flat border — no gradient card wrapper
- **Loading skeleton**: `h-20 rounded-xl skeleton-shimmer` blocks (matches cricket)
- **Empty state**: emoji + message + next-game hint
- All data, provider calls, GameCard component unchanged

### Basketball Navigation ✅ (NEW — `4126cc4`)
- **Single shared day offset** — both NBA and WNBA sections show the same selected day
- **`localDayOffset(selected)`** from `date-utils.ts` — always returns LOCAL calendar day
- **`localDateKey(date)`** formats YYYYMMDD for ESPN scoreboard endpoint
- **Tab counts** computed via `localDateString(localDayOffset(offset))` — local timezone, never UTC
- **Live games** always counted on Today (offset 0) regardless of `startTimeIso`
- No new providers added; no features removed

### FantasyIQ Rebrand ✅
- App title, meta tags, OG/Twitter cards → "FantasyIQ"
- Lightning bolt logo, "Multi-Sport Fantasy" tagline
- SessionStorage cache key: `fantasyiq:overview:`

### Cricket Schedule — Recent Tab ✅ (`e4f7f20`)
- **`/cricket` tabs now: Recent / Today / Tomorrow / Day After**
- Recent tab shows all completed (`status === "final"`) matches from yesterday + today (local dates), newest first
- `CricketLeagueOverview` extended with `recentCompleted: CricketGame[]`
- Provider (`cricket.js`) exposes `recentCompleted` — final games sorted newest-first
- Default tab on page load = Today (not Recent)
- Full timezone correctness via `localDateString` / `localDateStringFromIso` from `date-utils.ts`
- All existing Today / Tomorrow / Day After behaviour fully preserved

### Shared Date/Timezone Utility ✅ (`33f556a`)
- **`src/lib/date-utils.ts`** — single source of truth for all local-timezone helpers
- Exports: `localDateString`, `localDateStringFromIso`, `localDateKey`, `relativeDate`, `fmtDisplayDate`, `fmtTime`, `localDayOffset`
- All three pages (`home.tsx`, `basketball.tsx`, `cricket-schedule.tsx`) import from here
- No more duplicate date helpers scattered across page files

### Cricket ✅
- **Dedicated `/cricket` route** — CricketSchedule page with Recent/Today/Tomorrow/Day-After tabs
- **TheSportsDB dual strategy**: day-based (`eventsday.php`) + 17 known league IDs
- **Format badges**: T20 / ODI / Test / The Hundred / T10
- **Competition auto-discovery**: no hardcoded list required
- **Cricket box score** (`/cricket/:competition/game/:id`) — batting + bowling scorecards with FPTS
- **Cricket fantasy optimizer** (`/cricket/:competition/game/:id/optimizer`) — 11-player lineup, C/VC roles, 100-credit budget
- **Format-aware scoring**: `src/lib/cricket-scoring.ts` — T20, ODI, Test, Hundred, T10 profiles
- **Format filter library**: `src/lib/format-filter.ts` — `filterStatsByFormat()`, `computeRollingStats()`, format groups

### Basketball ✅
- **Dedicated `/basketball` route** — NBA + WNBA with shared day tabs (Today/Tomorrow/Day After)
- **Off-season handling**: "Next scheduled" hint in empty state; `isGameSoon()` 48h filter
- **Local date in day tabs**: uses `localDayOffset()` + `localDateKey()` from date-utils (not UTC)
- **Prev-day ESPN scoreboard fetch**: fetches both local date and prev ESPN date, merges/deduplicates

### Cricket Bug Fixes ✅
- **StatusBadge -8h window** (`cae2320`): matches provider's upcoming cutoff
- **Local date for day tabs** (`87446ee` + `33f556a`): Today/Tomorrow/Day-After use `localDateString()` from date-utils
- **Upcoming window +8h** (`4c9377b`): covers T20 (~3.5h) and ODI (~8h) durations

### Route Fix ✅
- **`318fbc8`**: Removed broken `/cricket/:competition` catch-all that caused "League not found"

### Football ✅ (infrastructure only)
- `/football` route with coming-soon banner

### Shared Infrastructure ✅
- `src/lib/date-utils.ts` — all local-timezone date helpers
- `src/lib/provider-manager.ts` — `createProviderManager()` with reliability scoring
- `src/lib/provider-health.ts` — per-provider health tracking
- `src/lib/format-filter.ts` — format-aware stats
- `src/lib/cricket-types.ts` — `CricketGame`, `CricketPlayer`, `CricketInnings`, etc.
- `src/lib/cricket-scoring.ts` — scoring rule engine

---

## What Was Lost (NOT on GitHub)

During a previous Replit session, 6 cricket enhancement tasks were implemented and committed locally but **never pushed**. They need to be re-implemented:

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
- **No innings scorecard**: TSDB free tier doesn't provide batting/bowling breakdowns
- **No player data**: Fantasy optimizer has no player list for TSDB-sourced games
- **ESPNcricinfo blocked**: Requires `x-hsci-auth-token` header + CORS restricted

### Workflows
- `artifacts/hoopiq: web` fails (port 21534 conflict — `HoopIQ` workflow already holds that port)
- `hoopiq-repo/*` workflows all fail (missing `node_modules` — spurious duplicate registrations)
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

## File Changes (full history July 25 → July 28)

| Commit | File(s) Changed | What |
|--------|----------------|------|
| `4126cc4` | `src/pages/basketball.tsx` | Cricket UI redesign + Today/Tomorrow/Day-After tabs with date-utils |
| `526974f` | docs | Update AI_HANDOFF + CURRENT_STATUS |
| `e4f7f20` | `src/pages/cricket-schedule.tsx`, `src/providers/cricket.js`, `src/lib/cricket-types.ts` | Recent tab for cricket |
| `33f556a` | `src/lib/date-utils.ts` (new), `home.tsx`, `basketball.tsx`, `cricket-schedule.tsx` | Shared local-timezone utility |
| `318fbc8` | `src/App.tsx` | Remove broken `/cricket/:competition` catch-all route |
| `c1f889f` | `src/api.js`, `src/pages/basketball.tsx` | Prev-day ESPN scoreboard merge |
| `cae2320` | `src/pages/cricket-schedule.tsx` | StatusBadge -8h window |
| `9cc461c` | `vite.config.ts` | PORT alignment (21534) |
| `87446ee` | `src/pages/cricket-schedule.tsx` | Local date for day tabs |
