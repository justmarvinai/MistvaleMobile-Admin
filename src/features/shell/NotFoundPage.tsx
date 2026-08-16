import type { ReactNode } from 'react';
import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';

export function NotFoundPage({
  title = 'Page not found',
  description = 'That screen does not exist in the Admin Suite.',
}: {
  title?: string;
  description?: string;
}): ReactNode {
  return (
    <Center py="xl">
      <Stack align="center" gap="sm" maw={460}>
        <Title order={2} size="h3">
          {title}
        </Title>
        <Text size="sm" c="dimmed" ta="center">
          {description}
        </Text>
        <Button
          component={Link}
          to="/"
          variant="default"
          leftSection={<IconArrowLeft size={16} />}
          mt="sm"
        >
          Back to dashboard
        </Button>
      </Stack>
    </Center>
  );
}
