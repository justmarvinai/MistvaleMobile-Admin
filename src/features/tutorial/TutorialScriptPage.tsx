import { useMemo, useState, type ReactNode } from 'react';
import { ActionIcon, Alert, Anchor, Badge, Group, Paper, Stack, Table, Text } from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconInfoCircle,
  IconPencil,
} from '@tabler/icons-react';
import { useContentList, useSaveContent } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import { ContentItemLink, ContentTypeLink } from '@/components/nav';
import { StateBadge } from '@/components/StateBadge';
import { moveStep, readScript, scriptProblems } from './scriptModel';

/**
 * The tutorial script (ADMIN_SUITE_DESIGN §2.18).
 *
 * A *reviewing* view, not a second field editor. Every field of a step is already editable
 * through the generic browser, and duplicating any of it here would create a second place
 * to change one thing. What the browser cannot do is show a script as a script — fifteen
 * rows sorted into the order a player walks them, with what each one points at and what it
 * hands over, so an operator can see the shape of somebody's first hour on one screen.
 *
 * The one thing it does that the browser cannot is **reorder**. The script is walked by
 * position and publish refuses a gap or a duplicate, so moving step 9 above step 8 by hand
 * means editing two entities and getting both numbers right; here it is an arrow, and the
 * two writes are a swap rather than a renumber of everything below.
 */
const TYPE_PATH = 'tutorial';

export function TutorialScriptPage(): ReactNode {
  const list = useContentList(TYPE_PATH);
  const save = useSaveContent(TYPE_PATH);
  const [moving, setMoving] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const steps = useMemo(() => readScript(list.data?.items ?? []), [list.data]);
  const problems = useMemo(() => scriptProblems(steps), [steps]);
  const entries = useMemo(
    () => new Map((list.data?.items ?? []).map((item) => [item.key, item])),
    [list.data],
  );

  /**
   * Applies a move as two saves.
   *
   * Sequential rather than parallel, and the second only if the first landed: a half-
   * applied swap would leave two steps sharing a number, which is the exact state this
   * page exists to prevent somebody reaching by hand.
   */
  const move = async (key: string, direction: -1 | 1): Promise<void> => {
    const writes = moveStep(steps, key, direction);
    if (writes.length === 0) return;

    setMoving(key);
    setFailure(null);
    try {
      for (const write of writes) {
        const entry = entries.get(write.key);
        if (!entry) throw new Error(`"${write.key}" is no longer in the script.`);
        await save.mutateAsync({ key: write.key, data: { ...entry.data, step: write.step } });
      }
    } catch (cause) {
      setFailure(
        cause instanceof Error
          ? `${cause.message} The other half of the swap may have saved — check the numbering below.`
          : 'The move did not save.',
      );
    } finally {
      setMoving(null);
    }
  };

  if (list.isPending) return <LoadingState label="Reading the script…" />;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;

  return (
    <Stack gap="lg">
      <PageHeader
        title="Tutorial script"
        description="The first hour, in the order a player walks it. Edit a step's words and rewards in its own editor; the order lives here."
      />

      {steps.length === 0 ? (
        <Alert icon={<IconInfoCircle size={16} />} color="gray">
          No steps yet. A script is built from <ContentLink>tutorial entities</ContentLink> — the
          first one you create becomes step 1.
        </Alert>
      ) : (
        <Alert icon={<IconInfoCircle size={16} />} color="gray" variant="light">
          {steps.length} steps. A player's progress is stored as a <b>position</b>, not a step key,
          so re-cutting the script never strands anybody mid-way — but somebody on step 9 when you
          publish will find step 9 is now whatever you moved there.
        </Alert>
      )}

      {problems.map((problem) => (
        <Alert
          key={problem.message}
          icon={<IconAlertTriangle size={16} />}
          color={problem.severity === 'error' ? 'red' : 'yellow'}
          variant="light"
        >
          {problem.message}
        </Alert>
      ))}

      {failure && (
        <Alert icon={<IconAlertTriangle size={16} />} color="red">
          {failure}
        </Alert>
      )}

      <Paper withBorder p={0}>
        <Table striped highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={64}>Step</Table.Th>
              <Table.Th>Says</Table.Th>
              <Table.Th w={180}>Points at</Table.Th>
              <Table.Th w={200}>Waits for</Table.Th>
              <Table.Th w={90}>Gives</Table.Th>
              <Table.Th w={130}>Order</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {steps.map((step, index) => (
              <Table.Tr key={step.key} opacity={step.active ? 1 : 0.55}>
                <Table.Td>
                  <Text fw={700} ff="monospace">
                    {step.step}
                  </Text>
                </Table.Td>

                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <ContentItemLink typePath={TYPE_PATH} entityKey={step.key}>
                      <Anchor component="span" fw={600}>
                        {step.title}
                      </Anchor>
                    </ContentItemLink>
                    <StateBadge state={step.state} />
                    {!step.active && (
                      <Badge size="xs" color="gray" variant="outline">
                        off
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {step.key}
                  </Text>
                </Table.Td>

                <Table.Td>
                  <Text size="sm">{step.screen}</Text>
                  {step.highlight ? (
                    <Text size="xs" c="dimmed" ff="monospace">
                      {step.highlight}
                    </Text>
                  ) : (
                    <Text size="xs" c="dimmed">
                      nothing — a centred beat
                    </Text>
                  )}
                </Table.Td>

                <Table.Td>
                  {step.goal ? (
                    <Text size="sm" ff="monospace">
                      {step.goal.type}
                      {step.goal.target > 1 ? ` ×${step.goal.target}` : ''}
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">
                      a press of Continue
                    </Text>
                  )}
                </Table.Td>

                <Table.Td>
                  {step.gives > 0 ? (
                    <Badge variant="light" color="yellow">
                      {step.gives}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>

                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      aria-label={`Move ${step.title} earlier`}
                      disabled={index === 0 || moving !== null}
                      loading={moving === step.key}
                      onClick={() => void move(step.key, -1)}
                    >
                      <IconArrowUp size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      aria-label={`Move ${step.title} later`}
                      disabled={index === steps.length - 1 || moving !== null}
                      onClick={() => void move(step.key, 1)}
                    >
                      <IconArrowDown size={16} />
                    </ActionIcon>
                    <ContentItemLink typePath={TYPE_PATH} entityKey={step.key}>
                      <ActionIcon
                        component="span"
                        variant="subtle"
                        aria-label={`Edit ${step.title}`}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                    </ContentItemLink>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Text size="sm" c="dimmed">
        Reordering saves as a draft like every other content change — nothing a player sees moves
        until it is published.
      </Text>
    </Stack>
  );
}

function ContentLink({ children }: { children: ReactNode }): ReactNode {
  return (
    <ContentTypeLink typePath={TYPE_PATH}>
      <Anchor component="span">{children}</Anchor>
    </ContentTypeLink>
  );
}
