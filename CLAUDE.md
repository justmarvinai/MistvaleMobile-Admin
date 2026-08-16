# CLAUDE.md — MistvaleMobile-Admin

Operator cockpit (Admin Suite) for **Mistvale**, a 2D pixel-art turn-based champion-collection RPG. This repo is the **admin frontend SPA only** — it talks to the Admin API hosted by the game server in the sibling repo `MistvaleMobile`. It never touches the database directly.

## Read first (in order)

1. `docs/ADMIN_SUITE_DESIGN.md` — what the suite does (every editor, workflows, safety rails)
2. `docs/ADMIN_ARCHITECTURE.md` — how it's built (stack, type-sync contract, deploy)
3. `ROADMAP.md` — phase plan, aligned with the game repo's phases
4. Game repo context: `MistvaleMobile/CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API_DESIGN.md §2` (the Admin API this SPA consumes)

## Project state

**Phases A0–A1 complete → next is A2 (world authoring)** — see `ROADMAP.md`. The scaffold, typed API layer, rank-gated auth, app shell, dashboard, publish center, the generic entity browser (all 12 content types) and the Game config / Champion / Skills editors exist and are tested. Campaign, drop-table, balance-sandbox and battle-inspector editors do not yet.

**Working on the code:** `pnpm install`, then `pnpm dev` (Vite on `:5174`, serving `/admin/`, proxying `/admin/api` and `/api` to the game server on `127.0.0.1:3001`). Run the game server from the sibling repo first. `pnpm verify` runs the whole gate (format, lint, typecheck, test, build).

**API types are generated.** `pnpm sync-api` turns the game repo's `docs/openapi/admin-api.json` into `src/api/schema.d.ts`; `src/api/types.ts` is aliases onto it. That artifact is itself generated from the Zod contracts the server validates with, so a server-side shape change surfaces here as a type error rather than a runtime surprise — nothing needs mirroring by hand. Run `pnpm sync-api` after pulling a game-repo change; CI runs `sync-api --check` and fails on a stale schema. The only hand-written shapes left are the envelope generics and `HealthReport` (an operations endpoint outside the Admin API), and the runtime value lists that pickers need, which `src/api/types.test.ts` checks against the artifact.

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
- Branches: **work on `main` and push there directly** (owner's standing instruction — no feature branch). Every push must leave `pnpm verify` green, since nothing sits in front of `main`.

## Workflow with the owner

Between phases, ask the owner (Marvin) if they have feedback/bugs/improvement requests — offer, don't force. Open questions go in the game repo's `USER_QUESTIONS.md` (single questions file for the whole project).
