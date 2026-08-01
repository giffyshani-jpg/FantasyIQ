---
name: GitHub workflow
description: Repository source and documentation synchronization rule for FantasyIQ
---

The GitHub repository `giffyshani-jpg/FantasyIQ` is the authoritative source for active work. The working project should be on `main` and track `origin/main` before implementation.

**Why:** The initial workspace was a starter scaffold while the GitHub repository contained the current FantasyIQ product. Working from the starter would silently reintroduce stale code.

**How to apply:** Bootstrap from the latest GitHub `main`, then keep `AI_HANDOFF.md` and `CURRENT_STATUS.md` at the repository root synchronized with their canonical `docs/` counterparts. Keep feature commits separate from documentation commits.