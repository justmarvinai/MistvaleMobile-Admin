import { describe, expect, it } from 'vitest';
import type { EffectComponent } from '@/api/types';
import {
  addComponent,
  changeComponentType,
  defaultComponent,
  describeComponent,
  inspectSkill,
  moveComponent,
  removeComponent,
  resolveDescription,
  serializeComponent,
  serializeComponents,
  updateComponent,
} from './components';
import { toComponents } from './schema';

/**
 * The composer's real contract: what the component list becomes after each edit, and
 * exactly which fields reach the server. Both matter because the engine reads
 * `components` positionally and switches on `type` — a stray field or a lost reorder is
 * a live bug, not a cosmetic one.
 */

const damage: EffectComponent = { type: 'damage', scale: 'atk', mult: 3.2, hits: 2 };
const poison: EffectComponent = {
  type: 'applyStatus',
  status: 'poison',
  turns: 2,
  target: 'hitTargets',
  chance: 0.75,
};
const heal: EffectComponent = { type: 'heal', scale: 'maxHp', mult: 0.2, target: 'allAllies' };

describe('adding and removing components', () => {
  it('appends a valid default for every component type', () => {
    const types = [
      'damage',
      'applyStatus',
      'heal',
      'shield',
      'turnMeter',
      'cleanse',
      'dispel',
      'extraTurn',
      'cooldown',
    ] as const;

    for (const type of types) {
      const created = defaultComponent(type);
      expect(created.type).toBe(type);
      // Every default must already satisfy the server's schema, so "add then save"
      // never lands the operator in a validation wall.
      expect(serializeComponent(created).type).toBe(type);
    }
  });

  it('appends to the end so the newest component runs last', () => {
    const result = addComponent([damage], 'applyStatus');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(damage);
    expect(result[1]?.type).toBe('applyStatus');
  });

  it('does not mutate the list it was given', () => {
    const original = [damage];
    addComponent(original, 'heal');
    expect(original).toHaveLength(1);
  });

  it('removes by index and leaves the rest in order', () => {
    expect(removeComponent([damage, poison, heal], 1)).toEqual([damage, heal]);
  });

  it('ignores an out-of-range removal rather than dropping a component', () => {
    const list = [damage, poison];
    expect(removeComponent(list, 5)).toEqual(list);
    expect(removeComponent(list, -1)).toEqual(list);
  });
});

describe('reordering components', () => {
  it('moves a component up', () => {
    expect(moveComponent([damage, poison, heal], 2, 1)).toEqual([damage, heal, poison]);
  });

  it('moves a component down', () => {
    expect(moveComponent([damage, poison, heal], 0, 2)).toEqual([poison, heal, damage]);
  });

  it('leaves the list untouched for a no-op or out-of-range move', () => {
    const list = [damage, poison];
    expect(moveComponent(list, 0, 0)).toEqual(list);
    expect(moveComponent(list, 0, 9)).toEqual(list);
    expect(moveComponent(list, -1, 0)).toEqual(list);
  });

  it('preserves every component through a round trip of moves', () => {
    const list = [damage, poison, heal];
    const moved = moveComponent(moveComponent(list, 0, 2), 2, 0);
    expect(moved).toEqual(list);
  });
});

describe('retyping a component', () => {
  it('carries chance and condition across the type change', () => {
    const gated: EffectComponent = {
      type: 'applyStatus',
      status: 'poison',
      turns: 3,
      target: 'hitTargets',
      chance: 0.5,
      condition: { type: 'targetHpBelow', pct: 40 },
    };

    const [retyped] = changeComponentType([gated], 0, 'damage');
    expect(retyped?.type).toBe('damage');
    expect(retyped?.chance).toBe(0.5);
    expect(retyped?.condition).toEqual({ type: 'targetHpBelow', pct: 40 });
  });

  it('keeps the target when both types accept one', () => {
    const [retyped] = changeComponentType([heal], 0, 'shield');
    expect(retyped).toMatchObject({ type: 'shield', target: 'allAllies' });
  });

  it('drops fields that do not exist on the new type', () => {
    const [retyped] = changeComponentType([poison], 0, 'extraTurn');
    expect(retyped).toBeDefined();
    // `status` and `turns` are meaningless on extraTurn; leaving them would show up as
    // a phantom field change in the publish diff.
    expect(serializeComponent(retyped as EffectComponent)).toEqual({
      type: 'extraTurn',
      chance: 0.75,
    });
  });

  it('is a no-op when the type is unchanged', () => {
    const list = [damage];
    expect(changeComponentType(list, 0, 'damage')).toBe(list);
  });
});

describe('updating a component', () => {
  it('replaces only the targeted index', () => {
    const updated = updateComponent([damage, poison], 1, { ...poison, turns: 4 });
    expect(updated[0]).toEqual(damage);
    expect(updated[1]).toMatchObject({ turns: 4 });
  });
});

