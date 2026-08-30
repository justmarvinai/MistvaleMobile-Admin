import { useMemo, type ReactNode } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Card,
  Group,
  Paper,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconListCheck,
  IconRoute,
} from '@tabler/icons-react';
import { useContentList } from '@/api/hooks';
import { ContentItemLink } from '@/components/nav';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import {
  chainProblems,
  goalSentence,
  ladderProblems,
  rewardLines,
  scheduleSentence,
  type GoalLike,
  type MilestoneLike,
  type RewardsLike,
} from './goalText';

/**
 * Quests, missions and events (ADMIN_SUITE_DESIGN §2.10).
 *
 * All three are built on the same goal DSL, and in a JSON form every one of them reads
 * `{"type":"spireHeight","target":10,"filters":{…}}` where the operator is thinking "reach
 * floor 10 of the Mistspire". One screen for the three because the question is the same
 * one: what is a player being asked to do, and what does it pay?
 *
 * Fields are still edited in the generic browser — this is a reviewing view, like the
 * campaign grid and the tutorial script — but three things it reports are invisible there
 * and each publishes cleanly: a gap in the Path's numbering (the chain is walked by `step`,
 * so a gap is a wall), a milestone ladder whose rungs do not climb, and an event schedule
 * that can never fire.
 */

interface QuestLike {
  key: string;
  name: string;
  description?: string;
  period?: string;
  goals?: GoalLike[];
  rewards?: RewardsLike;
  unlockLevel?: number;
  active?: boolean;
  countsTowardChest?: boolean;
  sortOrder?: number;
}

interface MissionLike extends QuestLike {
  step?: number;
  arc?: number;
  arcName?: string;
}

interface EventLike {
  key: string;
  name: string;
  description?: string;
  active?: boolean;
  unlockLevel?: number;
  schedule?: Parameters<typeof scheduleSentence>[0];
  pointRules?: {
    type: string;
    label?: string;
    points: number;
    filters?: Record<string, unknown>;
  }[];
  milestones?: MilestoneLike[];
}

const PERIODS = ['daily', 'weekly', 'monthly'] as const;

