import { useEffect, useState, type ReactNode } from 'react';
import { Button, Code, Group, Modal, Stack, Text, TextInput } from '@mantine/core';

/**
 * Destructive-action confirmation.
 *
 * Two strengths: a plain confirm for reversible things (discarding a draft), and a typed
 * confirm — the operator must retype an exact phrase — for anything that changes what
 * players see (revert, deleting live content). Safety rails are features, not polish
 * (CLAUDE.md).
 */
export function ConfirmTyped({
  opened,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  /** When set, the confirm button unlocks only once this exact text is typed. */
  phrase,
  loading = false,
  danger = true,
}: {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  phrase?: string;
  loading?: boolean;
  danger?: boolean;
}): ReactNode {
  const [typed, setTyped] = useState('');

  // Reopening must not inherit the previous attempt's text, or the second confirmation
  // would be unlocked before the operator has read it.
  useEffect(() => {
    if (opened) setTyped('');
  }, [opened]);

  const unlocked = phrase === undefined || typed.trim() === phrase;

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="md">
      <Stack gap="md">
        <div>{children}</div>

        {phrase !== undefined && (
          <TextInput
            label={
              <Text size="sm">
                Type <Code>{phrase}</Code> to confirm
              </Text>
            }
            value={typed}
            onChange={(event) => setTyped(event.currentTarget.value)}
            autoComplete="off"
            data-autofocus
          />
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            color={danger ? 'red' : 'mist'}
            onClick={onConfirm}
            disabled={!unlocked}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
