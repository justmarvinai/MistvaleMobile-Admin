import type { ReactNode } from 'react';
import { Alert, Box, Button, Center, Code, Group, Loader, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconMoodEmpty, IconRefresh } from '@tabler/icons-react';
import { ApiError } from '@/api/client';

/**
 * The three states every server-backed view owes the operator: loading, error, empty.
 *
 * Centralised so no screen can quietly skip one — "real loading, empty and error states
 * everywhere" is a requirement, not polish.
 */

export function LoadingState({ label = 'Loading…' }: { label?: string }): ReactNode {
  return (
    <Center py="xl">
      <Group gap="sm">
        <Loader size="sm" color="mist" />
        <Text c="dimmed" size="sm">
          {label}
        </Text>
      </Group>
    </Center>
  );
}

export function ErrorState({
  error,
  title = 'Something went wrong',
  onRetry,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}): ReactNode {
  const apiError = error instanceof ApiError ? error : undefined;
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
  const issues = apiError?.fieldIssues() ?? [];

  return (
    <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} title={title} my="md">
      <Stack gap="xs">
        <Text size="sm">{message}</Text>

        {issues.length > 0 && (
          <Stack gap={2}>
            {issues.map((issue) => (
              <Text key={`${issue.path}-${issue.message}`} size="xs" c="dimmed">
                <Code>{issue.path || '(root)'}</Code> {issue.message}
              </Text>
            ))}
          </Stack>
        )}

        <Group gap="sm">
          {apiError && (
            <Text size="xs" c="dimmed">
              {apiError.code}
              {apiError.requestId ? ` · request ${apiError.requestId}` : ''}
            </Text>
          )}
          {onRetry && (
            <Button
              size="compact-xs"
              variant="subtle"
              color="red"
              leftSection={<IconRefresh size={14} />}
              onClick={onRetry}
            >
              Try again
            </Button>
          )}
        </Group>
      </Stack>
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}): ReactNode {
  return (
    <Center py="xl">
      <Stack align="center" gap="xs" maw={420}>
        <Box c="dimmed">
          <IconMoodEmpty size={32} />
        </Box>
        <Text fw={600}>{title}</Text>
        {description && (
          <Text size="sm" c="dimmed" ta="center">
            {description}
          </Text>
        )}
        {action}
      </Stack>
    </Center>
  );
}

/**
 * Renders the right state for a query result.
 *
 * Takes the pieces of a TanStack Query result rather than the result object itself, so
 * it composes with queries of any shape without a generic dance at every call site.
 */
export function QueryState({
  isPending,
  error,
  onRetry,
  loadingLabel,
  errorTitle,
  children,
}: {
  isPending: boolean;
  error: unknown;
  onRetry?: () => void;
  loadingLabel?: string;
  errorTitle?: string;
  children: ReactNode;
}): ReactNode {
  if (isPending) return <LoadingState label={loadingLabel} />;
  if (error) return <ErrorState error={error} title={errorTitle} onRetry={onRetry} />;
  return <>{children}</>;
}
