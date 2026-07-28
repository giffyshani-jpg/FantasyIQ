# FantasyIQ — Technical Notes

Reference documentation for non-obvious technical details. Verified against live data July 2026.

---

## ESPN Basketball API Slugs

### Working (HTTP 200)

| LeagueKey | ESPN slug |
|-----------|-----------|
| `nba` | `nba` |
| `wnba` | `wnba` |
| `nbl` | `nbl` |
| `fiba` | `fiba` |
| `ncaam` | `mens-college-basketball` |
| `ncaaw` | `womens-college-basketball` |

Base URL: `https://site.api.espn.com/apis/site/v2/sports/basketball/<slug>/scoreboard`

### Unsupported (HTTP 400 — no public endpoint)

- `nba-summer-league` → 400 (NBA Summer League NOT served via public API — use NBA CDN instead)
- `nznbl` → 400 (New Zealand NBL not served by ESPN — use TheSportsDB ID 5066)
- `eurocup`, `euroleague` → 400 (ESPN does not carry these leagues)

### Dated Queries

Some ESPN slugs support `?dates=YYYYMMDD` while others only return current-day data.
`getLeagueOverview` in `providers/espn.js` handles 400 errors from dated queries gracefully (returns empty array).

### Live Detection

`getLeagueOverview` always fetches the *default* scoreboard (no date param) first — this is ESPN's
authoritative "now" view and correctly shows LIVE games regardless of the viewer's timezone.
Classifies purely by `status.type.state`, never by comparing calendar dates.

---

## ESPN Player Game Log Endpoint

```
https://site.web.api.espn.com/apis/common/v3/sports/basketball/{league}/athletes/{athleteId}/gamelog
```

(league = `nba` or `wnba`)

### Capabilities Confirmed

- Real historical games grouped by season type (regular, playoffs/play-in, preseason)
- Parallel `names`/`stats` array covering: MIN, FG, 3PT, FT, REB, AST, BLK, STL, PF, TO, PTS
- Per-event: date, opponent (id/abbreviation/name), home/away (`atVs`: `"vs"` = home, `"@"` = away), final score, W/L
- Keyed by the same athlete id already returned in box score/summary — no separate id-lookup needed
- CORS is open (`Access-Control-Allow-Origin: *`) — safe to call directly from browser

### Known Gaps

