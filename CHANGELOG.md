# Changelog — Mistvale Admin Suite

All notable changes to the Admin Suite are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: pre-release `0.x` until EA-0.1.

## [Unreleased]

### Added — content export and import (A3, ADMIN_SUITE_DESIGN §2.17)

**Publish center → Export & import**, and it sits inside the publish center rather than beside
it because §2.17 asks that an import "shows dry-run diff first" — and an import writes
**drafts**, so the dry run is the Pending changes tab one click away, with the same field-level
diff, the same validation and the same publish button every other edit goes through. A second
review path here would be a second thing to trust.

Export downloads the live content as one JSON document named after its revision. Import takes
one back, and accepts **both** shapes an operator plausibly has to hand: the whole-game
document the API returns, and the game repo's own per-type files (`stage.json`,
`champion.json`), which are bare arrays whose type is only in the filename. That second form
is the commoner case — it is what `content-snapshot/` in the game repo holds — and a reader
that refused it would refuse the one somebody restoring from git actually has. What it will
not do is guess: a bare array whose name says nothing usable is refused by name rather than
imported under a type nobody chose, which is why dropping `manifest.json` by mistake is
reported rather than obeyed.

Files are **staged** rather than sent: an import is a write, and one that happened the moment
a file was picked would leave nothing to change your mind about. What is staged is listed by
content type with its entity count and a tick, so restoring one type out of twenty-six is a
checkbox rather than a hand-edited bundle.

### Added — the gear tables read as curves (A3, ADMIN_SUITE_DESIGN §2.12)

The config editor picks its control from the live value's type, and for an array or an
object that meant a JSON textarea — correct, complete and unreadable for the values that
are actually _shapes_. `economy.gearUpgradeSuccess` is sixteen numbers falling from 1 to
0.2, and `0.02` typed where `0.2` was meant is invisible in a blob and obvious on a line.

A numeric list is a line with a box under each point now, defaulting to the curve rather
than hiding it behind a toggle, because the readable half of the pair should be the one an
operator lands on. It covers the two tables A3 asked to have "surfaced" and five more
besides, and both shapes those come in: an array indexed from 0, and a flat numeric map
keyed by its own labels — **sorted as numbers when every key is one**, so `{"1", "2", "10"}`
comes back in that order rather than 1, 10, 2, which would draw a cliff that is not in the
data. The line is scaled against the curve's own range rather than against zero, since
several of these are multipliers hovering near 1 and a zero-based axis draws every one of
them as one flat line at the top. Raw JSON stays one press away for the edits a curve
cannot express — adding a rank to a ladder, renaming a key.

A list that is _not_ numbers stays JSON (`arena.botGivenNames` is words), because a line
through it would be a picture of nothing and a number box could not write a name back.

Also: the save button said "Save 1 drafts".

### Added — what a shop's weights and gates actually do (A3, ADMIN_SUITE_DESIGN §2.9)

**Content → Shops.** The same argument as the summon pools next door: every field of the
Bazaar is already editable in the generic browser and none of them says what it _does_. A
weight is relative to the other offers, and which offers those are depends on the player's
level — so **adding one level-30 offer changes the odds a level-29 player gets on everything
else in the shop**, and nothing in a field-by-field view shows that. The screen is one band
per level at which the contents change, each with its own recomputed shares.

Two things it deliberately refuses to compute, because both would be plausible and wrong. There
is **no "chance of appearing in this window"**: the server stocks a window weighted _without
replacement_, so no closed form exists and a `1 - (1 - p)^n` here would be a number that
disagrees with the game — what is reported is the share of **one** slot, which is exactly what
a weight is. And a weight of zero is only called dead **beside a positive one**, because a
wholly weightless pool is picked from uniformly, which is what the server does.

It also names the two faults that publish cleanly and look right in an editor: an offer no
player can be shown (weight 0 among positives, or a level gate above the cap), and a band with
fewer eligible offers than the window has slots — where the server lets the remaining slots
repeat, which reads in-game as the same offer twice and is a bug report waiting to happen.

