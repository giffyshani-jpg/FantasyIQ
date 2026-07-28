# FantasyIQ

A mobile-first multi-sport fantasy intelligence hub for Cricket, Basketball, and Football — live scores, box scores, pre-game intel, and an AI-assisted lineup optimizer.

## Run & Operate

- `PORT=21534 BASE_PATH=/ pnpm --filter @workspace/hoopiq run dev` — start the app (correct workflow: **HoopIQ**)
- `pnpm --filter @workspace/hoopiq run typecheck` — TypeScript check (run before every commit)
- **Do NOT** start `artifacts/hoopiq: web` workflow — it conflicts on port 21534

## Stack

- pnpm workspaces, Node.js 22, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, shadcn/ui
- Routing: Wouter (lightweight SPA routing)
- State: React useState/useEffect, raw fetch in hooks
- Persistence: Browser localStorage only (no backend, no database)
- Data: ESPN unofficial API + TheSportsDB free tier (browser fetch, CORS open)

## Where things live

```
artifacts/hoopiq/src/
  api.js                — adapter layer: ALL provider calls go through here
  providers/            — data sources (espn.js, cricket.js, thesportsdb.js, …)
  lib/                  — business logic (date-utils.ts, cricket-scoring.ts, format-filter.ts, …)
  pages/                — route components (home.tsx, basketball.tsx, cricket-schedule.tsx, …)
  components/           — shared UI (game-card.tsx, layout.tsx, …)
docs/                   — canonical documentation (AI_HANDOFF.md, CHANGELOG.md, KNOWN_ISSUES.md, …)
```

## Architecture decisions

- `api.js` is the ONLY import boundary. UI never calls providers directly.
- `safeCall()` wraps every provider invocation — one failure never crashes the app.
- No backend — all data from public ESPN/TheSportsDB APIs via browser fetch.
- Timezone-safe: never infer "live" from clock time alone — only from provider status field.
- Format-aware cricket stats: T20/ODI/Test groups are NEVER mixed (`src/lib/format-filter.ts`).
- All date/time helpers centralised in `src/lib/date-utils.ts` — no new helpers in page files.

## Product

- **Home** — 3 sport hub cards (Cricket, Basketball, Football) with live count indicators
- **Basketball** — NBA + WNBA hub; Recent/Today/Tomorrow tabs; pre-game intel; fantasy optimizer with AI Coach
- **Cricket** — schedule (Recent/Today/Tomorrow tabs); match box score; format-aware fantasy optimizer
- **Football** — competition list; live scores and fantasy coming soon

## User preferences

*(Populate with explicit user requests across sessions.)*

## Gotchas

- Cricket routes in `App.tsx` MUST appear before `/:league` catch-all (prevents misrouting)
- `/cricket/:competition` has NO route — `CricketBoxScore` back-nav goes to `/cricket`
- NZ NBL uses TheSportsDB (ESPN returns 400 for "nznbl")
- NBA Summer League: ESPN doesn't serve a public `nba-summer-league` slug; use NBA CDN fallback
- `hoopiq-repo/` and `artifacts/hoopiq/docs/` have been deleted — do NOT recreate

## Pointers

- Full technical context: `docs/AI_HANDOFF.md`
- Current state of what works: `docs/CURRENT_STATUS.md`
- Bug tracker: `docs/KNOWN_ISSUES.md`
- ESPN slugs, gamelog endpoint, pregame arch: `docs/TECHNICAL_NOTES.md`
- TheSportsDB cricket league IDs: `docs/AI_HANDOFF.md` (TheSportsDB Cricket League IDs section)
