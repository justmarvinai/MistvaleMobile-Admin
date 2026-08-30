# CLAUDE.md — MistvaleMobile-Admin

Operator cockpit (Admin Suite) for **Mistvale**, a 2D pixel-art turn-based champion-collection RPG. This repo is the **admin frontend SPA only** — it talks to the Admin API hosted by the game server in the sibling repo `MistvaleMobile`. It never touches the database directly.

## Read first (in order)

1. `docs/ADMIN_SUITE_DESIGN.md` — what the suite does (every editor, workflows, safety rails)
2. `docs/ADMIN_ARCHITECTURE.md` — how it's built (stack, type-sync contract, deploy)
3. `ROADMAP.md` — phase plan, aligned with the game repo's phases
4. Game repo context: `MistvaleMobile/CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API_DESIGN.md §2` (the Admin API this SPA consumes)

## Project state

**Phases A0–A1 complete, and A2 with them** — see `ROADMAP.md`. The scaffold, typed API layer, rank-gated auth, app shell, dashboard, publish center, the generic entity browser (all **26** content types, dungeons, masteries, quests, missions, events, login tracks, news, expeditions, the Sunken Stair, the tutorial script and the sound cues included), the Game config / Champion / Skills editors, **Player management**, the **Arena bot manager**, the **mail composer**, the **tutorial script editor**, the **balance sandbox** and the **audit log** exist and are tested. The **campaign grid** and the **battle inspector** landed with A2.

**A2 is closed, and one item of it was cut rather than built.** §2.9's drop-table editor described a generalised `dropTable` content type that was never made: a stage carries its own drops band inline (`rewards.drops`), which is what makes a chapter a farm for one specific thing, and the `dropTableKey` field left over from the original plan was declared in the schema and read _nowhere_ — an operator could set it and nothing would happen. What A2 ships instead is the two views that had no substitute: the **campaign grid** (Content → Campaign — a reviewing view over generated content, seven stages by three difficulties, every cell linking into the generic editor, and a missing cell drawn as a hole because a chapter with six Brutal stages and seven of everything else is a fault) and the **battle inspector** (Live ops → Battle inspector — the engine's event log verbatim, grouped into its own turns, with the seed that makes the fight reproducible).

**Player management was pulled forward out of A5**, because Mistvale has no e-mail addresses and so an operator is the only password reset that exists — without it the support path was hand-writing a password hash into the database. Search, the account page, and six audited actions (reset password, set rank, ban/unban, rename, grant, sign out everywhere) are live; the roster/gear drill-ins, summon history, the gift-mail attachment on a grant, and bulk actions stay at A5 — though the composer itself landed early with the game repo's P8f, since mail is how an operator apologises and there is no other channel to a player.

**The balance sandbox came with the game repo's C27** — the one item on that repo's debts list that named a hard rule. Retuning a stage was already an edit; _checking_ the retune was a deploy, because the only way to find out what a change did was to publish it and go and play the stage. It is at **Live ops → Balance sandbox**: pick a stage, pick a bench team, press Simulate, and read the win rate, the average and median turns over winning runs, the three-star turn limit and the share of runs inside it. Three things make it worth trusting and all three are said on the screen — it is the _same_ `simulateStage` and the same three bench teams the game repo's `pnpm sim` gates call (`packages/sim`), so a number here is comparable to a gate's; `source: 'draft'` layers the pending edits over live exactly as a publish would, which is the case it exists for; and it writes nothing at all, not even an audit row, because the audit log is the record of what an operator _changed_. It sits under Live ops rather than inside a stage editor because it is a question rather than an edit — wiring it into A2's campaign editor when that exists is a link, not a rebuild.

**The audit log came with the game repo's C31** (gap G1), and it is the oldest promise in `ADMIN_SUITE_DESIGN` §2.17. Every administrative mutation has recorded who, what and both sides of the change since P1 — and the suite could see _ten_ of them, on the dashboard. Ten is enough to notice that something happened; it is no use for the question a log exists to answer, which only ever comes up on a bad day: what happened to this thing, and who did it. It is at **Live ops → Audit log**, filtered by actor, action, entity, entity id and date, all optional and all combining. Three details are load-bearing and each is invisible when it is wrong: the count is of _matches_ rather than of the page (the difference between "3 changes to this stage" and "3 of 400" is the whole question); the filter's own option lists come from the **whole** log rather than the current results, since a filter whose options narrow as it is used can only be used once; and an emptied box is _absent_ from the query rather than present and empty, because `?actor=` matches every row and looks exactly like a filter matching none. Reading the log is deliberately **not itself audited**, for the reason the balance sandbox writes no audit row: "somebody opened the audit log" would bury the entries that matter under entries about looking at them.

**The tutorial script editor came with the game repo's P9**, for the one reason a purpose-built editor ever earns its place over the generic browser: the script is walked by _position_, publish refuses a gap or a duplicate, and reordering by hand meant editing two entities and getting both numbers right. It is a reviewing view — the whole first hour in walking order, with a move rendered as a swap of two numbers — and every field of a step is still edited in the generic browser, because a second place to change one thing is worse than a click.

**The Arena bot manager came with the game repo's P7**, since a ladder that ships without an operator view of it is a ladder nobody can fix on a Sunday. It is deliberately two buttons and a table: what each band _is_ lives in `arena.botBands` in the Game config editor, because it is content, and an individual bot is an ordinary player reachable through Players with "Include bots" on.

**What the game repo has published** (P0–P9 complete, the design rework closed, the owner's change batches running): 1,136 content entities over **26** content types, of which **409 stages** — the whole campaign at 12 chapters × 7 stages × 3 difficulties, plus 120 Depths floors across ten dungeons, one Titan run, one world-boss strike, the tutorial's cold open and four Trials and **the Mistspire's thirty floors**, nine of which carry a `teamRestriction` — the ward that makes the tower the one mode asking for a broad roster. The Deep Run's eleven rooms are _not_ among them: a room is synthesised into a stage at battle start, so the whole descent is one `deepRun` entry an operator edits in one place. That is the scale A2's campaign editor has to browse comfortably: the generic entity table already virtualizes, but a stage _grid_ per chapter/difficulty is the shape the authoring flow wants, and the 252 campaign stages are generated from twelve plan entries in the game repo's seed rather than hand-authored — so the editor's job is reviewing and retuning generated content, not creating 252 rows by hand.

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