### Added — what the summon odds actually mean (A3, ADMIN_SUITE_DESIGN §2.8)

**Content → Summon pools.** Published gacha odds are the one number in the game a player is
entitled to hold us to, and a form of raw rates cannot answer the three questions an operator
has about them: are these a distribution at all, when does mercy start, and how many pulls
does a rarity actually cost?

All three, per rarity, per pool. Rates that do not sum to 100% get a red banner **before**
publish refuses them — publish already does, but only once you get there, long after the
number you mistyped has left the screen. Mercy is shown as the pull it first touches and
what the rate has become by twice that. And the expected pull count is walked rather than
solved, because mercy makes the closed form a piecewise mess: at each pull the rate is
known, so the probability of first success at pull _n_ is exact. A rarity nobody can ever
reach — 0% with no mercy — reads **unreachable** rather than a large number, because that is
content to fix rather than a figure to compare.

Champion weights are shown as the share each actually gets _within its band_, with the
reason on the screen: the band is chosen from the rates first and a champion from the band
second, which is what keeps an advertised rate honest however the roster grows. A band whose
weights are all zero reads as zero rather than an even split, since it cannot be rolled from
at all.

Every field is still edited in the generic browser. This screen only says what the numbers
mean — a second place to change them would be a second place for them to drift.

**The off-by-one it caught is worth carrying.** The first pull mercy touches is `after + 2`,
not `after + 1`: the server's counter is _pulls since that rarity last landed_, so going into
pull `n` it holds `n - 1`, and the bonus needs `since - after > 0`. The obvious answer would
have promised an operator mercy a pull earlier than the game grants it — and the test
neighbouring the one that caught it had warned about exactly that.

### Added — the campaign as a grid (A2, ADMIN_SUITE_DESIGN §2.6)

**Content → Campaign**: twelve chapters, seven stage numbers by three difficulties, laid out
the way a retune is actually compared. "Is 4-6 Brutal out of line with 4-5" is one glance
across a row here, and a search through a flat list of 252 anywhere else.

**A reviewing view rather than an authoring one**, which follows from how the content got
here: the game repo's seed generates all 252 campaign stages from twelve chapter plans, so
nobody is ever going to create one by hand. Every cell carries the three figures a retune is
compared on — energy, waves, enemy units — and **links into the generic entity editor** for
the fields. A second place to change a stage is a second place for it to drift, and the
browser's editor is already schema-driven, validated and wired to the publish flow. What the
grid adds is the shape, which is the only thing the browser cannot give.

**A missing cell is drawn as a hole rather than closed up.** A chapter with six Brutal stages
and seven of everything else is a content fault — a difficulty a player can reach and not
play is a dead end — and a grid that quietly tidied the gap would hide the one thing this
view exists to make obvious. The chapter says so in a banner naming the cells.

One decision inside it is worth recording, because the obvious version works and is wrong:
the grid reads `parentKey`, `number` and `difficulty` off each stage's **body**, not by
parsing its key. The key encodes the same three facts today (`c04_s6_brutal`), and a stage
authored with any other key would silently vanish from the grid — which is exactly the kind
of gap this view is for.

### Added — the battle inspector (ADMIN_SUITE_DESIGN §2.18)

The debugging tool for "that fight felt wrong", and the last thing A2 owed that a report
could arrive about tomorrow. **Live ops → Battle inspector**: pick a fight from the recent
list or paste an id, and read the engine's own event log grouped into its own turns, with
both sides as the log opened with them.

It works at all because **a battle is its event log** — the engine is deterministic given a
seed, the server keeps the whole log on the row, and the game client only ever renders it.
So what is on this screen is what the player saw, rather than a reconstruction that could
differ in exactly the case somebody is asking about. The **seed is on the screen** for the
same reason: with it, the fight is reproducible exactly, which is the difference between
investigating a report and guessing at it.

