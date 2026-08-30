import { useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Card,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconStairsDown } from '@tabler/icons-react';
import { useContentList } from '@/api/hooks';
import { ContentItemLink } from '@/components/nav';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import {
  floorsOf,
  keepProblems,
  openWeek,
  opensDaily,
  type DungeonLike,
  type StageLike,
} from './depthsModel';

/**
 * The Depths (ADMIN_SUITE_DESIGN §2.7).
 *
 * A keep's floors are ordinary `stage` entities carrying `parentKey` and `number`, which is
 * right — a floor is a fight and rides the same engine as everything else — and it means
 * the generic browser shows a keep as fifteen rows in a list of four hundred, in key order,
 * with nothing saying how the descent scales. This is one keep's ladder: what level the
 * enemies are at each floor, what it costs, and where the step is.
 *
 * The week beside it is the rotation, inverted. `openDays` is a list of numbers on each
 * keep, so "which spring is open on Thursday" means reading five entities and turning five
 * lists inside out in your head — and an *empty* list means every day, which read literally
 * looks like a keep that never opens.
 */
export function DepthsPage(): ReactNode {
  const dungeons = useContentList('dungeons');
  const stages = useContentList('stages');
  const [selected, setSelected] = useState<string | null>(null);

  const keeps = useMemo(
    () =>
      (dungeons.data?.items ?? [])
        .map((item) => item.data as unknown as DungeonLike)
        .filter((keep) => keep && typeof keep.name === 'string')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [dungeons.data],
  );

  const allStages = useMemo(
    () => (stages.data?.items ?? []).map((item) => item.data as unknown as StageLike),
    [stages.data],
  );

  const keep = keeps.find((entry) => entry.key === selected) ?? keeps[0] ?? null;
  const week = useMemo(() => openWeek(keeps.filter((entry) => !opensDaily(entry))), [keeps]);

  if (dungeons.isPending || stages.isPending) return <LoadingState label="Reading the Depths" />;
  if (dungeons.error) {
    return <ErrorState error={dungeons.error} onRetry={() => void dungeons.refetch()} />;
  }
  if (stages.error) {
    return <ErrorState error={stages.error} onRetry={() => void stages.refetch()} />;
  }

  return (
    <>
      <PageHeader
        title="The Depths"
        description="Every keep as its own descent, and the rotation as a week."
      />

      {keeps.length === 0 ? (
        <Paper withBorder p="xl">
          <Stack align="center" gap="xs">
            <IconStairsDown size={32} opacity={0.4} />
            <Text c="dimmed" size="sm">
              No dungeons are published.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Stack gap="md">
          <RotationWeek week={week} keeps={keeps} />

          <Paper withBorder p="md">
            <SegmentedControl
              value={keep?.key ?? ''}
              onChange={setSelected}
              data={keeps.map((entry) => ({ value: entry.key, label: entry.name }))}
              fullWidth
            />
          </Paper>

          {keep && <KeepView keep={keep} stages={allStages} />}
        </Stack>
      )}
    </>
  );
}

function RotationWeek({
  week,
  keeps,
}: {
  week: ReturnType<typeof openWeek>;
  keeps: readonly DungeonLike[];
}): ReactNode {
  const rotating = keeps.filter((keep) => !opensDaily(keep));
  const daily = keeps.filter(opensDaily);
  if (rotating.length === 0) return null;
  const nameOf = (key: string): string => keeps.find((keep) => keep.key === key)?.name ?? key;

  return (
    <Card withBorder>
      <Title order={4} mb={4}>
        The week
      </Title>
      <Text size="xs" c="dimmed" mb="sm">
        {rotating.length} {rotating.length === 1 ? 'keep rotates' : 'keeps rotate'}; the other{' '}
        {daily.length} {daily.length === 1 ? 'is' : 'are'} open every day and left off this grid so
        it says something.
      </Text>
      <Group gap="xs" grow align="stretch">
        {week.map((day) => (
          <Paper key={day.day} withBorder p="xs">
            <Text size="xs" fw={600} mb={4}>
              {day.label}
            </Text>
            <Stack gap={2}>
              {day.keys.map((key) => (
                <Text key={key} size="xs" c="dimmed">
                  {nameOf(key)}
                </Text>
              ))}
              {day.keys.length === 0 && (
                <Text size="xs" c="red">
                  Nothing open
                </Text>
              )}
            </Stack>
          </Paper>
        ))}
      </Group>
    </Card>
  );
}

