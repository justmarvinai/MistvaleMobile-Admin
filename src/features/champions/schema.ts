import { z } from 'zod';
import { ELEMENTS, RARITIES, ROLES, STATS } from '@/api/types';
import { CONTENT_KEY_PATTERN } from '@/features/content/templates';

/**
 * Client mirror of `championDefSchema`
 * (MistvaleMobile/packages/shared/src/content/entities.ts).
 *
 * Every bound here matches the server's exactly. The point is not to replace server
 * validation — the server re-validates every write and re-validates again at publish —
 * but to catch mistakes at the field the operator is typing in, rather than after a
 * round-trip.
 */

const contentKey = z
  .string()
  .min(2, 'At least 2 characters.')
  .max(64, 'At most 64 characters.')
  .regex(CONTENT_KEY_PATTERN, 'Lowercase snake_case, starting with a letter.');

export const baseStatsSchema = z.object({
  hp: z.number().int('Whole numbers only.').min(100).max(60_000),
  atk: z.number().int('Whole numbers only.').min(10).max(5_000),
  def: z.number().int('Whole numbers only.').min(10).max(5_000),
  spd: z.number().int('Whole numbers only.').min(50).max(200),
  critRate: z.number().int('Whole numbers only.').min(0).max(100),
  critDmg: z.number().int('Whole numbers only.').min(0).max(300),
  res: z.number().int('Whole numbers only.').min(0).max(300),
  acc: z.number().int('Whole numbers only.').min(0).max(300),
});

export const auraSchema = z.object({
  stat: z.enum(STATS),
  value: z.number().min(1).max(100),
  scope: z.enum(['all', 'element', 'faction']),
  area: z.enum(['any', 'campaign', 'arena', 'depths']),
});

export const championFormSchema = z.object({
  key: contentKey,
  sortOrder: z.number().int().min(0).max(9999),
  name: z.string().min(1, 'A champion needs a name.').max(48),
  title: z.string().max(64),
  lore: z.string().max(2000),
  factionKey: contentKey,
  element: z.enum(ELEMENTS),
  rarity: z.enum(RARITIES),
  role: z.enum(ROLES),
  baseStats: baseStatsSchema,
  skills: z
    .array(contentKey)
    .min(1, 'A champion needs at least one skill.')
    .max(5, 'At most five skills (A1–A4 plus a passive).'),
  aura: auraSchema.nullable(),
  assetKey: contentKey,
  isFood: z.boolean(),
  summonable: z.boolean(),
  starter: z.boolean(),
  balanceVersion: z.number().int().min(1),
});

export type ChampionFormValues = z.infer<typeof championFormSchema>;

/** Per-rarity kit depth the server warns about at publish (validate.ts). */
export const EXPECTED_SKILLS_BY_RARITY: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 3,
  legendary: 4,
};

/**
 * Reads a champion out of the raw entity the API returns.
 *
 * Falls back to the template's defaults per field rather than rejecting the whole
 * entity: an operator must always be able to open and repair content, including content
 * that predates a schema change.
 */
export function toChampionForm(data: Record<string, unknown>, key: string): ChampionFormValues {
  const stats = isRecord(data.baseStats) ? data.baseStats : {};
  return {
    key,
    sortOrder: numberOr(data.sortOrder, 0),
    name: stringOr(data.name, ''),
    title: stringOr(data.title, ''),
    lore: stringOr(data.lore, ''),
    factionKey: stringOr(data.factionKey, ''),
    element: pick(data.element, ELEMENTS, 'mist'),
    rarity: pick(data.rarity, RARITIES, 'rare'),
    role: pick(data.role, ROLES, 'attack'),
    baseStats: {
      hp: numberOr(stats.hp, 12_000),
      atk: numberOr(stats.atk, 900),
      def: numberOr(stats.def, 800),
      spd: numberOr(stats.spd, 95),
      critRate: numberOr(stats.critRate, 15),
      critDmg: numberOr(stats.critDmg, 50),
      res: numberOr(stats.res, 30),
      acc: numberOr(stats.acc, 0),
    },
    skills: Array.isArray(data.skills)
      ? data.skills.filter((entry): entry is string => typeof entry === 'string')
      : [],
    aura: toAura(data.aura),
    assetKey: stringOr(data.assetKey, ''),
    isFood: booleanOr(data.isFood, false),
    summonable: booleanOr(data.summonable, true),
    starter: booleanOr(data.starter, false),
    balanceVersion: numberOr(data.balanceVersion, 1),
  };
}

function toAura(value: unknown): ChampionFormValues['aura'] {
  if (!isRecord(value)) return null;
  return {
    stat: pick(value.stat, STATS, 'hp'),
    value: numberOr(value.value, 20),
    scope: pick(value.scope, ['all', 'element', 'faction'] as const, 'all'),
    area: pick(value.area, ['any', 'campaign', 'arena', 'depths'] as const, 'any'),
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function pick<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}