**The viewer adds nothing to the record.** It splits the log on the engine's own
`turnStart` rather than inferring a boundary, and it filters by unit and event type; it
never interprets an event, because two operators looking at one battle have to see the same
fight. Events before the first turn are kept in a **Setup** row rather than dropped — "what
did this fight start with" is one of the two questions anybody opens this for — and a turn
that nothing survived the filter is dropped rather than left blank, since an operator
filtering to one champion wants that champion's fight and not three hundred empty rows.

The list deliberately does not carry the log: a hundred fights at three hundred turns each
is a response nobody wants and a table nobody can render.

### Added — the dashboard says what the game has been doing (gap G3)

It could tell you how many champions and stages were published, which describes the
_content_; it could not tell you whether anybody was playing. `ADMIN_SUITE_DESIGN` §2.1 has
wanted battle, summon and economy figures since A0, and when P6 shipped the note said the
data now existed. This is the follow-through.

Three cards under the KPI strip. **Battles** — today, this week, how many of today's were
won, and a split by mode where which modes nobody plays is the more interesting half.
**Summons** — today, this week, how many came from mercy rather than the base rate, and the
rarity split _over the week_, because a Legendary is rare enough that a day's count is
usually zero and a zero says nothing about the rates. **Economy** — earned against spent per
currency over the day, both halves rather than the net, since a net of zero is produced by a
healthy economy and by nothing happening at all.

**Every figure is a day beside a week**, because one number alone cannot tell a quiet
Tuesday from a broken endpoint — which is the failure a dashboard exists to catch. And when
a week really is empty the panel says so in a sentence rather than printing three cards of
zeroes: on a live server that is a fault, not a quiet week.

### Added — the audit log, searchable (gap G1)

Every administrative mutation has recorded who, what and both sides of the change since the
game repo's P1, and the suite could see **ten of them**, on the dashboard. Ten is enough to
notice that something happened; it is no use at all for the question the log exists to
answer, which only ever comes up on a bad day: what happened to this thing, and who did it.

**Live ops → Audit log.** Filter by actor (a substring, since the recorded label carries an
`admin:` prefix and an operator types the name), action, entity, entity id and date — all
optional, and all **combining**, because an operator arrives from one of two directions and
usually both by the second attempt. Paging carries the count of _matches_ rather than of the
page: the difference between "3 changes to this stage" and "3 of 400" is the whole question.

A row is its sentence, with before and after behind a chevron — a log where every row is a
JSON dump is one nobody scrolls. The subject is a **button**: "what else happened to this
thing" is the second question every time, and making it a click is the difference between a
log and a search box somebody has to retype into.

Two details that are easy to get wrong and invisible when they are: the filter's own option
lists are built from the **whole** log rather than from the current results, since a filter
whose options narrow as it is used can only be used once; and an emptied box is _absent_
from the query rather than present and empty, because `?actor=` matches every row and looks
exactly like a filter matching none.

### Added — the balance sandbox

**Live ops → Balance sandbox.** Pick a stage, pick a bench team, press Simulate. It reports
the win rate, the average and median turns across winning runs, the stage's own three-star
turn limit and the share of runs that came in under it — usually the figure actually being
asked about, because a stage can be perfectly clearable and still be mis-tuned if nobody can
three-star it. The first real use of it said exactly that about chapter 1 Brutal: a fresh
team wins every time and three-stars it never.

It closes the last item on the game repo's own debts list (ROADMAP 13, gap G4). Retuning a
stage was already an edit; _checking_ the retune was a deploy, because the only way to find
out what a change did was to publish it and go and play the stage.

- **It is the same simulation CI runs.** The game repo's new `packages/sim` holds one
  `simulateStage` and one definition of each bench team, and both `pnpm sim` and this call it,
  so a number here is directly comparable to a gate's.
- **Draft means draft.** The pending edits are layered over live exactly as a publish would,
  which is the case it exists for. Running it publishes nothing — the publish centre is still
  the only thing that does.
