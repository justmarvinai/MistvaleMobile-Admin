import { useState, type ReactNode } from 'react';
import { Box, Group, NumberInput, Paper, Stack, Text, UnstyledButton } from '@mantine/core';
import { asCurve, polyline, withPoint, type Curve } from '@/lib/curve';

/**
 * A numeric curve, edited as a curve (ADMIN_SUITE_DESIGN §2.12).
 *
 * The config editor picks its control from the live value's type, and for an array or an
 * object that meant a JSON textarea — correct, complete, and unreadable for the values
 * that are actually *shapes*. `economy.gearUpgradeSuccess` is sixteen numbers falling from
 * 1 to 0.2, and `0.02` typed where `0.2` was meant is invisible in a blob and obvious on a
 * line.
 *
 * The line is drawn against the curve's **own** range rather than against zero, because
 * several of these are multipliers hovering near 1 and a zero-based axis draws all of them
 * as one flat line at the top. It is a shape rather than a chart: no axes, no gridlines —
 * the figures are in the boxes underneath, which is where they are edited.
 */

const WIDTH = 560;
const HEIGHT = 56;

export interface CurveEditorProps {
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  label?: string;
}

/** True where this value is worth drawing as a curve at all. */
export function isCurve(value: unknown): boolean {
  return asCurve(value) !== null;
}

export function CurveEditor({ value, onChange, disabled, label }: CurveEditorProps): ReactNode {
  const curve = asCurve(value);
  const [focused, setFocused] = useState<string | null>(null);
  if (!curve) return null;

  return (
    <Stack gap="xs">
      <Sparkline curve={curve} focused={focused} onPick={setFocused} />
      <Group gap={6} wrap="wrap">
        {curve.points.map((point) => (
          <NumberInput
            key={point.id}
            size="xs"
            w={92}
            label={point.label}
            value={point.value}
            disabled={disabled ?? false}
            onFocus={() => setFocused(point.id)}
            onBlur={() => setFocused(null)}
            aria-label={`${label ?? 'Value'} ${point.label}`}
            onChange={(next) => {
              const parsed = typeof next === 'number' ? next : Number(next);
              // A box being cleared reads as an empty string; leaving the last value in
              // place is what keeps the curve a curve while somebody retypes a number.
              if (!Number.isFinite(parsed)) return;
              onChange(withPoint(curve, point.id, parsed));
            }}
            hideControls
            stepHoldDelay={500}
            stepHoldInterval={100}
          />
        ))}
      </Group>
    </Stack>
  );
}

function Sparkline({
  curve,
  focused,
  onPick,
}: {
  curve: Curve;
  focused: string | null;
  onPick: (id: string | null) => void;
}): ReactNode {
  const line = polyline(curve.points, WIDTH, HEIGHT);
  const coords = line.split(' ').map((pair) => pair.split(',').map(Number));
  const values = curve.points.map((point) => point.value);

  return (
    <Paper withBorder p="xs" maw={WIDTH + 24}>
      <Box
        component="svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        w="100%"
        h={HEIGHT}
        // Decoration for a table of numbers that is already on the screen and already
        // readable, so it says nothing a screen reader needs to hear twice.
        aria-hidden
        style={{ display: 'block', overflow: 'visible' }}
      >
        <polyline
          points={line}
          fill="none"
          stroke="var(--mantine-color-mist-5)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {coords.map(([x, y], index) => {
          const point = curve.points[index];
          if (!point || x === undefined || y === undefined) return null;
          return (
            <circle
              key={point.id}
              cx={x}
              cy={y}
              r={focused === point.id ? 5 : 3}
              fill={
                focused === point.id ? 'var(--mantine-color-mist-3)' : 'var(--mantine-color-mist-6)'
              }
              onMouseEnter={() => onPick(point.id)}
              onMouseLeave={() => onPick(null)}
            />
          );
        })}
      </Box>
      <Group justify="space-between" mt={4}>
        <Text size="xs" c="dimmed">
          low {Math.min(...values).toLocaleString()}
        </Text>
        <Text size="xs" c="dimmed">
          {curve.points.length} points
        </Text>
        <Text size="xs" c="dimmed">
          high {Math.max(...values).toLocaleString()}
        </Text>
      </Group>
    </Paper>
  );
}

/** The toggle back to raw JSON, for the edits a curve cannot express. */
export function RawToggle({ raw, onToggle }: { raw: boolean; onToggle: () => void }): ReactNode {
  return (
    <UnstyledButton onClick={onToggle}>
      <Text size="xs" c="dimmed" td="underline">
        {raw ? 'Edit as a curve' : 'Edit as JSON'}
      </Text>
    </UnstyledButton>
  );
}
