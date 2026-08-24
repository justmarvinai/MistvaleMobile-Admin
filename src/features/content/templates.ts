import type { ContentType } from '@/api/types';

/**
 * Starting points for new entities.
 *
 * Each template is a *schema-valid* entity, so "New → Save" always succeeds and the
 * operator edits from something real instead of fighting a validation wall. Keys that
 * point at other content (`factionKey`, `assetKey`, skill lists) are deliberately left
 * empty where the schema allows it, and are pickers in the dedicated editors — a
 * template must never invent a reference that does not exist, because publish validation
 * would then reject content the operator never typed.
 */
export function templateFor(contentType: ContentType, key: string): Record<string, unknown> {
  const templates: Record<ContentType, Record<string, unknown>> = {
    faction: { key, sortOrder: 0, name: 'New faction', lore: '', icon: '' },

    status: {
      key,
      sortOrder: 0,
      name: 'New status',
      kind: 'debuff',
      engineType: 'statModifier',
      family: key,
      potency: 1,
      params: { stat: 'atk', pct: -25, tick: 'none', maxStacks: 1 },
      icon: '',
      description: '',
    },

    skill: {
      key,
      sortOrder: 0,
      name: 'New skill',
      description: '',
      slot: 'a1',
      cooldown: 0,
      targeting: { side: 'enemy', mode: 'single' },
      components: [{ type: 'damage', scale: 'atk', mult: 2, hits: 1 }],
      upgrades: [],
      aiHints: {},
      animation: { track: 'attack' },
    },

    asset: {
      key,
      sortOrder: 0,
      kind: 'unit',
      source: 'repo',
      basePath: `units/${key}`,
      tracks: { idle: { frames: 4, fps: 8, loop: true } },
      stillPath: '',
      avatarPath: '',
    },

    champion: {
      key,
      sortOrder: 0,
      name: 'New champion',
      title: '',
      lore: '',
      // Pickers in the champion editor fill these; they intentionally start blank so a
      // half-finished champion fails validation loudly rather than pointing at nothing.
      factionKey: '',
      element: 'mist',
      rarity: 'rare',
      role: 'attack',
      baseStats: {
        hp: 12_000,
        atk: 900,
        def: 800,
        spd: 95,
        critRate: 15,
        critDmg: 50,
        res: 30,
        acc: 0,
      },
      skills: [],
      aura: null,
      assetKey: '',
      isFood: false,
      summonable: true,
      starter: false,
      balanceVersion: 1,
    },

    enemy: {
      key,
      sortOrder: 0,
      name: 'New enemy',
      archetype: 'grunt',
      element: 'mist',
      role: 'attack',
      baseStats: {
        hp: 9_000,
        atk: 700,
        def: 600,
        spd: 90,
        critRate: 15,
        critDmg: 50,
        res: 30,
        acc: 0,
      },
      growth: 1.045,
      skills: [],
      assetKey: '',
      isBoss: false,
      bossMechanics: { almightyImmunity: false, tmReductionImmune: false },
    },

    gearSet: {
      key,
      sortOrder: 0,
      name: 'New relic set',
      lore: '',
      pieces: 2,
      bonusType: 'stat',
      bonus: { stat: 'atk', pct: 15 },
    },

    gearSlot: {
      key: 'weapon',
      sortOrder: 0,
      name: 'Weapon',
      allowedMainStats: ['atk'],
      allowsPercentMain: false,
      accessory: false,
      ascensionRequired: 0,
    },

    // Eleven ranks of nothing: a new relic stat starts flat so an operator fills in the
    // curve deliberately rather than editing away someone else's numbers.
    gearStat: {
      key,
      sortOrder: 0,
      name: 'New relic stat',
      stat: 'atk',
      percent: false,
      canBeMain: true,
      canBeSub: true,
      mainBase: [0, 0, 0, 0, 0, 0],
      mainMax: [0, 0, 0, 0, 0, 0],
      subMin: [0, 0, 0, 0, 0, 0],
      subMax: [0, 0, 0, 0, 0, 0],
    },

    item: {
      key,
      sortOrder: 0,
      name: 'New item',
      category: 'material',
      rarity: 'common',
      description: '',
      icon: '',
      payload: {},
    },

    campaignChapter: {
      key,
      sortOrder: 0,
      number: 1,
      name: 'New chapter',
      region: '',
      lore: '',
      backgroundAsset: '',
      starRewards: [],
    },

    // A keep with no rotation and no level gate: open to everyone, every day, until an
    // operator decides otherwise. Floors are `stage` rows whose `parentKey` names this.
    dungeon: {
      key,
      sortOrder: 0,
      name: 'New dungeon',
      kind: 'relic',
      lore: '',
      region: '',
      backgroundAsset: '',
      tagline: '',
      floors: 15,
      setKeys: [],
      itemKeys: [],
      openDays: [],
      unlockLevel: 1,
    },

    stage: {
      key,
      sortOrder: 0,
      mode: 'campaign',
      parentKey: '',
      number: 1,
      difficulty: 'normal',
      energyCost: 4,
      waves: [[]],
      rewards: {
        silverMin: 500,
        silverMax: 800,
        playerXp: 20,
        championXp: 200,
        drops: {
          gearChance: 0,
          gearRankMin: 1,
          gearRankMax: 2,
          gearRarityWeights: {},
          gearSlots: [],
          gearSetKeys: [],
          items: [],
        },
      },
      starRules: { noDeaths: true, maxTurns: 12 },
      firstClearRewards: {},
      unlock: {},
      // Only a `tutorial` stage brings its own team, and publish refuses one anywhere
      // else — so the template starts empty and the cold open is the deliberate exception.
      presetTeam: [],
    },

    // A Tier-1 stat node: the simplest thing that is both valid and useful, so an
    // operator edits a real mastery rather than fighting a validation wall.
    mastery: {
      key,
      sortOrder: 0,
      name: 'New mastery',
      description: '',
      tree: 'onslaught',
      tier: 1,
      icon: '',
      effects: [{ type: 'stat', stat: 'atk', flat: 50, pct: 0 }],
    },

    // A daily with one goal and no filters. Filters are the part that needs thought — each
    // goal type declares which it accepts, and publish rejects any other — so the template
    // leaves them off rather than guessing at one an operator would have to notice and
    // remove.
    quest: {
      key,
      sortOrder: 0,
      name: 'New quest',
      description: '',
      period: 'daily',
      goals: [{ type: 'battleWin', target: 5, filters: {} }],
      rewards: {},
      countsTowardChest: true,
      unlockLevel: 1,
      icon: '',
      active: true,
    },

    // Arc 1, step 1 — publishable as-is. Arc and step both matter: arcs open in order, so
    // a *gap* in the numbering strands every arc past it, and publish validation says so
    // rather than letting a chain silently stop halfway.
    mission: {
      key,
      sortOrder: 0,
      name: 'New mission',
      description: '',
      arc: 1,
      step: 1,
      arcName: 'New arc',
      goals: [{ type: 'battleWin', target: 5, filters: {} }],
      rewards: {},
      grants: { champions: [], title: '' },
      icon: '',
      active: true,
    },

    // A weekend event, publishable as-is. Weekly rather than a dated window because a
    // recurring event tends itself; the `window` form is a two-field edit away and is what
    // a one-off launch weekend wants. One rule and two rungs so the shape of both arrays
    // is obvious before an operator adds to them.
    event: {
      key,
      sortOrder: 0,
      name: 'New event',
      description: '',
      bannerAsset: '',
      schedule: { kind: 'weekly', startWeekday: 5, durationDays: 3 },
      pointRules: [{ type: 'battleWin', filters: {}, points: 10, label: 'Each battle won' }],
      milestones: [
        { points: 500, rewards: {} },
        { points: 1500, rewards: {} },
      ],
      unlockLevel: 1,
      active: true,
    },

    // A post an operator fills in and schedules. Inactive and unwindowed: a draft
    // announcement that went live the moment it was saved would be the feature's worst
    // failure, and an empty window means "always up" rather than "never".
    newsPost: {
      key,
      sortOrder: 0,
      title: 'New post',
      body: 'What happened, and what it means for the player.',
      startsAt: '',
      endsAt: '',
      pinned: false,
      active: false,
    },

    // A seven-day welcome strip. Days must run 1…n with no gaps — the Nth claim pays the
    // day numbered N — so the template ships all seven rather than one to copy, which is
    // the shape an operator edits rather than assembles.
    //
    // Inactive on purpose: only one track of each kind may be active, so a new one created
    // beside the shipped calendar would fail validation the moment it was saved. Turning it
    // on is the deliberate step of swapping which track is live.
    loginTrack: {
      key,
      sortOrder: 0,
      name: 'New track',
      description: '',
      track: 'welcome',
      days: Array.from({ length: 7 }, (_unused, index) => ({
        day: index + 1,
        rewards: { silver: 1000 },
        grants: { champions: [], choices: [], relics: [] },
      })),
      active: false,
    },

    // A beat — words and a Continue, no goal. The script is walked by *position*, so a new
    // step lands at the end by default: `step` is left at 1 only because there is no way to
    // know the current length from here, and publish validation says so plainly if the
    // numbering ends up with a gap or a duplicate.
    //
    // Inactive on purpose. An active step appears in front of every player mid-script the
    // moment it is published, and where in the script it belongs is the decision being made
    // here — not one to make by accident on first save.
    // A plain interface beep, audible the moment it is published. Deliberately a *tone*
    // rather than the noise source: a new cue that says nothing is hard to tell from a
    // new cue that is broken.
    soundCue: {
      key,
      sortOrder: 0,
      bus: 'sfx',
      // A synthesised cue rather than a file, because that is what a *cue* is here: the
      // two entries that name a `sample` are the music, and they loop. Both fields are on
      // the template so an operator building a track knows they exist.
      sample: '',
      loop: false,
      voice: {
        source: 'tone',
        wave: 'square',
        startHz: 660,
        endHz: 660,
        attack: 0.004,
        decay: 0.12,
        gain: 0.4,
        filterHz: 6000,
        overtones: [],
      },
      throttleMs: 40,
      active: false,
    },

    tutorialStep: {
      key,
      sortOrder: 0,
      step: 1,
      screen: 'haven',
      highlight: '',
      title: 'New step',
      body: 'What the Wardenmaster says here.',
      rewards: {},
      grantsBefore: {},
      grantsRelics: [],
      // The speaker every step in the script has, so a new beat looks like the ones around
      // it. `sound` is empty because a new step has no recording yet — dropping one into
      // the game repo's `assets/music_and_sounds/tutorial_sounds/` and naming it here is
      // what gives the step a voice, and a step without one is simply read.
      portrait: 'portraits/wardenmaster_avatar.jpg',
      sound: '',
      active: false,
    },

    // Rates that already sum to 1, so a new pool is publishable the moment its champion
    // list is filled in rather than failing validation on the first save.
    summonPool: {
      key,
      sortOrder: 0,
      name: 'New summon pool',
      description: '',
      sigilKey: '',
      rates: { rare: 0.915, epic: 0.08, legendary: 0.005 },
      pity: {},
      entries: [],
    },

    shop: {
      key,
      sortOrder: 0,
      name: 'New shop',
      description: '',
      restockMinutes: 60,
      baseSlots: 4,
      crystalSlots: 4,
      crystalSlotCost: 150,
      refreshCost: 50,
      // One placeholder offer: the schema needs at least one, and an empty shop would
      // fail validation on the first save rather than at publish.
      offers: [
        {
          key: 'new_offer',
          kind: 'item',
          name: 'New offer',
          weight: 10,
          currency: 'silver',
          price: 1000,
          pricePerRank: 0,
          refKey: '',
          quantity: 1,
          dailyLimit: 0,
          minAccountLevel: 1,
        },
      ],
    },

    // A short errand with one favour on it, so the shape of a favour is visible rather
    // than described. `rewards` is empty because it is currency and item *keys*, and a
    // template must not invent one.
    expedition: {
      key,
      sortOrder: 0,
      name: 'New expedition',
      description: 'Where they are going, in a sentence.',
      hours: 4,
      partySize: 2,
      unlockLevel: 1,
      rewards: {},
      favours: [{ kind: 'role', value: 'support', bonusPct: 15 }],
      icon: '',
    },

    // A publishable stair with nothing invented in it.
    //
    // The three rooms are a rest and two caches on purpose: a `fight` room is refused by
    // publish validation with no waves, and a wave needs a real `enemyKey` — so a template
    // that shipped one would either fail on first save or invent a reference. What is here
    // instead is the *structure* — three rooms in band for three doors on every floor, and
    // three boons available on floor 1, which are the two rules validation checks first —
    // and the fights are added with the enemy picker.
    deepRun: {
      key,
      sortOrder: 0,
      name: 'New deep run',
      lore: '',
      tagline: '',
      backgroundAsset: '',
      unlockLevel: 1,
      runsPerDay: 2,
      floors: 12,
      forks: 3,
      rooms: [
        {
          key: `${key}_rest`,
          name: 'A dry ledge',
          kind: 'rest',
          description: 'Somewhere to sit. The party mends a little.',
          minFloor: 1,
          maxFloor: 60,
          waves: [],
          healPct: 25,
          rewards: {},
          boonsOffered: 0,
          weight: 1,
        },
        {
          key: `${key}_cache_small`,
          name: 'A spilled satchel',
          kind: 'cache',
          description: 'Someone came this way and did not come back.',
          minFloor: 1,
          maxFloor: 60,
          waves: [],
          healPct: 0,
          rewards: {},
          boonsOffered: 0,
          weight: 1,
        },
        {
          key: `${key}_cache_deep`,
          name: 'A sealed niche',
          kind: 'cache',
          description: 'Wedged shut, and worth the shoulder.',
          minFloor: 1,
          maxFloor: 60,
          waves: [],
          healPct: 0,
          rewards: {},
          boonsOffered: 0,
          weight: 1,
        },
      ],
      boons: [
        {
          key: `${key}_boon_atk`,
          name: 'Sharper',
          description: 'The party hits harder for the rest of the descent.',
          rarity: 'common',
          bonuses: { atk: 120 },
          effects: [],
          stacks: true,
          minFloor: 1,
        },
        {
          key: `${key}_boon_def`,
          name: 'Braced',
          description: 'The party takes less for the rest of the descent.',
          rarity: 'common',
          bonuses: { def: 90 },
          effects: [],
          stacks: true,
          minFloor: 1,
        },
        {
          key: `${key}_boon_hp`,
          name: 'Stubborn',
          description: 'Everyone still standing has more left in them.',
          rarity: 'common',
          bonuses: { hp: 1500 },
          effects: [],
          stacks: true,
          minFloor: 1,
        },
      ],
      depthTiers: [],
    },

    gameConfig: {
      key,
      value: 0,
      group: 'misc',
      label: 'New constant',
      help: '',
    },
  };

  return templates[contentType];
}

/**
 * Content keys are lowercase snake_case and stable forever — the database, seeds and
 * assets all reference them, so the server refuses anything else.
 */
export const CONTENT_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export function validateContentKey(key: string): string | undefined {
  const trimmed = key.trim();
  if (trimmed.length < 2) return 'Keys are at least 2 characters.';
  if (trimmed.length > 64) return 'Keys are at most 64 characters.';
  if (!CONTENT_KEY_PATTERN.test(trimmed)) {
    return 'Lowercase snake_case, starting with a letter (e.g. ember_warden).';
  }
  return undefined;
}