- **It writes nothing.** No player, no roster, no progress, no content, and no audit row.

The three teams are **fresh** (four Rares at 20 / ★3, no relics), **modest** (50 / ★5 / asc 2
with relics) and **built** (60 / ★6 / asc 6, relics and a collection), picked by key rather
than by strength so a benchmark's baseline does not drift when a champion is retuned. The
stage picker is grouped by chapter and keep and names a stage the way the game does —
"Veilwood Fringe 1-7 · brutal" — beside its key, because an operator arrives here from the
entity browser with a key or from a bug report with a number.

Two things worth carrying from building it. Mantine 7's `Select` reads `{ group, items }`
and **silently ignores a flat option carrying a `group` field** — the first cut did exactly
that and the component threw inside `items.map`. And its `Select` renders a visible combobox
_and_ a hidden native input, both carrying the field's label, so `getByLabelText` finds two;
the role is the unambiguous handle.

### Changed — a wave line's star rating now decides something, and defaults to ★6

The game repo's C13 answers its Q8: an enemy's `stars` had been authored on every wave line of
every stage since P2, shown in this editor, and read by nothing. The engine honours it now — it
scales the unit's HP/ATK/DEF on the same rank ladder a champion climbs, so **★6 is full strength
and ★1 is roughly 42% of it**. Speed, crit and resistance are flat at every rating by design.

What changes for an operator is that the field is real: retuning a floor by dropping its guards
from ★6 to ★4 does something now, where before it did nothing and the only working lever was
`level`. **And the default moved from ★1 to ★6** — a wave line added without touching the rating
used to mean nothing and would now mean "58% weaker than the archetype is authored", so an unset
rating reads as "as authored" instead. `pnpm sync-api` carries both through; the generic entity
browser needs no change, since `stars` was already an ordinary number field on the wave editor.

Worth knowing when reviewing a diff: the game repo re-authored all 252 campaign stages in the
same release (Normal/Hard/Brutal went from ★1/2/3 to ★4/5/6 — the same shape on the ladder the
engine actually reads), so a publish diff against a live box will show every campaign stage's
`waves` as changed. That is expected, and it is what `SEED.sh --replace stage` is for.

### Changed — the API types know about the Mistspire

The game repo's C11 adds a tower: a `dungeon` of kind `spire` carrying a `spire` block (keys
a day, how often a keeper stands in the way, and the landings a climb pays at), thirty
`spire`-mode stages, and the field that makes the mode work — **`stage.teamRestriction`**, the
ward naming an element, a faction, a role or a rarity floor that a floor's team must meet.
Two goal types come with it (`spireFloor`, `spireHeight`). `pnpm sync-api` picks all of it up
from the regenerated OpenAPI artifact, so the generic entity browser edits a tower today with
no purpose-built editor: the landings are an ordinary array of objects and the ward is three
fields.

**No spire editor is planned**, which is the same judgement the Titan and the world boss got.
What would earn one is the tower's own shape — thirty floors reviewed as a column with their
wards beside them — and that is A2's campaign-grid problem rather than a new one.

**One publish rule worth knowing about as an operator**, because it will refuse work that
looks correct: a ward is validated against the **whole champion roster**, and one that fewer
than four non-food champions satisfy is rejected. Three of the game's eight factions hold two
or three champions, so a floor warded to the Drowned Choir cannot be published — the game has
no legal team for it and never will until the roster grows.

### Added — Expeditions and the Sunken Stair are authorable

The game repo's C10 closed with two new content types, and the type sync had fallen behind
by both: `expedition` (C10c) and `deepRun` (C10f). `pnpm sync-api` picks them up, and the
three places a content type has to be named by hand now name them — the runtime
`CONTENT_TYPES` list the pickers read, the registry entry that gives a type its label, path
and blurb, and a template so **New → Save** succeeds on the first press.

