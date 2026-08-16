import {
  AI_PREFER_OPTIONS,
  EFFECT_COMPONENT_TYPES,
  EFFECT_TARGETS,
  ELEMENTS,
  SCALING_STATS,
  SKILL_SLOTS,
  SKILL_UPGRADE_EFFECTS,
  type AiHints,
  type EffectComponent,
  type EffectCondition,
  type SkillAnimation,
  type SkillSlot,
  type SkillUpgrade,
  type Targeting,
} from '@/api/types';
import { booleanOr, isRecord, numberOr, pick, stringOr } from '@/features/champions/schema';

/**
 * Reading a skill out of the raw entity the API returns, and writing one back.
 *
 * The composer holds a typed `SkillFormValues` in React state rather than in
 * react-hook-form: the component list is a discriminated union edited by pure functions
 * (`components.ts`), and threading that through a form library's field registry buys
 * nothing but indirection.
 */

export interface SkillFormValues {
  key: string;
  sortOrder: number;
  name: string;
  description: string;
  slot: SkillSlot;
  cooldown: number;
  targeting: Targeting;
  components: EffectComponent[];
  upgrades: SkillUpgrade[];
  aiHints: AiHints;
  animation: SkillAnimation;
}

export function toSkillForm(data: Record<string, unknown>, key: string): SkillFormValues {
  return {
    key,
    sortOrder: numberOr(data.sortOrder, 0),
    name: stringOr(data.name, ''),
    description: stringOr(data.description, ''),
    slot: pick(data.slot, SKILL_SLOTS, 'a1'),
    cooldown: numberOr(data.cooldown, 0),
    targeting: toTargeting(data.targeting),
    components: toComponents(data.components),
    upgrades: toUpgrades(data.upgrades),
    aiHints: toAiHints(data.aiHints),
    animation: toAnimation(data.animation),
  };
}

function toTargeting(value: unknown): Targeting {
  const raw = isRecord(value) ? value : {};
  const targeting: Targeting = {
    side: pick(raw.side, ['enemy', 'ally', 'self'] as const, 'enemy'),
    mode: pick(raw.mode, ['single', 'all', 'random', 'lowestHp', 'self'] as const, 'single'),
  };
  const count = numberOr(raw.count, 0);
  // `count` only means anything for random targeting; carrying it elsewhere would show
  // up as a phantom field in the publish diff.
  if (targeting.mode === 'random' && count >= 1) targeting.count = count;
  return targeting;
}

/**
 * Parses the stored component list.
 *
 * Anything the editor cannot represent is dropped rather than half-rendered — a
 * component of an unknown type could only come from a newer server, and silently
 * writing it back mangled would be worse than losing it visibly.
 */
export function toComponents(value: unknown): EffectComponent[] {
  if (!Array.isArray(value)) return [];
  const components: EffectComponent[] = [];

  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const type = raw.type;
    if (typeof type !== 'string') continue;
    if (!EFFECT_COMPONENT_TYPES.some((known) => known === type)) continue;

    const shared: { condition?: EffectCondition; chance?: number } = {};
    const condition = toCondition(raw.condition);
    if (condition) shared.condition = condition;
    if (typeof raw.chance === 'number') shared.chance = raw.chance;

    const target = pick(raw.target, EFFECT_TARGETS, 'hitTargets');
    const scale = pick(raw.scale, SCALING_STATS, 'atk');

    switch (type) {
      case 'damage': {
        const component: EffectComponent = {
          type: 'damage',
          scale,
          mult: numberOr(raw.mult, 1),
          hits: numberOr(raw.hits, 1),
          ...shared,
        };
        if (typeof raw.ignoreDefPct === 'number') component.ignoreDefPct = raw.ignoreDefPct;
        if (typeof raw.element === 'string') {
          component.element = pick(raw.element, ELEMENTS, 'mist');
        }
        components.push(component);
        break;
      }
      case 'applyStatus':
        components.push({
          type: 'applyStatus',
          status: stringOr(raw.status, ''),
          turns: numberOr(raw.turns, 2),
          target,
          ...shared,
        });
        break;
      case 'heal':
        components.push({ type: 'heal', scale, mult: numberOr(raw.mult, 0.15), target, ...shared });
        break;
      case 'shield':
        components.push({
          type: 'shield',
          scale,
          mult: numberOr(raw.mult, 0.15),
          turns: numberOr(raw.turns, 2),
          target,
          ...shared,
        });
        break;
      case 'turnMeter':
        components.push({
          type: 'turnMeter',
          deltaPct: numberOr(raw.deltaPct, 0),
          target,
          ...shared,
        });
        break;
      case 'cleanse':
        components.push({ type: 'cleanse', count: toCount(raw.count), target, ...shared });
        break;
      case 'dispel':
        components.push({ type: 'dispel', count: toCount(raw.count), target, ...shared });
        break;
      case 'extraTurn':
        components.push({ type: 'extraTurn', ...shared });
        break;
      case 'cooldown':
        components.push({
          type: 'cooldown',
          delta: numberOr(raw.delta, -1),
          target,
          ...shared,
        });
        break;
      default:
        break;
    }
  }

  return components;
}

function toCount(value: unknown): number | 'all' {
  if (value === 'all') return 'all';
  return numberOr(value, 1);
}

