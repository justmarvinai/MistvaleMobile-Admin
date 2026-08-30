# Mistvale Admin Suite — Product Design

> Status: **Planning.** The Admin Suite is the operator cockpit for Mistvale: every piece of game content, every balance number, every player account is inspectable and editable here — no SQL, no redeploys. It is a React SPA talking to the game server's Admin API (`MistvaleMobile/docs/API_DESIGN.md §2`); architecture in `ADMIN_ARCHITECTURE.md`.

## 0. Design goals

1. **Everything editable** — champions, skills, enemies, gear, stages, dungeons, summon pools, drop tables, quests, missions, events, shops, login calendar, masteries, Hall of Valor, tutorial steps, bots, news, and every balance constant.
2. **Impossible to break the live game** — draft → validate → diff → publish workflow with one-click revert; hard validation (schema + referential + engine-registry) blocks bad publishes.
3. **Fast content authoring** — creating "one more dungeon floor" or "next month's event" is minutes, with duplication, bulk edit, and live preview everywhere.
4. **Accountable** — every mutation writes the audit log; every player-facing grant flows through the same audited reward pipeline as gameplay.

## 1. Information architecture

```
┌─ Sidebar ────────────┐
│ ▣ Dashboard          │  Content ▾            Players ▾          System ▾
│ ─ CONTENT ─          │  Champions            Search/Inspect     Publish center
│ Champions            │  Skills library       Grants             Revisions/revert
│ Skills               │  Enemies              Password resets    Export/Import
│ Enemies              │  Gear & Sets          Bans               Audit log
│ Gear & Sets          │  Campaign             Mail composer      Battle inspector
│ Campaign             │  The Depths           Bot manager        Health & stats
│ The Depths           │  Summon pools                            Jobs
│ Summon pools         │  Drop tables
│ Drop tables          │  Quests & Missions
│ Quests & Missions    │  Events
│ Events               │  Shops (Bazaar)
│ Shops                │  Login calendar
│ Login calendar       │  Masteries / Hall of Valor
│ Masteries & Valor    │  Tutorial steps
│ Tutorial             │  News
│ News                 │  Game config (constants)
│ Game config          │  Assets
│ Assets               │
│ ─ PLAYERS ─ …        │  Top bar: [draft changes: 7] [Validate] [Publish…] [rev #42]
└──────────────────────┘
```

- Persistent **draft banner**: number of unpublished changes; Validate + Publish always one click away.
- Global search (⌘K): jump to any entity by key/name.
- Every list: filter, sort, column picker, CSV export; every entity: Duplicate, History (audit entries), Delete (guarded).

## 2. Editors — specifications

### 2.1 Dashboard

KPI cards: players (total/active today), battles today by mode, summons today by rarity (actual % vs configured — drift detector), silver/crystal faucet-sink totals (7d), energy spent by mode, arena battles, error rate, server health strip (RSS, event-loop lag, DB pool, content rev, active battles). Recent audit entries + latest news. All from `/admin/api/stats/overview` + `/health`.

### 2.2 Champion editor (flagship)

- **List**: sprite thumb (animated on hover), key, name, faction, element, rarity, role, power estimate, summonable/starter flags, balance_version.
- **Detail tabs:**
  - _Identity_: key (immutable after create), name, title, lore, faction, element, rarity, role, flags; avatar & sprite pick from Asset registry with **live idle preview** at 1×/2×/3×.
  - _Stats_: base stats at max (HP/ATK/DEF/SPD/CR/CD/RES/ACC) with instant derived preview: the full 1–60 × rank curve table and a radar-vs-role-average chart; aura editor (stat/scope/area).
  - _Skills_: ordered skill slots (A1–A4 + passive) referencing the Skills library; inline open; **kit preview card** exactly as the game renders it (shared description templater).
  - _Balance_: sandbox — pit this champion (level/rank/gear preset) vs an enemy pack via the balance-sim endpoint; shows avg turns to kill / survive. Small but killer feature for tuning without deploys.
- Create = wizard (identity → stats from role template → skills from archetype templates) so a new champion is playable in <10 min.

### 2.3 Skills library & composer

