import { useEffect, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconShieldLock } from '@tabler/icons-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from '@tanstack/react-router';
import { ApiError } from '@/api/client';
import { useLogin, useMe } from '@/api/hooks';

/**
 * Admin sign-in.
 *
 * The server accepts only `admin`-rank accounts here and answers everything else with
 * INVALID_CREDENTIALS — deliberately identical to a wrong password, so probing the Admin
 * API cannot reveal which accounts hold which rank. The form says so plainly rather than
 * letting an admin-in-waiting think their password is broken.
 */

const loginSchema = z.object({
  accountName: z
    .string()
    .trim()
    .min(3, 'Account name must be at least 3 characters.')
    .max(20, 'Account name must be at most 20 characters.'),
  password: z.string().min(1, 'Enter your password.'),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage({ redirectTo }: { redirectTo?: string }): ReactNode {
  const login = useLogin();
  const me = useMe();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { accountName: '', password: '' },
  });

  // An operator who is already signed in should never be parked on a login form —
  // arriving here with a live session (bookmark, back button) goes straight through.
  useEffect(() => {
    if (!me.data) return;
    void navigate({ to: '/', replace: true });
  }, [me.data, navigate]);

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => {
        // Only same-origin paths are honoured; an absolute URL in the query string
        // would otherwise make this an open redirect.
        if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
          window.location.assign(redirectTo);
          return;
        }
        void navigate({ to: '/', replace: true });
      },
    });
  });

  const error = login.error;
  const rejected = error instanceof ApiError && error.code === 'INVALID_CREDENTIALS';

  return (
    <Center mih="100vh" p="md">
      <Box w="100%" maw={400}>
        <Stack gap={4} align="center" mb="xl">
          <Text fw={700} size="lg" c="mist.3" lts={2}>
            MISTVALE
          </Text>
          <Text size="sm" c="dimmed">
            Admin Suite
          </Text>
        </Stack>

        <Paper p="lg" radius="sm">
          <form onSubmit={onSubmit} noValidate>
            <Stack gap="md">
              <Title order={3} size="h4">
                Sign in
              </Title>

              {error && (
                <Alert
                  color="red"
                  variant="light"
                  icon={<IconAlertTriangle size={16} />}
                  title={rejected ? 'Sign-in refused' : 'Could not sign in'}
                >
                  <Stack gap={4}>
                    <Text size="sm">{error.message}</Text>
                    {rejected && (
                      <Text size="xs" c="dimmed">
                        The Admin Suite accepts Admin-rank accounts only. A correct password on a
                        Player or GameMaster account is refused with this same message. Rank is
                        granted on the server with{' '}
                        <Text span ff="monospace" size="xs">
                          SET_RANK.sh
                        </Text>
                        .
                      </Text>
                    )}
                    {error.requestId && (
                      <Text size="xs" c="dimmed">
                        request {error.requestId}
                      </Text>
                    )}
                  </Stack>
                </Alert>
              )}

              <TextInput
                label="Account name"
                placeholder="your account name"
                autoComplete="username"
                autoFocus
                error={errors.accountName?.message}
                {...register('accountName')}
              />

              <PasswordInput
                label="Password"
                placeholder="your password"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register('password')}
              />

              <Button
                type="submit"
                fullWidth
                color="mist"
                loading={login.isPending}
                leftSection={<IconShieldLock size={16} />}
              >
                Sign in
              </Button>

              <Text size="xs" c="dimmed" ta="center">
                No e-mail, no self-serve signup. Lost admin access is recovered on the server with
                SET_RANK.sh.
              </Text>
            </Stack>
          </form>
        </Paper>
      </Box>
    </Center>
  );
}
