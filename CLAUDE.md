# CLAUDE.md — MistvaleMobile-Admin

Operator cockpit (Admin Suite) for **Mistvale**, a 2D pixel-art turn-based champion-collection RPG. This repo is the **admin frontend SPA only** — it talks to the Admin API hosted by the game server in the sibling repo `MistvaleMobile`. It never touches the database directly.

## Read first (in order)

1. `docs/ADMIN_SUITE_DESIGN.md` — what the suite does (every editor, workflows, safety rails)
2. `docs/ADMIN_ARCHITECTURE.md` — how it's built (stack, type-sync contract, deploy)
3. `ROADMAP.md` — phase plan, aligned with the game repo's phases
4. Game repo context: `MistvaleMobile/CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API_DESIGN.md §2` (the Admin API this SPA consumes)

## Project state

**Phases A0–A1 complete → next is A2 (world authoring)** — see `ROADMAP.md`. The scaffold, typed API layer, rank-gated auth, app shell, dashboard, publish center, the generic entity browser (all **24** content types, dungeons, masteries, quests, missions, events, login tracks, news, the tutorial script and the sound cues included), the Game config / Champion / Skills editors, **Player management**, the **Arena bot manager**, the **mail composer** and the **tutorial script editor** exist and are tested. Campaign, drop-table, balance-sandbox and battle-inspector editors do not yet.

**Player management was pulled forward out of A5**, because Mistvale has no e-mail addresses and so an operator is the only password reset that exists — without it the support path was hand-writing a password hash into the database. Search, the account page, and six audited actions (reset password, set rank, ban/unban, rename, grant, sign out everywhere) are live; the roster/gear drill-ins, summon history, the gift-mail attachment on a grant, and bulk actions stay at A5 — though the composer itself landed early with the game repo's P8f, since mail is how an operator apologises and there is no other channel to a player.

**The tutorial script editor came with the game repo's P9**, for the one reason a purpose-built editor ever earns its place over the generic browser: the script is walked by _position_, publish refuses a gap or a duplicate, and reordering by hand meant editing two entities and getting both numbers right. It is a reviewing view — the whole first hour in walking order, with a move rendered as a swap of two numbers — and every field of a step is still edited in the generic browser, because a second place to change one thing is worse than a click.

**The Arena bot manager came with the game repo's P7**, since a ladder that ships without an operator view of it is a ladder nobody can fix on a Sunday. It is deliberately two buttons and a table: what each band _is_ lives in `arena.botBands` in the Game config editor, because it is content, and an individual bot is an ordinary player reachable through Players with "Include bots" on.

**What the game repo has published** (P0–P9 complete, P10 release hardening in progress): 1,053 content entities, of which **372 stages** — the whole campaign at 12 chapters × 7 stages × 3 difficulties, plus 120 Depths floors across ten dungeons. That is the scale A2's campaign editor has to browse comfortably: the generic entity table already virtualizes, but a stage _grid_ per chapter/difficulty is the shape the authoring flow wants, and the 252 campaign stages are generated from twelve plan entries in the game repo's seed rather than hand-authored — so the editor's job is reviewing and retuning generated content, not creating 252 rows by hand.

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
