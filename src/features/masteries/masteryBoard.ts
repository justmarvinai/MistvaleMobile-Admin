/**
 * The mastery board, read as a board (ADMIN_SUITE_DESIGN §2.12).
 *
 * Forty-eight nodes over three trees and six tiers, and the generic browser shows them as
 * forty-eight rows in key order. Two things are invisible there and both decide whether the
 * content works: **what a node actually does** — the effect is a discriminated union nested
 * inside an array inside the entity, so a JSON form shows `{"type":"stat","stat":"atk",…}`
 * where the operator is thinking "+40 attack" — and **whether the board can be spent**.
 *
 * The spending rules are the server's own (`@mistvale/shared`'s `MASTERY_PICKS_BY_TIER`,
 * `MASTERY_MAX_TREES`), which is why the numbers are duplicated here as constants rather
 * than imported: the Admin SPA does not depend on the game's packages, and `api/types.test`
 * checks the runtime lists it does mirror against the generated artifact. These are rules
 * rather than content, so the honest guard is a test that states them out loud.
 */

export const MASTERY_TREES = ['onslaught', 'bulwark', 'insight'] as const;
export type MasteryTree = (typeof MASTERY_TREES)[number];

export const TREE_LABEL: Readonly<Record<MasteryTree, string>> = {
  onslaught: 'Onslaught',
  bulwark: 'Bulwark',
  insight: 'Insight',
};

export const MASTERY_MIN_TIER = 1;
export const MASTERY_MAX_TIER = 6;

/** How many picks each tier allows, across both open trees. Index 0 is unused. */
export const PICKS_BY_TIER: readonly number[] = [0, 2, 3, 3, 3, 3, 1];
export const TOTAL_PICKS = PICKS_BY_TIER.reduce((sum, count) => sum + count, 0);
export const MAX_TREES = 2;

export interface MasteryEffectLike {
  type: string;
  [field: string]: unknown;
}

export interface MasteryNodeLike {
  key: string;
  name: string;
  description?: string;
  tree: string;
  tier: number;
  effects: MasteryEffectLike[];
}

export interface BoardCell {
  tier: number;
  nodes: MasteryNodeLike[];
}

export interface BoardTree {
  tree: string;
  label: string;
  tiers: BoardCell[];
  total: number;
}

/** The published nodes laid out as three columns of six tiers. */
export function board(nodes: readonly MasteryNodeLike[]): BoardTree[] {
  const trees = [...new Set([...MASTERY_TREES, ...nodes.map((node) => node.tree)])];
  return trees.map((tree) => {
    const mine = nodes.filter((node) => node.tree === tree);
    return {
      tree,
      label: (TREE_LABEL as Record<string, string>)[tree] ?? tree,
      total: mine.length,
      tiers: Array.from({ length: MASTERY_MAX_TIER }, (_, index) => ({
        tier: index + MASTERY_MIN_TIER,
        nodes: mine
          .filter((node) => node.tier === index + MASTERY_MIN_TIER)
          .sort((a, b) => a.key.localeCompare(b.key)),
      })),
    };
  });
}

export interface BoardProblem {
  tree: string | null;
  tier: number | null;
  message: string;
}

/**
 * What the board gets wrong that publish refuses — said here, while it can still be fixed.
 *
 * Two rules, and the second is the one nobody can see. A tree missing a tier is a dead end.
 * But a board can hold a node at every tier of every tree and still **strand every build in
 * the game**: the budget is fifteen picks with a hard allowance per tier and a champion may
 * open at most two trees, so if no pair supplies a tier's allowance nobody ever finishes a
 * board — a permanent, silent shortfall with nothing on screen to explain it.
 *
 * One workable pair is the bar, because the player chooses the pair. Requiring every pair
 * to work would refuse content that is merely specialised.
 */
export function boardProblems(nodes: readonly MasteryNodeLike[]): BoardProblem[] {
  if (nodes.length === 0) return [];
  const out: BoardProblem[] = [];
  const at = (tree: string, tier: number): number =>
    nodes.filter((node) => node.tree === tree && node.tier === tier).length;

  for (const tree of MASTERY_TREES) {
    for (let tier = MASTERY_MIN_TIER; tier <= MASTERY_MAX_TIER; tier += 1) {
      if (at(tree, tier) > 0) continue;
      out.push({
        tree,
        tier,
        message: `No tier ${tier} node — a champion training ${TREE_LABEL[tree]} hits a dead end here.`,
      });
    }
  }

  const pairs: [MasteryTree, MasteryTree][] = [];
  for (let a = 0; a < MASTERY_TREES.length; a += 1) {
    for (let b = a + 1; b < MASTERY_TREES.length; b += 1) {
      pairs.push([MASTERY_TREES[a]!, MASTERY_TREES[b]!]);
    }
  }
  const shortfall = (pair: [MasteryTree, MasteryTree]): { tier: number; held: number } | null => {
    for (let tier = MASTERY_MIN_TIER; tier <= MASTERY_MAX_TIER; tier += 1) {
      const held = at(pair[0], tier) + at(pair[1], tier);
      if (held < (PICKS_BY_TIER[tier] ?? 0)) return { tier, held };
    }
    return null;
  };
  if (pairs.every((pair) => shortfall(pair) !== null)) {
    const first = shortfall(pairs[0]!);
    out.push({
      tree: null,
      tier: first?.tier ?? null,
      message:
        `No pair of trees can fill a ${TOTAL_PICKS}-pick build — every pair runs out at ` +
        `tier ${first?.tier ?? 1}, which allows ${PICKS_BY_TIER[first?.tier ?? 1] ?? 0} picks ` +
        `against ${first?.held ?? 0} published. Publish refuses this.`,
    });
  }

  return out;
}

