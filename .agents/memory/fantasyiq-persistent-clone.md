---
name: Persistent clone location
description: Workspace and filesystem guidance for FantasyIQ GitHub work
---

The GitHub checkout is the authoritative working tree for FantasyIQ. Keep it in a persistent directory and ensure any workspace-facing pointer resolves to that exact checkout before editing.

**Why:** A temporary clone can disappear during parallel validation, and a stale or broken workspace pointer can cause edits to land outside the real repository.

**How to apply:** Verify `git rev-parse --show-toplevel`, `git status --short --branch`, and `git rev-parse origin/main` from the active path before editing, committing, or pushing.