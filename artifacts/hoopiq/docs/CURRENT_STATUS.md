# HoopIQ — Current Status

**Last updated**: July 25, 2026  
**Build status**: ✅ TypeScript clean · Vite server running  
**Git**: Committed locally (see Git section for push status)

---

## What's Working

### Cricket ✅
- **TheSportsDB multi-league provider** — 17 cricket competition IDs queried in parallel
- **Day-based auto-discovery** — `eventsday.php?d={date}&s=Cricket` fetches ALL cricket events for any date without needing league IDs
- **Today's active competitions**: The Hundred Men's, The Hundred Women's, Lanka Premier League, Global Super League (and more)
- **14 upcoming games shown on home page** across **6 active competitions** as of July 25, 2026
- Competition groups with color badges: Live / Today time / Tomorrow / Future date
- Competition names, venues, start times all displayed correctly
- No more "No active competitions found" message
- Provider health tracking via `src/lib/provider-health.ts`

### NBA ✅ (Fixed)
- **No more fake pre-season games** shown as "upcoming today"
- **Root cause was**: ESPN's `/scoreboard` endpoint returns October 5 pre-season games when no games are active. The home page was showing those as game cards.
- **Fix**: `isGameSoon()` filter — only shows game cards for games within 48 hours. Far-future games display as "Season starts [date]" text.
- Now shows: "Next game: Mon, Oct 5" cleanly, no misleading game cards

### WNBA ✅
- Shows real WNBA game today (game cards appear within 48h window)

### Home Page ✅
- "Other Basketball" section completely removed
- Only shows: 🏀 NBA · 🏀 WNBA · 🏏 Cricket
- Header shows correct count: "15 games upcoming today" (cricket + WNBA)

---

## Known Limitations

### Cricket Data Quality
- **TheSportsDB free tier has no live scores** — all games show as "scheduled" (NS) or "final" (FT), never "in_progress" while a match is happening
- **Score data only for completed matches** — innings-level scorecard not available (no batting/bowling breakdowns from TSDB free tier)
- **Cricket Box Score page** shows empty scorecard for TSDB-sourced games (TSDB doesn't provide innings data)
- **Fantasy Optimizer** has no player data for TSDB games

### ESPNcricinfo — WHY WE CAN'T USE IT
- `hs-consumer-api.espncricinfo.com` requires an `x-hsci-auth-token` header (Akamai 403 without it)
- CORS policy: `access-control-allow-origin: https://www.espncricinfo.com` only — blocks all cross-origin browser requests
- Both server-side and browser fetches fail
- ESPNcricinfo's API is NOT publicly accessible

### `site.api.espn.com/sports/cricket/*` — WHY IT DOESN'T WORK
- Returns `{"code":404}` for all cricket slugs (named or generic)
- ESPN's basketball API and cricket API live on different infrastructures
- Cricket data comes from ESPNcricinfo, not the main ESPN API domain

---

## Provider Architecture

```
Cricket (home page, game list):
  Primary:  TheSportsDB eventsday.php   — today/tomorrow/+3 days, all competitions at once
  Secondary: TheSportsDB per-league     — 17 known league IDs for broader coverage

Basketball:
  NBA/WNBA:  ESPN site.api.espn.com    — live scores, schedules, box scores
```

---

## File Structure (Changed This Session)

| File | Change |
|------|--------|
| `src/providers/cricket.js` | Complete rewrite — TheSportsDB multi-source |
| `src/pages/home.tsx` | Removed Other Basketball; fixed NBA/WNBA "close games only" filter |

---

## Git Status

Last commit: `feat: live data fixes — cricket TheSportsDB, NBA "no fake games", remove Other Basketball`  
Push status: GitHub push times out (no OAuth credential helper configured in this env)  
Remote: `https://github.com/giffyshani-jpg/Static-Site-Builder`

To push manually, configure a PAT:
```
git remote set-url origin https://<PAT>@github.com/giffyshani-jpg/Static-Site-Builder.git
git push origin main
```
