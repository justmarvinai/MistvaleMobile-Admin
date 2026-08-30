import { describe, expect, it } from 'vitest';
import type { ContentEntry } from '@/api/types';
import { flatten, placeNames, stageOptions } from './stageOptions';

function entry(key: string, data: Record<string, unknown>): ContentEntry {
  return { key, data, state: 'live', updatedAt: null, updatedBy: null };
}

const names = placeNames(
  [entry('chapter_01', { name: 'Veilwood Fringe', number: 1 })],
  [entry('keep_ember', { name: 'Emberhold' })],
);

describe('placeNames', () => {
  it('names a chapter and a keep alike', () => {
    expect(names.get('chapter_01')).toEqual({ name: 'Veilwood Fringe', number: 1 });
    // A keep is not numbered, and a floor is said as "Emberhold · 3" rather than "0-3".
    expect(names.get('keep_ember')).toEqual({ name: 'Emberhold', number: null });
  });

  it('falls back to the key rather than to nothing', () => {
    // A place whose name has been emptied in the editor still has to be pickable — an
    // option with a blank label is one nobody can find.
    const bare = placeNames([entry('chapter_09', { name: '' })], []);
    expect(bare.get('chapter_09')?.name).toBe('chapter_09');
  });
});

describe('stageOptions', () => {
  const stages = [
    entry('c01_s2_normal', { mode: 'campaign', parentKey: 'chapter_01', number: 2 }),
    entry('c01_s1_hard', {
      mode: 'campaign',
      parentKey: 'chapter_01',
      number: 1,
      difficulty: 'hard',
    }),
    entry('c01_s1_normal', { mode: 'campaign', parentKey: 'chapter_01', number: 1 }),
    entry('ember_f1', { mode: 'dungeon', parentKey: 'keep_ember', number: 1 }),
  ];

  it('labels a stage by the place a player would say, and by its key', () => {
    // Both, because the two answer different questions: an operator who came from the
    // entity browser has a key in hand, and one who came from a bug report has "1-1".
    const options = flatten(stageOptions(stages, names));
    const first = options.find((option) => option.value === 'c01_s1_normal');
    expect(first?.label).toContain('Veilwood Fringe');
    expect(first?.label).toContain('c01_s1_normal');
  });

  it('names the difficulty only when it is not the default', () => {
    // Asserted on the *human* half of the label rather than the whole of it: every normal
    // stage's key ends in `_normal`, so a `toContain` over the label would pass for a
    // reason that has nothing to do with the rule.
    const options = flatten(stageOptions(stages, names));
    const said = (key: string): string =>
      (options.find((option) => option.value === key)?.label ?? '').split(' — ')[0] ?? '';
    expect(said('c01_s1_normal')).toBe('Veilwood Fringe 1-1');
    expect(said('c01_s1_hard')).toBe('Veilwood Fringe 1-1 · hard');
  });

  it('says a keep floor by its keep, since a keep has no chapter number', () => {
    const options = flatten(stageOptions(stages, names));
    expect(options.find((option) => option.value === 'ember_f1')?.label).toContain('Emberhold · 1');
  });

  it('groups by place and orders within it by difficulty then number', () => {
    const groups = stageOptions(stages, names);
    expect(groups.map((entry) => entry.group)).toEqual(['Emberhold', 'Veilwood Fringe']);
    expect(flatten(groups).map((option) => option.value)).toEqual([
      'ember_f1',
      'c01_s1_hard',
      'c01_s1_normal',
      'c01_s2_normal',
    ]);
  });

  it('survives a stage whose fields are not what the schema promises', () => {
    // The list comes from the content endpoint as `unknown` data, and a draft can hold
    // anything an operator typed. An option that throws is a picker that will not open.
    const odd = flatten(stageOptions([entry('odd', { mode: 42, parentKey: null })], names));
    expect(odd).toHaveLength(1);
    expect(odd[0]!.value).toBe('odd');
  });
});
