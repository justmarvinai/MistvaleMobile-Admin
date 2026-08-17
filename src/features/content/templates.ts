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