describe('serialization', () => {
  it('writes exactly the fields the server schema accepts', () => {
    expect(serializeComponent(damage)).toEqual({
      type: 'damage',
      scale: 'atk',
      mult: 3.2,
      hits: 2,
    });
  });

  it('omits optional fields that were never set', () => {
    const serialized = serializeComponent(damage);
    expect(serialized).not.toHaveProperty('ignoreDefPct');
    expect(serialized).not.toHaveProperty('element');
    expect(serialized).not.toHaveProperty('chance');
    expect(serialized).not.toHaveProperty('condition');
  });

  it('includes optional fields once they are set', () => {
    const pierce: EffectComponent = { ...damage, ignoreDefPct: 0.5, element: 'ember' };
    expect(serializeComponent(pierce)).toMatchObject({ ignoreDefPct: 0.5, element: 'ember' });
  });

  it('drops a status that has not been chosen yet', () => {
    const blank: EffectComponent = {
      type: 'applyStatus',
      status: '',
      turns: 2,
      target: 'hitTargets',
    };
    expect(serializeComponent(blank)).not.toHaveProperty('status');
  });

  it('keeps "all" as a literal for cleanse and dispel counts', () => {
    const cleanse: EffectComponent = { type: 'cleanse', count: 'all', target: 'allAllies' };
    expect(serializeComponent(cleanse)).toMatchObject({ count: 'all' });
  });

  it('serializes a whole list in order', () => {
    const serialized = serializeComponents([damage, poison, heal]);
    expect(serialized.map((component) => component.type)).toEqual([
      'damage',
      'applyStatus',
      'heal',
    ]);
  });

  it('round-trips through the parser without drift', () => {
    const original = [damage, poison, heal];
    const reparsed = toComponents(serializeComponents(original));
    expect(reparsed).toEqual(original);
  });

  it('round-trips a component carrying a condition', () => {
    const gated: EffectComponent = {
      type: 'turnMeter',
      deltaPct: -30,
      target: 'allEnemies',
      condition: { type: 'alliesDead', atLeast: 2 },
      chance: 0.4,
    };
    expect(toComponents(serializeComponents([gated]))).toEqual([gated]);
  });

  it('drops component types the editor does not know', () => {
    // Only a newer server could produce one; writing it back half-parsed would be worse
    // than losing it visibly.
    expect(toComponents([{ type: 'summonAlly', count: 2 }, damage])).toEqual([damage]);
  });
});

describe('component summaries', () => {
  it('describes a multi-hit damage component with its multiplier', () => {
    expect(describeComponent(damage)).toBe('2 × 3.2 × ATK');
  });

  it('shows the chance when a component is not guaranteed', () => {
    expect(describeComponent(poison)).toContain('75%');
  });

  it('names the status a component applies', () => {
    expect(describeComponent(poison)).toContain('poison');
  });
});

describe('description templating', () => {
  const components = [damage, poison];

  it('fills {dmg} from the damage component', () => {
    expect(resolveDescription('Attacks for {dmg}.', components)).toBe('Attacks for 2 × 3.2 × ATK.');
  });

  it('fills {chance} and {turns} from the first component that carries them', () => {
    expect(resolveDescription('{chance} chance to poison for {turns} turns.', components)).toBe(
      '75% chance to poison for 2 turns.',
    );
  });

  it('leaves a placeholder in place when nothing can fill it', () => {
    // Better a visible `{dmg}` than silently rendering nothing — the operator must be
    // able to see which placeholder has no source.
    expect(resolveDescription('Deals {dmg}.', [heal])).toBe('Deals {dmg}.');
  });
});

describe('validation mirroring the server', () => {
  const known = new Set(['poison', 'atk_up']);

  it('rejects an empty component list', () => {
    const issues = inspectSkill({
      slot: 'a2',
      cooldown: 3,
      components: [],
      knownStatusKeys: known,
    });
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        message: expect.stringContaining('at least one'),
      }),
    );
  });

  it('rejects a status key that does not exist', () => {
    const issues = inspectSkill({
      slot: 'a2',
      cooldown: 3,
      components: [{ type: 'applyStatus', status: 'nonexistent', turns: 2, target: 'hitTargets' }],
      knownStatusKeys: known,
    });
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: 'error',
        index: 0,
        message: expect.stringContaining('nonexistent'),
      }),
    );
  });

  it('accepts a status key that does exist', () => {
    const issues = inspectSkill({
      slot: 'a2',
      cooldown: 3,
      components: [poison],
      knownStatusKeys: known,
    });
    expect(issues.filter((issue) => issue.severity === 'error')).toHaveLength(0);
  });

  it('rejects an A1 with a cooldown', () => {
    const issues = inspectSkill({
      slot: 'a1',
      cooldown: 2,
      components: [damage],
      knownStatusKeys: known,
    });
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: 'error', message: 'A1 skills must have no cooldown.' }),
    );
  });

  it('warns about an active skill with no cooldown, without blocking it', () => {
    const issues = inspectSkill({
      slot: 'a3',
      cooldown: 0,
      components: [damage],
      knownStatusKeys: known,
    });
    expect(issues.filter((issue) => issue.severity === 'error')).toHaveLength(0);
    expect(issues).toContainEqual(expect.objectContaining({ severity: 'warning' }));
  });

  it('leaves a valid A1 with no issues at all', () => {
    expect(
      inspectSkill({ slot: 'a1', cooldown: 0, components: [damage], knownStatusKeys: known }),
    ).toEqual([]);
  });
});
