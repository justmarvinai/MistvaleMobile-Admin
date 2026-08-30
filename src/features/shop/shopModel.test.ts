import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_LEVEL_CAP,
  levelBands,
  unreachableOffers,
  windowCost,
  windowsPerDay,
  type ShopLike,
  type ShopOfferLike,
} from './shopModel';

const offer = (over: Partial<ShopOfferLike> & { key: string }): ShopOfferLike => ({
  name: over.key,
  kind: 'item',
  weight: 10,
  currency: 'silver',
  price: 100,
  minAccountLevel: 1,
  dailyLimit: 0,
  ...over,
});

const shop = (offers: ShopOfferLike[], over: Partial<ShopLike> = {}): ShopLike => ({
  key: 'bazaar',
  name: 'Bazaar',
  restockMinutes: 60,
  baseSlots: 4,
  crystalSlots: 4,
  crystalSlotCost: 150,
  refreshCost: 50,
  offers,
  ...over,
});

describe('levelBands', () => {
  it('is one band per level at which the contents change', () => {
    const bands = levelBands(
      shop([
        offer({ key: 'a' }),
        offer({ key: 'b', minAccountLevel: 10 }),
        offer({ key: 'c', minAccountLevel: 10 }),
      ]),
    );
    expect(bands.map((band) => band.level)).toEqual([1, 10]);
    expect(bands[0]?.offers.map((entry) => entry.key)).toEqual(['a']);
    expect(bands[1]?.offers.map((entry) => entry.key)).toEqual(['a', 'b', 'c']);
  });

  it('shares a slot by weight within the band', () => {
    const bands = levelBands(
      shop([offer({ key: 'a', weight: 30 }), offer({ key: 'b', weight: 10 })]),
    );
    expect(bands[0]?.offers.map((entry) => entry.share)).toEqual([0.75, 0.25]);
    expect(bands[0]?.totalWeight).toBe(40);
  });

  it('recomputes the shares each band, because a gate changes the denominator', () => {
    // The whole reason bands exist: adding one gated offer moves the odds of everything a
    // player below that level sees — which no field-by-field view can show.
    const bands = levelBands(
      shop([offer({ key: 'a', weight: 10 }), offer({ key: 'b', weight: 10, minAccountLevel: 20 })]),
    );
    expect(bands[0]?.offers[0]?.share).toBe(1);
    expect(bands[1]?.offers[0]?.share).toBe(0.5);
  });

  it('shares a wholly weightless pool evenly, the way the server picks from one', () => {
    const bands = levelBands(
      shop([offer({ key: 'a', weight: 0 }), offer({ key: 'b', weight: 0 })]),
    );
    expect(bands[0]?.offers.map((entry) => entry.share)).toEqual([0.5, 0.5]);
  });

  it('treats a negative weight as zero, as the server does', () => {
    const bands = levelBands(
      shop([offer({ key: 'a', weight: -5 }), offer({ key: 'b', weight: 10 })]),
    );
    expect(bands[0]?.totalWeight).toBe(10);
    expect(bands[0]?.offers[0]?.share).toBe(0);
  });

  it('flags a band with fewer offers than the window has slots', () => {
    const bands = levelBands(shop([offer({ key: 'a' }), offer({ key: 'b', minAccountLevel: 10 })]));
    // At level 1 there is one offer for four slots, so three of them repeat it.
    expect(bands[0]?.repeats).toBe(true);
    expect(bands[1]?.repeats).toBe(true);
    expect(levelBands(shop([offer({ key: 'a' })]), 1)[0]?.repeats).toBe(false);
  });

  it('leaves out a band no account can reach', () => {
    const bands = levelBands(
      shop([offer({ key: 'a' }), offer({ key: 'b', minAccountLevel: ACCOUNT_LEVEL_CAP + 1 })]),
    );
    expect(bands.map((band) => band.level)).toEqual([1]);
  });
});

describe('unreachableOffers', () => {
  it('names an offer weighted zero beside offers that are not', () => {
    const found = unreachableOffers(shop([offer({ key: 'a', weight: 0 }), offer({ key: 'b' })]));
    expect(found.map((entry) => entry.key)).toEqual(['a']);
    expect(found[0]?.reason).toContain('never be drawn');
  });

  it('leaves a wholly weightless shop alone — it is picked from uniformly', () => {
    expect(
      unreachableOffers(shop([offer({ key: 'a', weight: 0 }), offer({ key: 'b', weight: 0 })])),
    ).toEqual([]);
  });

  it('names a level gate above the cap', () => {
    const found = unreachableOffers(shop([offer({ key: 'a', minAccountLevel: 99 })]));
    expect(found[0]?.reason).toContain('the cap is 60');
  });

  it('judges a weight against its own band rather than the whole shop', () => {
    // `b` is weightless but so is everything a level-1 player can see, so at that band it
    // is picked uniformly. Reading the whole shop's weights would have called it dead.
    const found = unreachableOffers(
      shop([
        offer({ key: 'b', weight: 0 }),
        offer({ key: 'late', weight: 50, minAccountLevel: 30 }),
      ]),
    );
    expect(found).toEqual([]);
  });
});

describe('windowCost', () => {
  it('reports a range per currency', () => {
    const [band] = levelBands(
      shop([
        offer({ key: 'a', price: 100 }),
        offer({ key: 'b', price: 900 }),
        offer({ key: 'c', price: 20, currency: 'crystals' }),
      ]),
    );
    expect(windowCost(band!)).toEqual([
      { currency: 'crystals', min: 20, max: 20 },
      { currency: 'silver', min: 100, max: 900 },
    ]);
  });
});

describe('windowsPerDay', () => {
  it('turns a restock timer into the number a limit is felt as', () => {
    expect(windowsPerDay(60)).toBe(24);
    expect(windowsPerDay(1440)).toBe(1);
    expect(windowsPerDay(0)).toBe(0);
  });
});
