# CLAUDE.md — MistvaleMobile-Admin

Operator cockpit (Admin Suite) for **Mistvale**, a 2D pixel-art turn-based champion-collection RPG. This repo is the **admin frontend SPA only** — it talks to the Admin API hosted by the game server in the sibling repo `MistvaleMobile`. It never touches the database directly.

## Read first (in order)
1. `docs/ADMIN_SUITE_DESIGN.md` — what the suite does (every editor, workflows, safety rails)
2. `docs/ADMIN_ARCHITECTURE.md` — how it's built (stack, type-sync contract, deploy)
3. `ROADMAP.md` — phase plan, aligned with the game repo's phases
4. Game repo context: `MistvaleMobile/CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API_DESIGN.md §2` (the Admin API this SPA consumes)

## Project state
**Planning phase.** No application code yet — implementation begins with game-repo Phase P0/P1 (the Admin API must exist first). Do not scaffold code here until the game repo's server skeleton and OpenAPI artifact exist.

## Hard rules
- **Stack (locked):** Vite + React 18 + TypeScript strict + Mantine 7 + TanStack Query/Router/Table + react-hook-form + Zod. Generated API types via openapi-typescript from `MistvaleMobile/docs/openapi/admin-api.json` (`pnpm sync-api`; CI fails on drift). pnpm only.
- **No direct DB access, ever.** All reads/writes via `/admin/api/*`.
- **No serif fonts.** Dark utilitarian Mantine theme with Mistvale accents.
- **Server is truth:** no optimistic updates; mutations re-fetch.
- **Safety rails are features, not polish:** draft→validate→diff→publish, typed confirmations for destructive actions, audit visibility. Never bypass or stub them "temporarily".
- **Shared editor primitives first:** build/extend `RewardPicker`, `GoalBuilder`, `EffectComponentEditor`, `DiffViewer`, `SpritePreview`, `CurveEditor`, `EntityTable` rather than one-off per-editor UIs.
- Production quality only — no skeletons/MVPs; every editor ships with validation, empty states, and error handling.

## Conventions
- Feature folders under `src/features/<editor>/` (see ADMIN_ARCHITECTURE §4); shared primitives in `src/components/`.
- Commits: `feat(admin/<area>): …`, `fix:`, `docs:`, `chore:`; update `CHANGELOG.md` under `[Unreleased]` with every user-visible change.
- Testing: Vitest + RTL for editor logic (skill composer, publish diff are priority), Playwright smoke for login→edit→validate→publish.
- Branch discipline: never commit to `main` directly; current work branch: `claude/mistvale-raid-planning-1k4axz`.

## Workflow with the owner
Between phases, ask the owner (Marvin) if they have feedback/bugs/improvement requests — offer, don't force. Open questions go in the game repo's `USER_QUESTIONS.md` (single questions file for the whole project).
