# Mistvale Admin Suite — Technical Architecture

> Status: **Planning.** Companion to `ADMIN_SUITE_DESIGN.md`. The game-side halves (Admin API, DB, content cache, publish flow) are specified in the game repo (`MistvaleMobile/docs/ARCHITECTURE.md`, `DATA_MODEL.md`, `API_DESIGN.md §2`).

## 1. Core decision: SPA over the game server's Admin API

The Admin Suite is a **pure frontend SPA** (this repo) served as static files by nginx at **`play.pathlands.cc/admin`** (path-based on the game's single domain — owner decision; Vite `base: '/admin/'`), talking to the **Admin API hosted inside the game server process** (`/admin/api/*`).

Why this shape (vs. a separate admin backend):
1. **One source of truth** for schema, validation, and game logic — the Zod content schemas, RewardService, and engine registry live once, in the game repo. A second backend would duplicate or import them across repos.
2. **Instant content publishes** — the admin edits the same process that serves players, so cache invalidation is an in-process atomic swap, satisfying "changes are live at the game directly".
3. **One less process** on the 1-core/4 GB VPS.

Boundary discipline: the game repo owns *data + rules*; this repo owns the *entire operator experience* (all screens, editors, workflows in ADMIN_SUITE_DESIGN.md). The Admin Suite never touches PostgreSQL directly.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Build | Vite 6 + TypeScript 5 strict | Same toolchain as the game client |
| UI | React 18 + **Mantine 7** | Internal tool: forms/tables/modals productivity beats hand-crafting; MIT; dark theme; no serif fonts. (The *game* client stays 100% custom-built — this is deliberately different.) |
| Data layer | TanStack Query 5 | Caching, invalidation, optimistic-free mutations, retry — ideal for CRUD cockpits |
| Forms | react-hook-form + Zod resolvers | Zod schemas come from the generated API types |
| Routing | TanStack Router | Typed routes, deep-linkable entity pages (`/champions/anuria?tab=skills`) |
| Tables | TanStack Table | Virtualized lists (gear tables, audit log) |
| Charts | Recharts (small set) | Dashboard KPIs, stat curves, rate pies |
| API types | **openapi-typescript** generated client from `MistvaleMobile/docs/openapi/admin-api.json` | The sync contract between repos (§3) |
| Editor niceties | dnd-kit (drag: waves, calendar, mission order), CodeMirror (JSON/markdown fields) | |
| Testing | Vitest + React Testing Library (critical editors: skill composer, publish diff), Playwright smoke (login → edit → validate → publish on a seeded local stack) | |

## 3. Type sync between repos (the contract)

1. Game repo build emits `docs/openapi/admin-api.json` (generated from Fastify+Zod route definitions; CI fails on drift).
2. This repo's `pnpm sync-api` fetches that file (path or raw URL, pinned by git ref in `.api-source`) and regenerates `src/api/schema.d.ts`.
3. CI here runs `sync-api --check` — a stale schema fails the build, so the suite can never silently disagree with the server.
Generated code is committed (reviewable diffs when the API changes).

## 4. App structure

```
src/
├── app/            # bootstrap, router, auth guard, query client, theme
├── api/            # generated schema.d.ts + thin typed fetch wrapper (credentials, error envelope, 401 → login)
├── features/       # one folder per editor (champions, skills, enemies, gear, campaign, depths,
│   │               #   summon, drops, quests, missions, events, shops, calendar, masteries,
│   │               #   valor, tutorial, config, assets, players, bots, mail, publish, battles, jobs, dashboard, news)
│   └── <feature>/  #   routes.tsx, components/, hooks.ts (queries+mutations), schemas.ts
├── components/     # shared: EntityTable, DiffViewer, RewardPicker, EnemyPicker, GoalBuilder,
│                   #   EffectComponentEditor, SpritePreview (canvas idle player), CurveEditor, ConfirmTyped
└── lib/            # formatting, permissions, audit helpers
```
- **Shared editor primitives are the real product**: `RewardPicker`, `DropTableRef`, `GoalBuilder`, `EffectComponentEditor`, `SpritePreview`, `CurveEditor`, `DiffViewer` are reused across features — that's what keeps 20+ editors consistent and cheap to extend.
- Draft state is server-side (draft rows), so the SPA stays stateless-ish: no local persistence beyond auth + UI prefs.

## 5. Auth & security (suite side)
- **Rank-based access (owner decision):** the game has one account system with ranks `player` / `gamemaster` / `admin`. The suite logs in via `/admin/api/auth/login`, which succeeds **only for `admin`-rank accounts** (GameMaster is a reserved moderation rank with no suite access at EA; the server re-checks rank on every request — UI gating is UX, not security).
- Session cookie; auth guard redirects to login; the logged-in admin's name shows in the top bar with a session-revoke shortcut.
- All requests same-origin (`play.pathlands.cc/admin/api` proxied by nginx to the game server) → no CORS surface.
- Idle logout (30 min) with dirty-form warning; every destructive mutation double-confirmed (typed phrase for player deletion / content revert).

## 6. Dev & deploy
- Dev: `pnpm dev` with Vite proxy `/admin/api → http://localhost:3001` (game server run from the game repo; `SEED.sh` provides content). A `.env.development` points at a locally running game stack — documented one-command bring-up in the game repo.
- Deploy: built by the game repo's `UPDATE.sh` (clones/pulls this repo, `pnpm build` with `base: '/admin/'`, output to `/srv/mistvale/admin`, symlink-swap; nginx serves it under `location /admin` with SPA fallback). No separate service, no runtime env — the SPA reads its API base from same-origin. First admin account is bootstrapped on the VPS by the game repo's `DEPLOY.sh`/`SET_RANK.sh`.
- Versioning: suite shows its git short-sha + the server's content rev in the footer; mismatch warnings if the API schema hash differs from the generated client (belt-and-suspenders on top of CI).

## 7. Phase alignment
The suite grows in lockstep with the game's data model (see `ROADMAP.md` here + game `ROADMAP.md`): each game phase that adds content tables ships with its editors in the same phase — content authoring is never blocked on "admin comes later".