- Component-based editor mirroring the engine contract: ordered **effect components** (damage / applyStatus / heal / shield / turnMeter / cleanse / dispel / revive / extraTurn / teamEffect…) each with typed params (scaling stat, multiplier, chance, turns, target selector). Add/remove/reorder components; targeting block; cooldowns; tome upgrade ladder editor; AI hints; animation binding (track + vfx key).
- Validation inline: unknown status keys, chance >100%, empty targeting, upgrade ladder gaps — red before save, blocking at publish.
- Description templating: `{dmg}`, `{chance}`, `{turns}` placeholders resolved from components so text never lies about numbers.

### 2.4 Enemy editor

Champion-like editor plus: archetype key, stat profile (reference stats + growth curves with plotted preview), boss flag + boss mechanics (engine-known toggles: TM-fill resistance, phase shields, enrage timer), tint variant color (until real models arrive), used-by list (which stages reference it — with jump links).

### 2.5 Gear & sets editor

Sets (name, 2/4-piece bonus from engine-known bonus types, lore, drop sources); slots config (allowed main stats per slot); main-stat growth tables and substat roll ranges per rank (editable grids with sanity warnings vs neighboring ranks); sell values; upgrade cost & success tables (in Game config, cross-linked).

### 2.6 Campaign editor

- Chapter list (1–12) → chapter page: name, lore, background, star-chest tiers.
- **Stage grid** (7 stages × 3 difficulties): each cell shows energy, enemy power, drop table; click → stage editor:
  - Wave composer: 1–3 waves, each up to 4 slots; enemy picker (archetype + level + stars + modifiers); per-wave preview of total HP/damage.
  - Rewards: silver range, player XP, champ XP, drop table ref, first-clear bonus; star rules.
  - **Simulate** button: runs balance-sim with reference teams (weak/expected/strong presets) → win% and avg turns, inline. Tuning without guesswork.
- Bulk tools: "propagate stats +15% to next difficulty", "copy chapter as template".

### 2.7 The Depths editor — **shipped**

**Content → The Depths.** A keep as its own descent, plus the rotation as a week. A floor is an ordinary `stage` with `parentKey` and `number` — right, since a floor is a fight on the same engine as everything else, and also why the generic browser shows a keep as fifteen rows in a list of four hundred with nothing saying how it scales. Here: enemy level as a **band** (waves climb inside one floor, so a single figure would be a lie), the step from the floor above, waves, energy, the three-star turn limit and the relic chance, every row linking into the editor.

Four faults it names, all of which publish cleanly: more floors declared than published, a gap in the numbering (which is what "floor N is open" is computed from), two floors sharing a number, and a descent that gets **easier** — the one balance fact that is certainly a mistake rather than a choice. The week inverts `openDays`, where an **empty list means every day**; read literally that looks like a keep that never opens, and the four gear dungeons are all authored that way, so they are listed as daily rather than drawn on the grid.

- _Not built:_ bulk scaling tools. Floors are generated from ten plan entries in the game repo's seed, so a retune is a change to the plan and a re-seed, and a second way to rewrite fifteen floors would be a second source of truth for the curve.

### 2.8 Summon pool editor

Per sigil type: rarity rate sliders (must sum 100% — live pie), champion weights per rarity bucket, pity rules (threshold + per-summon bonus), preview: "expected pulls per Epic" calculator; publish requires rates-sum + non-empty-bucket validation. Rate changes are flagged loudly in the publish diff (player-trust critical).

### 2.9 Drop table editor

Reusable tables: weighted entries (gear query: set/slot/rank/rarity-weights/level, item + qty range, silver range, champion ref), rolls count, nested-table support; **100-roll preview** button; used-by list.

### 2.10 Quests, Missions, Events — **shipped**

**Content → Errands.** One screen for the three, because they are one goal DSL wearing three names and the question is the same: what is a player being asked to do, and what does it pay. Quests by period with the day's-chest count; the Path as an ordered chain grouped by arc; every event with its schedule, its point rules and its ladder.

Every goal is a **sentence**, and the sentence says **Reach** for a threshold and a plain count for a tally. That difference is the accumulation rule itself, and getting it wrong is the classic quest bug — "reach +12 on a relic" must not be satisfied by twelve relics at +1 — so it is stated rather than left to be remembered.

Three faults it names: a gap or a duplicate in the Path's `step` numbering (the chain is walked by position exactly as the tutorial script is, so a gap is a wall), a milestone ladder whose rungs do not climb or pay nothing, and a schedule that can never fire — including the distinction a raw object hides, between a `window` that runs once and a `weekly` that comes back forever.

