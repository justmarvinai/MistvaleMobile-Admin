# AGENTS.md — MistvaleMobile-Admin

Instructions for AI coding agents working in this repository.

**Start by reading `CLAUDE.md`** — it is the authoritative agent guide for this repo (project state, locked stack, hard rules, conventions). Everything there applies to all agents, not just Claude.

Repo-specific quick facts:
- This is the **Admin Suite SPA** for the game in `MistvaleMobile`. Frontend only; the Admin API lives in the game repo's server. No database access from here.
- **Planning phase** — documentation only until the game repo's Phase P0/P1 provides the Admin API + OpenAPI artifact.
- Key docs: `docs/ADMIN_SUITE_DESIGN.md` (product spec), `docs/ADMIN_ARCHITECTURE.md` (technical spec), `ROADMAP.md` (phases).
- Never edit generated files (`src/api/schema.d.ts`) by hand — run `pnpm sync-api`.
- Never weaken publish/validation/confirmation safety rails.
- Work on the designated feature branch; never push to `main` without explicit permission; keep `CHANGELOG.md` current.
