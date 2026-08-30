import { describe, expect, it } from 'vitest';
import {
  MASTERY_EFFECT_TYPES,
  MASTERY_MAX_TIER,
  MAX_TREES,
  PICKS_BY_TIER,
  TOTAL_PICKS,
  board,
  boardProblems,
  effectSentence,
  hasSentence,
  type MasteryNodeLike,
} from './masteryBoard';

const node = (tree: string, tier: number, index: number): MasteryNodeLike => ({
  key: `${tree}_t${tier}_${index}`,
  name: `${tree} ${tier}.${index}`,
  tree,
  tier,
  effects: [{ type: 'stat', stat: 'atk', flat: 10 }],
});

const nodes = (perTree: number | Record<string, number>): MasteryNodeLike[] => {
  const out: MasteryNodeLike[] = [];
  for (const tree of ['onslaught', 'bulwark', 'insight']) {
    const count = typeof perTree === 'number' ? perTree : (perTree[tree] ?? 0);
    for (let tier = 1; tier <= MASTERY_MAX_TIER; tier += 1) {
      for (let index = 0; index < count; index += 1) out.push(node(tree, tier, index));
    }
  }
  return out;
};

/**
 * The rules are the server's, mirrored here because the Admin SPA does not depend on the
 * game's packages. Stating them out loud is the guard: a change on the server that is not
 * copied across fails this test's own arithmetic rather than shipping a board that flags
 * content the server accepts, or accepts content it refuses.
 */
describe('the spending rules', () => {
  it('is fifteen picks across at most two trees', () => {
    expect(PICKS_BY_TIER).toEqual([0, 2, 3, 3, 3, 3, 1]);
    expect(TOTAL_PICKS).toBe(15);
    expect(MAX_TREES).toBe(2);
  });
});

describe('board', () => {
  it('lays the nodes out as trees by tier', () => {
    const laid = board(nodes(2));
    expect(laid.map((tree) => tree.tree)).toEqual(['onslaught', 'bulwark', 'insight']);
    expect(laid[0]?.tiers).toHaveLength(6);
    expect(laid[0]?.tiers[0]?.nodes).toHaveLength(2);
    expect(laid[0]?.total).toBe(12);
  });

  it('keeps a tree the game has never heard of rather than dropping its nodes', () => {
    // A node authored into a fourth tree is content that exists; a board that silently
    // omitted it would be a screen lying about what is published.
    const laid = board([...nodes(1), node('resonance', 1, 0)]);
    expect(laid.map((tree) => tree.tree)).toContain('resonance');
  });

  it('is three empty columns for an empty board rather than nothing at all', () => {
    expect(board([])).toHaveLength(3);
  });
});

describe('boardProblems', () => {
  it('says nothing about a board every pair can fill', () => {
    expect(boardProblems(nodes(2))).toEqual([]);
  });

  it('names a tree missing a tier', () => {
    const list = nodes(2).filter((entry) => !(entry.tree === 'bulwark' && entry.tier === 4));
    const problems = boardProblems(list);
    expect(problems.some((entry) => entry.tree === 'bulwark' && entry.tier === 4)).toBe(true);
  });

  it('names a board no pair can fill, even with every tier populated', () => {
    const problems = boardProblems(nodes(1));
    const build = problems.find((entry) => entry.tree === null);
    expect(build?.message).toContain('No pair of trees');
    expect(build?.message).toContain('tier 2');
  });

  it('accepts a board where one pair fails, since the player picks the pair', () => {
    const problems = boardProblems(nodes({ onslaught: 1, bulwark: 1, insight: 3 }));
    expect(problems.filter((entry) => entry.tree === null)).toEqual([]);
  });

  it('says nothing at all about an empty board', () => {
    expect(boardProblems([])).toEqual([]);
  });
});

describe('effectSentence', () => {
  it('says what a stat node does in the words an operator thinks in', () => {
    expect(effectSentence({ type: 'stat', stat: 'atk', flat: 40 })).toBe('+40 ATK');
    expect(effectSentence({ type: 'stat', stat: 'critRate', pct: 5 })).toBe('+5% C.RATE');
    expect(effectSentence({ type: 'stat', stat: 'def', flat: 20, pct: 3 })).toBe(
      '+20 DEF and +3% DEF',
    );
    expect(effectSentence({ type: 'stat', stat: 'spd', flat: -5 })).toBe('-5 SPD');
  });

  it('has a written sentence for every kind the union carries', () => {
    // The guard that matters, and it took a restructure to make it honest: the first cut
    // was a switch with a fallback that appended figures, so deleting a case still produced
    // a plausible sentence and no test could tell. A lookup table can be *asked*.
    for (const type of MASTERY_EFFECT_TYPES) {
      expect(hasSentence(type), type).toBe(true);
    }
  });

  it('carries a condition into the sentence, in words rather than as a type name', () => {
    expect(
      effectSentence({
        type: 'damageDealt',
        pct: 12,
        condition: { type: 'targetHpBelow', pct: 50 },
      }),
    ).toBe('+12% damage dealt against a target below 50% HP');
    expect(
      effectSentence({
        type: 'stat',
        stat: 'atk',
        flat: 30,
        condition: { type: 'selfHasNoBuffs' },
      }),
    ).toBe('+30 ATK while carrying no buffs');
  });

  it('says the procs with their numbers', () => {
    expect(effectSentence({ type: 'lifesteal', pct: 8 })).toContain('8% of damage dealt');
    expect(effectSentence({ type: 'battleStartShield', pctMaxHp: 15, turns: 2 })).toContain(
      '15% of max HP for the first 2 turns',
    );
    expect(
      effectSentence({
        type: 'turnMeterProc',
        trigger: 'allyDied',
        chance: 0.5,
        pct: 15,
        target: 'team',
      }),
    ).toBe('50% chance of +15% turn meter to the team on ally died');
    expect(
      effectSentence({ type: 'bonusDamageMaxHp', chance: 0.15, pct: 12, bossPct: 3 }),
    ).toContain("12% of the target's max HP (3% against a boss)");
    expect(effectSentence({ type: 'lastStand' })).toContain('one lethal blow');
  });

  it('falls back to the kind and its figures rather than to silence', () => {
    // An effect the server adds after this file was written is invisible to the SPA, so
    // the fallback has to carry its numbers: a node that appears to do nothing is worse
    // than one worded awkwardly.
    expect(effectSentence({ type: 'lifebindAura', pct: 12, turns: 3 })).toBe(
      'lifebind aura (pct 12, turns 3)',
    );
  });
});
