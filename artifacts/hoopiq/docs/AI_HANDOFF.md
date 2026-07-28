# FantasyIQ — AI Handoff Document

Context for any agent picking up work on this codebase.

> **Last updated**: July 28, 2026  
> **Git**: Local `main` = `origin/main` = `e4f7f20` — fully synchronized  
> **Build**: TypeScript clean · Vite running on port 21534 (`HoopIQ` workflow)

---

## Current Git State

```
e4f7f20  feat(cricket-schedule): add Recent tab showing completed matches from yesterday + today  ← HEAD = origin/main
0a261ed  docs: update AI_HANDOFF and CURRENT_STATUS for date-utils fix (33f556a)
33f556a  fix(date-utils): extract shared local-timezone utility — fixes home date, match counts, Today/Tomorrow/Day-After, WNBA navigator
a695c73  docs: update AI_HANDOFF and CURRENT_STATUS to reflect true state (July 28)
318fbc8  fix(bug5-routes): remove broken /cricket/:competition catch-all route
c1f889f  fix(bug2-basketball): fetch prev-day ESPN scoreboard and filter by local date
cae2320  fix(bug1-cricket): extend StatusBadge 'Starting' window from 3h to 8h
9cc461c  fix(preview): align dev server PORT with artifact.toml (21534)
87446ee  fix(cricket-schedule): use local date for day tabs
eca4e0d  fix(basketball): use local date in date navigator
4c9377b  fix(cricket): extend upcoming window to 8h
ef818ef  feat(Task 1): rebrand HoopIQ → FantasyIQ
```

Nothing uncommitted. Nothing unpushed. Clean.

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
      date-utils.ts           ← NEW: single source of truth for ALL local-timezone helpers
      types.ts                — LeagueKey union; "cricket" is a member
      cricket-types.ts        — CricketGame, CricketPlayer, CricketInnings, etc.
      cricket-scoring.ts      — scoring engine (T20/ODI/Test/Hundred/T10 profiles)
      format-filter.ts        — filterStatsByFormat(), computeRollingStats(), format groups
      provider-manager.ts     — createProviderManager() with reliability scoring
      provider-health.ts      — per-provider health tracking
    pages/
      home.tsx                — FantasyIQ home hub (3 sport cards)
      basketball.tsx          — /basketball — NBA + WNBA with local-date navigator
      cricket-schedule.tsx    — /cricket — Today/Tomorrow/Day-After tabs
      cricket-box-score.tsx   — /cricket/:competition/game/:id
      cricket-optimizer.tsx   — /cricket/:competition/game/:id/optimizer
      football.tsx            — /football — coming soon banner
```

---

## Key Invariants — NEVER BREAK THESE

1. **`safeCall()` wraps every provider call** in `api.js`. Never remove.
2. **UI never imports from providers directly** — only from `src/api.js`.
3. **Cricket routes in `App.tsx` before `/:league`** — `/cricket/:competition/game/:id` must be listed before `/:league/game/:id` or the wrong page renders.
4. **`mapTsdbStatus()` never infers `in_progress` from time** — only from TSDB's explicit `strStatus` field.
5. **`isGameSoon(game)`** in `home.tsx` — 48h window filter for NBA/WNBA cards. Do not remove; ESPN returns Oct pre-season games year-round.
6. **`fetchGamesByLeagueAndLocalDate()`** in `api.js` — fetches both local date AND prev ESPN date, merges by ID. Fixes IST/AEST users missing games. Do not revert to single-date fetch.
7. **StatusBadge "Starting" window = 8h** in `cricket-schedule.tsx`. Matches provider's upcoming cutoff. Do not reduce.
8. **All date/time helpers live in `src/lib/date-utils.ts`** — do NOT add new local date helpers in page files. Import from date-utils instead. Functions: `localDateString`, `localDateStringFromIso`, `localDateKey`, `relativeDate`, `fmtDisplayDate`, `fmtTime`, `localDayOffset`.

---

## Cricket Data — What Works

### Primary Source: TheSportsDB (free, CORS-open)

Two strategies queried in parallel:

**Day-based** (`eventsday.php?d={YYYY-MM-DD}&s=Cricket`):
- Returns ALL cricket on any calendar date; no league IDs needed
- Queried for: yesterday, today, +1, +2, +3 days (UTC calendar)

**League-based** (`eventsnextleague.php?id=X` / `eventspastleague.php?id=X`):
- 17 known competition IDs — see `KNOWN_LEAGUES` in `cricket.js`

**Limitation**: TSDB free tier has no live cricket scores. Status is always NS/FT.  
**Fix path**: Integrate CricAPI or Cricbuzz (both require an API key).

### Why ESPNcricinfo cannot be used
- `hs-consumer-api.espncricinfo.com` requires `x-hsci-auth-token` (Akamai WAF → 403)
- CORS: `access-control-allow-origin: https://www.espncricinfo.com` only — blocks all cross-origin requests
- `site.api.espn.com/sports/cricket/*` returns `{"code": 404}` — basketball ESPN API ≠ cricket

---

## Tasks That Need Re-Implementation

These 6 tasks were built in a previous session, committed locally, but **never pushed** and were lost when the local branch was reset to match `origin/main`. The `/tmp` backup was also cleared. They need to be re-done:

| Task | Feature | Files |
|------|---------|-------|
| 1 | Dual-provider fallback manager in `api.js` | new `src/providers/cricket-backup.js` + edit `api.js` |
| 2 | Match Intelligence panel on box score (toss/weather/pitch/H2H/PlayingXI) | edit `cricket-types.ts` + `cricket-box-score.tsx` |
| 3 | Format-aware stat badges in optimizer (`FormatGroupBadge`) | edit `cricket-optimizer.tsx` |
| 4 | Per-player fantasy intel panel in optimizer (`PlayerIntelPanel`) | edit `cricket-optimizer.tsx` |
| 5 | Recommendation engine (Captain/VC/Safe/Differential/GL) | new `src/lib/cricket-recommendations.ts` + edit `cricket-optimizer.tsx` |
| 6 | Schedule timezone audit comments | edit `cricket-schedule.tsx` |

**Start with Task 1 (provider fallback). Typecheck + push after EACH task.**

---

## Workflow Notes

The correct workflow is **`HoopIQ`** (runs `pnpm --filter @workspace/hoopiq run dev` on port 21534).

`artifacts/hoopiq: web` is a duplicate workflow that fails because port 21534 is already taken.

`hoopiq-repo/*` workflows all fail — `node_modules` are missing in that directory. These are spurious duplicate artifact registrations from a platform event and can be ignored.

---

## Git Authentication

PAT is available. To push:
```bash
git remote set-url origin https://<PAT>@github.com/giffyshani-jpg/Static-Site-Builder.git
git push origin main
git remote set-url origin https://github.com/giffyshani-jpg/Static-Site-Builder.git
```

---

## Dev Commands

```bash
pnpm --filter @workspace/hoopiq run typecheck   # must be clean before every commit
pnpm --filter @workspace/hoopiq run dev         # starts Vite on $PORT (21534)
```

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
// The Hundred covered by eventsday.php (not in KNOWN_LEAGUES — no ID found yet)
```
