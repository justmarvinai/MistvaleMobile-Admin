import type { ReactNode } from 'react';
import { Badge, Card, Group, Progress, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import type { StatsOverview } from '@/api/types';

/**
 * What the game has been doing (gap G3).
 *
 * ADMIN_SUITE_DESIGN §2.1 asked for battle, summon and economy figures from the start,
 * and the dashboard could only say how many rows each content table held — which describes
 * the content rather than the game.
 *
 * **Every figure is a day beside a week**, because one number alone cannot tell a quiet
 * Tuesday from a broken endpoint, which is exactly the failure a dashboard exists to
 * catch. A day on its own is a number an operator has no way to be alarmed by.
 */
export function ActivityPanel({ stats }: { stats: StatsOverview }): ReactNode {
  const { battles, summons, economy } = stats.activity;
  const quiet = battles.week === 0 && summons.week === 0 && economy.length === 0;

  if (quiet) {
    return (
      <Card>
        <Text fw={600} size="sm" mb={4}>
          Activity
        </Text>
        <Text size="sm" c="dimmed">
          Nothing has happened in the last seven days — no battles, no summons, no economy movement.
          On a live server that is a fault rather than a quiet week.
        </Text>
      </Card>
    );
  }

  return (
    <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
      <Card>
        <Group justify="space-between" mb="xs">
          <Text fw={600} size="sm">
            Battles
          </Text>
          <Badge variant="light" size="sm">
            {battles.day} today
          </Badge>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">
          {battles.week} this week · {battles.wonDay} of today&rsquo;s were won
        </Text>
        {battles.byMode.length === 0 ? (
          <Text size="xs" c="dimmed">
            No battles this week.
          </Text>
        ) : (
          <Table fz="xs" withRowBorders={false}>
            <Table.Tbody>
              {battles.byMode.map((row) => (
                <Table.Tr key={row.mode}>
                  <Table.Td>{row.mode}</Table.Td>
                  <Table.Td ta="right" c="dimmed">
                    {row.day} / {row.week}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Card>
        <Group justify="space-between" mb="xs">
          <Text fw={600} size="sm">
            Summons
          </Text>
          <Badge variant="light" size="sm">
            {summons.day} today
          </Badge>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">
          {summons.week} this week · {summons.mercyWeek} from mercy
        </Text>
        {summons.byRarity.length === 0 ? (
          <Text size="xs" c="dimmed">
            No pulls this week.
          </Text>
        ) : (
          <Stack gap={6}>
            {/* Over the week rather than the day: a Legendary is rare enough that a day's
                count is usually zero, and a zero says nothing about the rates. */}
            {summons.byRarity.map((row) => (
              <div key={row.rarity}>
                <Group justify="space-between" gap={4}>
                  <Text size="xs">{row.rarity}</Text>
                  <Text size="xs" c="dimmed">
                    {row.week} · {share(row.week, summons.week)}
                  </Text>
                </Group>
                <Progress
                  value={summons.week > 0 ? (row.week / summons.week) * 100 : 0}
                  size="xs"
                />
              </div>
            ))}
          </Stack>
        )}
      </Card>

      <Card>
        <Text fw={600} size="sm" mb="xs">
          Economy, today
        </Text>
        <Text size="xs" c="dimmed" mb="sm">
          {/* Both halves rather than the net: a net of zero is produced by a healthy
              economy and by nothing happening at all. */}
          Earned against spent, per currency
        </Text>
        {economy.length === 0 ? (
          <Text size="xs" c="dimmed">
            Nothing earned or spent today.
          </Text>
        ) : (
          <Table fz="xs" withRowBorders={false}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th />
                <Table.Th ta="right">In</Table.Th>
                <Table.Th ta="right">Out</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {economy.map((row) => (
                <Table.Tr key={row.currency}>
                  <Table.Td>{row.currency}</Table.Td>
                  <Table.Td ta="right" c="mist.4">
                    {row.faucet.toLocaleString()}
                  </Table.Td>
                  <Table.Td ta="right" c="red.4">
                    {row.sink.toLocaleString()}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </SimpleGrid>
  );
}

/** `12%`, or nothing at all when there is no denominator to be a share of. */
export function share(part: number, whole: number): string {
  if (whole <= 0) return '—';
  return `${Math.round((part / whole) * 100)}%`;
}
