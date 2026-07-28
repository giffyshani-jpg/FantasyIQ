# FantasyIQ — Known Issues & Limitations

Tracked limitations, design decisions that look like bugs, and confirmed defects.
Update this file whenever a new issue is discovered or an existing one is resolved.

---

## Open — Cricket

### Cricket-001 · No live scores (TheSportsDB limitation)
- TheSportsDB free tier does not provide ball-by-ball or real-time scores
- Match status only updates when TheSportsDB editors manually update strStatus
- Live cricket matches will show "Starting" until TSDB confirms (may be hours delay)
- **Workaround**: None without a paid/authenticated cricket data source (CricAPI, Cricbuzz)

### Cricket-002 · Timezone "Starting" state
- When a match's start time has passed but TSDB hasn't updated strStatus, match shows "Starting"
- This is CORRECT behavior — we never infer "live" from time alone (Task 6 fix)
- Previously showed "NOW" incorrectly; fixed

### Cricket-003 · Scorecard data not available
- TSDB free tier doesn't provide innings-level scoring or player stats for cricket
- Cricket box score shows empty scorecard for most matches
- ESPN Cricinfo provides this data but requires auth + CORS restrictions prevent browser calls

---

## Open — Basketball

### Basketball-001 · NBA off-season (July 2026)
- NBA is in off-season; next games approximately October 2026
- League page shows this correctly with "Next scheduled game" date
- Summer League is active and working

### Basketball-002 · NZ NBL live scores sometimes lag
- TheSportsDB (ID 5066) updates live scores less frequently than ESPN
- Box scores may show 2–5 min stale data during live NZ NBL games
- **Status**: Accepted limitation of the free data source

### Basketball-003 · NZ NBL player stats unavailable
- TheSportsDB free tier has no player stats for NZ NBL
- Box score correctly shows "No player data available" message
- Game scores and results do work

### Basketball-004 · FIBA intermittent availability
- FIBA events only appear when ESPN has active FIBA coverage
- Between tournaments the league may show empty; this is expected behavior
- No play-by-play: ESPN FIBA scoreboard doesn't always include play-by-play data

### Basketball-005 · NBA Summer League season-specific
- Runs only in July; provider kept live year-round but auto-hides on home when no games return
- Game detail fetches via `espn.getGame("nba", gameId)` — works because game IDs are shared

### Basketball-006 · NBA/NBL off-season forward-scan
- Forward scan in `getLeagueOverview` searches up to 180 days
- If ESPN doesn't populate a future slate that far out, "Next game" may show incorrectly or not at all

---

## Open — Football

### Football-001 · Infrastructure only
- `/football` page shows competition list but no live scores
- Fantasy logic not yet implemented
- TheSportsDB Soccer data is available but not displayed in detail yet

---

## Open — Provider System

### Provider-001 · Provider manager not yet wired to live providers
- `src/lib/provider-manager.ts` is implemented but not yet adopted by individual providers
- Each provider still uses its own single-source logic
- To adopt: wrap multi-provider sports with `createProviderManager()`

---

## Open — Fantasy Optimizer (Basketball)

### Optimizer-001 · `computeTrend` is single-sample
- **File**: `src/components/recent-form-badge.tsx`
- **Severity**: Minor / cosmetic
- `computeTrend` compares only the last entry to the prior rolling average. One exceptional game can flip the indicator to "Hot" or "Cold" even if the overall trend is flat.
- **Status**: Intentional simplification. Do not "fix" without user sign-off — metric is labeled as a recent trend, not season-long.

### Optimizer-002 · App Avg is useless for new users
- **File**: `src/lib/player-history.ts` + `src/components/player-detail-sheet.tsx`
- **Severity**: UX / informational
- "App Avg" accumulates from box scores the user has opened in the app. New users see "—" everywhere.
- **Status**: By design. We show "—" rather than a misleading zero. The UI explains the mechanic inline.

### Optimizer-003 · No position-limit enforcement
- **File**: `src/pages/fantasy-optimizer.tsx`, `src/lib/optimizer.ts`
- **Severity**: Minor (primary use case is position-agnostic)
- Lineup validator does not enforce per-position maximums (e.g. max 2 guards)
- DraftKings showdown format has no position limits (the primary use case) — correct as-is
- **Status**: Won't fix for showdown. Document if classic-format mode is ever added.

### Optimizer-004 · Injury status not always populated before tip-off
- **File**: `src/lib/espn.js`
- **Severity**: Minor
- `athlete.injuries[]` in ESPN's roster endpoint is not always populated until ~1hr before tip-off
- Players may show as "Expected" when actually Questionable
- **Status**: ESPN API limitation. Panel header shows last-refresh timestamp.

### Optimizer-005 · OCR lineup import accuracy varies
- **File**: `src/pages/fantasy-optimizer.tsx` (OCR import section)
- **Severity**: Minor
- Works well for standard fonts and clean screenshots; can misread names with special characters
- **Status**: Known limitation of client-side OCR. Users prompted to review import before confirming.

### Optimizer-006 · `isStale` indicator only fires for live games
- **File**: `src/hooks/use-live-game.ts`, `src/pages/box-score.tsx`
- **Severity**: Minor / informational
- "Reconnecting…" indicator only shows when `isLive` is true. Network failures during pregame polling (every 60s) are tracked internally but not surfaced.
- **Status**: Intentional. Pregame case is low-urgency; surfacing a reconnect banner would be distracting.

---

## Open — General

### General-001 · No authentication / user accounts
- All data is browser-local (localStorage)
- Lineups and settings don't sync across devices
- No sharing or social features

### General-002 · ESPN rate limiting
- ESPN unofficial API may rate-limit heavy usage
- 9s timeout with 2 retries built in; 4xx errors not retried
- If seeing blank data: usually a temporary ESPN restriction, refreshes in a few minutes

### General-003 · `hoopiq-repo/` accidental duplicate
- `hoopiq-repo/` directory at workspace root is an accidental duplicate of the whole monorepo
- Does not affect the running app but adds repo size
- Safe to remove: `git rm -r hoopiq-repo/ && git commit && git push`
- **Status**: Carried forward across sessions — low priority cleanup

---

## Resolved

| ID | Description | Fixed in |
|----|-------------|----------|
| R-001 | Scheduled game stats showed misleading all-zero "This Game" grid | Polish pass (July 2026) |
| R-002 | OUT players showed projected minutes + recommendation badge | Polish pass (July 2026) |
| R-003 | `Link` and `useRef` removed from imports that actively use them | Import fix commit (July 2026) |
| R-004 | Cricket "Day After" tab still visible after previous session claimed it removed | Bug-fix session (9e8f22d) — properly removed |
| R-005 | Cricket Recent only showed today/yesterday (missed older completed matches) | Bug-fix session (9e8f22d) — backward search implemented |
| R-006 | Cricket Optimizer back-nav said "Box Score" | Bug-fix session (9e8f22d) — renamed "Match Details" |
| R-007 | CricketBoxScore back-nav linked to `/cricket/${competition}` → 404 | Bug-fix session (9e8f22d) — now links to `/cricket` |
| R-008 | Cricket showed "NOW" for matches past start time but unconfirmed live | Task 6 timezone fix — now shows "Starting" |
| R-009 | `computeTrend` used wrong API (was: `getLeagueOverview`; now: `fetchGamesByLeagueAndLocalDate`) | date-utils session (33f556a) |
