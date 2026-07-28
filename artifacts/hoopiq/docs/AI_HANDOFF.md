# FantasyIQ — AI Handoff Document

Context for any agent picking up work on this codebase.

> **Last updated**: July 28, 2026  
> **Git**: Local `main` = `origin/main` = `c19b81e` — fully synchronized  
> **GitHub repo**: `giffyshani-jpg/FantasyIQ` (renamed from `Static-Site-Builder`)  
> **Build**: TypeScript clean · Vite running on port 21534 (`HoopIQ` workflow)  
> **Preview**: ✅ Working

---

## Current Git State

```
c19b81e  fix(basketball-nav): Today/Tomorrow/Day After tabs use date-utils localDayOffset  ← HEAD = origin/main
4126cc4  feat(basketball): redesign schedule pages to match Cricket UI
526974f  docs: update AI_HANDOFF and CURRENT_STATUS for Recent tab (e4f7f20)
e4f7f20  feat(cricket-schedule): add Recent tab showing completed matches from yesterday + today
0a261ed  docs: update AI_HANDOFF and CURRENT_STATUS for date-utils fix (33f556a)
33f556a  fix(date-utils): extract shared local-timezone utility
```

Nothing uncommitted. Nothing unpushed. Clean.

---

## GitHub Repository

- **Name**: `FantasyIQ` (was `Static-Site-Builder` — renamed July 28 2026)
- **URL**: `https://github.com/giffyshani-jpg/FantasyIQ`
- **Remote**: `git remote set-url origin https://<PAT>@github.com/giffyshani-jpg/FantasyIQ.git`
- **Branches**: `main` only (`replit-agent` was deleted — it was a stale branch 66 commits behind with only a lock file commit)

---

## Architecture Overview

```
artifacts/hoopiq/
  src/
    api.js                    — adapter boundary; ALL provider calls go through here
    App.tsx                   — routes; cricket routes MUST come before /:league catch-all
    providers/
      cricket.js              — TheSportsDB multi-league + day-based auto-discovery
      espn.js / nba.js / …    — basketball ESPN providers
      football.js             — TheSportsDB Soccer (infrastructure only)
    lib/
      date-utils.ts           ← single source of truth for ALL local-timezone helpers
      types.ts                — LeagueKey union
      cricket-types.ts        — CricketGame, CricketPlayer, CricketInnings, etc.
      cricket-scoring.ts      — scoring engine (T20/ODI/Test/Hundred/T10 profiles)
      format-filter.ts        — filterStatsByFormat(), computeRollingStats(), format groups
      provider-manager.ts     — createProviderManager() with reliability scoring
      provider-health.ts      — per-provider health tracking
    pages/
      home.tsx                — FantasyIQ home hub (3 sport cards)
      basketball.tsx          — /basketball — shared Today/Tomorrow/Day-After tabs + NBA/WNBA sections
      cricket-schedule.tsx    — /cricket — Recent/Today/Tomorrow/Day-After tabs
      cricket-box-score.tsx   — /cricket/:competition/game/:id
      cricket-optimizer.tsx   — /cricket/:competition/game/:id/optimizer
      football.tsx            — /football — coming soon banner
```

---

## Key Invariants — NEVER BREAK THESE

1. **`safeCall()` wraps every provider call** in `api.js`. Never remove.
2. **UI never imports from providers directly** — only from `src/api.js`.
3. **Cricket routes in `App.tsx` before `/:league`** — `/cricket/:competition/game/:id` must be listed before `/:league/game/:id`.
4. **`mapTsdbStatus()` never infers `in_progress` from time** — only from TSDB's explicit `strStatus` field.
5. **`isGameSoon(game)`** in `basketball.tsx` — 48h window filter for NBA/WNBA cards. Do not remove.
6. **`fetchGamesByLeagueAndLocalDate()`** in `api.js` — fetches both local date AND prev ESPN date, merges by ID. Do not revert to single-date fetch.
7. **StatusBadge "Starting" window = 8h** in `cricket-schedule.tsx`. Do not reduce.
8. **All date/time helpers live in `src/lib/date-utils.ts`** — do NOT add new local date helpers in page files.
9. **Basketball DayTabs use `localDayOffset(selected)`** — tab index maps directly to day offset (0=today, 1=tomorrow, 2=day after).

---

## Workflow Notes

**Use only `HoopIQ`** workflow to run the app.

- `HoopIQ`: `PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev` ✅
- `artifacts/hoopiq: web`: duplicate managed workflow — port 21534 conflict — **do not start**
- `hoopiq-repo/*`: spurious duplicate registrations from a platform event — **ignore**

The `.replit` `runButton = "Project"` launches `HoopIQ` correctly.

---

## Git Authentication

```bash
git remote set-url origin https://<PAT>@github.com/giffyshani-jpg/FantasyIQ.git
git push origin main
```

PAT: same one used throughout this session (see previous handoff for storage).

---

## Dev Commands

```bash
pnpm --filter @workspace/hoopiq run typecheck   # must pass before every commit
pnpm --filter @workspace/hoopiq run dev         # starts Vite on $PORT (21534)
```

---

## Tasks That Need Re-Implementation

These 6 tasks were completed in a prior session but never pushed and are now lost:

| Task | Feature | Files |
|------|---------|-------|
| 1 | Dual-provider fallback manager in `api.js` | new `src/providers/cricket-backup.js` + edit `api.js` |
| 2 | Match Intelligence panel on box score | edit `cricket-types.ts` + `cricket-box-score.tsx` |
| 3 | Format-aware stat badges in optimizer | edit `cricket-optimizer.tsx` |
| 4 | Per-player fantasy intel panel | edit `cricket-optimizer.tsx` |
| 5 | Recommendation engine (Captain/VC/Safe/Differential/GL) | new `src/lib/cricket-recommendations.ts` + edit `cricket-optimizer.tsx` |
| 6 | Schedule timezone audit comments | edit `cricket-schedule.tsx` |

**Start with Task 1. Typecheck + push after each task.**

---

## Known Workspace Clutter

`hoopiq-repo/` directory exists at workspace root — it's a duplicate of the monorepo accidentally committed. It does not affect the running app. Safe to remove in a future cleanup commit (just `git rm -r hoopiq-repo/` + commit + push).

---

## TheSportsDB Cricket League IDs

```javascript
const KNOWN_LEAGUES = [
  { id: 4460, name: "Indian Premier League",     format: "T20"  },
  { id: 4461, name: "Big Bash League",           format: "T20"  },
  { id: 4463, name: "Vitality T20 Blast",        format: "T20"  },
  { id: 4458, name: "County Championship Div 1", format: "Test" },
  { id: 4459, name: "County Championship Div 2", format: "Test" },
  { id: 4462, name: "SA T20 Challenge",          format: "T20"  },
  { id: 5067, name: "Pakistan Super League",     format: "T20"  },
  { id: 5174, name: "Super Smash",               format: "T20"  },
  { id: 5175, name: "Lanka Premier League",      format: "T20"  },
  { id: 5176, name: "Caribbean Premier League",  format: "T20"  },
  { id: 5529, name: "Bangladesh Premier League", format: "T20"  },
  { id: 5530, name: "Sheffield Shield",          format: "Test" },
  { id: 5532, name: "SA20",                      format: "T20"  },
  { id: 5533, name: "Nepal Premier League",      format: "T10"  },
  { id: 5534, name: "Shpageeza Cricket League",  format: "T20"  },
  { id: 5535, name: "Zimbabwe T20",              format: "T20"  },
  { id: 5606, name: "Ireland T20 Trophy",        format: "T20"  },
];
```
