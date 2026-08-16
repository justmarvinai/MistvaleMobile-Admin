import { useEffect, useState, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  List,
  Modal,
  Paper,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconChecklist, IconRocket } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useContentDiff, usePublishContent, useValidateContent } from '@/api/hooks';
import type { ContentIssue } from '@/api/types';
import { contentTypeLabel } from '@/lib/content-registry';
import { notifyError, notifySuccess } from '@/lib/notify';
import { ErrorState } from '@/components/QueryState';

/**
 * Publish (ADMIN_SUITE_DESIGN §2.17).
 *
 * The gate is deliberately sequential: validate, read what came back, then publish.
 * Errors block outright; warnings require the operator to tick that they have read them.
 * The server enforces the same rule — it refuses to publish invalid content — so this is
 * about telling the operator *why* before they hit a wall, not about being the guard.
 */
export function PublishModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}): ReactNode {
  const diff = useContentDiff();
  const validate = useValidateContent();
  const publish = usePublishContent();
  const navigate = useNavigate();

  const [note, setNote] = useState('');
  const [warningsAccepted, setWarningsAccepted] = useState(false);

  // Each opening is a fresh decision: a note or an accepted warning from last time must
  // not carry into a publish the operator has not looked at.
  useEffect(() => {
    if (!opened) return;
    setNote('');
    setWarningsAccepted(false);
    validate.reset();
    publish.reset();
    // `validate` and `publish` are stable mutation objects; re-running on their identity
    // would reset the form on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const result = validate.data;
  const totals = diff.data?.totals;
  const changeCount = diff.data?.entries.length ?? 0;

  const blocked = result === undefined || result.errors.length > 0;
  const needsAcceptance = (result?.warnings.length ?? 0) > 0 && !warningsAccepted;

  const doPublish = (): void => {
    publish.mutate(
      { note: note.trim() },
      {
        onSuccess: (published) => {
          notifySuccess(
            `Published revision #${published.rev}`,
            `${published.summary.added} added, ${published.summary.modified} modified, ${published.summary.removed} removed. Players see it now.`,
          );
          onClose();
          void navigate({ to: '/publish' });
        },
        onError: (error) => notifyError('Publish failed', error),
      },
    );
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Publish content" size="lg">
      <Stack gap="md">
        {diff.error ? (
          <ErrorState error={diff.error} title="Could not read the pending changes" />
        ) : changeCount === 0 ? (
          <Alert color="blue" variant="light">
            <Text size="sm">There is nothing to publish — every draft is already live.</Text>
          </Alert>
        ) : (
          <>
            <Paper p="sm" bg="dark.8">
              <Group gap="lg">
                <Stat label="Added" value={totals?.added ?? 0} color="teal" />
                <Stat label="Modified" value={totals?.modified ?? 0} color="blue" />
                <Stat label="Removed" value={totals?.removed ?? 0} color="red" />
              </Group>
            </Paper>

            <Button
              variant={result ? 'default' : 'light'}
              color="mist"
              leftSection={<IconChecklist size={16} />}
              onClick={() =>
                validate.mutate(undefined, {
                  onError: (error) => notifyError('Could not validate', error),
                })
              }
              loading={validate.isPending}
            >
              {result ? 'Re-validate' : 'Validate first'}
            </Button>

            {validate.error && (
              <ErrorState error={validate.error} title="Validation failed to run" />
            )}

            {result && result.errors.length > 0 && (
              <Alert
                color="red"
                variant="light"
                icon={<IconAlertTriangle size={16} />}
                title={`${result.errors.length} ${result.errors.length === 1 ? 'error' : 'errors'} block this publish`}
              >
                <IssueList issues={result.errors} />
              </Alert>
            )}

            {result && result.warnings.length > 0 && (
              <Alert
                color="yellow"
                variant="light"
                icon={<IconAlertTriangle size={16} />}
                title={`${result.warnings.length} ${result.warnings.length === 1 ? 'warning' : 'warnings'}`}
              >
                <Stack gap="xs">
                  <IssueList issues={result.warnings} />
                  <Button
                    size="compact-xs"
                    variant={warningsAccepted ? 'filled' : 'default'}
                    color="yellow"
                    leftSection={warningsAccepted ? <IconCheck size={12} /> : undefined}
                    onClick={() => setWarningsAccepted((current) => !current)}
                  >
                    {warningsAccepted ? 'Warnings acknowledged' : 'I have read these warnings'}
                  </Button>
                </Stack>
              </Alert>
            )}

            {result && result.ok && result.errors.length === 0 && result.warnings.length === 0 && (
              <Alert color="mist" variant="light" icon={<IconCheck size={16} />}>
                <Text size="sm">
                  {result.checked} entries checked — no problems. Ready to publish.
                </Text>
              </Alert>
            )}

            <Textarea
              label="What changed"
              description="Goes into the revision history and feeds the CHANGELOG. Keep it specific."
              placeholder="Rebalanced chapter 3 enemy HP; added Ember Warden's A3."
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={5}
              maxLength={400}
            />

            {publish.error && <ErrorState error={publish.error} title="Publish failed" />}
          </>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={publish.isPending}>
            Cancel
          </Button>
          <Button
            color="mist"
            leftSection={<IconRocket size={16} />}
            onClick={doPublish}
            loading={publish.isPending}
            disabled={changeCount === 0 || blocked || needsAcceptance}
          >
            Publish{' '}
            {changeCount > 0 ? `${changeCount} ${changeCount === 1 ? 'change' : 'changes'}` : ''}
          </Button>
        </Group>

        {changeCount > 0 && blocked && !validate.isPending && (
          <Text size="xs" c="dimmed" ta="right">
            {result === undefined
              ? 'Validate before publishing.'
              : 'Fix the errors above, then re-validate.'}
          </Text>
        )}
        {needsAcceptance && (
          <Text size="xs" c="dimmed" ta="right">
            Acknowledge the warnings to continue.
          </Text>
        )}
      </Stack>
    </Modal>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }): ReactNode {
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

export function IssueList({ issues }: { issues: ContentIssue[] }): ReactNode {
  return (
    <List size="xs" spacing={4}>
      {issues.map((issue, index) => (
        <List.Item key={`${issue.contentType}-${issue.key}-${issue.path ?? ''}-${index}`}>
          <Text size="xs" span fw={600}>
            {contentTypeLabel(issue.contentType)} / {issue.key}
          </Text>
          {issue.path && (
            <Text size="xs" span c="dimmed" ff="monospace">
              {' '}
              {issue.path}
            </Text>
          )}
          <Text size="xs" span>
            {' '}
            — {issue.message}
          </Text>
        </List.Item>
      ))}
    </List>
  );
}
