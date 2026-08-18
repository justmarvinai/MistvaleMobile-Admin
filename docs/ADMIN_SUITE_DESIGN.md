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

### 2.7 The Depths editor

Dungeon list (4 gear dungeons, Proving Grounds, 5 Springs): identity, boss, open-days (springs rotation calendar widget), floor table 1–15 with the same stage editor + bulk scaling tools, featured drops.

### 2.8 Summon pool editor

Per sigil type: rarity rate sliders (must sum 100% — live pie), champion weights per rarity bucket, pity rules (threshold + per-summon bonus), preview: "expected pulls per Epic" calculator; publish requires rates-sum + non-empty-bucket validation. Rate changes are flagged loudly in the publish diff (player-trust critical).

### 2.9 Drop table editor

Reusable tables: weighted entries (gear query: set/slot/rank/rarity-weights/level, item + qty range, silver range, champion ref), rolls count, nested-table support; **100-roll preview** button; used-by list.

### 2.10 Quests, Missions, Events

- Quests: daily/weekly/monthly tabs; goal-DSL builder (dropdown goal type + typed params), rewards, sort; daily-chest meter config.
- Missions: ordered chain board with drag re-order, chapter grouping, progress-goal builder, reward editor; final-reward slot.
- Events: calendar view of scheduled events; event editor: banner asset, window (start/end, timezone-aware), point rules builder (action → points), milestone ladder with reward editor; preset templates (Champion Training / Dungeon Delve / Summon Surge); clone-forward ("run again next month").

### 2.11 Shops, Login calendar, News

- Bazaar: slot grid (stock ref, price, refresh group), crystal-shop offers, refresh timer config; price sanity warnings (vs configured economy baselines).
- Login calendar: 30-day grid + 7-day welcome strip, drag rewards onto days, month preview as players see it.
- News: markdown editor with live game-style preview, schedule window, pin.

### 2.12 Masteries, Hall of Valor, Tutorial, Game config

- Masteries: 3-tree node canvas, per-node effect (engine-known) + emblem costs; connectivity validation (tier gating).
- Hall of Valor: element × stat grid, 10-level cost/bonus curves with total-cost summary.
- **Tutorial — shipped** (`/tutorial`, beside the generic browser rather than instead of it): the whole script in walking order — what each step says, the screen and `data-mv-highlight` key it points at, the goal it waits for, and how much it hands over. **Reordering is the reason it exists**: the script is walked by position and publish refuses a gap or a duplicate, so a move is rendered as a swap of two numbers — two writes rather than a renumber of everything below — applied in sequence so a half-applied swap cannot leave two steps sharing a number. The same numbering rules the server enforces are reported here while the operator is still editing; the server is still the thing that refuses. Field editing stays in the generic browser, deliberately: a second place to change one thing is worse than a click.
  - _Not built, and not missed:_ a highlight-target picker (the keys are a client convention that content deliberately is not validated against, so a picker would be a list that lies the moment the client ships one more) and the storyboard dry-run (the overlay itself, on a test account, is the honest version of that and now exists).
- Game config: schema-driven forms grouped by domain (Energy, XP curves, Gear upgrade tables, Combat constants, Element wheel, Arena tiers & rewards, Pity defaults, Rate limits, Reset time…). Each field: current live value vs draft, default, and helptext sourced from docs. This is the game's control room — every constant the design docs mark _tunable_ appears here.

### 2.13 Asset manager

Upload frame strips/PNGs (drag-drop) → server packs & registers; preview player (play tracks at set fps); assign to champions/enemies/vfx slots; usage list; orphan finder. Enforces ASSET_GUIDE conventions (size check, naming).

### 2.14 Player management — **search, inspect and the six actions shipped** (pulled forward from A5)

- Search by account/profile name; player page: profile & resources, roster (with gear detail drill-in), items, progress (campaign stars, dungeon floors, arena state, quests), summon history with pity counters, economy log tail, battle history (open in Battle inspector), sessions.
- Actions (all audited, all confirm-guarded): **Grant** (champion / gear roll / items / currency — via RewardService with a mail-attachment option "send as gift mail"), **Reset password** (generates temp password + force-change flag — the EA-0.1 support path), **Set rank** (Player / GameMaster / Admin — typed confirmation, self-demotion blocked), **Ban/unban** (reason required), **Rename profile** (the no-profanity-filter support path), session revoke.
- Bulk: select-all-filtered → mail composer. _(A5 — needs the mail composer.)_
- **Shipped now:** search by either name (bots hidden by default), the account page (wallet, live energy, holdings as counts, progress and deepest floors, live sessions, economy tail), and **Reset password · Set rank · Ban/unban · Rename profile · Grant · Sign out everywhere** — every one audited with before/after, the two irreversible ones behind a typed confirmation of the account name. Two guards refuse the caller's own account: an admin cannot change their own rank or ban themselves.
- **Why this jumped the queue:** there is no e-mail address anywhere in Mistvale, so an operator is the _only_ password reset that exists. Without this the support path was hand-writing an argon2id hash into the database — a hard-rule violation, not a missing convenience.
- **Fresh start** (the danger zone, in red, apart from the rest): returns an account to exactly the state registration leaves it in — champions, relics, items, campaign and Depths progress, the Chronicle, shop stock, summon history, battles, arena standing and Hall of Valor all destroyed; level 1 with the starter chooser waiting. The account keeps its name, password and rank: this is a reset, not a deletion. Confirmed by typing the account name, and the dialog _counts_ what is about to go, because "reset" and "reset, and that was 143 relics" are different sentences and only one of them stops somebody with the wrong account open. Three things deliberately survive: **settings** (audio, speed, motion and colourblind glyphs are accessibility choices, not progress), the **economy ledger** (emptied through RewardService so the sum of a player's deltas still equals their balance — the reset is a line in the history, not a hole in it), and the **audit trail**, which records the whole before-state since nothing else will remember it. Refuses arena bots and points at the bot manager.
- **Still A5:** roster and gear drill-in (holdings are counts today), summon history with pity, battle history into the inspector, grants of champions/gear rolls, the gift-mail attachment option, and bulk actions.

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

### 2.19 Jobs & health

Job list (daily reset, shop refresh, event rotation, bot refresh, backup trigger status) with last-run/next-run/result and a guarded "Run now". Health page = dashboard strip expanded + log-error tail.

## 3. Access model (EA — owner decision)

One account system with ranks **Player / GameMaster / Admin**; **only Admin-rank accounts can log into the suite** — full access to everything documented here. GameMaster is a reserved moderation rank (badge + future in-game moderation tools; no suite access at EA). Rank management lives in Player management (§2.14): admin-only, audited, self-demotion blocked; first admin + lockout recovery via the game repo's `SET_RANK.sh` on the VPS. No self-serve admin signup; optional IP allowlist on `/admin` at nginx level; every session listed/revocable.

## 4. UX standards for the suite

Dense-but-clean dark utilitarian theme (Mantine component system, no serif fonts, Mistvale accent colors); every destructive action = typed confirmation; every form = dirty-state guard; every table = keyboard navigable; optimistic UI nowhere (server truth only, same philosophy as the game); toasts carry request-ids for error reports.
