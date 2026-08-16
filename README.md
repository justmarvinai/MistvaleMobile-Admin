# Mistvale Admin Suite

The operator cockpit for **Mistvale** — a 2D pixel-art, turn-based champion-collection RPG (repo: `MistvaleMobile`). Every champion, skill, enemy, item, stage, quest, event, shop, and balance constant of the game is authored and tuned here; player support (grants, password resets, bans, mail) lives here too.

**Status: 📐 Planning.** Implementation starts alongside the game's Phase P0/P1 (the Admin API must exist first).

## Documentation
| Doc | Contents |
|---|---|
| [`docs/ADMIN_SUITE_DESIGN.md`](docs/ADMIN_SUITE_DESIGN.md) | Full product spec: all editors, publish workflow, safety rails |
| [`docs/ADMIN_ARCHITECTURE.md`](docs/ADMIN_ARCHITECTURE.md) | Stack, repo-sync contract, structure, deploy |
| [`ROADMAP.md`](ROADMAP.md) | Phase plan (aligned to the game repo) |
| [`CHANGELOG.md`](CHANGELOG.md) | Keep-a-Changelog |
| [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) | Working agreements for AI-assisted development |

Game-side context (architecture, data model, Admin API): see `MistvaleMobile/docs/`.

## Shape (planned)
React 18 + Vite + TypeScript SPA (Mantine, TanStack Query/Router) → static hosting via nginx at **`play.pathlands.cc/admin`** → talks to the game server's `/admin/api` (typed client generated from the game repo's OpenAPI artifact; login restricted to Admin-rank accounts). No separate backend, no direct DB access.
