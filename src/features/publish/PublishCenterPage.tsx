import { useState, type ReactNode } from 'react';
import { Alert, Badge, Button, Card, Group, Paper, Stack, Table, Tabs, Text } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconChecklist,
  IconHistory,
  IconRocket,
  IconTrash,
} from '@tabler/icons-react';
import {
  useContentDiff,
  useDiscardAllDrafts,
  useRevertContent,
  useRevisions,
  useValidateContent,
} from '@/api/hooks';
import type { ContentRevisionSummary } from '@/api/types';
import { DiffViewer } from '@/components/DiffViewer';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmTyped } from '@/components/ConfirmTyped';
import { EmptyState, ErrorState, LoadingState } from '@/components/QueryState';
import { formatRelative, formatTimestamp } from '@/lib/format';
import { notifyError, notifySuccess } from '@/lib/notify';
import { IssueList, PublishModal } from './PublishModal';

/**
 * Publish center (ADMIN_SUITE_DESIGN §2.17).
 *
 * Two halves: what is about to change (diff + validation) and what already changed
 * (revision history + revert). Revert is the fire escape, so it takes a typed
 * confirmation — it rewrites live content for every player at once.
 */
export function PublishCenterPage(): ReactNode {
  const diff = useContentDiff();
  const validate = useValidateContent();
  const [publishOpen, setPublishOpen] = useState(false);

  const entries = diff.data?.entries ?? [];
  const totals = diff.data?.totals;

  return (
    <>
      <PageHeader
        title="Publish center"
        description="Everything between your drafts and the live game. Validate, review the diff, publish — or roll back."
        actions={
          <Group gap="sm">
            <Button
              variant="default"
              leftSection={<IconChecklist size={16} />}
              onClick={() =>
                validate.mutate(undefined, {
                  onError: (error) => notifyError('Could not validate', error),
                })
              }
              loading={validate.isPending}
              disabled={entries.length === 0}
            >
              Validate
            </Button>
            <Button
              color="mist"
              leftSection={<IconRocket size={16} />}
              onClick={() => setPublishOpen(true)}
              disabled={entries.length === 0}
            >
              Publish…
            </Button>
          </Group>
        }
      />

      <Tabs defaultValue="pending" keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab
            value="pending"
            rightSection={
              entries.length > 0 ? (
                <Badge size="xs" color="yellow" variant="light">
                  {entries.length}
                </Badge>
              ) : undefined
            }
          >
            Pending changes
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<IconHistory size={14} />}>
            Revision history
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="pending">
          <Stack gap="lg">
            {validate.data && <ValidationSummary result={validate.data} />}

            {totals && entries.length > 0 && (
              <Group justify="space-between">
                <Group gap="lg">
                  <Counter label="Added" value={totals.added} color="teal" />
                  <Counter label="Modified" value={totals.modified} color="blue" />
                  <Counter label="Removed" value={totals.removed} color="red" />
                </Group>
                <DiscardAllButton count={entries.length} />
              </Group>
            )}

            {diff.isPending ? (
              <LoadingState label="Reading pending changes…" />
            ) : diff.error ? (
              <ErrorState
                error={diff.error}
                title="Could not read the diff"
                onRetry={() => void diff.refetch()}
              />
            ) : (
              <DiffViewer entries={entries} />
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="history">
          <RevisionHistory />
        </Tabs.Panel>
      </Tabs>

      <PublishModal opened={publishOpen} onClose={() => setPublishOpen(false)} />
    </>
  );
}

function ValidationSummary({
  result,
}: {
  result: { ok: boolean; checked: number; errors: ContentIssueList; warnings: ContentIssueList };
}): ReactNode {
  if (result.errors.length > 0) {
    return (
      <Alert
        color="red"
        variant="light"
        icon={<IconAlertTriangle size={16} />}
        title={`${result.errors.length} ${result.errors.length === 1 ? 'error' : 'errors'} — publishing is blocked`}
      >
        <IssueList issues={result.errors} />
      </Alert>
    );
  }
  if (result.warnings.length > 0) {
    return (
      <Alert
        color="yellow"
        variant="light"
        icon={<IconAlertTriangle size={16} />}
        title={`${result.warnings.length} ${result.warnings.length === 1 ? 'warning' : 'warnings'} — publishing is allowed`}
      >
        <IssueList issues={result.warnings} />
      </Alert>
    );
  }
  return (
    <Alert color="mist" variant="light" icon={<IconCheck size={16} />}>
      <Text size="sm">{result.checked} entries checked — no problems found.</Text>
    </Alert>
  );
}

type ContentIssueList = Parameters<typeof IssueList>[0]['issues'];

function Counter({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}): ReactNode {
  return (
    <Group gap={6}>
      <Badge size="sm" variant="light" color={color}>
        {value}
      </Badge>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
    </Group>
  );
}

function DiscardAllButton({ count }: { count: number }): ReactNode {
  const discard = useDiscardAllDrafts();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="subtle"
        color="red"
        size="compact-sm"
        leftSection={<IconTrash size={14} />}
        onClick={() => setOpen(true)}
      >
        Discard all drafts
      </Button>

      <ConfirmTyped
        opened={open}
        onClose={() => setOpen(false)}
        title="Discard every draft?"
        confirmLabel="Discard all"
        phrase="discard all drafts"
        loading={discard.isPending}
        onConfirm={() =>
          discard.mutate(undefined, {
            onSuccess: (result) => {
              setOpen(false);
              notifySuccess(
                `Discarded ${result.discarded} ${result.discarded === 1 ? 'draft' : 'drafts'}`,
                'Live content is untouched.',
              );
            },
            onError: (error) => notifyError('Could not discard drafts', error),
          })
        }
      >
        <Text size="sm">
          All {count} unpublished {count === 1 ? 'change' : 'changes'} are thrown away and cannot be
          recovered. Published content is not affected.
        </Text>
      </ConfirmTyped>
    </>
  );
}

