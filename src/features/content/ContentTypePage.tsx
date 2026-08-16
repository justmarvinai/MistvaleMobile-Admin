import { useMemo, useState, type ReactNode } from 'react';
import { Badge, Button, Group, Menu, Text, Tooltip } from '@mantine/core';
import {
  IconDotsVertical,
  IconPlus,
  IconTrash,
  IconCopy,
  IconArrowBackUp,
} from '@tabler/icons-react';
import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';
import { useContentList, useDeleteContent, useDiscardDraft } from '@/api/hooks';
import type { ContentListItem } from '@/api/types';
import { contentTypeByPath, DEDICATED_EDITORS } from '@/lib/content-registry';
import { EntityTable } from '@/components/EntityTable';
import { PageHeader } from '@/components/PageHeader';
import { StateBadge } from '@/components/StateBadge';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { ConfirmTyped } from '@/components/ConfirmTyped';
import { formatRelative } from '@/lib/format';
import { notifyError, notifySuccess } from '@/lib/notify';
import { NotFoundPage } from '@/features/shell/NotFoundPage';
import { GameConfigPage } from '@/features/config/GameConfigPage';
import { CreateEntityModal } from './CreateEntityModal';

/**
 * The generic entity browser: one screen that makes every content type in the registry
 * editable the moment the server knows about it.
 *
 * Game config is a whole-collection form rather than a list of rows, so it takes over
 * this route instead of getting a separate one — the sidebar stays generated from a
 * single registry loop either way.
 */
export function ContentTypePage({ typePath }: { typePath: string }): ReactNode {
  const info = contentTypeByPath(typePath);

  if (!info) {
    return (
      <NotFoundPage
        title="Unknown content type"
        description={`There is no content type at “${typePath}”. It may have been renamed on the server.`}
      />
    );
  }

  if (info.type === 'gameConfig') return <GameConfigPage />;

  return <EntityBrowser typePath={info.path} />;
}