- No starter/bench status per historical game (only current game's live summary has it)
- No plus/minus per historical game
- Preseason games are mixed into `seasonTypes` — filter them out unless preseason data is wanted

### How It's Used

`providers/espn.js` → `getPlayerGameLog` → wrapped per-league in `providers/nba.js`/`wnba.js` →
exposed via `api.js` → `fetchPlayerGameLog`. Cached in `lib/game-log-cache.ts` (sessionStorage, 45 min TTL).
Derived metrics in `lib/game-log-metrics.ts`. Surfaced on `/:league/player/:playerId` page.

---

## Player Availability from ESPN Data

ESPN's box score/summary endpoint athlete entries expose explicit `starter` (boolean) and
`didNotPlay` (boolean) fields alongside injury-report status string (OUT/GTD/Questionable/Probable).

**Rule:** prefer `player.didNotPlay` / `player.starter` when defined. Only fall back to the
minutes-based heuristic (zero minutes once game started ⇒ inactive) for feed shapes where these
explicit flags are absent.

**Why:** The explicit flags cover DNP-Coach's-Decision, healthy scratches, and bench-never-checked-in
cases that the minutes heuristic can't distinguish. They're also available pregame via injury report.

**Caveat:** Both are `undefined` pregame (no box score published yet), not `false`.
When `undefined`, fall back to heuristic from previous game's box score.

---

## Pre-Game Intelligence Architecture

### ESPN Data Available Pregame

- **Roster endpoint**: `athlete.injuries[]` — injury status (not always populated until ~1hr before tip-off)
- **Pickcenter/odds block** (`summary.pickcenter[0]`): spread, `homeTeamOdds.favorite`, `overUnder` for scheduled games when market posted. Not always present. Exposed as `Game.pregameOdds`.
- **No depth-chart endpoint** — `/sports.core.api.espn.com/.../depthcharts` returns 404. No official "expected starter" exists pregame.

### Expected Starter Heuristic

Since ESPN provides no pregame starter list, derive from the most recently completed game's box score
for each team (`fetchGameById(prevGameId)` after finding previous game ID from team schedule).
Players with `starter === true` or played ≥8 minutes form the "rotation baseline" (capped at 10 per team).
Labeled "Expected Starter" in UI (not "Confirmed Starter").

### Data Flow

1. `useLiveGame` polls every 60s while `status === "scheduled"`.
2. `usePregameIntel` runs once per `game.id`: fetches team schedules + previous game + player gamelogs via `Promise.all`, stores as `rotationBaseline` state.
3. On each `game` update (every 60s), `useMemo` cheaply recomputes lineup status/recommendations from already-fetched baseline + current `game.injuryReport` + `game.pregameOdds`.

### Back-to-Back Threshold

≤30h gap between prior game date and tonight's tipoff ISO timestamp.
30h (not strict 24h) accounts for early-afternoon-to-late-evening scheduling.

### Recommendation Badge Thresholds (`lib/pregame-intel.ts`)

| Tier | Condition |
|------|-----------|
| Elite Play | avgFptsLast5 ≥ 45 |
| Strong Play | avgFptsLast5 ≥ 32 |
| Safe Value | avgFptsLast5 ≥ 20 |
| Risky | avgFptsLast5 ≥ 10 |
| Avoid | avgFptsLast5 < 10 or status === "Out" |

**Adjustments:** Questionable/GTD → −1 tier; minutesTrend "down" → −1; "up" (non-bench) → +1;
backToBack → −1; blowoutRisk High (and player's team is favorite) → −1.

---

## Provider Chain and Retry Logic

### NBA Provider Chain (July 2026)

- NBA: ESPN primary → NBA CDN fallback (`nbadotcom.js` `getNbaTodayGames`/`getNbaOverview`)
- WNBA: ESPN primary (active season, reliable)
- NBA Summer League: ESPN NBA slug filtered to `season.type === 3` → NBA CDN `getSummerLeagueOverview`
- NZ NBL: TheSportsDB ID 5066 primary (ESPN returns HTTP 400 for "nznbl" slug)
- Australia NBL: ESPN (off-season July 2026, next season Oct 2026)
- FIBA: ESPN (varies by tournament window)

### ESPN Retry Logic

- `fetchJson()` in `providers/espn.js`: 2 retries, 600ms × attempt backoff, 9s timeout per attempt
- **4xx errors are NOT retried** (ESPN returns 400/404 for unsupported leagues — don't hammer)
- 5xx and network errors ARE retried

### TheSportsDB Notes

- Free tier: next/past 15 events per league, no live scores, no player stats
- `dateEvent` field is local timezone, not UTC — compare against both local AND UTC date
- `isEventFinished()`: handles "Match Finished", "FT", "AET", "AP", "PSO", "Abandoned"
- Postponed/cancelled events kept as "scheduled" so they don't pollute Last Played

### NBA CDN

- Base: `https://cdn.nba.com/static/json`
- `todaysScoreboard_00.json` — live scoreboard (includes Summer League)
- Summer League identification: `g.gameLabel.includes("Summer")` OR `gameId.startsWith("001")`
- CORS: requires `Origin: https://www.nba.com` header from browser

### api.js Caching

- Overview cache: 2 min TTL, memory + sessionStorage, keyed by `${league}:${scan ? "1" : "0"}`
- In-flight coalescing: concurrent requests for same key share one Promise
- Game detail cache: 30s (live), 5min (final), 2min (scheduled)

---

## Artifact Registration Pattern

**Rule:** When a repo is cloned into `artifacts/<slug>/`, the Replit proxy does NOT route to it because
`createArtifact` was never called. Copying files skips the system-level registration.

**Fix if needed:**
1. Backup all source files from `artifacts/<slug>/src/` and custom config files.
2. `rm -rf artifacts/<slug>/`
3. Call `createArtifact({ slug, previewPath, title, artifactType })` — registers with proxy and creates managed workflow `artifacts/<slug>: web`.
4. Copy all backed-up files back over the freshly scaffolded directory.
5. Run `pnpm install` then `WorkflowsRestart` on the managed workflow.

The managed workflow name is always `artifacts/<slug>: <service-name>` (service name from `artifact.toml`).

---

## CSS Theme

- Background: `222 20% 7%` (deep navy)
- Primary: `24 95% 53%` (basketball orange #f97316)
- Card: `222 18% 10%`
- `index.css` has `.skeleton-shimmer`, `.live-dot`, `.fade-in-up`, `.stagger-children` utility classes

---

## Cricket Fantasy Scoring Profiles

| Profile | Per Run | Per Wicket | SR Bonus | Economy Bonus | Duck Penalty |
|---------|---------|------------|----------|---------------|--------------|
| T20 | +1 | +30 | Yes (min 10 balls) | Yes (min 2 overs) | −2 |
| T10 | +1 | +30 | Yes (min 10 balls) | Yes (min 2 overs) | −2 |
| ODI | +1 | +25 | Yes (min 20 balls) | Yes (min 5 overs) | −3 |
| Test | +1 | +16 | No | No | −4 |
| The Hundred | +1 | +30 | No (per format rules) | No (per format rules) | −2 |

Captain multiplier: ×2.0. Vice Captain multiplier: ×1.5.

See `src/lib/cricket-scoring.ts` for full Strike Rate and Economy tier breakdowns.