function RevisionHistory(): ReactNode {
  const revisions = useRevisions();
  const revert = useRevertContent();
  const [target, setTarget] = useState<ContentRevisionSummary | undefined>(undefined);

  if (revisions.isPending) return <LoadingState label="Loading revisions…" />;
  if (revisions.error) {
    return (
      <ErrorState
        error={revisions.error}
        title="Could not load revisions"
        onRetry={() => void revisions.refetch()}
      />
    );
  }

  const { current, revisions: list } = revisions.data;

  if (list.length === 0) {
    return (
      <EmptyState
        title="Nothing published yet"
        description="The first publish creates revision #1 and a full snapshot you can always roll back to."
      />
    );
  }

  return (
    <>
      <Card>
        <Table fz="sm" className="mv-tabular">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={90}>Revision</Table.Th>
              <Table.Th w={170}>Published</Table.Th>
              <Table.Th w={140}>By</Table.Th>
              <Table.Th w={160}>Changes</Table.Th>
              <Table.Th>Note</Table.Th>
              <Table.Th w={110} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {list.map((revision) => (
              <Table.Tr key={revision.rev}>
                <Table.Td>
                  <Group gap={6}>
                    <Text size="sm" fw={600} ff="monospace">
                      #{revision.rev}
                    </Text>
                    {revision.rev === current && (
                      <Badge size="xs" color="mist" variant="light">
                        live
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" title={formatTimestamp(revision.publishedAt)}>
                    {formatRelative(revision.publishedAt)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs">{revision.publishedBy || '—'}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Badge size="xs" color="teal" variant="light">
                      +{revision.summary.added}
                    </Badge>
                    <Badge size="xs" color="blue" variant="light">
                      ~{revision.summary.modified}
                    </Badge>
                    <Badge size="xs" color="red" variant="light">
                      −{revision.summary.removed}
                    </Badge>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c={revision.note ? undefined : 'dimmed'}>
                    {revision.note || 'no note'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {revision.rev !== current && (
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color="red"
                      onClick={() => setTarget(revision)}
                    >
                      Revert to this
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      <Paper p="sm" mt="md" bg="dark.8">
        <Text size="xs" c="dimmed">
          Reverting does not rewind history: it restores the chosen snapshot as a new revision, so
          the audit trail stays append-only and the rollback itself is visible. Any pending drafts
          are dropped in the process.
        </Text>
      </Paper>

      <ConfirmTyped
        opened={target !== undefined}
        onClose={() => setTarget(undefined)}
        title={`Revert to revision #${target?.rev ?? ''}?`}
        confirmLabel="Revert live content"
        phrase={target ? `revert to ${target.rev}` : undefined}
        loading={revert.isPending}
        onConfirm={() => {
          if (!target) return;
          const rev = target.rev;
          revert.mutate(
            { rev },
            {
              onSuccess: (result) => {
                setTarget(undefined);
                notifySuccess(
                  `Reverted to #${rev}`,
                  `Restored as revision #${result.rev}. Players see it now.`,
                );
              },
              onError: (error) => notifyError('Could not revert', error),
            },
          );
        }}
      >
        <Stack gap="xs">
          <Text size="sm">
            Every player is moved onto the content as it stood at revision #{target?.rev} —
            immediately, without a redeploy.
          </Text>
          <Text size="sm" c="red">
            Any unpublished drafts are discarded.
          </Text>
          {target?.note && (
            <Text size="xs" c="dimmed">
              That revision&apos;s note: “{target.note}”
            </Text>
          )}
        </Stack>
      </ConfirmTyped>
    </>
  );
}
