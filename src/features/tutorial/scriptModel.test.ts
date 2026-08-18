import { describe, expect, it } from 'vitest';
import type { ContentEntry } from '@/api/types';
import { moveStep, readScript, scriptProblems } from './scriptModel';

/**
 * The script editor's arithmetic.
 *
 * Two things are worth being sure about without a browser: that the order shown is the
 * order the game walks, and that a reorder produces a numbering the server will accept.
 * Everything else on the page is a table.
 */

const entry = (key: string, data: Record<string, unknown>): ContentEntry => ({
  key,
  state: 'live',
  updatedAt: null,
  updatedBy: null,
  data: { title: key, screen: 'haven', highlight: '', active: true, ...data },
});

const script = (...numbers: number[]): ContentEntry[] =>
  numbers.map((step, index) => entry(`tut_${index + 1}`, { step }));

describe('reading the script', () => {
  it('orders by step, whatever order the list arrived in', () => {
    const steps = readScript([
      entry('third', { step: 3 }),
      entry('first', { step: 1 }),
      entry('second', { step: 2 }),
    ]);
    expect(steps.map((step) => step.key)).toEqual(['first', 'second', 'third']);
  });

  it('pulls out what a row needs and nothing more', () => {
    const [step] = readScript([
      entry('tut_equip', {
        step: 5,
        title: 'What the road gave up',
        screen: 'relics',
        highlight: 'panel:relic-list',
        goal: { type: 'gearEquip', target: 1, filters: {} },
        rewards: { silver: 4000, playerXp: 60 },
        grantsRelics: [{ setKey: 'ironroot', slot: 'weapon', rank: 2, rarity: 'uncommon' }],
      }),
    ]);
    expect(step).toMatchObject({
      step: 5,
      screen: 'relics',
      highlight: 'panel:relic-list',
      goal: { type: 'gearEquip', target: 1 },
    });
    // Two rewards and a relic — what the row shows as "gives 3".
    expect(step?.gives).toBe(3);
  });

  it('calls a step with no goal a beat', () => {
    expect(readScript([entry('beat', { step: 1 })])[0]?.goal).toBeNull();
  });

  it('falls back to the key when a step has no title yet', () => {
    const [step] = readScript([{ ...entry('tut_new', { step: 1 }), data: { step: 1 } }]);
    expect(step?.title).toBe('tut_new');
  });
});

describe('what publish would refuse', () => {
  it('is quiet about a script numbered 1…n', () => {
    expect(scriptProblems(readScript(script(1, 2, 3)))).toEqual([]);
  });

  it('names a duplicate, and says why it matters', () => {
    const problems = scriptProblems(readScript(script(1, 2, 2)));
    expect(problems.some((problem) => /appears twice/.test(problem.message))).toBe(true);
    expect(problems.every((problem) => problem.severity === 'error')).toBe(true);
  });

  it('names the missing number rather than just "a gap"', () => {
    const problems = scriptProblems(readScript(script(1, 3, 4)));
    expect(problems.some((problem) => /Step 2 is missing/.test(problem.message))).toBe(true);
  });

  it('warns about a deactivated step without calling it an error', () => {
    const steps = readScript([entry('one', { step: 1 }), entry('two', { step: 2, active: false })]);
    const problems = scriptProblems(steps);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.severity).toBe('warning');
  });
});

describe('moving a step', () => {
  const steps = readScript(script(1, 2, 3));

  it('swaps two numbers rather than renumbering the rest', () => {
    // Two writes, not fifteen: a small draft and a readable publish diff.
    expect(moveStep(steps, 'tut_2', -1)).toEqual([
      { key: 'tut_2', step: 1 },
      { key: 'tut_1', step: 2 },
    ]);
  });

  it('moves down the same way', () => {
    expect(moveStep(steps, 'tut_1', 1)).toEqual([
      { key: 'tut_1', step: 2 },
      { key: 'tut_2', step: 1 },
    ]);
  });

  it('refuses to run off either end', () => {
    expect(moveStep(steps, 'tut_1', -1)).toEqual([]);
    expect(moveStep(steps, 'tut_3', 1)).toEqual([]);
  });

  it('says nothing about a step that is not in the script', () => {
    expect(moveStep(steps, 'nobody', 1)).toEqual([]);
  });

  it('leaves the numbering complete, whatever is moved', () => {
    for (const key of ['tut_1', 'tut_2', 'tut_3']) {
      for (const direction of [-1, 1] as const) {
        const writes = new Map(moveStep(steps, key, direction).map((w) => [w.key, w.step]));
        const after = steps.map((step) => writes.get(step.key) ?? step.step).sort();
        expect(after, `${key} ${direction}`).toEqual([1, 2, 3]);
      }
    }
  });
});
