# FantasyIQ

FantasyIQ is a multi-sport fantasy analysis hub for real basketball, cricket, football, and European basketball data.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/hoopiq/src/api.js` — browser-facing provider registry and league metadata.
- `artifacts/hoopiq/src/providers/` — sport data adapters; WNBA and existing basketball providers remain independent.
- `artifacts/hoopiq/src/lib/*-scoring.ts` — sport-specific fantasy scoring and lineup validation.
- `artifacts/hoopiq/src/pages/*optimizer.tsx` — user-facing optimizer flows.
- `lib/api-spec/openapi.yaml` — source of truth for API contracts; generated clients and Zod schemas live under `lib/api-client-react` and `lib/api-zod`.

## Architecture decisions

- EuroLeague results are fetched from the official XML feed through the same-origin API server proxy because the official endpoint does not provide browser CORS.
- The basketball hub always renders NBA before WNBA; secondary competition links are shown only for live/upcoming schedules or results from the last 14 days.
- Chinese CBA uses TheSportsDB league ID 4442 for schedules and completed results; its free feed has no live scores or player box scores.
- Cricket contest guidance consumes the existing stats-based AI ratings but never changes cricket scoring profiles, credits, or the 11-player optimizer.
- PKL accepts imported/provider player records rather than inventing a roster while no stable PKL player feed is configured.
- Football captaincy prioritizes only explicit penalty/set-piece signals; it never infers those roles from position, goals, or fantasy points.
- Existing WNBA and basketball provider/scoring pipelines are preserved as separate adapters.

## Product

- Basketball schedules, box scores, analysis, player comparisons, injuries, and fantasy optimization across NBA, WNBA, and supported leagues including CBA.
- Cricket schedules, scorecards, format-aware scoring, an 11-player optimizer, AI player ratings, and small-/large-contest strategy guidance.
- Football match discovery, lineup/formation validation, XI optimization, captain/vice-captain selection, and explicit set-piece/penalty-taker signals.
- EuroLeague results and fixtures through the official feed proxy.
- PKL seven-player optimization using Dream11-style kabaddi scoring, role limits, team limits, and imported real player projections.

## User preferences

- Preserve existing WNBA, basketball, and sport scoring behavior when adding new sport features.

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.
- Restart `artifacts/api-server: API Server` after server or API contract changes, then verify `/api/healthz` and the changed route through the shared proxy.
- The FantasyIQ remote is `fantasyiq`; `origin` may point to a different repository and must not be used for this branch.
- Providers must not fabricate player data or credits when the upstream source does not supply them.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `.agents/memory/espn-api-slugs.md` before adding ESPN-backed basketball leagues.
