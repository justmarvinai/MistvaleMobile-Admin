import { describe, expect, it } from 'vitest';
import { BASE_RANKS_BY_RARITY, defaultBaseRank, toChampionForm } from './schema';

/**
 * The champion form rebuilds the entity field by field, which means a field it does not
 * carry is a field a save silently deletes. `baseRank` — the star a champion is *called*
 * at — arrived with the game repo's C6 and would have been exactly that: opening any ★2
 * Common or ★3 Uncommon in the editor and pressing Save would have moved it down a star,
 * with no error anywhere, because the server reads an absent `baseRank` as the bottom of
 * the rarity's band.
 */
describe('toChampionForm', () => {
  it('keeps the star a champion was called at', () => {
    const form = toChampionForm({ rarity: 'common', baseRank: 2 }, 'sskarn_broodguard');
    expect(form.baseRank).toBe(2);
  });

  it('falls back to the bottom of the rarity band when nothing says otherwise', () => {
    expect(toChampionForm({ rarity: 'legendary' }, 'aureleth').baseRank).toBe(5);
    expect(toChampionForm({ rarity: 'epic' }, 'anuria').baseRank).toBe(4);
    expect(toChampionForm({ rarity: 'uncommon' }, 'thorn_adept').baseRank).toBe(2);
  });

  it('never invents a star outside the rarity band', () => {
    for (const [rarity, allowed] of Object.entries(BASE_RANKS_BY_RARITY)) {
      expect(allowed).toContain(defaultBaseRank(rarity));
    }
  });
});
