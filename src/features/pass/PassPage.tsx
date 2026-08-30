import { useMemo, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Card,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { useContentList } from '@/api/hooks';
import { ContentItemLink } from '@/components/nav';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import {
  SHORTEST_MONTH,
  pacing,
  passProblems,
  seasonSentence,
  tierLines,
  type PassLike,
} from './passModel';

/**
 * The Vale Pass (ADMIN_SUITE_DESIGN §2.11, alongside the calendar).
 *
 * A season is one entity holding a thirty-tier, two-column ladder — the login track's
 * situation exactly, and the generic browser shows it as a JSON blob three screens tall.
 * Laying it out as a table is half the reason this exists.
 *
 * The other half, and the one that earns the page, is **arithmetic an operator cannot see**.
 * A season's length is written nowhere: it is the top tier divided by the daily ceiling, two
 * fields at opposite ends of a form. Lowering the ceiling, widening the spacing or adding
 * five tiers can leave a season needing forty-one days of a thirty-one-day month — which
 * passes validation, looks entirely reasonable in the editor, and is a track nobody can
 * finish. That figure is the first thing on this page.
 *
 * It reviews and does not edit, like every A4 view: every field is still changed in the
 * generic browser, because a second place to change one thing is worse than a click.
 */
export function PassPage(): ReactNode {
  const passes = useContentList('vale-pass');

  const seasons = useMemo(
    () =>
      (passes.data?.items ?? [])
        .map((item) => item.data as unknown as PassLike)
        .sort((a, b) => a.key.localeCompare(b.key)),
    [passes.data],
  );

  if (passes.isPending) return <LoadingState label="Reading the season" />;
  if (passes.error)
    return <ErrorState error={passes.error} onRetry={() => void passes.refetch()} />;

  return (
    <>
      <PageHeader
        title="Vale Pass"
        description="Every season, its two-column ladder, and how many days at the ceiling it takes to finish."
      />

      {seasons.length === 0 ? (
        <Paper withBorder p="xl">
          <Text c="dimmed" size="sm" ta="center">
            No season is published.
          </Text>
        </Paper>
      ) : (
        <Stack gap="md">
          {seasons.map((season) => (
            <SeasonCard key={season.key} season={season} />
          ))}
        </Stack>
      )}
    </>
  );
}

function SeasonCard({ season }: { season: PassLike }): ReactNode {
  const measured = pacing(season);
  const problems = passProblems(season);
  const tiers = season.tiers ?? [];

  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm" align="flex-start">
        <div>
          <Title order={4}>{season.name}</Title>
          <Text size="xs" c="dimmed" maw={640}>
            {season.description}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {seasonSentence(season)}
          </Text>
        </div>
        <Group gap="xs">
          {season.active === false && (
            <Badge size="sm" color="gray" variant="light">
              off
            </Badge>
          )}
          <Badge size="sm" variant="light">
            {tiers.length} tiers
          </Badge>
          <Badge size="sm" variant="light">
            opens at level {season.unlockLevel ?? 1}
          </Badge>
          <Text
            component={ContentItemLink}
            typePath="vale-pass"
            entityKey={season.key}
            size="xs"
            c="mist"
          >
            edit
          </Text>
        </Group>
      </Group>

      {/* The pacing strip. Three figures and the one that matters is the middle one — it is
          the only thing on this page that cannot be read off the form. */}
      <Group gap="xl" mb="sm">
        <Figure label="Whole track" value={`${measured.total.toLocaleString()} favour`} />
        <Figure
          label="Days at the ceiling"
          value={
            measured.daysAtCap === null
              ? 'no ceiling'
              : `${measured.daysAtCap} of ${SHORTEST_MONTH}`
          }
          hint={
            measured.daysAtCap === null
              ? 'With no daily ceiling a single heavy day can finish the whole track.'
              : `Measured against the shortest month, because a season that fits March and not February is broken every February. ${
                  measured.slackInShortestMonth === null
                    ? ''
                    : `${Math.max(0, measured.slackInShortestMonth)} days off and still finished.`
                }`
          }
        />
        <Figure
          label="Daily ceiling"
          value={measured.dailyCap > 0 ? `${measured.dailyCap.toLocaleString()} favour` : 'none'}
        />
        <Figure
          label="Second column"
          value={
            (season.unlockCost ?? 0) > 0
              ? `${(season.unlockCost ?? 0).toLocaleString()} crystals`
              : 'open to everybody'
          }
        />
      </Group>

      {problems.length > 0 && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color={problems.some((problem) => problem.level === 'error') ? 'red' : 'yellow'}
          variant="light"
          mb="sm"
        >
          <Stack gap={4}>
            {problems.map((problem, index) => (
              <Text key={index} size="sm">
                {problem.message}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      {/* What earns favour. Broad by design — a pass rewards whatever somebody plays, which
          is what separates it from an event — so the list is worth reading whole. */}
      {(season.pointRules ?? []).length > 0 && (
        <Group gap="xs" mb="sm">
          {(season.pointRules ?? []).map((rule, index) => (
            <Badge key={index} size="sm" variant="outline">
              {rule.points ?? 0} · {rule.label || rule.type}
            </Badge>
          ))}
        </Group>
      )}

      <Table striped withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={70}>Tier</Table.Th>
            <Table.Th w={120}>Favour</Table.Th>
            <Table.Th>Free track</Table.Th>
            <Table.Th>Season’s own track</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {tiers.map((tier, index) => {
            const free = tierLines(tier.free);
            const premium = tierLines(tier.premium);
            return (
              <Table.Tr key={index}>
                <Table.Td>{index + 1}</Table.Td>
                <Table.Td>{(tier.points ?? 0).toLocaleString()}</Table.Td>
                <Table.Td>
                  {/* An empty column is said rather than left blank: a blank cell in a table
                      of thirty rows reads as a rendering fault, and an empty free column is
                      a real editorial choice worth seeing. */}
                  {free.length === 0 ? (
                    <Text size="xs" c="dimmed">
                      — nothing
                    </Text>
                  ) : (
                    <Text size="xs">{free.join(' · ')}</Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {premium.length === 0 ? (
                    <Text size="xs" c="dimmed">
                      — nothing
                    </Text>
                  ) : (
                    <Text size="xs">{premium.join(' · ')}</Text>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): ReactNode {
  return (
    <div>
      <Group gap={4}>
        <Text size="xs" c="dimmed" tt="uppercase">
          {label}
        </Text>
        {hint && (
          <Tooltip label={hint} multiline w={320} withArrow>
            <IconInfoCircle size={12} opacity={0.6} />
          </Tooltip>
        )}
      </Group>
      <Text size="lg" fw={600}>
        {value}
      </Text>
    </div>
  );
}
