import { describe, expect, it } from 'vitest';
import { share } from './ActivityPanel';

/**
 * The one piece of arithmetic on the activity panel.
 *
 * A rarity share on a week with no pulls is the case worth pinning: `0/0` is `NaN`, and a
 * dashboard reading "NaN%" is worse than one reading nothing at all.
 */
describe('share', () => {
  it('reads a part of a whole as a percentage', () => {
    expect(share(1, 4)).toBe('25%');
    expect(share(3, 3)).toBe('100%');
  });

  it('says nothing rather than NaN when there is no whole', () => {
    expect(share(0, 0)).toBe('—');
    expect(share(5, 0)).toBe('—');
  });

  it('rounds rather than printing a fraction of a per cent', () => {
    expect(share(1, 3)).toBe('33%');
  });
});
