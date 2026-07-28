# FantasyIQ — Current Status

**Last updated**: July 28, 2026  
**Build status**: ✅ TypeScript clean · Vite server running (HoopIQ workflow, port 21534)  
**Git**: ✅ Local = GitHub = `c19b81e` — fully synchronized  
**GitHub repo**: `giffyshani-jpg/FantasyIQ` (renamed from Static-Site-Builder)  
**Preview**: ✅ Working — http://localhost:21534/

---

## Git Synchronization

| Item | Status |
|------|--------|
| Local branch | `main` at `c19b81e` |
| Remote (`origin/main`) | `c19b81e` |
| Uncommitted changes | None |
| Unpushed commits | None |
| Remote URL | `https://github.com/giffyshani-jpg/FantasyIQ.git` |

**Local and GitHub are fully in sync.**

---

## GitHub Repository State

| Item | State |
|------|-------|
| Repository name | `FantasyIQ` (was `Static-Site-Builder`) |
| Branches | `main` only |
| `replit-agent` branch | Deleted (was 66 commits behind, 1 ahead — stale pnpm lock commit) |

---

## Workflow State

| Workflow | Status | Notes |
|----------|--------|-------|
| `HoopIQ` | ✅ RUNNING | Correct workflow — port 21534, `BASE_PATH=/` |
| `artifacts/api-server: API Server` | ✅ RUNNING | Express API on port 8080 |
| `artifacts/mockup-sandbox: Component Preview Server` | ✅ RUNNING | port 8081 |
| `artifacts/hoopiq: web` | NOT STARTED | Duplicate managed workflow — conflicts on port 21534; ignore |
| `hoopiq-repo/*` | NOT STARTED | Spurious duplicate registrations — ignore |

**Use only `HoopIQ` workflow** to run the app. Do not start `artifacts/hoopiq: web`.

---

## What's Working (on GitHub)

### Basketball Schedule Redesign ✅ (`4126cc4`)
- Shared DayTabs (Today / Tomorrow / Day After) replace per-league arrow DateNav
- LeagueSection redesigned as cricket CompetitionGroup-style header (collapsible, count badge, live pulse dot)
- Same card style, spacing, animations as cricket-schedule.tsx

### Basketball Navigation ✅ (`c19b81e`)
- `localDayOffset(selected)` → `localDateKey()` for ESPN ESPN endpoint — always LOCAL calendar day
- Tab counts via `localDateString(localDayOffset(offset))` — timezone-correct
- Live games always counted on Today

### Cricket Schedule — Recent Tab ✅ (`e4f7f20`)
- Tabs: Recent / Today / Tomorrow / Day After
- Recent tab shows completed matches from yesterday + today, newest first
- Default tab = Today

### Shared Date/Timezone Utility ✅ (`33f556a`)
- `src/lib/date-utils.ts` — single source of truth for all local-timezone helpers
- Exports: `localDateString`, `localDateStringFromIso`, `localDateKey`, `relativeDate`, `fmtDisplayDate`, `fmtTime`, `localDayOffset`

### Cricket ✅
- `/cricket` — Today/Tomorrow/Day-After tabs, TheSportsDB dual strategy
- Format badges: T20 / ODI / Test / The Hundred / T10
- Cricket box score + fantasy optimizer (11-player, C/VC, 100-credit budget)

### Basketball ✅
- `/basketball` — NBA + WNBA with shared day tabs
- Off-season handling, prev-day ESPN scoreboard fetch for IST/AEST users

### Football ✅ (infrastructure only)
- `/football` — coming-soon banner

---

## Known Limitations

### Cricket Data Quality
- No live scores (TheSportsDB free tier — NS/FT only)
- No innings scorecard data
- ESPNcricinfo blocked (CORS + auth token required)

### Workspace Clutter
- `hoopiq-repo/` directory was accidentally committed to the repo — contains a duplicate of the workspace monorepo. It does not affect the running app but adds repo size. Safe to remove in a future cleanup commit.

---

## Tasks That Need Re-Implementation (Lost in Previous Session)

| Task | Feature | Files Needed |
|------|---------|-------------|
| 1 | Dual-provider fallback manager | `src/providers/cricket-backup.js` + `api.js` |
| 2 | Match Intelligence panel on box score | `cricket-types.ts` + `cricket-box-score.tsx` |
| 3 | Format-aware stat badges in optimizer | `cricket-optimizer.tsx` |
| 4 | Per-player fantasy intel panel | `cricket-optimizer.tsx` |
| 5 | Captain/VC/Safe/Differential/GL recommendation engine | `src/lib/cricket-recommendations.ts` + `cricket-optimizer.tsx` |
| 6 | Schedule timezone audit comments | `cricket-schedule.tsx` |

---

## File Changes (recent)

| Commit | Files | What |
|--------|-------|------|
| `c19b81e` | docs only | Basketball nav behavior + docs update |
| `4126cc4` | `src/pages/basketball.tsx` | Cricket UI redesign + DayTabs |
| `e4f7f20` | cricket-schedule, cricket.js, cricket-types | Recent tab |
| `33f556a` | `src/lib/date-utils.ts` (new), home/basketball/cricket pages | Shared timezone utility |
