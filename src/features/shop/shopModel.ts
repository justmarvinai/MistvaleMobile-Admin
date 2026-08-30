/**
 * What a shop's numbers actually mean (ADMIN_SUITE_DESIGN §2.9).
 *
 * A shop is a list of offers with a `weight` and a `minAccountLevel`, and neither field
 * says anything on its own — a weight is relative to the others and a level gate changes
 * the pool the weights are relative *to*. So the generic browser can show every field of
 * the Bazaar correctly and still leave an operator unable to answer the only two questions
 * they ever have: how often does this show up, and who can see it.
 *
 * Everything here is exact arithmetic on the published content, and where an exact answer
 * does not exist it is not offered. In particular **there is no "chance of appearing in
 * this window"**: the server stocks a window weighted *without replacement*
 * (`modules/shop/service.ts`), so the probability that an offer lands in one of eight
 * slots has no closed form, and a plausible-looking `1 - (1 - p)^n` here would be a number
 * that disagrees with the game. What is reported is the share of **one** slot, which is
 * precisely what a weight is.
 */

export interface ShopOfferLike {
  key: string;
  name: string;
  kind: string;
  weight: number;
  currency: string;
  price: number;
  pricePerRank?: number;
  minAccountLevel: number;
  dailyLimit: number;
}

export interface ShopLike {
  key: string;
  name: string;
  description?: string;
  restockMinutes: number;
  baseSlots: number;
  crystalSlots: number;
  crystalSlotCost: number;
  refreshCost: number;
  offers: ShopOfferLike[];
}

/** The highest level an account reaches — a gate above this can never open. */
export const ACCOUNT_LEVEL_CAP = 60;

export interface BandOffer extends ShopOfferLike {
  /** Share of a single slot, 0–1. */
  share: number;
}

export interface LevelBand {
  /** The account level at which this pool becomes what a player sees. */
  level: number;
  offers: BandOffer[];
  totalWeight: number;
  /**
   * True where the pool holds fewer offers than the window has slots.
   *
   * The server draws without replacement and then, once the pool is exhausted, lets the
   * remaining slots repeat. That is deliberate and it is also the thing that reads as a
   * bug in-game — the same offer twice in one window — so it is worth naming here, where
   * it can be fixed, rather than in a bug report.
   */
  repeats: boolean;
}

/**
 * The pools a shop actually has, one per level at which its contents change.
 *
 * Bands rather than a flat list because `minAccountLevel` filters *before* the weights are
 * applied: adding one level-30 offer changes the odds of everything a level-29 player sees
 * for every other offer in the shop, and nothing in a field-by-field editor shows that.
 */
export function levelBands(shop: ShopLike, maxSlots = shop.baseSlots): LevelBand[] {
  const levels = [...new Set(shop.offers.map((offer) => offer.minAccountLevel))]
    .filter((level) => level <= ACCOUNT_LEVEL_CAP)
    .sort((a, b) => a - b);

  return levels.map((level) => {
    const eligible = shop.offers.filter((offer) => offer.minAccountLevel <= level);
    const totalWeight = eligible.reduce((sum, offer) => sum + Math.max(0, offer.weight), 0);
    return {
      level,
      totalWeight,
      // A pool whose weights are all zero is picked from uniformly, which is what the
      // server does rather than dividing by nothing.
      offers: eligible.map((offer) => ({
        ...offer,
        share:
          totalWeight > 0
            ? Math.max(0, offer.weight) / totalWeight
            : eligible.length > 0
              ? 1 / eligible.length
              : 0,
      })),
      repeats: eligible.length < maxSlots,
    };
  });
}

export interface Unreachable {
  key: string;
  name: string;
  reason: string;
}

/**
 * Offers no player will ever be shown, and why.
 *
 * Both cases publish cleanly and look right in an editor, which is the whole reason to
 * compute them: a weight of zero beside positive weights is drawn with probability zero,
 * and a level gate above the cap is a gate that never opens.
 */
export function unreachableOffers(shop: ShopLike): Unreachable[] {
  const out: Unreachable[] = [];
  for (const offer of shop.offers) {
    if (offer.minAccountLevel > ACCOUNT_LEVEL_CAP) {
      out.push({
        key: offer.key,
        name: offer.name,
        reason: `Needs account level ${offer.minAccountLevel}; the cap is ${ACCOUNT_LEVEL_CAP}.`,
      });
      continue;
    }
    if (offer.weight > 0) continue;

    // Zero weight is only fatal beside a positive one: a pool that is *entirely* zero is
    // picked from uniformly, so every offer in it is still reachable.
    const pool = shop.offers.filter((other) => other.minAccountLevel <= offer.minAccountLevel);
    if (pool.some((other) => other.weight > 0)) {
      out.push({
        key: offer.key,
        name: offer.name,
        reason: 'Weight 0 beside offers that have one — it can never be drawn.',
      });
    }
  }
  return out;
}

/** What a full window costs, per currency, at a given band. */
export function windowCost(band: LevelBand): { currency: string; min: number; max: number }[] {
  const byCurrency = new Map<string, number[]>();
  for (const offer of band.offers) {
    const prices = byCurrency.get(offer.currency) ?? [];
    prices.push(offer.price);
    byCurrency.set(offer.currency, prices);
  }
  return [...byCurrency.entries()]
    .map(([currency, prices]) => ({
      currency,
      min: Math.min(...prices),
      max: Math.max(...prices),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/** "every 60 minutes" → the number of windows a day, which is what a limit is felt as. */
export function windowsPerDay(restockMinutes: number): number {
  if (restockMinutes <= 0) return 0;
  return Math.round((24 * 60) / restockMinutes);
}
