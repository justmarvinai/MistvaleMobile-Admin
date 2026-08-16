import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_RANKS,
  CONTENT_TYPES,
  DIFFICULTIES,
  EFFECT_COMPONENT_TYPES,
  EFFECT_CONDITION_TYPES,
  EFFECT_TARGETS,
  ELEMENTS,
  ERROR_CODES,
  RARITIES,
  ROLES,
  SCALING_STATS,
  SKILL_SLOTS,
  SKILL_UPGRADE_EFFECTS,
  STATS,
  STATUS_ENGINE_TYPES,
} from './types';

/**
 * The runtime value lists, checked against the server contract.
 *
 * `types.ts` pins each list with `satisfies`, which catches a member the server *removed*
 * — the alias stops accepting it. It cannot catch a member the server *added*: a picker
 * would silently offer nine of ten options and nobody would notice until an operator went
 * looking for the missing one.
 *
 * So this reads the generated OpenAPI artifact and compares the enum sets directly.
 */

const artifact = resolve(
  import.meta.dirname,
  '../../../MistvaleMobile/docs/openapi/admin-api.json',
);

interface JsonNode {
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, JsonNode>;
  items?: JsonNode;
  /** Zod emits `oneOf` for discriminated unions and `anyOf` for plain ones. */
  oneOf?: JsonNode[];
  anyOf?: JsonNode[];
  type?: unknown;
  [key: string]: unknown;
}

/** The arms of a union node, whichever keyword produced it. */
function armsOf(node: JsonNode): JsonNode[] {
  return node.oneOf ?? node.anyOf ?? [];
}

/**
 * Looks through a union that only exists to make something nullable.
 *
 * `.nullable()` becomes `anyOf: [realSchema, {type: 'null'}]`, which would otherwise hide
 * the properties every lookup below is after.
 */
function unwrap(node: JsonNode): JsonNode {
  if (node.properties || node.enum || node.const !== undefined) return node;
  const arms = armsOf(node).filter((arm) => arm.type !== 'null');
  return arms.length === 1 ? unwrap(arms[0]!) : node;
}

const document = JSON.parse(readFileSync(artifact, 'utf8')) as {
  components: { schemas: Record<string, JsonNode> };
};
const schemas = document.components.schemas;

/** Follows a dotted property path through a component schema. */
function at(schemaName: string, path: string[]): JsonNode {
  let node: JsonNode | undefined = schemas[schemaName];
  for (const step of path) {
    if (!node) break;
    node = unwrap(node);
    node = step === '[]' ? node.items : node.properties?.[step];
  }
  if (!node) throw new Error(`No node at ${schemaName}.${path.join('.')}`);
  return node;
}

/** The values a node admits, whether it is an enum or a union of consts. */
function valuesOf(node: JsonNode): string[] {
  if (Array.isArray(node.enum)) return node.enum.map(String);
  if (node.const !== undefined) return [String(node.const)];
  const arms = armsOf(node).filter((arm) => arm.type !== 'null');
  if (arms.length > 0) return arms.flatMap(valuesOf);
  throw new Error('Node carries no enumerable values.');
}

/** The `type` discriminators of a union of object schemas. */
function discriminators(node: JsonNode, key = 'type'): string[] {
  return armsOf(node).flatMap((arm) => {
    const discriminator = arm.properties?.[key];
    return discriminator ? valuesOf(discriminator) : [];
  });
}

/** One arm of the effect-component union, by its `type` discriminator. */
function componentArm(type: string): JsonNode {
  const arm = armsOf(at('SkillDef', ['components', '[]'])).find(
    (candidate) => candidate.properties?.type?.const === type,
  );
  if (!arm) throw new Error(`No effect component arm for "${type}".`);
  return arm;
}

describe('runtime value lists match the server contract', () => {
  it.each([
    ['ELEMENTS', ELEMENTS, () => valuesOf(at('ChampionDef', ['element']))],
    ['RARITIES', RARITIES, () => valuesOf(at('ChampionDef', ['rarity']))],
    ['ROLES', ROLES, () => valuesOf(at('ChampionDef', ['role']))],
    ['STATS', STATS, () => valuesOf(at('ChampionDef', ['aura', 'stat']))],
    ['ACCOUNT_RANKS', ACCOUNT_RANKS, () => valuesOf(at('AccountSummary', ['rank']))],
    ['DIFFICULTIES', DIFFICULTIES, () => valuesOf(at('StageDef', ['difficulty']))],
    ['ERROR_CODES', ERROR_CODES, () => valuesOf(at('ApiError', ['code']))],
    ['CONTENT_TYPES', CONTENT_TYPES, () => valuesOf(at('ContentTypeCount', ['contentType']))],
    ['STATUS_ENGINE_TYPES', STATUS_ENGINE_TYPES, () => valuesOf(at('StatusDef', ['engineType']))],
    ['SKILL_SLOTS', SKILL_SLOTS, () => valuesOf(at('SkillDef', ['slot']))],
    ['SCALING_STATS', SCALING_STATS, () => valuesOf(componentArm('damage').properties!.scale!)],
    [
      'EFFECT_COMPONENT_TYPES',
      EFFECT_COMPONENT_TYPES,
      () => discriminators(at('SkillDef', ['components', '[]'])),
    ],
    [
      'EFFECT_CONDITION_TYPES',
      EFFECT_CONDITION_TYPES,
      () => discriminators(componentArm('damage').properties!.condition!),
    ],
    [
      'EFFECT_TARGETS',
      EFFECT_TARGETS,
      () => valuesOf(componentArm('applyStatus').properties!.target!),
    ],
    [
      'SKILL_UPGRADE_EFFECTS',
      SKILL_UPGRADE_EFFECTS,
      () => discriminators(at('SkillDef', ['upgrades', '[]']), 'effect'),
    ],
  ])('%s', (_name, local, fromContract) => {
    expect([...local].sort()).toEqual([...new Set(fromContract())].sort());
  });
});
