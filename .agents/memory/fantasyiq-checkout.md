---
name: FantasyIQ checkout persistence
description: Prevent loss of Git metadata when continuing FantasyIQ work across Replit sessions.
---

Use a normal Git clone under the persistent workspace for the FantasyIQ development branch. Do not rely on a linked worktree whose `.git` pointer targets temporary storage.

**Why:** a prior checkout's source files persisted while its Git administrative directory under `/tmp` disappeared, making branch status and commits unavailable.

**How to apply:** verify the actual remote branch first, then clone that branch directly into a persistent workspace directory before editing.
