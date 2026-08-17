import { useState, type ReactNode } from 'react';
import {
  Alert,
  Button,
  Card,
  Code,
  CopyButton,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconCopy, IconKey } from '@tabler/icons-react';
import {
  useGrant,
  useRenamePlayer,
  useResetPassword,
  useRevokeSessions,
  useSetBanned,
  useSetRank,
} from '@/api/hooks';
import { ApiError } from '@/api/client';
import { ConfirmTyped } from '@/components/ConfirmTyped';
import { ACCOUNT_RANKS, type AdminPlayerDetail } from '@/api/types';

/**
 * The six things an operator can do to an account (ADMIN_SUITE_DESIGN §2.14).
 *
 * All six confirm first, and the two that cannot be undone by clicking again — a password
 * reset and a ban — confirm by *typing* the account name. Safety rails are features
 * (CLAUDE.md), and the account name is the right phrase to demand: it is the one thing an
 * operator who has the wrong account open would get wrong.
 *
 * The temporary password is shown once, here, with a copy button. It is deliberately not
 * re-readable: the server keeps only its hash, so a second look would mean storing a
 * credential somewhere to look at.
 */
export function PlayerActions({ detail }: { detail: AdminPlayerDetail }): ReactNode {
  const id = detail.player.id;
  const banned = detail.account.status === 'banned';

  const reset = useResetPassword(id);
  const setRank = useSetRank(id);
  const setBanned = useSetBanned(id);
  const rename = useRenamePlayer(id);
  const grant = useGrant(id);
  const revoke = useRevokeSessions(id);

  const [confirming, setConfirming] = useState<'reset' | 'ban' | 'unban' | 'revoke' | null>(null);
  const [temporary, setTemporary] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [profileName, setProfileName] = useState(detail.player.profileName);
  const [grantForm, setGrantForm] = useState({
    silver: 0,
    crystals: 0,
    valorMedals: 0,
    note: '',
  });

  /** Every action reports the same way, so a failure never passes silently. */
  const report = (message: string) => (): void => {
    notifications.show({ color: 'green', message, icon: <IconCheck size={16} /> });
  };
  const complain = (error: unknown): void => {
    notifications.show({
      color: 'red',
      title: 'That did not work',
      message: error instanceof ApiError ? error.message : 'Something went wrong.',
    });
  };

  return (
    <Stack gap="lg">
      <Card withBorder padding="md">
        <Title order={5} mb="xs">
          Password
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          Mistvale has no e-mail addresses, so this is the only reset there is. The account is
          signed out everywhere and cannot play again until it has chosen a new password.
        </Text>

        {temporary ? (
          <Alert color="yellow" icon={<IconKey size={16} />} title="Read this out now">
            <Stack gap="xs">
              <Text size="sm">It is shown once — the server keeps only its hash.</Text>
              <Group gap="xs">
                <Code style={{ fontSize: 16 }}>{temporary}</Code>
                <CopyButton value={temporary}>
                  {({ copied, copy }) => (
                    <Button
                      size="xs"
                      variant="light"
                      color={copied ? 'green' : 'gray'}
                      leftSection={<IconCopy size={14} />}
                      onClick={copy}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
              <Button size="xs" variant="subtle" onClick={() => setTemporary(null)}>
                Done
              </Button>
            </Stack>
          </Alert>
        ) : (
          <Button
            color="yellow"
            variant="light"
            loading={reset.isPending}
            onClick={() => setConfirming('reset')}
          >
            Reset password
          </Button>
        )}
      </Card>

      <Card withBorder padding="md">
        <Title order={5} mb="md">
          Account
        </Title>
        <Stack gap="md">
          <Select
            label="Rank"
            description="Only Admin rank can open this suite. You cannot change your own."
            data={ACCOUNT_RANKS.map((rank) => ({ value: rank, label: rank }))}
            value={detail.account.rank}
            allowDeselect={false}
            disabled={setRank.isPending}
            onChange={(value) => {
              if (!value || value === detail.account.rank) return;
              setRank.mutate(value as (typeof ACCOUNT_RANKS)[number], {
                onSuccess: report(`Rank set to ${value}.`),
                onError: complain,
              });
            }}
          />

          <Divider />

          {banned ? (
            <Button
              color="green"
              variant="light"
              loading={setBanned.isPending}
              onClick={() => setConfirming('unban')}
            >
              Lift the ban
            </Button>
          ) : (
            <Stack gap="xs">
              <TextInput
                label="Ban reason"
                description="Required — the account is shown it when it next tries to sign in."
                placeholder="Why this account is being banned"
                value={banReason}
                onChange={(event) => setBanReason(event.currentTarget.value)}
              />
              <Button
                color="red"
                variant="light"
                disabled={banReason.trim().length < 3}
                loading={setBanned.isPending}
                onClick={() => setConfirming('ban')}
              >
                Ban account
              </Button>
            </Stack>
          )}

          <Divider />

          <Group align="flex-end" gap="sm">
            <TextInput
              label="Profile name"
              description="The support path for a name that has to go."
              value={profileName}
              onChange={(event) => setProfileName(event.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button
              variant="light"
              disabled={profileName.trim() === detail.player.profileName}
              loading={rename.isPending}
              onClick={() =>
                rename.mutate(profileName.trim(), {
                  onSuccess: report('Profile renamed.'),
                  onError: complain,
                })
              }
              mb={2}
            >
              Rename
            </Button>
          </Group>

          <Divider />

          <Button
            variant="subtle"
            color="gray"
            disabled={detail.sessions.length === 0}
            loading={revoke.isPending}
            onClick={() => setConfirming('revoke')}
          >
            Sign out everywhere ({detail.sessions.length})
          </Button>
        </Stack>
      </Card>

      <Card withBorder padding="md">
        <Title order={5} mb="xs">
          Grant
        </Title>
        <Text size="sm" c="dimmed" mb="md">
          Goes through RewardService, so it lands in the economy ledger beside the battle payouts.
          Negative amounts take things away.
        </Text>
        <Stack gap="sm">
          <Group grow>
            <NumberInput
              label="Silver"
              value={grantForm.silver}
              onChange={(value) =>
                setGrantForm((form) => ({ ...form, silver: Number(value) || 0 }))
              }
            />
            <NumberInput
              label="Crystals"
              value={grantForm.crystals}
              onChange={(value) =>
                setGrantForm((form) => ({ ...form, crystals: Number(value) || 0 }))
              }
            />
            <NumberInput
              label="Valor"
              value={grantForm.valorMedals}
              onChange={(value) =>
                setGrantForm((form) => ({ ...form, valorMedals: Number(value) || 0 }))
              }
            />
          </Group>
          <Textarea
            label="Note"
            description="Recorded in the audit trail. Say why."
            placeholder="Compensation for the forge bug on the 14th"
            autosize
            minRows={2}
            value={grantForm.note}
            onChange={(event) =>
              setGrantForm((form) => ({ ...form, note: event.currentTarget.value }))
            }
          />
          <Button
            variant="light"
            loading={grant.isPending}
            disabled={
              grantForm.note.trim().length < 3 ||
              (grantForm.silver === 0 && grantForm.crystals === 0 && grantForm.valorMedals === 0)
            }
            onClick={() =>
              grant.mutate(
                {
                  ...(grantForm.silver !== 0 ? { silver: grantForm.silver } : {}),
                  ...(grantForm.crystals !== 0 ? { crystals: grantForm.crystals } : {}),
                  ...(grantForm.valorMedals !== 0 ? { valorMedals: grantForm.valorMedals } : {}),
                  note: grantForm.note.trim(),
                },
                {
                  onSuccess: () => {
                    setGrantForm({ silver: 0, crystals: 0, valorMedals: 0, note: '' });
                    report('Granted.')();
                  },
                  onError: complain,
                },
              )
            }
          >
            Grant
          </Button>
        </Stack>
      </Card>

      <ConfirmTyped
        opened={confirming === 'reset'}
        onClose={() => setConfirming(null)}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSuccess: (result) => {
              setTemporary(result.temporaryPassword);
              setConfirming(null);
              report(`Password reset — ${result.sessionsRevoked} session(s) signed out.`)();
            },
            onError: (error) => {
              setConfirming(null);
              complain(error);
            },
          })
        }
        title="Reset this password?"
        confirmLabel="Reset password"
        phrase={detail.account.accountName}
        loading={reset.isPending}
      >
        <Text size="sm">
          <strong>{detail.account.accountName}</strong> will be signed out everywhere and given a
          temporary password, which you will see once. They cannot play again until they have
          replaced it.
        </Text>
      </ConfirmTyped>

      <ConfirmTyped
        opened={confirming === 'ban'}
        onClose={() => setConfirming(null)}
        onConfirm={() =>
          setBanned.mutate(
            { banned: true, reason: banReason.trim() },
            {
              onSuccess: () => {
                setConfirming(null);
                report('Account banned.')();
              },
              onError: (error) => {
                setConfirming(null);
                complain(error);
              },
            },
          )
        }
        title="Ban this account?"
        confirmLabel="Ban"
        phrase={detail.account.accountName}
        loading={setBanned.isPending}
      >
        <Text size="sm">
          <strong>{detail.account.accountName}</strong> will be signed out immediately and shown “
          {banReason.trim()}” at every sign-in attempt.
        </Text>
      </ConfirmTyped>

      <ConfirmTyped
        opened={confirming === 'unban'}
        onClose={() => setConfirming(null)}
        onConfirm={() =>
          setBanned.mutate(
            { banned: false },
            {
              onSuccess: () => {
                setConfirming(null);
                report('Ban lifted.')();
              },
              onError: (error) => {
                setConfirming(null);
                complain(error);
              },
            },
          )
        }
        title="Lift the ban?"
        confirmLabel="Lift ban"
        danger={false}
        loading={setBanned.isPending}
      >
        <Text size="sm">
          <strong>{detail.account.accountName}</strong> will be able to sign in again with their
          existing password.
        </Text>
      </ConfirmTyped>

      <ConfirmTyped
        opened={confirming === 'revoke'}
        onClose={() => setConfirming(null)}
        onConfirm={() =>
          revoke.mutate(undefined, {
            onSuccess: (result) => {
              setConfirming(null);
              report(`${result.revoked} session(s) signed out.`)();
            },
            onError: (error) => {
              setConfirming(null);
              complain(error);
            },
          })
        }
        title="Sign this account out everywhere?"
        confirmLabel="Sign out"
        danger={false}
        loading={revoke.isPending}
      >
        <Text size="sm">
          The password keeps working — they will just have to use it again. Use this when a session
          may be in the wrong hands but the credentials are not.
        </Text>
      </ConfirmTyped>
    </Stack>
  );
}
