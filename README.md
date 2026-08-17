# Mistvale Admin Suite

The operator cockpit for **Mistvale** — a 2D pixel-art, turn-based champion-collection RPG (repo: `MistvaleMobile`). Every champion, skill, enemy, item, stage, quest, event, shop, and balance constant of the game is authored and tuned here; player support (grants, password resets, bans, mail) lives here too.

**Status: Phases A0–A1 shipped.** Auth, app shell, dashboard, publish center, the generic entity browser for all 22 content types, and the Game config / Champion / Skills editors are built and tested. Next: A2 (campaign, drop tables, balance sandbox, battle inspector).

## Running it

The suite is a frontend only — it needs the game server from the sibling `MistvaleMobile` repo running on `127.0.0.1:3001`.

```bash
pnpm install
pnpm dev        # http://localhost:5174/admin/
pnpm verify     # format + lint + typecheck + test + build, the whole CI gate
```

Sign in with an **Admin-rank** account; any other rank is refused with the same message as a wrong password. Grant the first one on the server with the game repo's `SET_RANK.sh`.

## Documentation

| Doc                                                        | Contents                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| [`docs/ADMIN_SUITE_DESIGN.md`](docs/ADMIN_SUITE_DESIGN.md) | Full product spec: all editors, publish workflow, safety rails |
| [`docs/ADMIN_ARCHITECTURE.md`](docs/ADMIN_ARCHITECTURE.md) | Stack, repo-sync contract, structure, deploy                   |
| [`ROADMAP.md`](ROADMAP.md)                                 | Phase plan (aligned to the game repo)                          |
| [`CHANGELOG.md`](CHANGELOG.md)                             | Keep-a-Changelog                                               |
| [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md)        | Working agreements for AI-assisted development                 |

Game-side context (architecture, data model, Admin API): see `MistvaleMobile/docs/`.

## Shape

React 18 + Vite + TypeScript SPA (Mantine, TanStack Query/Router/Table) → static hosting via nginx at **`play.pathlands.cc/admin`** → talks to the game server's `/admin/api`. No separate backend, no direct DB access.

```
src/
├── app/        bootstrap, route tree, auth guard, shell (sidebar + publish bar), theme
├── api/        fetch wrapper + envelope handling, query client, hooks, DTOs
├── components/ shared primitives: EntityTable, DiffViewer, EffectComponentEditor, ConfirmTyped, QueryState
├── features/   one folder per editor (auth, dashboard, content, config, champions, skills, publish)
└── lib/        content registry mirror, formatting, toasts
```

API types are **generated**: `pnpm sync-api` turns the game repo's `docs/openapi/admin-api.json` into `src/api/schema.d.ts`, and `src/api/types.ts` aliases onto it. The artifact comes from the Zod contracts the server validates with, so both ends of the wire have one definition. CI runs `sync-api --check` and fails on a stale schema.
