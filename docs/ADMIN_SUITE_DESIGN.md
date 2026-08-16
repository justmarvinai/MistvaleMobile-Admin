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
  - *Identity*: key (immutable after create), name, title, lore, faction, element, rarity, role, flags; avatar & sprite pick from Asset registry with **live idle preview** at 1×/2×/3×.
  - *Stats*: base stats at max (HP/ATK/DEF/SPD/CR/CD/RES/ACC) with instant derived preview: the full 1–60 × rank curve table and a radar-vs-role-average chart; aura editor (stat/scope/area).
  - *Skills*: ordered skill slots (A1–A4 + passive) referencing the Skills library; inline open; **kit preview card** exactly as the game renders it (shared description templater).
  - *Balance*: sandbox — pit this champion (level/rank/gear preset) vs an enemy pack via the balance-sim endpoint; shows avg turns to kill / survive. Small but killer feature for tuning without deploys.
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
- Tutorial: ordered step list (trigger, screen, highlight target picker from a screen-element registry, dialogue text, forced action, rewards); dry-run mode renders the flow as a storyboard.
- Game config: schema-driven forms grouped by domain (Energy, XP curves, Gear upgrade tables, Combat constants, Element wheel, Arena tiers & rewards, Pity defaults, Rate limits, Reset time…). Each field: current live value vs draft, default, and helptext sourced from docs. This is the game's control room — every constant the design docs mark *tunable* appears here.

### 2.13 Asset manager
Upload frame strips/PNGs (drag-drop) → server packs & registers; preview player (play tracks at set fps); assign to champions/enemies/vfx slots; usage list; orphan finder. Enforces ASSET_GUIDE conventions (size check, naming).

### 2.14 Player management
- Search by account/profile name; player page: profile & resources, roster (with gear detail drill-in), items, progress (campaign stars, dungeon floors, arena state, quests), summon history with pity counters, economy log tail, battle history (open in Battle inspector), sessions.
- Actions (all audited, all confirm-guarded): **Grant** (champion / gear roll / items / currency — via RewardService with a mail-attachment option "send as gift mail"), **Reset password** (generates temp password + force-change flag — the EA-0.1 support path), **Set rank** (Player / GameMaster / Admin — typed confirmation, self-demotion blocked), **Ban/unban** (reason required), **Rename profile** (the no-profanity-filter support path), session revoke.
- Bulk: select-all-filtered → mail composer.

### 2.15 Bot manager
Ladder view by rating band; generate N bots (name generator + roster synthesis from live content at target power); edit individual bot teams (same team editor as defense teams); nightly refresh policy config; "bot density" health check vs real-player count per band.

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