function KeepView({ keep, stages }: { keep: DungeonLike; stages: StageLike[] }): ReactNode {
  const floors = useMemo(() => floorsOf(keep, stages), [keep, stages]);
  const problems = useMemo(() => keepProblems(keep, floors), [keep, floors]);

  return (
    <Stack gap="md">
      {problems.length > 0 && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="yellow"
          variant="light"
          title={`${problems.length} ${problems.length === 1 ? 'thing' : 'things'} to look at`}
        >
          <Stack gap={4}>
            {problems.map((problem) => (
              <Text key={`${problem.floor ?? 'keep'}-${problem.message}`} size="sm">
                {problem.floor === null ? (
                  <strong>This keep</strong>
                ) : (
                  <strong>Floor {problem.floor}</strong>
                )}{' '}
                — {problem.message}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      <Card>
        <Group justify="space-between" mb="sm" align="flex-start">
          <div>
            <Text fw={600} size="sm">
              {keep.name}
            </Text>
            {keep.tagline && (
              <Text size="xs" c="dimmed">
                {keep.tagline}
              </Text>
            )}
          </div>
          <Group gap="xs">
            <Badge variant="light" size="sm">
              {keep.kind}
            </Badge>
            <Badge variant="light" size="sm">
              {floors.length} of {keep.floors} floors
            </Badge>
            <Badge variant="light" size="sm">
              opens at level {keep.unlockLevel ?? 1}
            </Badge>
            <Badge variant="light" size="sm" color={opensDaily(keep) ? 'teal' : 'grape'}>
              {opensDaily(keep) ? 'every day' : 'rotates'}
            </Badge>
          </Group>
        </Group>

        {(keep.setKeys?.length ?? 0) > 0 && (
          <Text size="xs" c="dimmed" mb="xs">
            Drops: {keep.setKeys?.join(', ')}
            {(keep.itemKeys?.length ?? 0) > 0 ? ` · ${keep.itemKeys?.join(', ')}` : ''}
          </Text>
        )}

        {floors.length === 0 ? (
          <Text size="sm" c="dimmed">
            No floors are published under this keep.
          </Text>
        ) : (
          <Table fz="xs" striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={60}>Floor</Table.Th>
                <Table.Th>Enemy level</Table.Th>
                <Table.Th ta="right">Step</Table.Th>
                <Table.Th ta="right">Waves</Table.Th>
                <Table.Th ta="right">Enemies</Table.Th>
                <Table.Th ta="right">Energy</Table.Th>
                <Table.Th ta="right">3★ turns</Table.Th>
                <Table.Th ta="right">Relic chance</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {floors.map((floor) => (
                <Table.Tr key={floor.key}>
                  <Table.Td>{floor.number}</Table.Td>
                  <Table.Td>
                    {floor.levelMin === floor.levelMax
                      ? floor.levelMin
                      : `${floor.levelMin}–${floor.levelMax}`}
                  </Table.Td>
                  <Table.Td ta="right" c={floor.stepFromPrevious < 0 ? 'red' : undefined}>
                    {floor.number === floors[0]?.number
                      ? '—'
                      : floor.stepFromPrevious > 0
                        ? `+${floor.stepFromPrevious}`
                        : String(floor.stepFromPrevious)}
                  </Table.Td>
                  <Table.Td ta="right">{floor.waves}</Table.Td>
                  <Table.Td ta="right">{floor.enemies}</Table.Td>
                  <Table.Td ta="right">{floor.energyCost}</Table.Td>
                  <Table.Td ta="right">{floor.maxTurns ?? '—'}</Table.Td>
                  <Table.Td ta="right">
                    {floor.gearChance === null ? '—' : `${Math.round(floor.gearChance * 100)}%`}
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text
                      component={ContentItemLink}
                      typePath="stages"
                      entityKey={floor.key}
                      size="xs"
                      c="mist"
                    >
                      edit
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