The Deep Run's template is the interesting one. Its three rooms are a rest and two caches
rather than fights, and that is deliberate: publish validation refuses a `fight` room with
no waves, and a wave needs a real `enemyKey` — so a template carrying one would either fail
on first save or invent a reference that does not exist. What ships instead is the
_structure_ validation checks first — three rooms in band so every floor can offer three
doors, and three boons available on floor 1 so the first offer cannot repeat — and the
fights are added with the enemy picker.

Both templates were checked against the game repo's own Zod schemas and the Deep Run's
publish validation rather than by eye, which caught the first cut writing a stat bonus as
`maxHp`: the engine's stat key is `hp`, and a template that fails on save is worse than no
template.

### Changed — the API types know about the Valewurm

The game repo's C9 adds a Titan: a `dungeon` of kind `titan` carrying a `titan` block (its
turn cap, its keys a day, and a ladder of damage tiers), plus a `titan`-mode stage and two
goal types (`titanRun`, `titanDamage`). `pnpm sync-api` picks all of it up from the
regenerated OpenAPI artifact, so the generic entity browser edits a Titan today with no
purpose-built editor — the ladder is an ordinary array of objects and the publish gate is
where the rules are enforced (ascending damage, no duplicate rungs, no rung that pays
nothing, exactly one stage per keep).

**No Titan editor is planned yet, and that is the same judgement the bot manager was
built on**: a purpose-built editor earns its place when the generic browser cannot express
the thing safely. A damage ladder is a list of three fields, and the server reports every
rule it breaks while editing. If authoring a second Titan turns out to be awkward in
practice, that is the moment to build one.

### Fixed — saving a champion no longer forgets the star it was called at

The game repo's C6 gives a champion `baseRank`: the star it is _summoned_ at, which is now
a band rather than always ★1 — a Common at ★1 or ★2, an Uncommon at ★2 or ★3, and a fixed
★3/★4/★5 for the three above. The champion editor rebuilds the entity field by field, so a
field it does not carry is a field a save deletes; opening any ★2 Common or ★3 Uncommon and
pressing Save would have moved it down a star, with no error anywhere, because the server
reads an absent `baseRank` as the bottom of its rarity's band.

It is a **Called at** picker beside Rarity now, offering only the stars that rarity allows
and disabled where there is only one — and changing the rarity moves it into the new band
rather than leaving a number publish would refuse. `BASE_RANKS_BY_RARITY` mirrors the game
repo's `RANK_RANGE_BY_RARITY.base` the way `content-registry.ts` mirrors its content
registry: the bands are a rule in code rather than a constraint in the API artifact, so
there is nothing to generate them from, and the server stays the guard.

How far a champion can _climb_ is deliberately not a field, here or anywhere. That is the
rarity's ceiling, enforced server-side, so no editor can author a Common into a six-star.

`championAwaken` also arrives with the sync, as a goal type a quest, mission or event can
be built on.

### Added — four more cues to retune, and the sound catalogue is in the spec

The game repo's summon rework adds `summon_charge`, `summon_tease`, `summon_burst` and a
`summon_epic` of its own. They need nothing here — the browser has picked `soundCue` up
whole since it landed — but they are four more rows an operator can reach, and §2.12 of the
design doc had never said what the Sounds page is: a bus, a throttle, and either a path to a
recording or the half-dozen numbers a shaped tone is described by. Written down now,
including the one thing it does not do — audition, which needs the client's synth.

### Changed — the tutorial has a voice, a face, and no dim

The game repo's audio pack landed, and three content fields came with it. The
generic entity editor edits them already — the Admin API is generic over the
registry — so what changed here is the **templates**, which is where an operator
finds out a field exists at all.

- `tutorialStep` gains `portrait` and `sound`. A new step starts with the
  Wardenmaster's own portrait, because every step in the script has it, and with no
  recording, because a new beat does not have one yet.
- `soundCue` gains `loop`, beside the `sample` it already had. Both are on the
  template so an operator building a music track can see the two fields that make
  one — everything else in the catalogue is a synthesised cue that neither loops nor
  names a file.

