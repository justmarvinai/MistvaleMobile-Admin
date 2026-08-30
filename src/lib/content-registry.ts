import { CONTENT_TYPES, type ContentType } from '@/api/types';

/**
 * Mirror of `MistvaleMobile/packages/shared/src/content/registry.ts`.
 *
 * The server drives its own routes off that registry; the suite needs the same
 * label/path mapping to build navigation and URLs. `GET /admin/api/content` returns
 * label and path per type as well, so the live overview is authoritative — this table
 * is what lets the sidebar render before that request resolves, and what gives each
 * type its editor binding.
 */

export interface ContentTypeInfo {
  type: ContentType;
  /** Plural label, matching the server's registry. */
  label: string;
  /** URL segment under `/admin/api/content/…`. */
  path: string;
  /** Which types this one points at; publish rejects dangling references. */
  references: readonly ContentType[];
  /** Short line under the page title, so an operator knows what the type is for. */
  blurb: string;
}

const REGISTRY: Readonly<Record<ContentType, ContentTypeInfo>> = Object.freeze({
  faction: {
    type: 'faction',
    label: 'Factions',
    path: 'factions',
    references: [],
    blurb: 'The banners champions belong to.',
  },
  status: {
    type: 'status',
    label: 'Status effects',
    path: 'statuses',
    references: [],
    blurb: 'Buffs and debuffs, each bound to an engine behaviour.',
  },
  skill: {
    type: 'skill',
    label: 'Skills',
    path: 'skills',
    references: ['status'],
    blurb: 'Ordered effect components the battle engine interprets.',
  },
  asset: {
    type: 'asset',
    label: 'Assets',
    path: 'assets',
    references: [],
    blurb: 'Sprite sheets, animation tracks and placeholder tints.',
  },
  champion: {
    type: 'champion',
    label: 'Champions',
    path: 'champions',
    references: ['faction', 'skill', 'asset'],
    blurb: 'Playable units: identity, base stats, kit and aura.',
  },
  enemy: {
    type: 'enemy',
    label: 'Enemies',
    path: 'enemies',
    references: ['skill', 'asset'],
    blurb: 'Hostile units, growth curves and boss mechanics.',
  },
  gearSet: {
    type: 'gearSet',
    label: 'Relic sets',
    path: 'gear-sets',
    references: [],
    blurb: 'Set bonuses the engine implements.',
  },
  gearSlot: {
    type: 'gearSlot',
    label: 'Relic slots',
    path: 'gear-slots',
    references: [],
    blurb: 'Which main stats may roll in each slot.',
  },
  gearStat: {
    type: 'gearStat',
    label: 'Relic stats',
    path: 'gear-stats',
    references: [],
    blurb: 'What each rollable stat is worth, per rank — the relic economy in eleven rows.',
  },
  item: {
    type: 'item',
    label: 'Items',
    path: 'items',
    references: [],
    blurb: 'Sigils, essences, tomes, emblems and materials.',
  },
  campaignChapter: {
    type: 'campaignChapter',
    label: 'Campaign chapters',
    path: 'chapters',
    references: ['gearSet'],
    blurb: 'Chapters, their regions and star-chest tiers.',
  },
  dungeon: {
    type: 'dungeon',
    label: 'Dungeons',
    path: 'dungeons',
    references: ['gearSet', 'item', 'enemy'],
    blurb: 'The Depths: floors, rotation days, unlock level and what each keep drops.',
  },
  stage: {
    type: 'stage',
    label: 'Stages',
    path: 'stages',
    references: ['campaignChapter', 'dungeon', 'enemy', 'gearSet'],
    blurb: 'Campaign stages and dungeon floors: waves, energy cost, rewards and star rules.',
  },
  summonPool: {
    type: 'summonPool',
    label: 'Summon pools',
    path: 'summon-pools',
    references: ['item', 'champion'],
    blurb:
      'Rates, mercy and the champion table per sigil. Rates must sum to 1, and every rarity advertised needs a champion to deliver it — publish refuses otherwise.',
  },
  shop: {
    type: 'shop',
    label: 'Shops',
    path: 'shops',
    references: ['item', 'gearSet', 'champion'],
    blurb: 'Rotating stock: slots, offers, prices and restock timing.',
  },
  mastery: {
    type: 'mastery',
    label: 'Masteries',
    path: 'masteries',
    references: [],
    blurb: 'The three trees: a node’s tier, and the typed effects the engine runs for it.',
  },
  quest: {
    type: 'quest',
    label: 'Quests',
    path: 'quests',
    references: [],
    blurb: 'The daily, weekly and monthly checklist: what it asks, and what it pays.',
  },
  mission: {
    type: 'mission',
    label: 'Missions',
    path: 'missions',
    references: ['champion'],
    blurb: 'The Valewarden’s Path: eighty steps in arcs of eight, and what each pays.',
  },
  event: {
    type: 'event',
    label: 'Events',
    path: 'events',
    references: [],
    blurb: 'Timed events: when they run, what earns points, and the milestone ladder.',
  },
  valePass: {
    type: 'valePass',
    label: 'Vale Pass',
    path: 'vale-pass',
    references: [],
    blurb:
      'The season: its window, what earns favour, the day’s ceiling, and the two-column tier ladder with the crystals that open the second column.',
  },
  newsPost: {
    type: 'newsPost',
    label: 'News',
    path: 'news',
    references: [],
    blurb: 'Announcements, with the window each is up for. Body is markdown-lite.',
  },
  loginTrack: {
    type: 'loginTrack',
    label: 'Login tracks',
    path: 'login-tracks',
    references: ['champion', 'gearSet'],
    blurb: 'The daily calendar and the welcome strip: one entity per track, a row per day.',
  },
  tutorialStep: {
    type: 'tutorialStep',
    label: 'Tutorial',
    path: 'tutorial',
    references: [],
    blurb:
      'The scripted opening, one entity per step. Steps must run 1…n with no gaps — the script is walked by position.',
  },
  soundCue: {
    type: 'soundCue',
    label: 'Sounds',
    path: 'sounds',
    references: [],
    blurb:
      'Every noise the game makes. A cue names a bus and either a recording or a handful of synth numbers — retune one and the next press of the button sounds different, with no deploy.',
  },
  expedition: {
    type: 'expedition',
    label: 'Expeditions',
    path: 'expeditions',
    references: [],
    blurb:
      'Work that is not a fight: how long a party is gone, how many it takes, and which favours raise the yield. A champion away cannot be fielded.',
  },
  deepRun: {
    type: 'deepRun',
    label: 'Deep Runs',
    path: 'deep-runs',
    references: [],
    blurb:
      'A branching descent fought without relics. One entity carries the whole stair — its rooms, its boons and its depth ladder.',
  },
  gameConfig: {
    type: 'gameConfig',
    label: 'Game config',
    path: 'config',
    references: [],
    blurb: 'Every tunable constant, grouped by domain.',
  },
});

export const CONTENT_TYPE_LIST: readonly ContentTypeInfo[] = CONTENT_TYPES.map(
  (type) => REGISTRY[type],
);

export function contentTypeInfo(type: ContentType): ContentTypeInfo {
  return REGISTRY[type];
}

export function contentTypeByPath(path: string): ContentTypeInfo | undefined {
  return CONTENT_TYPE_LIST.find((info) => info.path === path);
}

/** Human label for a content type used in diffs and issue lists, which send raw types. */
export function contentTypeLabel(type: string): string {
  const known = CONTENT_TYPES.find((candidate) => candidate === type);
  return known ? REGISTRY[known].label : type;
}

/**
 * Types that have a purpose-built editor. Everything else uses the generic entity
 * browser plus the raw JSON editor, which is still complete — the registry-driven API
 * accepts any valid entity — just less guided.
 */
export const DEDICATED_EDITORS: Partial<Record<ContentType, string>> = {
  champion: 'Champion editor',
  skill: 'Skills composer',
  gameConfig: 'Game config',
};