const STAT_LABEL: Readonly<Record<string, string>> = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  spd: 'SPD',
  critRate: 'C.RATE',
  critDmg: 'C.DMG',
  res: 'RES',
  acc: 'ACC',
};

/**
 * Every effect kind the mastery union carries, at the time this was written.
 *
 * Listed so a test can assert that each one has a sentence rather than falling through —
 * the SPA cannot import the server's union, so the guard is this list plus a test that
 * walks it. A kind the server adds later is invisible to both, which is exactly why the
 * fallback below prints the kind *and its numbers* instead of nothing: an unknown effect
 * reads awkwardly and still says what it does, where a silent one makes a node look inert.
 */
export const MASTERY_EFFECT_TYPES = [
  'stat',
  'damageDealt',
  'damageTaken',
  'lifesteal',
  'onKill',
  'battleStartShield',
  'cooldownProc',
  'healing',
  'redirect',
  'counterProc',
  'counterDamage',
  'protectionBonus',
  'cleanseProc',
  'turnMeterProc',
  'debuffChance',
  'setBonusAmplify',
  'a1Ramp',
  'firstStrike',
  'statusDuration',
  'bonusDamageMaxHp',
  'lastStand',
] as const;

const num = (effect: MasteryEffectLike, field: string): number => {
  const value = effect[field];
  return typeof value === 'number' ? value : 0;
};
const str = (effect: MasteryEffectLike, field: string): string => {
  const value = effect[field];
  return typeof value === 'string' ? value : '';
};
const flag = (effect: MasteryEffectLike, field: string): boolean => effect[field] === true;

const signed = (value: number): string => (value > 0 ? `+${value}` : String(value));
const chance = (value: number): string => `${Math.round(value * 100)}%`;

/** `shieldReceived` -> `shield received`; `damageDealt` -> `damage dealt`. */
function spaced(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
}

/**
 * A condition, as the clause that goes on the end of a sentence.
 *
 * Separate from the effect because several kinds carry one and the phrasing has to read the
 * same wherever it lands.
 */
export function conditionClause(condition: unknown): string {
  if (!condition || typeof condition !== 'object') return '';
  const rule = condition as MasteryEffectLike;
  switch (rule.type) {
    case 'targetShielded':
      return ' against a shielded target';
    case 'targetCrowdControlled':
      return ' against a stunned, frozen, sleeping or provoked target';
    case 'targetHpBelow':
      return ` against a target below ${num(rule, 'pct')}% HP`;
    case 'targetMaxHpAbove':
      return ' against a target with more maximum HP';
    case 'selfHpBelow':
      return ` while below ${num(rule, 'pct')}% HP`;
    case 'perOwnDebuff':
      return ` per debuff carried, up to ${num(rule, 'maxStacks')}`;
    case 'perLivingEnemy':
      return ` per living enemy, up to ${num(rule, 'maxStacks')}`;
    case 'selfHasNoBuffs':
      return ' while carrying no buffs';
    case 'aoeSkill':
      return ' from a skill that hit more than one target';
    case 'mode':
      return ` in the ${str(rule, 'mode') || 'named'} only`;
    default:
      return ` when ${spaced(String(rule.type ?? ''))}`;
  }
}

/**
 * One sentence per effect kind, as a lookup rather than a switch.
 *
 * A table because it is *checkable*: a test can walk `MASTERY_EFFECT_TYPES` and assert
 * every kind has an entry here, which a `switch` cannot be asked. That guard is the whole
 * reason for the shape — the first cut was a switch with a fallback that appended figures,
 * so deleting a case still produced a plausible sentence and no test could tell.
 */
