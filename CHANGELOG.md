# Changelog — Mistvale Admin Suite

All notable changes to the Admin Suite are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: pre-release `0.x` until EA-0.1.

## [Unreleased]

### Added — login tracks are authorable

`loginTrack` is the game repo's twenty-first content type, and re-cutting next month's calendar is now a draft to review rather than a deploy.

**One entity is a whole track**, not a day — thirty rows of days inside a single entry — because a track is only ever read whole and thirty entities would make "re-cut August" thirty reviews. Two rules the editor enforces at publish: **days must run 1…n with no gaps or duplicates** (the Nth claim pays the day numbered N, so a gap is a claim that quietly pays nothing), and **only one track of each kind may be active** (two live calendars is a coin toss over which one a player walks). Champions granted or offered, reward items, and relic sets are all reference-checked like everything else.

The template is a seven-day welcome strip with all seven days present, and it ships **inactive** — a second active track of a kind would fail validation the moment it was saved, so turning it on is the deliberate step of swapping which track is live. A purpose-built calendar editor — a month grid, per-day reward pickers, a diff that shows which days moved — stays at A4.

### Added — events are authorable and schedulable

`event` is the game repo's twentieth content type, and scheduling one is now an operator job rather than a deploy — which is the whole point of the framework.

Two things to know while composing one. **The schedule has two shapes**: `weekly` (a start weekday and a duration in game-days) repeats forever and is what the three shipped presets use; `window` (two timestamps) is a one-off, and publish validation refuses one that ends before it starts — a scheduling typo an operator would otherwise only notice when the event never appears. **Milestones must climb**: publish rejects a ladder out of order, since a rung claimable before the one below it would draw a bar that goes backwards.

Point rules are goals with a rate attached, so everything already true of a quest's goal is true here — including that a filter the type does not declare is refused. The template is a weekend event with one rule and two rungs: publishable as-is, and the shape of both arrays is visible before an operator adds to them. A purpose-built event editor (a calendar view, the rule builder, a ladder preview) stays at A4.

### Added — the Valewarden's Path is authorable

`mission` is the game repo's nineteenth content type, and `pnpm sync-api` plus the typecheck named the two places that had to follow — the same two the quest type touched, which is the type-sync contract behaving exactly as designed twice running.

All eighty missions are browsable and editable through the schema-driven entity browser. Two things worth knowing while authoring one: **arcs open in order, so a gap in the arc numbering strands every arc past it** — publish validation refuses that rather than letting a chain silently stop halfway — and a step's `grants.champions` is checked against the champion catalogue, because the last step of the chain hands over an exclusive Legendary and a dangling key there would pay nothing. The purpose-built mission editor (arc board, goal builder, reward picker) stays at A4.

### Added — quests are authorable

The game repo's P8a made `quest` its eighteenth content type, and the generic entity browser picked it up the moment `pnpm sync-api` ran — schema-driven browsing is exactly the property that makes a new content family arrive without an editor being written for it. All nineteen seeded quests are readable and editable today, with the draft → validate → diff → publish flow already around them.

Worth knowing while authoring one: a goal is `{type, target, filters}`, and **publish validation refuses a filter the goal's type does not declare**. `{type:'summon', mode:'campaign'}` looks entirely reasonable in the form and would silently never complete, so it is rejected at validate rather than discovered by a player. A purpose-built quest editor — goal builder, reward picker, a preview of what the checklist reads like — is A4's, alongside the mission and event composers it shares primitives with.

### Added — Fresh start

A full account reset, in its own red danger zone on the account page. Returns an account to exactly the state registration leaves it in: champions, relics, items, campaign and Depths progress, the Chronicle, shop stock, summon history, battles, arena standing and Hall of Valor all destroyed, back to level 1 with the starter chooser waiting. The login, password and rank survive — a reset is not a deletion.

- **Confirmed by typing the account name**, and the dialog counts what is about to go. "Reset" and "reset, and that was 143 relics" are different sentences, and only one of them stops an operator who has the wrong account open.
- **Settings survive.** Audio, battle speed, reduced motion and colourblind glyphs are accessibility choices rather than progress; wiping somebody's motion sensitivity because they wanted a fresh roster would be actively unkind.
- **The economy ledger survives, and still balances.** The wallet is emptied _through_ `RewardService` rather than by writing zeros, so the sum of a player's deltas still equals their balance and the reset reads as a line in the history instead of a hole in it. The faucet and sink figures it feeds were real; rewriting them would corrupt the dashboards.
- **The audit trail records the whole before-state** — level, wallet, holdings and progress. This is the one action with nothing left to compare against afterwards, so the audit entry is the only remaining answer to "what did that account have?".
- Arena bots are refused, with a pointer to the bot manager: rebuilding the ladder is what resetting a bot actually means.

### Added — the Arena bot manager (A5, with the game repo's P7)

The game repo's Arena ships seeded with sixty bots so a new account finds somebody to fight on its first evening. A ladder that ships without an operator view of it is a ladder nobody can fix on a Sunday, so the manager came with it.

- **A ladder view by band** — what each should hold against what it does, its rating window, and a fill bar that makes a short band visible rather than a number to compare. Counted by where each bot actually _stands_ rather than the window it was created in, so this page and the in-game leaderboard cannot disagree.
- **Two actions, both audited.** _Fill to strength_ is idempotent — it creates only the difference, and sheds an over-full band from the top so the entry-level opponents a new account meets are the ones that survive. _Rebuild now_ runs the nightly job on demand, which is what you want immediately after a balance publish rather than at 04:00.
- **Deliberately no third control.** Everything tunable about a band — its size, rating window, the champions and relics its bots are synthesised from, the two name pools — is `arena.botBands` and friends in the Game config editor, because it is content and content is data. The page links there instead of mirroring it: a second place to change a band's size is a second place for it to be wrong.
- **No per-bot editor either.** A bot is an ordinary `players` row with `is_bot` set, so it is inspected, renamed or removed through Players with "Include bots" switched on — which is the point of not giving bots their own table.
- **Tests** — 6 RTL cases over the screen: that it reports a short band as short, says so when the ladder has never been built, hits the right endpoint for each button, surfaces a failed run rather than swallowing it, and offers no band settings of its own.