function EntityBrowser({ typePath }: { typePath: string }): ReactNode {
  const info = contentTypeByPath(typePath);
  const list = useContentList(typePath);
  const remove = useDeleteContent(typePath);
  const discard = useDiscardDraft(typePath);
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [duplicateOf, setDuplicateOf] = useState<string | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<ContentListItem | undefined>(undefined);

  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const existingKeys = useMemo(() => new Set(items.map((item) => item.key)), [items]);

  const openEditor = (key: string): void => {
    void navigate({
      to: '/content/$typePath/$key',
      params: { typePath, key },
      search: {},
    });
  };

  const columns = useMemo<ColumnDef<ContentListItem, unknown>[]>(
    () => [
      {
        id: 'key',
        header: 'Key',
        accessorFn: (row) => row.key,
        size: 200,
        cell: ({ row }) => (
          <Text size="sm" ff="monospace" fw={500}>
            {row.original.key}
          </Text>
        ),
      },
      {
        id: 'name',
        header: 'Name',
        accessorFn: (row) => displayName(row),
        cell: ({ row }) => (
          <Text size="sm" truncate>
            {displayName(row.original)}
          </Text>
        ),
      },
      {
        id: 'state',
        header: 'State',
        accessorFn: (row) => row.state,
        size: 110,
        cell: ({ row }) => <StateBadge state={row.original.state} />,
      },
      {
        id: 'updatedBy',
        header: 'Updated by',
        accessorFn: (row) => row.updatedBy ?? '',
        size: 140,
        cell: ({ row }) => (
          <Text size="xs" c="dimmed">
            {row.original.updatedBy ?? '—'}
          </Text>
        ),
      },
      {
        id: 'updatedAt',
        header: 'Updated',
        accessorFn: (row) => row.updatedAt ?? '',
        size: 140,
        cell: ({ row }) => (
          <Text size="xs" c="dimmed">
            {formatRelative(row.original.updatedAt)}
          </Text>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        size: 52,
        cell: ({ row }) => (
          <RowMenu
            item={row.original}
            onDuplicate={() => {
              setDuplicateOf(row.original.key);
              setCreateOpen(true);
            }}
            onDelete={() => setPendingDelete(row.original)}
            onDiscardDraft={() => {
              discard.mutate(row.original.key, {
                onSuccess: () =>
                  notifySuccess(
                    'Draft discarded',
                    `${row.original.key} is back to its live version.`,
                  ),
                onError: (error) => notifyError('Could not discard the draft', error),
              });
            }}
          />
        ),
      },
    ],
    [discard],
  );

  if (!info) return null;

  const draftCount = items.filter((item) => item.state !== 'live').length;

  return (
    <>
      <PageHeader
        title={info.label}
        description={info.blurb}
        badge={
          DEDICATED_EDITORS[info.type] ? (
            <Tooltip
              label={`Entities of this type open in the ${DEDICATED_EDITORS[info.type]}`}
              withArrow
            >
              <Badge size="sm" variant="light" color="mist">
                {DEDICATED_EDITORS[info.type]}
              </Badge>
            </Tooltip>
          ) : undefined
        }
        actions={
          <Group gap="sm">
            {draftCount > 0 && (
              <Badge size="sm" color="yellow" variant="light">
                {draftCount} unpublished
              </Badge>
            )}
            <Button
              leftSection={<IconPlus size={16} />}
              color="mist"
              onClick={() => {
                setDuplicateOf(undefined);
                setCreateOpen(true);
              }}
            >
              New
            </Button>
          </Group>
        }
      />

      {list.isPending ? (
        <LoadingState label={`Loading ${info.label.toLowerCase()}…`} />
      ) : list.error ? (
        <ErrorState
          error={list.error}
          title={`Could not load ${info.label.toLowerCase()}`}
          onRetry={() => void list.refetch()}
        />
      ) : (
        <EntityTable
          data={items}
          columns={columns}
          getRowId={(row) => row.key}
          onRowClick={(row) => openEditor(row.key)}
          getSearchText={(row) => `${row.key} ${displayName(row)}`}
          searchPlaceholder={`Search ${info.label.toLowerCase()}…`}
          emptyTitle={`No ${info.label.toLowerCase()} yet`}
          emptyDescription="Create the first one — it starts as a draft and only reaches players when you publish."
          initialSorting={[{ id: 'key', desc: false }]}
        />
      )}

      <CreateEntityModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        typePath={typePath}
        existingKeys={existingKeys}
        duplicateOf={duplicateOf}
      />

      <ConfirmTyped
        opened={pendingDelete !== undefined}
        onClose={() => setPendingDelete(undefined)}
        title={`Delete ${pendingDelete?.key ?? ''}?`}
        confirmLabel="Delete"
        loading={remove.isPending}
        // Live content is only tombstoned here; the removal happens at publish. That is
        // still a change every player will see, so it takes a typed confirmation.
        phrase={pendingDelete?.state === 'live' ? pendingDelete.key : undefined}
        onConfirm={() => {
          if (!pendingDelete) return;
          const key = pendingDelete.key;
          remove.mutate(key, {
            onSuccess: (result) => {
              setPendingDelete(undefined);
              notifySuccess(
                result.pendingDelete ? 'Marked for deletion' : 'Draft deleted',
                result.pendingDelete
                  ? `${key} disappears from the game at the next publish.`
                  : `${key} never went live, so it is simply gone.`,
              );
            },
            onError: (error) => notifyError('Could not delete', error),
          });
        }}
      >
        <Text size="sm">
          {pendingDelete?.state === 'live'
            ? 'This entity is live. Deleting marks it for removal; it vanishes from the game at the next publish, and anything still referencing it will fail validation.'
            : 'This is an unpublished draft. Deleting it removes the draft outright.'}
        </Text>
      </ConfirmTyped>
    </>
  );
}

function RowMenu({
  item,
  onDuplicate,
  onDelete,
  onDiscardDraft,
}: {
  item: ContentListItem;
  onDuplicate: () => void;
  onDelete: () => void;
  onDiscardDraft: () => void;
}): ReactNode {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Actions for ${item.key}`}
        >
          <IconDotsVertical size={14} />
        </Button>
      </Menu.Target>
      <Menu.Dropdown onClick={(event) => event.stopPropagation()}>
        <Menu.Item leftSection={<IconCopy size={14} />} onClick={onDuplicate}>
          Duplicate
        </Menu.Item>
        {item.state !== 'live' && (
          <Menu.Item leftSection={<IconArrowBackUp size={14} />} onClick={onDiscardDraft}>
            Discard draft
          </Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={onDelete}>
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** Most entities carry a `name`; the ones that do not fall back to their key. */
function displayName(item: ContentListItem): string {
  const name = item.data?.name;
  if (typeof name === 'string' && name.length > 0) return name;
  const label = item.data?.label;
  if (typeof label === 'string' && label.length > 0) return label;
  return '—';
}