const SENTENCES: Readonly<Record<string, (effect: MasteryEffectLike) => string>> = {
  stat: (effect) => {
    const parts: string[] = [];
    if (num(effect, 'flat')) parts.push(`${signed(num(effect, 'flat'))} ${statOf(effect)}`);
    if (num(effect, 'pct')) parts.push(`${signed(num(effect, 'pct'))}% ${statOf(effect)}`);
    return parts.join(' and ') || `${statOf(effect)} unchanged`;
  },
  damageDealt: (effect) => `${signed(num(effect, 'pct'))}% damage dealt`,
  damageTaken: (effect) => `${signed(num(effect, 'pct'))}% damage taken`,
  lifesteal: (effect) => `Heals for ${num(effect, 'pct')}% of damage dealt`,
  onKill: (effect) =>
    str(effect, 'stat')
      ? `On a kill: ${signed(num(effect, 'flat'))} ${statOf(effect)}, stacking to ${num(effect, 'maxStacks') || 1}`
      : `On a kill: a shield worth ${num(effect, 'shieldPctMaxHp')}% of max HP`,
  battleStartShield: (effect) =>
    `A shield worth ${num(effect, 'pctMaxHp')}% of max HP for the first ${num(effect, 'turns')} turns`,
  cooldownProc: (effect) =>
    `${chance(num(effect, 'chance'))} chance to cut a random cooldown by a turn, on a hit costing ${num(effect, 'minDamagePctMaxHp')}% of the target's max HP`,
  healing: (effect) =>
    `${signed(num(effect, 'pct'))}% healing ${spaced(str(effect, 'mode'))}`.trim(),
  redirect: (effect) => `Takes ${num(effect, 'pct')}% of the damage aimed at allies`,
  counterProc: (effect) =>
    str(effect, 'trigger') === 'heavyHit'
      ? `${chance(num(effect, 'chance'))} chance to counterattack a blow costing ${num(effect, 'hpLostPct')}% of max HP`
      : `${chance(num(effect, 'chance'))} chance to counterattack when an ally is crowd-controlled`,
  counterDamage: (effect) => `${signed(num(effect, 'pct'))}% counterattack damage`,
  protectionBonus: (effect) =>
    `${signed(num(effect, 'pct'))}% to shields and to damage taken for allies`,
  cleanseProc: (effect) =>
    `${chance(num(effect, 'chance'))} chance to cleanse ${num(effect, 'count') || 1} debuff${num(effect, 'count') === 1 ? '' : 's'} each turn`,
  turnMeterProc: (effect) => {
    const target = str(effect, 'target') === 'team' ? 'the team' : 'self';
    const threshold =
      str(effect, 'trigger') === 'debuffsLandedInTurn'
        ? ` (${num(effect, 'threshold') || 1} in a turn)`
        : '';
    return `${chance(num(effect, 'chance'))} chance of ${signed(num(effect, 'pct'))}% turn meter to ${target} on ${spaced(str(effect, 'trigger'))}${threshold}`;
  },
  debuffChance: (effect) =>
    `${signed(num(effect, 'pct'))}% chance debuffs land${flag(effect, 'hardCcOnly') ? ' (hard crowd control only)' : ''}`,
  setBonusAmplify: (effect) =>
    `${signed(num(effect, 'pct'))}% to every relic set bonus this champion is getting`,
  a1Ramp: (effect) =>
    `Repeated A1 ramps ${num(effect, 'pctPerUse')}% a use, up to ${num(effect, 'maxPct')}%`,
  firstStrike: (effect) =>
    `Drains ${num(effect, 'pct')}% turn meter the first time the A1 reaches a target`,
  statusDuration: (effect) =>
    `${chance(num(effect, 'chance'))} chance to extend ${str(effect, 'mode') === 'allyBuffs' ? 'ally buffs' : 'own debuffs'} by ${num(effect, 'turns') || 1} turn${num(effect, 'turns') === 1 ? '' : 's'}${flag(effect, 'excludeHardCc') ? ', hard crowd control excluded' : ''}`,
  bonusDamageMaxHp: (effect) =>
    `${chance(num(effect, 'chance'))} chance of bonus damage worth ${num(effect, 'pct')}% of the target's max HP (${num(effect, 'bossPct')}% against a boss)`,
  lastStand: () => 'Survives one lethal blow a battle at 1 HP',
};

/** True where this kind has a written sentence rather than the generic fallback. */
export function hasSentence(type: string): boolean {
  return type in SENTENCES;
}

function statOf(effect: MasteryEffectLike): string {
  const key = str(effect, 'stat');
  return key ? (STAT_LABEL[key] ?? key.toUpperCase()) : '';
}

/**
 * One effect, in the words an operator is already thinking in.
 *
 * The nested union is the reason: a JSON form shows the shape and the screen has to show
 * the meaning — `{"type":"stat","stat":"atk","flat":40}` where the operator is thinking
 * "+40 attack".
 */
export function effectSentence(effect: MasteryEffectLike): string {
  const written = SENTENCES[effect.type];
  const when = conditionClause(effect.condition);
  if (written) return `${written(effect)}${when}`;

  // Never silent: an effect kind added on the server after this file was written must
  // still say its own name and its figures, or a node reads as doing nothing at all.
  const figures = Object.entries(effect)
    .filter(([field, value]) => field !== 'type' && typeof value === 'number')
    .map(([field, value]) => `${spaced(field)} ${String(value)}`);
  return `${spaced(String(effect.type))}${figures.length > 0 ? ` (${figures.join(', ')})` : ''}${when}`;
}