### Added — Player management (A5, pulled forward)

Mistvale has no e-mail addresses. That is a deliberate simplification with one binding consequence — **an operator is the only password reset there is** — and until now there was no screen for it, so the support path was hand-writing a password hash into the database. That breaks the no-direct-DB rule this suite exists to uphold, which is why this jumped ahead of A2.

- **Search** by account _or_ profile name, because a support request rarely says which one it is quoting. Bots hidden by default, one switch away.
- **The account page**: wallet, live energy, holdings as counts, progress and deepest floors, every live session with where it is signed in from, and the tail of the economy ledger with each line's deltas.
- **Six actions.** Reset password (the temporary one is shown once, with a copy button — the server keeps only its hash, so there is nothing to show twice), set rank, ban/unban, rename profile, grant currencies, sign out everywhere.
- **Safety rails.** The two that cannot be undone by clicking again — reset and ban — need the account name typed out, which is the one thing an operator with the wrong account open would get wrong. A ban cannot be sent without a reason. A grant cannot be sent without a note, because the note is what the audit trail will show a year later.
- **The screen never guesses at server rules.** Rank is a plain select, and the server's refusal to let an admin change their own comes back as an error toast rather than being predicted here — one rule, enforced where it belongs.
- 8 RTL cases over the refusals: no action fires on a single click, the typed confirmation unlocks only on an exact match, the temporary password is absent until the reset returns it, and a grant sends only the fields that were filled in.

### Changed — the game repo finished P6

No code change here; the type sync was already current. What changed is what the suite is now pointing at, recorded so A2 is planned against reality rather than against the planning docs.

- **372 stages are published** — 252 campaign (12 chapters × 7 × 3 difficulties) plus 120 Depths floors across ten dungeons. Both sets are _generated_ in the game repo's seed from twelve and ten plan entries, which settles a design question for A2's campaign editor: its job is reviewing and retuning generated content — a stage grid per chapter and difficulty, a wave composer that makes a retune cheap — not offering to create 252 rows by hand.
- The generic entity browser covers all **17** content types, so P6's two new families (`dungeon`, `mastery`) are fully editable today with no SQL-only fields. Their purpose-built editors — a floor-band view, a mastery tree canvas — remain scheduled at A4, and `ROADMAP.md` now says so plainly instead of leaving it to be inferred.
- Two long-standing gaps that the game repo's `USER_QUESTIONS.md` had parked at "P2" are really **A2** work and are re-dated there: the shallow publish diff (top-level keys only, which a stage's nested `waves` array makes noticeably worse) and the missing balance-sim endpoint behind the champion Balance tab and stage Simulate.

### Added — masteries

The game repo's P6 shipped the three mastery trees; the type sync brought the content family across as a compile error rather than a runtime surprise.

- **Masteries** (`masteries`) — a node's tree, tier, description and the typed effects the engine runs for it. The effect vocabulary is fixed and engine-known, so publish refuses a node promising a behaviour nothing implements, and refuses a tree with a hole in its ladder. Node _costs_ are deliberately not here: they are per tier, in the `economy.masteryCosts` game-config row, because a tier is the unit an operator actually reprices.
- The new-mastery template is a Tier-1 stat node — the simplest thing that is both valid and useful.

### Added — dungeons

The game repo's Phase P6 opened the Depths; the type sync brought the new content family across as a compile error rather than a runtime surprise.

- **Dungeons** (`dungeons`) — a keep's floors, its kind (relic, proving grounds or spring), which relic sets and items it drops, the account level it opens at, and the weekdays it runs on. The rotation is what turns the Essence Springs from a queue into a week, and it lives here so that moving Mist off Sunday is an edit and a publish rather than a deploy. The new-dungeon template starts open to everyone, every day, at fifteen floors.
- **Stages** now reference dungeons as well as chapters, and carry their own `gearSetKeys` — a campaign stage inherits its chapter's single set, while a dungeon floor names the four its keep is known for.

### Added — summon pools

The game repo's Phase P5 added the Mistgate; the type sync brought its content type across as a compile error rather than a runtime surprise.

- **Summon pools** (`summon-pools`) — rates, mercy rules and the weighted champion table per sigil, plus the ×10 floor. The new-pool template starts with rates that already sum to 1, because publish refuses a table that does not, and refuses a pool advertising a rarity it holds no champion for.

### Added — the relic economy's content types

The game repo's Phase P4 added two content families and a new field on stages; the type sync surfaced them as compile errors here rather than as runtime surprises, which is the contract working.

- **Relic stats** (`gear-stats`) — what each rollable stat is worth per rank, main and sub. Eleven entries that are the entire numeric surface of the relic economy.
- **Shops** (`shops`) — rotating stock: slots, offers, prices, bands and restock timing. Editable end to end, so re-pricing the Bazaar or adding an offer needs no deploy.
- Stage rewards now carry a **drop band** (relic chance, rank and rarity weights, slot restriction, item rolls), reflected in the new-stage template.

### Changed

- Regenerated API types for the game repo's `anchorLevel` field on enemies. The drift check caught the stale schema before anything was built against it, which is what it is for.

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