function toCondition(value: unknown): EffectCondition | undefined {
  if (!isRecord(value)) return undefined;
  switch (value.type) {
    case 'targetHasStatus':
      return { type: 'targetHasStatus', status: stringOr(value.status, '') };
    case 'targetMissingStatus':
      return { type: 'targetMissingStatus', status: stringOr(value.status, '') };
    case 'selfHpBelow':
      return { type: 'selfHpBelow', pct: numberOr(value.pct, 50) };
    case 'targetHpBelow':
      return { type: 'targetHpBelow', pct: numberOr(value.pct, 50) };
    case 'alliesDead':
      return { type: 'alliesDead', atLeast: numberOr(value.atLeast, 1) };
    default:
      return undefined;
  }
}

export function toUpgrades(value: unknown): SkillUpgrade[] {
  if (!Array.isArray(value)) return [];
  const upgrades: SkillUpgrade[] = [];

  for (const raw of value) {
    if (!isRecord(raw)) continue;
    const effect = pick(raw.effect, SKILL_UPGRADE_EFFECTS, 'damage');
    if (effect === 'cooldown') {
      upgrades.push({ effect: 'cooldown', turns: 1 });
      continue;
    }
    upgrades.push({ effect, pct: numberOr(raw.pct, 5) });
  }
  return upgrades;
}

function toAiHints(value: unknown): AiHints {
  if (!isRecord(value)) return {};
  const hints: AiHints = {};
  if (typeof value.prefer === 'string')
    hints.prefer = pick(value.prefer, AI_PREFER_OPTIONS, 'lowestHp');
  if (typeof value.openWith === 'boolean') hints.openWith = value.openWith;
  if (typeof value.dontRepeatWhileActive === 'string' && value.dontRepeatWhileActive) {
    hints.dontRepeatWhileActive = value.dontRepeatWhileActive;
  }
  if (typeof value.onlyBelowHpPct === 'number') hints.onlyBelowHpPct = value.onlyBelowHpPct;
  return hints;
}

function toAnimation(value: unknown): SkillAnimation {
  const raw = isRecord(value) ? value : {};
  const animation: SkillAnimation = {
    track: pick(raw.track, ['attack', 'cast', 'idle'] as const, 'attack'),
  };
  if (typeof raw.vfx === 'string' && raw.vfx) animation.vfx = raw.vfx;
  if (typeof raw.projectile === 'string' && raw.projectile) animation.projectile = raw.projectile;
  if (typeof raw.shake === 'boolean') animation.shake = raw.shake;
  return animation;
}

/**
 * Builds the payload for `PUT /content/skills/:key`.
 *
 * Optional fields are omitted rather than sent as null: the server's schema treats a
 * missing key as "use the default", and an explicit null would fail validation.
 */
export function toSkillPayload(
  form: SkillFormValues,
  serializedComponents: Record<string, unknown>[],
): Record<string, unknown> {
  const aiHints: Record<string, unknown> = {};
  if (form.aiHints.prefer) aiHints.prefer = form.aiHints.prefer;
  if (form.aiHints.openWith !== undefined) aiHints.openWith = form.aiHints.openWith;
  if (form.aiHints.dontRepeatWhileActive) {
    aiHints.dontRepeatWhileActive = form.aiHints.dontRepeatWhileActive;
  }
  if (form.aiHints.onlyBelowHpPct !== undefined) {
    aiHints.onlyBelowHpPct = form.aiHints.onlyBelowHpPct;
  }

  const animation: Record<string, unknown> = { track: form.animation.track };
  if (form.animation.vfx) animation.vfx = form.animation.vfx;
  if (form.animation.projectile) animation.projectile = form.animation.projectile;
  if (form.animation.shake !== undefined) animation.shake = form.animation.shake;

  const targeting: Record<string, unknown> = {
    side: form.targeting.side,
    mode: form.targeting.mode,
  };
  if (form.targeting.mode === 'random' && form.targeting.count !== undefined) {
    targeting.count = form.targeting.count;
  }

  return {
    key: form.key,
    sortOrder: form.sortOrder,
    name: form.name,
    description: form.description,
    slot: form.slot,
    cooldown: form.cooldown,
    targeting,
    components: serializedComponents,
    upgrades: form.upgrades.map((upgrade) =>
      upgrade.effect === 'cooldown'
        ? { effect: 'cooldown', turns: 1 }
        : { effect: upgrade.effect, pct: upgrade.pct },
    ),
    aiHints,
    animation,
  };
}

/** Skill-level problems the *form* can check; component problems live in `inspectSkill`. */
export function validateSkillForm(form: SkillFormValues): string[] {
  const errors: string[] = [];
  if (form.name.trim().length === 0) errors.push('A skill needs a name.');
  if (form.name.length > 64) errors.push('Name is at most 64 characters.');
  if (form.description.length > 600) errors.push('Description is at most 600 characters.');
  if (form.cooldown < 0 || form.cooldown > 9) errors.push('Cooldown is 0–9 turns.');
  if (form.upgrades.length > 6) errors.push('At most six upgrade rungs.');
  if (form.targeting.mode === 'random') {
    const count = form.targeting.count ?? 0;
    if (count < 1 || count > 4) errors.push('Random targeting needs a count of 1–4.');
  }
  return errors;
}

export const SLOT_LABELS: Record<SkillSlot, string> = {
  a1: 'A1 — basic attack',
  a2: 'A2',
  a3: 'A3',
  a4: 'A4',
  passive: 'Passive',
};

export const UPGRADE_LABELS: Record<SkillUpgrade['effect'], string> = {
  damage: 'Damage +%',
  chance: 'Effect chance +%',
  cooldown: 'Cooldown −1 turn',
  heal: 'Healing +%',
  shield: 'Shield +%',
};

export { booleanOr };
