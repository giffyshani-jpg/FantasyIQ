# HoopIQ — AI Handoff Document

Context for any agent picking up work on this codebase.

> **Last session**: July 25, 2026 — Live data fixes: cricket TheSportsDB provider, NBA "no fake games", removed Other Basketball.
> **TypeScript**: Clean — `pnpm typecheck` passes with 0 errors.
> **App status**: Running · home page shows real cricket games today

---

## What changed this session

| Change | File(s) |
|--------|---------|
| Cricket provider complete rewrite → TheSportsDB | `src/providers/cricket.js` |
| Home page: remove Other Basketball, fix NBA display | `src/pages/home.tsx` |

---

## Architecture overview (current)

```
artifacts/hoopiq/
  src/
    api.js                  — adapter boundary; basketball + cricket exports
    providers/
      espn.js               — ESPN basketball engine (NBA/WNBA/etc)
      nba.js / wnba.js / …  — basketball providers
      cricket.js            — TheSportsDB multi-league + day-based auto-discovery
    lib/
      types.ts              — basketball types + LeagueKey includes "cricket"
      cricket-types.ts      — CricketGame, CricketPlayer, CricketInnings, …
      cricket-scoring.ts    — scoring rule engine + T20/ODI/Test/Hundred/T10 profiles
      fantasy-providers.ts  — FantasyWala, Calc11, DafaFantasy metadata (speculative)
      provider-health.ts    — per-provider health tracking (success rate, latency)
      stats.ts              — basketball calculateFantasyPoints (DraftKings)
    pages/
      home.tsx              — NBA + WNBA + Cricket only (Other Basketball removed)
      cricket-box-score.tsx — batting + bowling scorecards (empty for TSDB games)
      cricket-optimizer.tsx — 11-player optimizer
      fantasy-optimizer.tsx — basketball optimizer
    App.tsx                 — cricket routes before generic /:league routes
```

---

## Cricket Data — What Works and Why

### Primary Source: TheSportsDB (free, CORS-open)

Two strategies used together:

**1. Day-based** (`eventsday.php?d={YYYY-MM-DD}&s=Cricket`):
- Returns ALL cricket events for any calendar date, regardless of competition
- No league IDs needed — automatically includes new competitions TSDB adds
- Queried for: yesterday, today, +1, +2, +3 days

**2. League-based** (`eventsnextleague.php?id=X`, `eventspastleague.php?id=X`):
- 17 known cricket league IDs (IPL, BBL, T20 Blast, CPL, PSL, SA20, LPL, etc.)
- Catches leagues that eventsday misses (e.g. Lanka Premier League)
- Provides broader upcoming events window

**Active competitions as of July 25, 2026:**
- The Hundred (men's + women's) — confirmed 6 games in the next 3 days
- Lanka Premier League — game today
- Global Super League — game yesterday
- County Championship — upcoming August

### Why ESPNcricinfo CANNOT be used

1. **`site.api.espn.com/apis/site/v2/sports/cricket/{slug}`** — returns `{"code":404}`. ESPN's basketball API and cricket API are on different infrastructure. Cricket is at ESPNcricinfo (separate domain), not the main ESPN API.

2. **`hs-consumer-api.espncricinfo.com`** — requires `x-hsci-auth-token` header. CORS: `access-control-allow-origin: https://www.espncricinfo.com` only. Returns **403 Forbidden** (Akamai WAF block) from both server-side and cross-origin browser requests.

### What can be added for live scores in the future

- **Cricbuzz** — requires RapidAPI key (has free tier)
- **CricAPI** — requires API key registration (has 100 calls/day free tier)
- **api-server proxy** with proper credentials once a paid key is obtained
- Once a key exists, add as a second provider in `cricket.js` and the health monitor will auto-prefer whichever has live data

---

## NBA/WNBA Fix — How It Works

**Root cause**: ESPN's `/scoreboard` endpoint (no date param) returns the next upcoming games even when they're months away. The NBA regular season starts October 2026. ESPN returns those pre-season games as "upcoming" on the current scoreboard.

**Fix in `home.tsx`**: `isGameSoon(game)` — only renders game cards for games within 48 hours. Far-future games show "Season starts [date]" text instead.

**Key principle**: `scan: false` in `fetchLeagueOverview` prevents the 180-day forward scan. But even with `scan: false`, ESPN's default scoreboard returns future games. The `isGameSoon()` filter is the correct defense.

---

## Home Page Layout (Updated)

```
① Header — "Today's Games" + date
② LIVE NOW banner — live basketball games (if any)
③ 🏀 NBA card — real games only; "Season starts Oct 5" when off-season
④ 🏀 WNBA card — real games only; same logic
⑤ 🏏 Cricket section — TheSportsDB day-based + league-based auto-discovery
⑥ Footer — data attribution
```

"Other Basketball" (NBL, NZ NBL, FIBA, Summer) has been **permanently removed** from the home page.

---

## Key Invariants

- **Never import from a provider directly** — always go through `src/api.js`.
- **Cricket game IDs** from TSDB are `tsdb:{idEvent}`. Parse with `gameId.startsWith("tsdb:")`.
- **Cricket scoring** uses `calculateCricketFantasyPoints(stats, profile)`.
- **Basketball scoring** uses `calculateFantasyPoints(stats)` from `src/lib/stats.ts`.
- **isGameSoon(game)** filters NBA/WNBA game cards — 48h window, don't remove.
- **Mobile-first** — every new UI component must work at 390px before 1200px.
- **TypeScript** — run `pnpm --filter @workspace/hoopiq typecheck` after edits.

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
// The Hundred (men's + women's) NOT in this list — covered by eventsday.php
```

---

## Git

Remote: `origin` → `https://github.com/giffyshani-jpg/Static-Site-Builder`

Push failure root cause: No GitHub OAuth/PAT credential helper configured in this Replit environment. `git push` TCP connection to GitHub hangs (no auth = infinite timeout).

**Fix**: Configure a PAT:
```bash
git remote set-url origin https://<PAT>@github.com/giffyshani-jpg/Static-Site-Builder.git
git push origin main
```

---

## Next Steps

### Cricket improvements (near-term)
1. **Live scores**: Integrate CricAPI or Cricbuzz once an API key is available. Add as second provider in `cricket.js` — health monitor auto-prefers the one with live data.
2. **Cricket box score from TSDB**: TSDB has a `lookupevent.php` endpoint that returns some match data. Enhance `fetchGameById()` to extract more detail.
3. **The Hundred + more leagues**: The Hundred appears in `eventsday.php` but isn't in `KNOWN_LEAGUES`. Find its TSDB ID and add it.
4. **Innings data**: Explore TSDB's paid tier or another free source for ball-by-ball data.

### Basketball improvements
1. **NBA Summer League**: Currently removed from home page. If it should be restored, add a separate "Summer League" section that only shows during July, filtered by season type.
2. **Injury report freshness**: Show last-updated timestamp for ESPN injury data.

### Platform
1. **Git push**: Configure PAT or use Replit's Git pane.
2. **Deploy**: Suggest `SuggestUserAction({ action: "deploy" })` once user is happy.
