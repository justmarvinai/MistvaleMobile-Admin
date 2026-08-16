import { useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Button,
  Group,
  Menu,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconChecklist,
  IconChevronDown,
  IconLogout,
  IconRefresh,
  IconRocket,
} from '@tabler/icons-react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useContentOverview, useLogout, useMe, useValidateContent } from '@/api/hooks';
import { notifyError, notifyInfo, notifySuccess } from '@/lib/notify';
import { PublishModal } from '@/features/publish/PublishModal';

/**
 * The persistent top bar (ADMIN_SUITE_DESIGN §1).
 *
 * Content revision, the draft counter, and Validate + Publish one click away from
 * wherever the operator is — the whole point of the bar is that publishing never
 * requires navigating somewhere first.
 */
export function TopBar(): ReactNode {
  const overview = useContentOverview();
  const me = useMe();
  const logout = useLogout();
  const validate = useValidateContent();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [publishOpen, setPublishOpen] = useState(false);

  const draftCount = overview.data?.draftCount ?? 0;
  const rev = overview.data?.rev;

  const runValidate = (): void => {
    validate.mutate(undefined, {
      onSuccess: (result) => {
        if (result.errors.length > 0) {
          notifyError(
            `Validation failed — ${result.errors.length} ${result.errors.length === 1 ? 'error' : 'errors'}`,
            new Error('Open the publish center to see every problem.'),
          );
          void navigate({ to: '/publish' });
          return;
        }
        if (result.warnings.length > 0) {
          notifyInfo(
            `Valid, with ${result.warnings.length} ${result.warnings.length === 1 ? 'warning' : 'warnings'}`,
            `${result.checked} entries checked. Warnings do not block a publish.`,
          );
          return;
        }
        notifySuccess('Content is valid', `${result.checked} entries checked, no problems.`);
      },
      onError: (error) => notifyError('Could not validate', error),
    });
  };

  return (
    <>
      <Group justify="space-between" style={{ flex: 1 }} wrap="nowrap" gap="sm">
        <Group gap="sm" wrap="nowrap">
          <UnstyledButton component={Link} to="/">
            <Group gap={8} wrap="nowrap">
              <Text fw={700} size="sm" c="mist.3" lts={1}>
                MISTVALE
              </Text>
              <Text fw={500} size="sm" c="dimmed">
                Admin
              </Text>
            </Group>
          </UnstyledButton>

          <Tooltip label="Live content revision — every published change bumps it" withArrow>
            <Badge variant="default" size="sm" ff="monospace">
              {rev === undefined ? 'rev —' : `rev #${rev}`}
            </Badge>
          </Tooltip>
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Tooltip
            label={
              draftCount === 0
                ? 'No unpublished changes'
                : `${draftCount} unpublished ${draftCount === 1 ? 'change' : 'changes'} — open the publish center`
            }
            withArrow
          >
            <Button
              component={Link}
              to="/publish"
              size="compact-sm"
              variant={draftCount > 0 ? 'light' : 'subtle'}
              color={draftCount > 0 ? 'yellow' : 'gray'}
            >
              {draftCount === 0
                ? 'No drafts'
                : `${draftCount} draft ${draftCount === 1 ? 'change' : 'changes'}`}
            </Button>
          </Tooltip>

          <Button
            size="compact-sm"
            variant="default"
            leftSection={<IconChecklist size={14} />}
            onClick={runValidate}
            loading={validate.isPending}
            disabled={draftCount === 0}
          >
            Validate
          </Button>

          <Button
            size="compact-sm"
            color="mist"
            leftSection={<IconRocket size={14} />}
            onClick={() => setPublishOpen(true)}
            disabled={draftCount === 0}
          >
            Publish…
          </Button>

          <Tooltip label="Re-fetch everything from the server" withArrow>
            <ActionIcon
              variant="subtle"
              color="gray"
              onClick={() => {
                void queryClient.invalidateQueries();
              }}
              aria-label="Refresh"
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>

          <Menu position="bottom-end" width={200}>
            <Menu.Target>
              <UnstyledButton>
                <Group gap={6} wrap="nowrap">
                  <Avatar size={26} radius="sm" color="mist">
                    {(me.data?.account.accountName ?? '?').slice(0, 2).toUpperCase()}
                  </Avatar>
                  <Text size="sm" visibleFrom="sm">
                    {me.data?.account.accountName ?? '…'}
                  </Text>
                  <IconChevronDown size={14} />
                </Group>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Signed in as {me.data?.account.rank ?? 'admin'}</Menu.Label>
              <Menu.Item
                color="red"
                leftSection={<IconLogout size={14} />}
                onClick={() => {
                  logout.mutate(undefined, {
                    onSuccess: () => void navigate({ to: '/login', search: {} }),
                    onError: (error) => notifyError('Could not sign out', error),
                  });
                }}
              >
                Sign out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Group>

      <PublishModal opened={publishOpen} onClose={() => setPublishOpen(false)} />
    </>
  );
}
