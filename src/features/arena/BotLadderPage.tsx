import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Alert,
  Badge,
  Button,
  Group,
  Paper,
  Progress,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle, IconRefresh, IconUsersPlus } from '@tabler/icons-react';
import { useArenaBotCensus, useRefreshArenaBots, useSeedArenaBots } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import { formatRelative } from '@/lib/format';
import type { ArenaBand, ArenaLadderReport } from '@/api/types';

/**
 * The Arena's bot ladder (ADMIN_SUITE_DESIGN §2.15).
 *
 * Two buttons and a table, deliberately. Everything an operator might *tune* — how many
 * bots a band holds, the rating window they spread across, the champions and relics they
 * are built from, the pools their names come from — is `arena.botBands` and its two name
 * lists in the game-config editor, because it is content and content is data. Duplicating
 * any of it here would create a second place to change one number.
 *
 * What is left is the two things a config edit cannot do by itself: make the ladder match
 * what the config now says, and rebuild it now rather than at 04:00.
 */
const BAND_LABELS: Readonly<Record<ArenaBand, string>> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

export function BotLadderPage(): ReactNode {
  const census = useArenaBotCensus();
  const seed = useSeedArenaBots();
  const refresh = useRefreshArenaBots();
  const [lastRun, setLastRun] = useState<{ what: string; report: ArenaLadderReport } | null>(null);

  const working = seed.isPending || refresh.isPending;

  const run = (what: string, action: typeof seed): void => {
    action.mutate(undefined, {
      onSuccess: (result) => setLastRun({ what, report: result.report }),
    });
  };

  return (
    <>
      <PageHeader
        title="Arena bots"
        description="The ladder must never be empty — a new account has to find somebody to fight on its first evening."
      />

      <Alert
        icon={<IconInfoCircle size={16} />}
        color="blue"
        variant="light"
        mb="md"
        title="Bots are ordinary players"
      >
        <Text size="sm">
          A bot is a row in <code>players</code> with <code>is_bot</code> set — matchmaking, the
          leaderboard and the battle engine treat it exactly like anybody else. It holds no
          currencies and writes nothing to the economy log, so it never appears in a faucet or sink
          report. To inspect, rename or remove one, find it under <Link to="/players">Players</Link>{' '}
          with “Include bots” switched on.
        </Text>
        <Text size="sm" mt="xs">
          What each band is built from lives in <code>arena.botBands</code> in the{' '}
          <Link to="/content/$typePath" params={{ typePath: 'config' }}>
            game config
          </Link>
          , along with the two name pools. Publish a change there, then rebuild here.
        </Text>
      </Alert>

      {census.isPending ? (
        <LoadingState label="Counting the ladder…" />
      ) : census.error ? (
        <ErrorState
          error={census.error}
          title="Could not read the ladder"
          onRetry={() => void census.refetch()}
        />
      ) : (
        <Stack gap="md">
          <Paper p="md" withBorder>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <div>
                <Title order={4}>{census.data.total} bots standing</Title>
                <Text size="sm" c="dimmed">
                  {census.data.refreshedAt
                    ? `Last rebuilt ${formatRelative(census.data.refreshedAt)}. The nightly job rebuilds every roster and drifts each rating inside its band.`
                    : 'The ladder has never been built. Seed it, or wait for tonight’s maintenance run.'}
                </Text>
              </div>

              <Group gap="sm" wrap="nowrap">
                <Button
                  leftSection={<IconUsersPlus size={16} />}
                  loading={seed.isPending}
                  disabled={working}
                  onClick={() => run('Seeded', seed)}
                >
                  Fill to strength
                </Button>
                <Button
                  variant="default"
                  leftSection={<IconRefresh size={16} />}
                  loading={refresh.isPending}
                  disabled={working}
                  onClick={() => run('Rebuilt', refresh)}
                >
                  Rebuild now
                </Button>
              </Group>
            </Group>
          </Paper>

          {(seed.error ?? refresh.error) && (
            <Alert icon={<IconAlertTriangle size={16} />} color="red" title="That run failed">
              {(seed.error ?? refresh.error)?.message}
            </Alert>
          )}

          {lastRun && (
            <Alert color="teal" variant="light" title={`${lastRun.what} the ladder`}>
              <Text size="sm">
                {lastRun.report.created} created · {lastRun.report.refreshed} rebuilt ·{' '}
                {lastRun.report.removed} removed.
              </Text>
            </Alert>
          )}

          <Paper withBorder>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Band</Table.Th>
                  <Table.Th>Standing</Table.Th>
                  <Table.Th>Rating window</Table.Th>
                  <Table.Th style={{ width: '35%' }}>Fill</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {census.data.bands.map((band) => {
                  const share = band.wanted === 0 ? 100 : (band.present / band.wanted) * 100;
                  const short = band.present < band.wanted;
                  return (
                    <Table.Tr key={band.band}>
                      <Table.Td>
                        <Text fw={600}>{BAND_LABELS[band.band]}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={short ? 'yellow' : 'teal'} variant="light">
                          {band.present} / {band.wanted}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed" ff="monospace">
                          {band.ratingMin}–{band.ratingMax}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Progress
                          value={Math.min(100, share)}
                          color={short ? 'yellow' : 'teal'}
                          size="sm"
                        />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Paper>

          <Text size="xs" c="dimmed">
            Counted by where each bot actually stands rather than by the window it was created in,
            so these numbers read the same as the leaderboard does. A band can drift over-full if a
            neighbour’s bots have won their way into it; filling to strength sheds the surplus from
            the top, keeping the entry-level opponents a new account will meet.
          </Text>
        </Stack>
      )}
    </>
  );
}
