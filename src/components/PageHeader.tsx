import type { ReactNode } from 'react';
import { Box, Group, Stack, Text, Title } from '@mantine/core';

/** Consistent page heading: title, one explanatory line, and the page's actions. */
export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
}): ReactNode {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" mb="lg">
      <Stack gap={2}>
        <Group gap="xs">
          <Title order={2} size="h3">
            {title}
          </Title>
          {badge}
        </Group>
        {description && (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        )}
      </Stack>
      {actions && <Box style={{ flexShrink: 0 }}>{actions}</Box>}
    </Group>
  );
}
