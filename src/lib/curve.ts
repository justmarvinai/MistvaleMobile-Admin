/**
 * Reading a config value as a curve.
 *
 * Seven of Mistvale's ninety-three tunables are numeric arrays and several more are flat
 * numeric maps, and both arrive in the config editor as a JSON textarea. That is correct
 * and unreadable: `economy.gearUpgradeSuccess` is sixteen numbers falling from 1 to 0.2,
 * and a mistyped `0.2` where `0.02` was meant is invisible in a blob and glaring on a line.
 *
 * Pure, and separate from the control that draws it, because the interesting part is the
 * two shapes rather than the drawing: an **array** is a curve indexed from 0, and a flat
 * **map of numbers** is a curve indexed by its keys — sorted numerically when every key is
 * a number, which is what makes `{"1":…,"2":…,"10":…}` come back in the right order rather
 * than as 1, 10, 2.
 */

export interface CurvePoint {
  /** The key to write back: an array index, or an object key. */
  id: string;
  /** What the axis is labelled with. */
  label: string;
  value: number;
}

export type CurveShape = 'array' | 'map';

export interface Curve {
  shape: CurveShape;
  points: CurvePoint[];
}

/** True where every key of a flat object parses as a finite number. */
function numericKeys(keys: string[]): boolean {
  return keys.length > 0 && keys.every((key) => key.trim() !== '' && Number.isFinite(Number(key)));
}

/**
 * A value read as a curve, or `null` where it is not one.
 *
 * Deliberately strict: a single non-number anywhere makes it not a curve, because a
 * partially numeric list drawn as a line would be a picture with holes in it that the
 * editor could not write back.
 */
export function asCurve(value: unknown): Curve | null {
  if (Array.isArray(value)) {
    if (value.length < 2) return null;
    if (!value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))) return null;
    return {
      shape: 'array',
      points: value.map((entry, index) => ({
        id: String(index),
        label: String(index),
        value: entry as number,
      })),
    };
  }

  if (!value || typeof value !== 'object') return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length < 2) return null;
  if (!entries.every(([, entry]) => typeof entry === 'number' && Number.isFinite(entry))) {
    return null;
  }

  const keys = entries.map(([key]) => key);
  const sorted = numericKeys(keys)
    ? [...entries].sort(([a], [b]) => Number(a) - Number(b))
    : [...entries].sort(([a], [b]) => a.localeCompare(b));

  return {
    shape: 'map',
    points: sorted.map(([key, entry]) => ({ id: key, label: key, value: entry as number })),
  };
}

/** Writes one point back, returning a value of the same shape the curve came from. */
export function withPoint(curve: Curve, id: string, value: number): unknown {
  if (curve.shape === 'array') {
    return curve.points.map((point) => (point.id === id ? value : point.value));
  }
  const out: Record<string, number> = {};
  for (const point of curve.points) out[point.id] = point.id === id ? value : point.value;
  return out;
}

/**
 * An SVG polyline through the points, in a 0–1 box.
 *
 * Scaled against the curve's own range rather than against zero: several of these are
 * multipliers hovering near 1 and a zero-based axis would draw every one of them as a flat
 * line at the top, which says nothing. A curve with no range at all is drawn down the
 * middle rather than divided by nothing.
 */
export function polyline(points: CurvePoint[], width: number, height: number): string {
  if (points.length === 0) return '';
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low;
  const step = points.length > 1 ? width / (points.length - 1) : 0;

  return points
    .map((point, index) => {
      const y = span === 0 ? height / 2 : height - ((point.value - low) / span) * height;
      return `${(index * step).toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}
