# FantasyIQ — Known Issues & Limitations

## Cricket

### No live scores (TheSportsDB limitation)
- TheSportsDB free tier does not provide ball-by-ball or real-time scores
- Match status only updates when TheSportsDB editors manually update strStatus
- Live cricket matches will show "Starting" until TSDB confirms (may be hours delay)
- **Workaround**: None without a paid/authenticated cricket data source (CricAPI, Cricbuzz)

### Timezone "Starting" state
- When a match's start time has passed but TSDB hasn't updated strStatus, the match shows "Starting" in the UI
- This is CORRECT behavior — we never infer "live" from time alone (Task 6 fix)
- Previously showed "NOW" incorrectly; this was a bug and is now fixed

### Scorecard data not available
- TSDB free tier doesn't provide innings-level scoring or player stats for cricket
- Cricket box score shows empty scorecard for most matches
- ESPN Cricinfo provides this data but requires auth + CORS restrictions prevent browser calls

## Basketball

### NBA off-season (July 2026)
- NBA is in off-season; next games approximately October 2026
- The league page shows this correctly with "Next scheduled game" date
- Summer League is active and working

### NZ NBL player stats
- TheSportsDB free tier has no player stats for NZ NBL
- Box score correctly shows "No player data available" message
- Game scores and results do work

## Football

### Infrastructure only
- `/football` page shows competition list but no live scores
- Fantasy logic not yet implemented
- TheSportsDB Soccer data is available but not displayed in detail yet

## Provider System

### Provider manager not yet wired to live providers
- `src/lib/provider-manager.ts` is implemented but not yet adopted by individual providers
- Each provider still uses its own single-source logic
- To adopt: wrap multi-provider sports with `createProviderManager()`

## General

### No authentication / user accounts
- All data is browser-local (localStorage)
- Lineups and settings don't sync across devices
- No sharing or social features

### ESPN rate limiting
- ESPN unofficial API may rate-limit heavy usage
- 9s timeout with 2 retries built in; 4xx errors not retried
- If seeing blank data: usually a temporary ESPN restriction, refreshes in a few minutes