`pnpm sync-api` picks the same three up as types, so pointing a step at a portrait
that is not a string is a type error here rather than a publish failure there.

### Added — sounds are editable (game repo P10c)

`soundCue` is the game's twenty-fourth content type, and the generic browser picks it up whole: every cue the game makes, its bus, and either the recording behind it or the envelope-and-oscillator numbers it is built from. Retuning what a button sounds like is now a content edit rather than a deploy, and pointing a cue at a dropped-in audio pack is one field.

The "new entity" template is a plain interface beep — a _tone_ rather than a noise burst, deliberately, because a new cue that says nothing is hard to tell from a new cue that is broken. It publishes inactive like every other template.

### Added — the tutorial script, as a script

The generic browser could already edit every field of a step. What it could not do was show fifteen of them as somebody's first hour, or reorder them.

- **The whole script on one screen**, in the order a player walks it: what each step says, what it points at, what it waits for and how much it hands over. A beat says "nothing — a centred beat" rather than leaving two cells blank.
- **Reordering is an arrow.** The script is walked by position and publish refuses a gap or a duplicate, so moving step 9 above step 8 by hand meant editing two entities and getting both numbers right. A move is now a **swap of two numbers** — two writes rather than a renumber of everything below, which keeps the draft small and the publish diff readable. The two saves go in sequence and the second only if the first landed; a half-applied swap is the exact state this page exists to stop anybody reaching.
- **Numbering problems are reported here rather than at the publish gate** — the same three rules the server enforces, in the same words, while the operator is still editing. The server is still the thing that refuses.
- It is a _reviewing_ view, not a second field editor. Every field stays editable in the generic browser, and duplicating any of it here would create a second place to change one thing.

### Changed — a stage can carry its own team

The game repo's cold open added `presetTeam` to the stage contract: the champions a `tutorial` stage is fought with, since that fight happens before the account owns anybody. The stage template starts it empty, because publish refuses a borrowed team on any other kind of stage.

### Added — the tutorial script in the entity browser

`tutorialStep` is the game repo's twenty-third content type and reaches the browser the way every type does — no editor code, because the registry entry and a template are the whole of it.

- **The template ships a beat**, inactive: an active step appears in front of every player mid-script the moment it is published, and _where in the script it belongs_ is the decision an operator is making — not one to make by accident on first save.
- Numbering is what the server validates hardest: the script is walked by **position**, so a gap or a duplicate is a step nobody reaches, and publish says so plainly rather than shipping a script that stalls.

### Added — the mail composer, and news is authorable

Two things arrive together, because they are the operator's two ways of saying something.

**The composer** (§2.16) sends to one player or to everybody. It is the one page in the suite that hands players currency directly and irreversibly — a message cannot be recalled, and a thousand of them cannot be recalled one at a time — so it is guarded twice: attachments go through the new reward picker, which only offers keys that exist; and a send to everybody unlocks only once **everybody** is typed out. Under it, the send log: one row per send with reached / read / collected, because after a compensation mail that is the only question anybody has.

**`RewardPicker` is a shared primitive, not part of the composer.** A reward map is the same flat shape everywhere in Mistvale — quests, missions, event ladders, calendar days, mail — and it is unforgiving of a typo: `sigil_gleeming` is a perfectly valid key that pays nothing. So the picker never offers free text. Currencies come from the closed list, items from the live catalogue, and a key that has since left the catalogue is called out in red rather than saved quietly. The quest, mission, event and login-track editors at A4 are the reason it was built here rather than inside the page that needed it first.

**`newsPost` is the game repo's twenty-second content type.** A post carries a window, so it appears and disappears on the clock the way an event does — write Friday's patch note on Tuesday, publish once, and it shows up by itself. Publish rejects a window that closes before it opens and a timestamp that is not one. The template ships inactive and unwindowed: a draft announcement that went live the moment it was saved would be this feature's worst failure.

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