- _Not built, and the reason is the tutorial editor's:_ a goal-DSL **builder** and drag re-ordering. Field editing stays in the generic browser, which is schema-driven and complete; a second place to change one thing is worse than a click. Re-ordering would earn its place the way the tutorial's did — if publish started refusing a gap — and today it reports one instead.
- _Not built:_ clone-forward. An event's `weekly` schedule already recurs forever, so the case it existed for is the `window` kind, which is one edit.

### 2.11 Shops, Login calendar, News

- Bazaar: slot grid (stock ref, price, refresh group), crystal-shop offers, refresh timer config; price sanity warnings (vs configured economy baselines).
- **Login calendar and News — shipped** (**Content → Calendar & news**). A track carries thirty days in an array, so the browser shows it as a JSON blob three screens tall and "what does day 21 pay" means counting array elements; it is a grid here, which is what it is in the game, with a day that is missing from the list and a day that pays nothing both named. A post shows its **window in words**: an empty bound means _unbounded_, and reading it literally as a missing date makes a live post look broken — so the screen says which of _showing now_, _not yet_ and _finished_ it is, and names a window that ends before it starts. Rewards are still dropped onto a day in the generic browser.

### 2.12 Masteries, Hall of Valor, Tutorial, Sounds, Game config

- **Masteries — shipped** (**Content → Mastery board**). Two things are invisible in a list of forty-eight nodes and both decide whether the content works. **What a node does**: the effect is a discriminated union nested inside an array, so a form shows `{"type":"stat","stat":"atk","flat":40}` where the operator is thinking "+40 attack" — all twenty-one kinds have a sentence, and so does every condition. And **whether the board can be spent**: fifteen picks, a hard allowance per tier and at most two trees, so a board can hold a node at every tier of every tree and still strand every build in the game. Publish refuses both faults (the game repo's C36) and the board says so while they can still be fixed.
  - _Built as a reviewing view rather than the node canvas sketched above, and the reason is in the data:_ Mistvale's board has **no prerequisite edges at all**. The gating is arithmetic over tiers and picks, so a canvas would draw lines that are not there. Emblem costs are `game_config`, where the curve editor now draws them.
- Hall of Valor: element × stat grid, 10-level cost/bonus curves with total-cost summary.
- **Tutorial — shipped** (`/tutorial`, beside the generic browser rather than instead of it): the whole script in walking order — what each step says, the screen and `data-mv-highlight` key it points at, the goal it waits for, and how much it hands over. **Reordering is the reason it exists**: the script is walked by position and publish refuses a gap or a duplicate, so a move is rendered as a swap of two numbers — two writes rather than a renumber of everything below — applied in sequence so a half-applied swap cannot leave two steps sharing a number. The same numbering rules the server enforces are reported here while the operator is still editing; the server is still the thing that refuses. Field editing stays in the generic browser, deliberately: a second place to change one thing is worse than a click.
  - _Not built, and not missed:_ a highlight-target picker (the keys are a client convention that content deliberately is not validated against, so a picker would be a list that lies the moment the client ships one more) and the storyboard dry-run (the overlay itself, on a test account, is the honest version of that and now exists).
- Sounds: the catalogue, through the generic browser. A cue is a bus, a throttle, and either a **`sample` path** to a published recording — which wins wherever one exists — or a **synth voice**: source, wave, start and end Hz, attack, decay, gain, filter and up to four overtones. Half a dozen numbers describe a shaped tone or a noise burst, which is what a pixel game's interface has always been made of, and it means retuning what the game sounds like is a content edit rather than a release. The two music tracks live here too, as looping cues on the music bus that stand on a recording rather than a voice.
  - _Not built:_ an audition button. Rendering a voice needs the client's synth, and until the suite borrows it the loop is edit → publish → listen in the game.
- Game config: schema-driven forms grouped by domain (Energy, XP curves, Gear upgrade tables, Combat constants, Element wheel, Arena tiers & rewards, Pity defaults, Rate limits, Reset time…). Each field: current live value vs draft, default, and helptext sourced from docs. This is the game's control room — every constant the design docs mark _tunable_ appears here.

### 2.13 Asset manager

Upload frame strips/PNGs (drag-drop) → server packs & registers; preview player (play tracks at set fps); assign to champions/enemies/vfx slots; usage list; orphan finder. Enforces ASSET_GUIDE conventions (size check, naming).

### 2.13a Balance sandbox — **shipped**

Pick a stage, pick a bench team, press Simulate. It reports the win rate, the average and
median turns across winning runs, the stage's own three-star turn limit and the share of
runs that came in under it — usually the figure actually being asked about, because a stage
can be perfectly clearable and still be mis-tuned if nobody can three-star it.

It exists because retuning a stage was already an edit and _checking_ the retune was a
deploy: the only way to find out what a change did was to publish it and go and play the
stage. Three properties are what make it worth trusting, and all three are stated on the
screen rather than left in this document:

- **It is the same simulation CI runs.** The game repo's `packages/sim` holds one
  `simulateStage` and one definition of each bench team; both `pnpm sim` and this call it, so
  a number here is directly comparable to a gate's.
- **Draft means draft.** `source: 'draft'` layers the pending edits over live exactly as a
  publish would, so what is measured is the _change_. Running it publishes nothing — the
  publish centre (§2.9) is still the only thing that does.
- **It writes nothing.** No player, no roster, no progress, no content — and deliberately no
  audit row, because the audit log is the record of what an operator _changed_.

The three teams are **fresh** (four Rares at 20 / ★3, no relics), **modest** (50 / ★5 /
asc 2 with relics) and **built** (60 / ★6 / asc 6, relics and a collection). They are picked
by key rather than by strength, deliberately: a benchmark whose baseline drifts when a
champion is retuned cannot be compared to yesterday's answer. Runs are capped at 200 a
press, because it is a loop whose length the operator chooses on a box that has a game to
serve.

What it deliberately is **not** yet: a champion balance tab, an arbitrary hand-picked team,
or a comparison of two content revisions side by side. Each is a real want; none of them is
needed to answer "did my retune do what I meant".

### 2.14 Player management — **shipped**, including the holdings drill-ins

- Search by account/profile name; player page: profile & resources, roster (with gear detail drill-in), items, progress (campaign stars, dungeon floors, arena state, quests), summon history with pity counters, economy log tail, battle history (open in Battle inspector), sessions.
- Actions (all audited, all confirm-guarded): **Grant** (champion / gear roll / items / currency — via RewardService with a mail-attachment option "send as gift mail"), **Reset password** (generates temp password + force-change flag — the EA-0.1 support path), **Set rank** (Player / GameMaster / Admin — typed confirmation, self-demotion blocked), **Ban/unban** (reason required), **Rename profile** (the no-profanity-filter support path), session revoke.
- Bulk: select-all-filtered → mail composer. _(A5 — needs the mail composer.)_
- **Shipped now:** search by either name (bots hidden by default), the account page (wallet, live energy, holdings as counts, progress and deepest floors, live sessions, economy tail), and **Reset password · Set rank · Ban/unban · Rename profile · Grant · Sign out everywhere** — every one audited with before/after, the two irreversible ones behind a typed confirmation of the account name. Two guards refuse the caller's own account: an admin cannot change their own rank or ban themselves.
- **Why this jumped the queue:** there is no e-mail address anywhere in Mistvale, so an operator is the _only_ password reset that exists. Without this the support path was hand-writing an argon2id hash into the database — a hard-rule violation, not a missing convenience.
- **Fresh start** (the danger zone, in red, apart from the rest): returns an account to exactly the state registration leaves it in — champions, relics, items, campaign and Depths progress, the Chronicle, shop stock, summon history, battles, arena standing and Hall of Valor all destroyed; level 1 with the starter chooser waiting. The account keeps its name, password and rank: this is a reset, not a deletion. Confirmed by typing the account name, and the dialog _counts_ what is about to go, because "reset" and "reset, and that was 143 relics" are different sentences and only one of them stops somebody with the wrong account open. Three things deliberately survive: **settings** (audio, speed, motion and colourblind glyphs are accessibility choices, not progress), the **economy ledger** (emptied through RewardService so the sum of a player's deltas still equals their balance — the reset is a line in the history, not a hole in it), and the **audit trail**, which records the whole before-state since nothing else will remember it. Refuses arena bots and points at the bot manager.
- **The drill-ins are in** (three tabs on the account page): the **roster** whole and strongest-first, with how many of nine relics each copy is wearing; the **vault** paged and narrowable to _loose_ or _worn_, since loose is what the cap counts and so is usually the question being asked; and the **pull history** newest first with **mercy** marked, which is the field "I pulled forty times and got nothing" actually turns on. A relic's stat line is rendered server-side, because whether a value is a percentage decides what the number means — `DEF 40` and `DEF 40%` are two very different relics.
  - **There is no button on the card that changes anything**, and that is the design rather than an omission: every change to what an account holds already exists as a grant, which lands in `economy_log`. A control here would be the one mutation in the suite with no ledger behind it. The reads are not audited either, for the balance sandbox's reason.
- **Still A5:** battle history linked into the inspector, grants of champions and gear rolls, the gift-mail attachment option, and bulk actions.

### 2.15 Bot manager — **shipped**

Ladder view by rating band: what each band should hold against what it does, its rating window, and a fill bar that makes a short band visible rather than a number to compare. Two actions — **Fill to strength** (idempotent; creates only the difference, and sheds an over-full band from the top so the entry-level opponents a new account meets survive) and **Rebuild now** (the nightly job on demand, for after a balance publish). Both audited; both answer with what they did and the ladder as it now stands.

Deliberately no third control. Everything an operator might _tune_ — how many bots a band holds, its rating window, the champions and relics they are synthesised from, the two name pools — is `arena.botBands`, `arena.botGivenNames` and `arena.botEpithets` in the Game config editor, because it is content and content is data. A second place to change a band's size is a second place for it to be wrong, so the page links to the config editor instead of mirroring it.

Individual bots need no editor either: a bot is an ordinary `players` row with `is_bot` set, so it is inspected, renamed or removed through §2.14 with "Include bots" switched on — which is the whole point of not giving bots their own table. Counts are read from where each bot actually _stands_ rather than the window it was created in, so the page and the leaderboard agree.

**Still to come:** the "bot density vs real-player count" health check, which needs a real player population to be meaningful.

### 2.16 Mail composer

Target: one player / all / filter result; title, body (markdown-lite), attachments via reward picker; expiry; preview as in-game; send log with claim stats.

### 2.17 Publish center & safety rails

- Draft diff viewer: grouped by entity, old→new values, risk badges (rate changes, stat nerfs on live champions, price hikes).
- Validate: full referential + engine-registry + economy sanity suite; errors block, warnings require checkbox.
- Publish: snapshot to `content_revisions`, atomic swap, note field ("what changed") — feeds CHANGELOG discipline.
- Revert: pick a revision → diff → restore.
- Export/Import: entity-type selection → JSON bundle (for git-committing content back to the game repo seeds; import shows dry-run diff first).

### 2.18 Battle inspector

Paste battle id / open from player page: metadata (mode, stage, seed, content rev), team & enemy panels, and an **event-log timeline viewer** (step through turns, filter by unit/effect) — the debugging tool for "that fight felt wrong" reports.

### 2.19 Jobs & health — **shipped**

**Live ops → Jobs & health.** Both endpoints have existed since P8i with nothing in front of them, so the only way to run a job early was to ssh to the box. The list is a **closed list of names** rather than a name that reaches anything callable — a generic "run this" would be a remote-execution surface with an admin cookie in front of it — and running one goes through the typed confirmation with the **job's own name** as the phrase, so confirming the nightly pass cannot be confirming the weekly one. Not because it is dangerous (both are written to be safe run late or twice) but because it works across the whole database. The health half is the dashboard's strip with room to read it: the numbers are the ARCHITECTURE §9 budgets, and a degraded box is diagnosed by _which_ one moved.

- _Not built:_ last-run / next-run times and the log-error tail. Neither is recorded anywhere — the scheduler derives its next fire from the clock rather than storing it, and there is no log sink to tail. Both would be a server change first, and inventing a "last run" from an audit row would be a figure that is wrong the moment a job runs on schedule.

## 3. Access model (EA — owner decision)

One account system with ranks **Player / GameMaster / Admin**; **only Admin-rank accounts can log into the suite** — full access to everything documented here. GameMaster is a reserved moderation rank (badge + future in-game moderation tools; no suite access at EA). Rank management lives in Player management (§2.14): admin-only, audited, self-demotion blocked; first admin + lockout recovery via the game repo's `SET_RANK.sh` on the VPS. No self-serve admin signup; optional IP allowlist on `/admin` at nginx level; every session listed/revocable.

## 4. UX standards for the suite

Dense-but-clean dark utilitarian theme (Mantine component system, no serif fonts, Mistvale accent colors); every destructive action = typed confirmation; every form = dirty-state guard; every table = keyboard navigable; optimistic UI nowhere (server truth only, same philosophy as the game); toasts carry request-ids for error reports.
