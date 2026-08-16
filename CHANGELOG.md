# Changelog — Mistvale Admin Suite

All notable changes to the Admin Suite are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: pre-release `0.x` until EA-0.1.

## [Unreleased]

### Added

- **Phase A0 — foundation.** Vite 6 + React 18 + TypeScript strict scaffold (`base: '/admin/'`, dev proxy to the game server), ESLint/Prettier matching the game repo, Vitest + RTL.
- **Typed API layer** (`src/api/`): fetch wrapper unwrapping the `{ok,data|error,rev}` envelope into either the payload or a structured `ApiError` carrying the server's code, message, field issues and requestId; TanStack Query client with per-resource hooks; API types generated from the game repo's OpenAPI artifact by `pnpm sync-api`, with `src/api/types.ts` aliasing onto them, so both ends of the wire come from the same Zod contracts. CI fails on a stale schema, and the runtime value lists pickers need are checked against the artifact rather than trusted.
- **Rank-gated auth**: login page explaining that only Admin-rank accounts are accepted, route guard on a pathless layout route, and a cache watcher that bounces to login the moment any request fails with `AUTH_REQUIRED`.
- **App shell**: sidebar generated from the content registry, persistent top bar with the live content revision, a draft-count badge, and Validate + Publish one click away everywhere. Dark utilitarian Mantine theme in mist teal on deep blue-black.
- **Dashboard**: KPI cards from `/stats/overview`, recent audit entries, and a server-health strip from the admin-gated `/api/health`.
- **Game config editor**: constants grouped by domain, one control per entry typed by its value, help text, per-field and bulk save to draft.
- **Generic entity browser**: sortable, searchable, windowed table for every content type — state badges (live/draft/deleting), create, duplicate, discard-draft and guarded delete; types without a bespoke editor get a validated JSON editor, so nothing is SQL-only.
- **Phase A1 — Champion editor**: identity/stats/skills/collection tabs, faction, asset and skill references as pickers over live content, ordered skill slots with reorder, aura editor, and client-side validation mirroring the server's schema.
- **Phase A1 — Skills composer** (flagship): effect-component editor with add/remove/reorder, a form per discriminated-union arm (damage, applyStatus, heal, shield, turnMeter, cleanse, dispel, extraTurn, cooldown), conditions and chance, targeting, tome upgrade ladder, AI hints, animation binding, and `{dmg}`/`{chance}`/`{turns}` description templating resolved from the components. Status pickers offer only real status keys; unknown keys and A1-with-cooldown are flagged while typing, exactly as publish would.
- **Publish center**: draft diff grouped by entity with old→new per field and the server's risk badges, Validate surfacing blocking errors and non-blocking warnings, Publish with a note, revision history, and revert behind a typed confirmation.
- **CI** (GitHub Actions) — format → lint → `sync-api --check` → typecheck → test → build, with the game repo checked out alongside so the generated-types drift check runs against the real artifact.
- **Tests**: 78 Vitest/RTL cases over the skills composer (component algebra, serialization, round-trip parsing, server-mirroring validation, and the editor's add/remove/reorder/retype behaviour) the publish diff rendering, and the runtime value lists checked member-for-member against the server contract.

### Changed

- Planning updated after owner review: suite served at **`play.pathlands.cc/admin`** (path-based, Vite `base: '/admin/'`) instead of an admin subdomain; access model switched from owner/editor roles to the game's **account ranks** — only Admin-rank accounts can log in (GameMaster reserved for future moderation); Player management gains **Set rank** (audited, self-demotion blocked); first-admin bootstrap documented via the game repo's `SET_RANK.sh`.

### Added

- Complete planning package: `docs/ADMIN_SUITE_DESIGN.md` (full editor-by-editor product spec incl. draft→validate→diff→publish workflow, player management, bot manager, battle inspector), `docs/ADMIN_ARCHITECTURE.md` (SPA-over-Admin-API architecture, locked stack, OpenAPI type-sync contract with the game repo), `ROADMAP.md` (phases A0–A6 aligned to game phases P0–P10), `CLAUDE.md`/`AGENTS.md` working agreements, `README.md`.
