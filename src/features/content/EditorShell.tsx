import { useState, type ReactNode } from 'react';
import { Alert, Anchor, Badge, Box, Button, Group, Paper, Stack, Text } from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconDeviceFloppy,
  IconTrash,
} from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { ContentTypeLink } from '@/components/nav';
import { useDeleteContent, useDiscardDraft } from '@/api/hooks';
import { contentTypeByPath } from '@/lib/content-registry';
import { PageHeader } from '@/components/PageHeader';
import { ConfirmTyped } from '@/components/ConfirmTyped';
import { ErrorState } from '@/components/QueryState';
import { notifyError, notifySuccess } from '@/lib/notify';

/**
 * Chrome shared by every entity editor: breadcrumb, publish state, and the
 * save / discard / delete controls.
 *
 * Keeping these here is what makes the editors comparable — an operator learns the
 * save model once and it holds for champions, skills and everything the generic editor
 * covers.
 */
export function EditorShell({
  typePath,
  entityKey,
  title,
  description,
  dirty,
  saving,
  saveError,
  onSave,
  onReset,
  isCreate,
  keyConflict,
  hasDraft,
  pendingDelete,
  children,
}: {
  typePath: string;
  entityKey: string;
  title: string;
  description?: string;
  dirty: boolean;
  saving: boolean;
  saveError: unknown;
  onSave: () => void;
  onReset: () => void;
  isCreate: boolean;
  keyConflict: boolean;
  hasDraft: boolean;
  pendingDelete: boolean;
  children: ReactNode;
}): ReactNode {
  const info = contentTypeByPath(typePath);
  const navigate = useNavigate();
  const remove = useDeleteContent(typePath);
  const discard = useDiscardDraft(typePath);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const backToList = (): void => {
    void navigate({ to: '/content/$typePath', params: { typePath } });
  };

  return (
    <>
      <Group gap={6} mb="xs">
        <Anchor component={ContentTypeLink} typePath={typePath} size="xs" c="dimmed">
          {info?.label ?? typePath}
        </Anchor>
        <Text size="xs" c="dimmed">
          /
        </Text>
        <Text size="xs" c="dimmed" ff="monospace">
          {entityKey}
        </Text>
      </Group>

      <PageHeader
        title={title}
        description={description}
        badge={
          <Group gap={6}>
            {isCreate && (
              <Badge size="sm" variant="light" color="teal">
                new
              </Badge>
            )}
            {!isCreate && pendingDelete && (
              <Badge size="sm" variant="light" color="red">
                deleting
              </Badge>
            )}
            {!isCreate && !pendingDelete && hasDraft && (
              <Badge size="sm" variant="light" color="yellow">
                draft
              </Badge>
            )}
            {dirty && (
              <Badge size="sm" variant="dot" color="orange">
                unsaved
              </Badge>
            )}
          </Group>
        }
        actions={
          <Group gap="sm">
            {!isCreate && (
              <Button
                variant="subtle"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            )}
            {!isCreate && hasDraft && (
              <Button
                variant="default"
                leftSection={<IconArrowBackUp size={16} />}
                onClick={() => setConfirmDiscard(true)}
              >
                Discard draft
              </Button>
            )}
            <Button variant="default" onClick={onReset} disabled={!dirty || saving}>
              Revert edits
            </Button>
            <Button
              color="mist"
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={onSave}
              loading={saving}
              disabled={!dirty && !isCreate}
            >
              Save draft
            </Button>
          </Group>
        }
      />

      {keyConflict && (
        <Alert
          color="orange"
          variant="light"
          icon={<IconAlertTriangle size={16} />}
          title="That key already exists"
          mb="md"
        >
          <Text size="sm">
            Something else is already stored under{' '}
            <Text span ff="monospace">
              {entityKey}
            </Text>
            . Saving would overwrite it. Go back and pick a different key.
          </Text>
        </Alert>
      )}

      {saveError !== null && saveError !== undefined && (
        <ErrorState error={saveError} title="Could not save" />
      )}

      <Paper p="lg" radius="sm">
        <Stack gap="lg">{children}</Stack>
      </Paper>

      <Box mt="md">
        <Text size="xs" c="dimmed">
          Saving writes a{' '}
          <Text span fw={600}>
            draft
          </Text>
          . Nothing reaches players until you publish from the publish center.
        </Text>
      </Box>

      <ConfirmTyped
        opened={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard this draft?"
        confirmLabel="Discard draft"
        loading={discard.isPending}
        onConfirm={() =>
          discard.mutate(entityKey, {
            onSuccess: () => {
              setConfirmDiscard(false);
              notifySuccess('Draft discarded', `${entityKey} is back to its live version.`);
            },
            onError: (error) => notifyError('Could not discard the draft', error),
          })
        }
      >
        <Text size="sm">
          The unpublished changes to{' '}
          <Text span ff="monospace">
            {entityKey}
          </Text>{' '}
          are dropped and the live version is restored in the editor. Published content is
          untouched.
        </Text>
      </ConfirmTyped>

      <ConfirmTyped
        opened={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${entityKey}?`}
        confirmLabel="Delete"
        loading={remove.isPending}
        phrase={entityKey}
        onConfirm={() =>
          remove.mutate(entityKey, {
            onSuccess: (result) => {
              setConfirmDelete(false);
              notifySuccess(
                result.pendingDelete ? 'Marked for deletion' : 'Draft deleted',
                result.pendingDelete
                  ? `${entityKey} disappears from the game at the next publish.`
                  : `${entityKey} never went live, so it is simply gone.`,
              );
              backToList();
            },
            onError: (error) => notifyError('Could not delete', error),
          })
        }
      >
        <Text size="sm">
          If this entity is live it is marked for removal and vanishes from the game at the next
          publish; anything still referencing it will then fail validation. If it is only a draft,
          it is removed outright.
        </Text>
      </ConfirmTyped>
    </>
  );
}
