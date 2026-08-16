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

    stage: {
      key,
      sortOrder: 0,
      mode: 'campaign',
      parentKey: '',
      number: 1,
      difficulty: 'normal',
      energyCost: 4,
      waves: [[]],
      rewards: { silverMin: 500, silverMax: 800, playerXp: 20, championXp: 200 },
      starRules: { noDeaths: true, maxTurns: 12 },
      firstClearRewards: {},
      unlock: {},
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
