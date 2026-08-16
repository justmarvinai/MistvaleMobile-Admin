/** Formatting helpers shared across screens. */

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const TIMESTAMP = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.348],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
];

/** "3 minutes ago" / "in 2 days". Falls back to the raw string for unparseable input. */
export function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return iso;

  let delta = (timestamp - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(delta) < size) return RELATIVE.format(Math.round(delta), unit);
    delta /= size;
  }
  return RELATIVE.format(Math.round(delta), 'year');
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) return iso;
  return TIMESTAMP.format(timestamp);
}

/** Title-cases a camelCase or snake_case identifier for a form label. */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/[_.]/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Stable JSON for comparing form state against what the server holds. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) => {
    if (typeof inner !== 'object' || inner === null || Array.isArray(inner)) return inner;
    return Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)));
  });
}

/** True when two values are deeply equal, ignoring object key order. */
export function deepEqual(a: unknown, b: unknown): boolean {
  return stableJson(a) === stableJson(b);
}
