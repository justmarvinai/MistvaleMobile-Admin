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
  stage: {
    type: 'stage',
    label: 'Stages',
    path: 'stages',
    references: ['campaignChapter', 'enemy'],
    blurb: 'Waves, energy cost, rewards and star rules.',
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