export function ErrandsPage(): ReactNode {
  const quests = useContentList('quests');
  const missions = useContentList('missions');
  const events = useContentList('events');

  const questList = useMemo(
    () => (quests.data?.items ?? []).map((item) => item.data as unknown as QuestLike),
    [quests.data],
  );
  const missionList = useMemo(
    () =>
      (missions.data?.items ?? [])
        .map((item) => item.data as unknown as MissionLike)
        .sort((a, b) => (a.step ?? 0) - (b.step ?? 0)),
    [missions.data],
  );
  const eventList = useMemo(
    () => (events.data?.items ?? []).map((item) => item.data as unknown as EventLike),
    [events.data],
  );

  if (quests.isPending || missions.isPending || events.isPending) {
    return <LoadingState label="Reading the errands" />;
  }
  const failure = quests.error ?? missions.error ?? events.error;
  if (failure) {
    return (
      <ErrorState
        error={failure}
        onRetry={() => {
          void quests.refetch();
          void missions.refetch();
          void events.refetch();
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Errands"
        description="What a player is being asked to do, in words, and what it pays."
      />

      <Tabs defaultValue="quests" keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="quests" leftSection={<IconListCheck size={14} />}>
            Quests
          </Tabs.Tab>
          <Tabs.Tab value="missions" leftSection={<IconRoute size={14} />}>
            The Path
          </Tabs.Tab>
          <Tabs.Tab value="events" leftSection={<IconCalendarEvent size={14} />}>
            Events
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="quests">
          <QuestTabs quests={questList} />
        </Tabs.Panel>
        <Tabs.Panel value="missions">
          <MissionChain missions={missionList} />
        </Tabs.Panel>
        <Tabs.Panel value="events">
          <EventList events={eventList} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

function GoalCell({ goals }: { goals: GoalLike[] | undefined }): ReactNode {
  const list = goals ?? [];
  if (list.length === 0) {
    return (
      <Text size="xs" c="red">
        No goal — nothing would ever complete it.
      </Text>
    );
  }
  return (
    <Stack gap={0}>
      {list.map((goal) => (
        <Text key={`${goal.type}-${goal.target}`} size="xs">
          {goalSentence(goal)}
        </Text>
      ))}
    </Stack>
  );
}

function RewardCell({ rewards }: { rewards: RewardsLike | undefined }): ReactNode {
  const lines = rewardLines(rewards);
  if (lines.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        —
      </Text>
    );
  }
  return (
    <Stack gap={0}>
      {lines.map((line) => (
        <Text key={line} size="xs" c="dimmed">
          {line}
        </Text>
      ))}
    </Stack>
  );
}

function QuestTabs({ quests }: { quests: QuestLike[] }): ReactNode {
  if (quests.length === 0) {
    return <Empty label="No quests are published." />;
  }
  return (
    <Stack gap="md">
      {PERIODS.map((period) => {
        const mine = quests
          .filter((quest) => quest.period === period)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        if (mine.length === 0) return null;
        const chest = mine.filter((quest) => quest.countsTowardChest).length;
        return (
          <Card key={period} withBorder>
            <Group justify="space-between" mb="sm">
              <Title order={4} tt="capitalize">
                {period}
              </Title>
              <Group gap="xs">
                <Badge variant="light" size="sm">
                  {mine.length} quests
                </Badge>
                {period === 'daily' && (
                  <Badge variant="light" size="sm" color="grape">
                    {chest} count towards the day&apos;s chest
                  </Badge>
                )}
              </Group>
            </Group>
            <Table fz="xs" striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Quest</Table.Th>
                  <Table.Th>Asks for</Table.Th>
                  <Table.Th>Pays</Table.Th>
                  <Table.Th ta="right" w={70}>
                    Level
                  </Table.Th>
                  <Table.Th w={60} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {mine.map((quest) => (
                  <Table.Tr key={quest.key} opacity={quest.active === false ? 0.5 : 1}>
                    <Table.Td>
                      <Text size="xs" fw={500}>
                        {quest.name}
                      </Text>
                      {quest.active === false && (
                        <Badge size="xs" color="gray" variant="light">
                          off
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <GoalCell goals={quest.goals} />
                    </Table.Td>
                    <Table.Td>
                      <RewardCell rewards={quest.rewards} />
                    </Table.Td>
                    <Table.Td ta="right">{quest.unlockLevel ?? 1}</Table.Td>
                    <Table.Td ta="right">
                      <Text
                        component={ContentItemLink}
                        typePath="quests"
                        entityKey={quest.key}
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
          </Card>
        );
      })}
    </Stack>
  );
}

function MissionChain({ missions }: { missions: MissionLike[] }): ReactNode {
  const problems = useMemo(
    () =>
      chainProblems(
        missions.map((mission) => ({
          key: mission.key,
          step: mission.step ?? 0,
          name: mission.name,
          arc: mission.arc ?? 0,
          arcName: mission.arcName ?? '',
        })),
      ),
    [missions],
  );

  if (missions.length === 0) return <Empty label="No missions are published." />;

  const arcs = [...new Set(missions.map((mission) => mission.arc ?? 0))].sort((a, b) => a - b);

  return (
    <Stack gap="md">
      {problems.length > 0 && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="red"
          variant="light"
          title={`${problems.length} ${problems.length === 1 ? 'problem' : 'problems'} in the numbering`}
        >
          {/* The Path is walked by `step`, exactly as the tutorial script is: a gap is a
              wall and a duplicate is an ambiguity, and both look ordinary in a key-sorted
              list. Publish refuses them; this says so while it can still be fixed. */}
          <Stack gap={4}>
            {problems.map((problem) => (
              <Text key={problem.step} size="sm">
                {problem.message}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      <Accordion multiple defaultValue={[String(arcs[0] ?? 0)]} variant="separated">
        {arcs.map((arc) => {
          const mine = missions.filter((mission) => (mission.arc ?? 0) === arc);
          return (
            <Accordion.Item key={arc} value={String(arc)}>
              <Accordion.Control>
                <Group gap="sm">
                  <Text fw={600} size="sm">
                    Arc {arc} — {mine[0]?.arcName || 'unnamed'}
                  </Text>
                  <Badge size="sm" variant="light">
                    {mine.length} steps
                  </Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Table fz="xs" striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={50}>Step</Table.Th>
                      <Table.Th>Mission</Table.Th>
                      <Table.Th>Asks for</Table.Th>
                      <Table.Th>Pays</Table.Th>
                      <Table.Th w={60} />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {mine.map((mission) => (
                      <Table.Tr key={mission.key}>
                        <Table.Td>{mission.step ?? '—'}</Table.Td>
                        <Table.Td>
                          <Text size="xs" fw={500}>
                            {mission.name}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <GoalCell goals={mission.goals} />
                        </Table.Td>
                        <Table.Td>
                          <RewardCell rewards={mission.rewards} />
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text
                            component={ContentItemLink}
                            typePath="missions"
                            entityKey={mission.key}
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
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </Stack>
  );
}

function EventList({ events }: { events: EventLike[] }): ReactNode {
  if (events.length === 0) return <Empty label="No events are published." />;

  return (
    <Stack gap="md">
      {events.map((event) => {
        const ladder = event.milestones ?? [];
        const problems = ladderProblems(ladder);
        return (
          <Card key={event.key} withBorder>
            <Group justify="space-between" mb={4} align="flex-start">
              <div>
                <Title order={4}>{event.name}</Title>
                <Text size="xs" c="dimmed" maw={640}>
                  {event.description}
                </Text>
              </div>
              <Group gap="xs">
                {event.active === false && (
                  <Badge size="sm" color="gray" variant="light">
                    off
                  </Badge>
                )}
                <Badge size="sm" variant="light">
                  opens at level {event.unlockLevel ?? 1}
                </Badge>
              </Group>
            </Group>

            <Text size="sm" mb="sm">
              {scheduleSentence(event.schedule)}
            </Text>

            {problems.length > 0 && (
              <Alert
                icon={<IconAlertTriangle size={16} />}
                color="yellow"
                variant="light"
                mb="sm"
                title="The ladder"
              >
                <Stack gap={4}>
                  {problems.map((problem) => (
                    <Text key={problem.message} size="sm">
                      {problem.message}
                    </Text>
                  ))}
                </Stack>
              </Alert>
            )}

            <Group align="flex-start" gap="xl" wrap="wrap">
              <div style={{ minWidth: 280, flex: 1 }}>
                <Text size="xs" fw={600} mb={4}>
                  Points come from
                </Text>
                <Stack gap={2}>
                  {(event.pointRules ?? []).map((rule) => (
                    <Text key={`${rule.type}-${rule.points}`} size="xs" c="dimmed">
                      {rule.label ||
                        goalSentence({
                          type: rule.type,
                          target: 1,
                          ...(rule.filters ? { filters: rule.filters } : {}),
                        })}{' '}
                      · {rule.points} pts
                    </Text>
                  ))}
                  {(event.pointRules ?? []).length === 0 && (
                    <Text size="xs" c="red">
                      No point rules — the ladder could never move.
                    </Text>
                  )}
                </Stack>
              </div>
              <div style={{ minWidth: 280, flex: 1 }}>
                <Text size="xs" fw={600} mb={4}>
                  The ladder
                </Text>
                <Stack gap={2}>
                  {ladder.map((rung, index) => (
                    <Text key={rung.points} size="xs" c="dimmed">
                      {index + 1}. {rung.points.toLocaleString()} pts —{' '}
                      {rewardLines(rung.rewards).join(', ') || 'nothing'}
                    </Text>
                  ))}
                  {ladder.length === 0 && (
                    <Text size="xs" c="red">
                      No milestones — the event pays nothing.
                    </Text>
                  )}
                </Stack>
              </div>
            </Group>

            <Group justify="flex-end" mt="sm">
              <Text
                component={ContentItemLink}
                typePath="events"
                entityKey={event.key}
                size="xs"
                c="mist"
              >
                edit this event
              </Text>
            </Group>
          </Card>
        );
      })}
    </Stack>
  );
}

function Empty({ label }: { label: string }): ReactNode {
  return (
    <Paper withBorder p="xl">
      <Stack align="center" gap="xs">
        <IconListCheck size={32} opacity={0.4} />
        <Text c="dimmed" size="sm">
          {label}
        </Text>
      </Stack>
    </Paper>
  );
}
