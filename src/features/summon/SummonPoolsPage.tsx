import { useMemo, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Alert,
  Badge,
  Card,
  Group,
  Paper,
  Progress,
  SegmentedControl,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconAlertTriangle, IconSparkles } from '@tabler/icons-react';
import { useContentList } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import {
  bandShares,
  expectedPulls,
  mercyBegins,
  rateAfter,
  ratesBalance,
  ratesSum,
  type PityRule,
} from './odds';

/**
 * The summon pool editor (ADMIN_SUITE_DESIGN §2.8).
 *
 * Published gacha odds are the one number in the game a player is entitled to hold us to,
 * so this screen's job is not to make rates easy to change — the generic browser already
 * does that, and every field is still edited there — but to make what they **mean**
 * impossible to misread. Three things an operator cannot see in a form of raw numbers:
 *
 *  - whether the rates are a distribution at all, which publish refuses but only once you
 *    get there, long after the number you mistyped has left the screen;
 *  - what mercy turns a rate into after a dry run, and at which pull it starts;
 *  - how many pulls a rarity actually costs, which is the figure a retune is judged on.
 *
 * None of it is a game outcome. The server rolls; this describes what the server will do,
 * from the same two published fields the player's own odds panel is drawn from.
 */

const RARITY_ORDER = ['legendary', 'epic', 'rare', 'uncommon', 'common'] as const;

interface Pool {
  key: string;
  name: string;
  sigilKey: string;
  rates: Record<string, number>;
  pity: Record<string, PityRule>;
  entries: { championKey: string; weight: number; featured?: boolean }[];
  tenPullFloor?: string;
}

function asPool(entry: { key: string; data?: unknown }): Pool | null {
  const data = entry.data;
  if (typeof data !== 'object' || data === null) return null;
  const pool = data as Partial<Pool> & { name?: unknown };
  if (typeof pool.name !== 'string') return null;
  return {
    key: entry.key,
    name: pool.name,
    sigilKey: typeof pool.sigilKey === 'string' ? pool.sigilKey : '',
    rates: (pool.rates ?? {}) as Record<string, number>,
    pity: (pool.pity ?? {}) as Record<string, PityRule>,
    entries: Array.isArray(pool.entries) ? pool.entries : [],
    ...(typeof pool.tenPullFloor === 'string' ? { tenPullFloor: pool.tenPullFloor } : {}),
  };
}

export function SummonPoolsPage(): ReactNode {
  const pools = useContentList('summon-pools');
  const [selected, setSelected] = useState<string | null>(null);

  const list = useMemo(
    () => (pools.data?.items ?? []).map(asPool).filter((pool): pool is Pool => pool !== null),
    [pools.data],
  );
  const pool = list.find((entry) => entry.key === selected) ?? list[0] ?? null;

  if (pools.isPending) return <LoadingState label="Loading the pools" />;
  if (pools.error) return <ErrorState error={pools.error} onRetry={() => void pools.refetch()} />;

  return (
    <>
      <PageHeader
        title="Summon pools"
        description="What the published odds actually mean, before anybody has to find out by pulling."
      />

      {list.length === 0 ? (
        <Paper withBorder p="xl">
          <Stack align="center" gap="xs">
            <IconSparkles size={32} opacity={0.4} />
            <Text c="dimmed" size="sm">
              No summon pools are published.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Stack gap="md">
          <Paper withBorder p="md">
            <SegmentedControl
              value={pool?.key ?? ''}
              onChange={setSelected}
              data={list.map((entry) => ({ value: entry.key, label: entry.name }))}
              fullWidth
            />
          </Paper>
          {pool && <PoolView pool={pool} />}
        </Stack>
      )}
    </>
  );
}

function PoolView({ pool }: { pool: Pool }): ReactNode {
  const sum = ratesSum(pool.rates);
  const balanced = ratesBalance(pool.rates);
  const rarities = RARITY_ORDER.filter((rarity) => pool.rates[rarity] !== undefined);

  return (
    <Stack gap="md">
      {!balanced && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="red"
          variant="light"
          title="These rates are not a distribution"
        >
          {/* Publish refuses this, but only once an operator gets there — long after the
              number they mistyped has left the screen. */}
          They sum to {(sum * 100).toFixed(2)}%, not 100%. Publish will refuse this pool.
        </Alert>
      )}

      <Card>
        <Group justify="space-between" mb="sm">
          <Text fw={600} size="sm">
            {pool.name}
          </Text>
          <Group gap="xs">
            <Badge variant="light" size="sm">
              {pool.sigilKey}
            </Badge>
            {pool.tenPullFloor && (
              <Badge variant="light" size="sm" color="grape">
                ×10 guarantees {pool.tenPullFloor}
              </Badge>
            )}
          </Group>
        </Group>

        <Table fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Rarity</Table.Th>
              <Table.Th ta="right">Rate</Table.Th>
              <Table.Th ta="right">Mercy from</Table.Th>
              <Table.Th ta="right">Rate at 2× that</Table.Th>
              <Table.Th ta="right">Pulls, on average</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rarities.map((rarity) => {
              const base = pool.rates[rarity] ?? 0;
              const rule = pool.pity[rarity];
              const begins = mercyBegins(rule);
              const expected = expectedPulls(base, rule);
              return (
                <Table.Tr key={rarity}>
                  <Table.Td tt="capitalize">{rarity}</Table.Td>
                  <Table.Td ta="right">{(base * 100).toFixed(2)}%</Table.Td>
                  <Table.Td ta="right" c={begins ? undefined : 'dimmed'}>
                    {begins ? `pull ${begins}` : 'no mercy'}
                  </Table.Td>
                  <Table.Td ta="right" c={begins ? undefined : 'dimmed'}>
                    {begins ? `${(rateAfter(base, rule, begins * 2) * 100).toFixed(1)}%` : '—'}
                  </Table.Td>
                  <Table.Td ta="right" fw={600}>
                    {/* Null when a rarity is unreachable: a 0% rate with no mercy is
                        exactly the content this screen exists to catch. */}
                    {expected === null ? (
                      <Text component="span" c="red.4" size="xs">
                        unreachable
                      </Text>
                    ) : (
                      Math.round(expected).toLocaleString()
                    )}
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Card>

      <Card>
        <Text fw={600} size="sm" mb={4}>
          Who is in it
        </Text>
        <Text size="xs" c="dimmed" mb="sm">
          Weights are relative <strong>within</strong> a rarity, never across one — the band is
          chosen from the rates first, then a champion from the band. That is what keeps the
          advertised rate honest however the roster grows.
        </Text>
        <Stack gap={6}>
          {bandShares(pool.entries).map((entry) => {
            const source = pool.entries.find((row) => row.championKey === entry.championKey);
            return (
              <div key={entry.championKey}>
                <Group justify="space-between" gap={4}>
                  <Group gap={4}>
                    <Text size="xs">{entry.championKey}</Text>
                    {source?.featured && (
                      <Badge size="xs" variant="light" color="yellow">
                        featured
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {(entry.share * 100).toFixed(1)}% of its band
                  </Text>
                </Group>
                <Progress value={entry.share * 100} size="xs" />
              </div>
            );
          })}
        </Stack>
      </Card>

      <Text size="xs" c="dimmed">
        Every field here is edited in the{' '}
        <Link to="/content/$typePath/$key" params={{ typePath: 'summon-pools', key: pool.key }}>
          content editor
        </Link>
        , which is schema-driven and wired to the publish flow. This screen only says what the
        numbers mean.
      </Text>
    </Stack>
  );
}
