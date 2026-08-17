import { useState, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  Progress,
  Radio,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconInfoCircle, IconSend } from '@tabler/icons-react';
import { useMailBatches, useSendMail } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import { RewardPicker } from '@/components/RewardPicker';
import { formatRelative } from '@/lib/format';
import type { MailTarget } from '@/api/types';

/**
 * The mail composer (ADMIN_SUITE_DESIGN §2.16).
 *
 * The one place in the suite that hands players currency directly and irreversibly — a
 * message cannot be unsent, and a thousand of them cannot be unsent one at a time. So the
 * send is guarded twice: attachments go through the same reward picker every editor uses
 * (which only offers keys that exist), and a send to everybody has to be typed out before
 * the button will do anything.
 *
 * Underneath it, the log: one row per send, with how many took what it carried. That is
 * the question an operator actually has after a compensation mail, and it is why the send
 * writes a batch id rather than a thousand unrelated rows.
 */
export function MailComposerPage(): ReactNode {
  const batches = useMailBatches();
  const send = useSendMail();

  const [target, setTarget] = useState<MailTarget>('player');
  const [playerId, setPlayerId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<Record<string, number>>({});
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [confirmation, setConfirmation] = useState('');
  const [sentNote, setSentNote] = useState<string | null>(null);

  // Typing the word is the guard on the irreversible half. One player is a support action;
  // everybody is a broadcast, and the difference should cost a moment.
  const confirmed = target === 'player' || confirmation.trim().toLowerCase() === 'everybody';
  const ready =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    confirmed &&
    (target === 'player' ? playerId.trim().length > 0 : true);

  const submit = (): void => {
    send.mutate(
      {
        target,
        ...(target === 'player' ? { playerId: playerId.trim() } : {}),
        title: title.trim(),
        body: body.trim(),
        attachments,
        expiresInDays,
      },
      {
        onSuccess: (result) => {
          setSentNote(
            `Sent to ${result.recipients} ${result.recipients === 1 ? 'player' : 'players'}.`,
          );
          setTitle('');
          setBody('');
          setAttachments({});
          setConfirmation('');
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Mail"
        description="Gifts, apologies, and the things a player has to be told directly. Everything sent here is audited and lands in the player's economy log."
      />

      <Stack gap="lg">
        <Paper p="md" withBorder>
          <Stack gap="md">
            <Title order={4}>Compose</Title>

            <Radio.Group
              label="Who receives it"
              value={target}
              onChange={(value) => {
                setTarget(value as MailTarget);
                setConfirmation('');
              }}
            >
              <Group mt="xs">
                <Radio value="player" label="One player" />
                <Radio value="all" label="Every player" />
              </Group>
            </Radio.Group>

            {target === 'player' && (
              <TextInput
                label="Player id"
                description="From the player's page — the id in its address, not the profile name."
                placeholder="00000000-0000-0000-0000-000000000000"
                value={playerId}
                onChange={(event) => setPlayerId(event.currentTarget.value)}
              />
            )}

            <TextInput
              label="Title"
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />

            <Textarea
              label="Message"
              description="Blank lines separate paragraphs. **Bold** and *emphasis* work; nothing else does, and the player sees text rather than markup either way."
              autosize
              minRows={5}
              maxLength={4000}
              value={body}
              onChange={(event) => setBody(event.currentTarget.value)}
            />

            <RewardPicker
              label="Attached"
              description="Currencies and items. A message with nothing attached is simply a message."
              value={attachments}
              onChange={setAttachments}
            />

            <NumberInput
              label="Expires after (days)"
              description="Uncollected attachments are gone when it expires. Zero means it keeps forever — use that sparingly; an inbox nothing leaves is an inbox nobody reads."
              min={0}
              max={365}
              value={expiresInDays}
              onChange={(value) => setExpiresInDays(typeof value === 'number' ? value : 0)}
            />

            {target === 'all' && (
              <Alert
                color="orange"
                icon={<IconAlertTriangle size={16} />}
                title="This reaches every player"
              >
                <Stack gap="xs">
                  <Text size="sm">
                    A send cannot be recalled, and attachments are paid the moment somebody collects
                    them. Type <b>everybody</b> to confirm.
                  </Text>
                  <TextInput
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.currentTarget.value)}
                    placeholder="everybody"
                    aria-label="Type everybody to confirm"
                  />
                </Stack>
              </Alert>
            )}

            {send.isError && (
              <Alert color="red" icon={<IconAlertTriangle size={16} />} title="Not sent">
                {send.error.message}
              </Alert>
            )}

            {sentNote && !send.isError && (
              <Alert color="green" icon={<IconInfoCircle size={16} />} title="Sent">
                {sentNote}
              </Alert>
            )}

            <Group justify="flex-end">
              <Button
                leftSection={<IconSend size={16} />}
                disabled={!ready || send.isPending}
                loading={send.isPending}
                onClick={submit}
              >
                Send
              </Button>
            </Group>
          </Stack>
        </Paper>

        <Paper p="md" withBorder>
          <Title order={4} mb="sm">
            Sent
          </Title>

          {batches.isPending ? (
            <LoadingState label="Reading the log…" />
          ) : batches.isError ? (
            <ErrorState error={batches.error} onRetry={() => void batches.refetch()} />
          ) : batches.data.batches.length === 0 ? (
            <Text c="dimmed" size="sm">
              Nothing sent yet. What the game itself raises — the rewards a full roster could not
              take, and anything a future system posts — is not listed here; this is the record of
              what an operator sent.
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={720}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Title</Table.Th>
                    <Table.Th>Sent</Table.Th>
                    <Table.Th>By</Table.Th>
                    <Table.Th>Reached</Table.Th>
                    <Table.Th>Read</Table.Th>
                    <Table.Th>Collected</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {batches.data.batches.map((batch) => {
                    const carrying = Object.keys(batch.attachments).length > 0;
                    const collectedPct =
                      batch.recipients > 0 ? (batch.claimed / batch.recipients) * 100 : 0;

                    return (
                      <Table.Tr key={batch.batchId}>
                        <Table.Td>
                          <Group gap="xs">
                            <Text size="sm">{batch.title}</Text>
                            {carrying && (
                              <Badge size="xs" variant="light" color="yellow">
                                gift
                              </Badge>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {formatRelative(batch.sentAt)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {batch.sentBy}
                          </Text>
                        </Table.Td>
                        <Table.Td>{batch.recipients}</Table.Td>
                        <Table.Td>{batch.read}</Table.Td>
                        <Table.Td>
                          {carrying ? (
                            <Group gap="xs" wrap="nowrap">
                              <Progress value={collectedPct} w={80} size="sm" />
                              <Text size="xs" c="dimmed">
                                {batch.claimed}
                              </Text>
                            </Group>
                          ) : (
                            <Text size="xs" c="dimmed">
                              —
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Paper>
      </Stack>
    </>
  );
}
