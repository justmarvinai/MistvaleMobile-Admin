import { describe, expect, it } from 'vitest';
import { asCurve, polyline, withPoint } from './curve';

describe('asCurve', () => {
  it('reads a numeric array as a curve indexed from zero', () => {
    const curve = asCurve([3000, 6000, 12000]);
    expect(curve?.shape).toBe('array');
    expect(curve?.points).toEqual([
      { id: '0', label: '0', value: 3000 },
      { id: '1', label: '1', value: 6000 },
      { id: '2', label: '2', value: 12000 },
    ]);
  });

  it('reads a flat numeric map, ordered by its keys as numbers', () => {
    // The case this exists for: `economy.gearUpgradeSuccess` is keyed "1".."16", and
    // string ordering would put 10 between 1 and 2 — a curve with a cliff in it that is
    // not in the data.
    const curve = asCurve({ '1': 1, '10': 0.48, '2': 0.85 });
    expect(curve?.shape).toBe('map');
    expect(curve?.points.map((point) => point.label)).toEqual(['1', '2', '10']);
  });

  it('orders a map of words alphabetically', () => {
    const curve = asCurve({ rare: 2, common: 0, epic: 3 });
    expect(curve?.points.map((point) => point.label)).toEqual(['common', 'epic', 'rare']);
  });

  it('refuses anything with a non-number in it', () => {
    // A partial curve would draw a line with holes the editor could not write back.
    expect(asCurve([1, 2, 'three'])).toBeNull();
    expect(asCurve({ a: 1, b: null })).toBeNull();
    expect(asCurve(['Vale', 'Ashen'])).toBeNull();
  });

  it('refuses a non-finite number', () => {
    expect(asCurve([1, Number.NaN])).toBeNull();
    expect(asCurve([1, Number.POSITIVE_INFINITY])).toBeNull();
  });

  it('refuses anything too short to be a curve, and anything that is not a collection', () => {
    expect(asCurve([5])).toBeNull();
    expect(asCurve({ only: 1 })).toBeNull();
    expect(asCurve(42)).toBeNull();
    expect(asCurve('text')).toBeNull();
    expect(asCurve(null)).toBeNull();
  });
});

describe('withPoint', () => {
  it('writes back an array as an array', () => {
    const curve = asCurve([1, 2, 3])!;
    expect(withPoint(curve, '1', 99)).toEqual([1, 99, 3]);
  });

  it('writes back a map as a map, keeping every key', () => {
    const curve = asCurve({ '1': 1, '2': 0.8 })!;
    expect(withPoint(curve, '2', 0.5)).toEqual({ '1': 1, '2': 0.5 });
  });

  it('leaves the value alone when nothing matches', () => {
    const curve = asCurve([1, 2])!;
    expect(withPoint(curve, 'nope', 9)).toEqual([1, 2]);
  });
});

describe('polyline', () => {
  it('scales against the curve’s own range rather than against zero', () => {
    // Several of these are multipliers hovering near 1; a zero-based axis draws every one
    // of them as a flat line at the top.
    const curve = asCurve([0.9, 0.95, 1])!;
    expect(polyline(curve.points, 100, 10)).toBe('0.00,10.00 50.00,5.00 100.00,0.00');
  });

  it('draws a flat curve down the middle rather than dividing by nothing', () => {
    const curve = asCurve([5, 5, 5])!;
    expect(polyline(curve.points, 100, 10)).toBe('0.00,5.00 50.00,5.00 100.00,5.00');
  });

  it('is empty for no points', () => {
    expect(polyline([], 100, 10)).toBe('');
  });
});
