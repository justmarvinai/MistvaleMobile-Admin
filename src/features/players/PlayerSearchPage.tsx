import { useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Badge, Group, Paper, Switch, Table, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { usePlayerSearch } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import { formatRelative } from '@/lib/format';
import type { AdminPlayerSummary } from '@/api/types';
import { RankBadge, StatusBadge } from './badges';

/**
 * Finding an account (ADMIN_SUITE_DESIGN §2.14).
 *
 * One box, both names. A support request says "I'm Rattledagger" or "my login is
 * rattle_d" and almost never says which of the two it is quoting, so the server searches
 * both and this does not ask the operator to guess.
 *
 * Bots are hidden by default rather than absent: they are players in every table, and an
 * operator debugging the arena ladder needs to reach them — but they would otherwise
 * bury sixty real accounts under sixty synthetic ones.
 */
export function PlayerSearchPage(): ReactNode {
  const [query, setQuery] = useState('');
  const [bots, setBots] = useState(false);
  // The search fires on every keystroke otherwise, and the operator is mid-word for most
  // of them.
  const [debounced] = useDebouncedValue(query, 250);

  const search = usePlayerSearch({ q: debounced, bots });

  return (
    <>
      <PageHeader
        title="Players"
        description="Search by account or profile name. Mistvale has no e-mail addresses, so this is the support desk."
      />

      <Paper p="md" withBorder mb="md">
        <Group align="flex-end" gap="md">
          <TextInput
            label="Search"
            placeholder="Account or profile name"
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Switch
            label="Include bots"
            checked={bots}
            onChange={(event) => setBots(event.currentTarget.checked)}
            mb={8}
          />
        </Group>
      </Paper>

      {search.isPending ? (
        <LoadingState label="Searching…" />
      ) : search.error ? (
        <ErrorState
          error={search.error}
          title="Could not search"
          onRetry={() => void search.refetch()}
        />
      ) : search.data.players.length === 0 ? (
        <Paper p="xl" withBorder>
          <Text c="dimmed" ta="center">
            {debounced ? `Nothing matches “${debounced}”.` : 'No accounts yet.'}
          </Text>
        </Paper>
      ) : (
        <Paper withBorder>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Account</Table.Th>
                <Table.Th>Profile</Table.Th>
                <Table.Th>Level</Table.Th>
                <Table.Th>Rank</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Last seen</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {search.data.players.map((player) => (
                <PlayerRow key={player.playerId} player={player} />
              ))}
            </Table.Tbody>
          </Table>
          <Group justify="flex-end" p="sm">
            <Text size="xs" c="dimmed">
              Showing {search.data.players.length} of {search.data.total}
            </Text>
          </Group>
        </Paper>
      )}
    </>
  );
}

function PlayerRow({ player }: { player: AdminPlayerSummary }): ReactNode {
  return (
    <Table.Tr>
      <Table.Td>
        <Link to="/players/$playerId" params={{ playerId: player.playerId }}>
          <Text size="sm" fw={500} c="mist.4">
            {player.accountName}
          </Text>
        </Link>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Text size="sm">{player.profileName}</Text>
          {player.isBot && (
            <Badge size="xs" variant="outline" color="gray">
              bot
            </Badge>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{player.level}</Text>
      </Table.Td>
      <Table.Td>
        <RankBadge rank={player.rank} />
      </Table.Td>
      <Table.Td>
        <StatusBadge status={player.status} />
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed">
          {player.lastLoginAt ? formatRelative(player.lastLoginAt) : 'never'}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}
