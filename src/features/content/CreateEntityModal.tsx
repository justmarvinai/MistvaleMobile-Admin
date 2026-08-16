import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { contentTypeByPath } from '@/lib/content-registry';
import { validateContentKey } from './templates';

/**
 * "New entity" / "Duplicate entity".
 *
 * Only collects the key, then hands off to the type's editor in create mode. Nothing is
 * written until the operator saves there — a mis-clicked New must not leave a stray
 * draft in the publish diff.
 */
export function CreateEntityModal({
  opened,
  onClose,
  typePath,
  existingKeys,
  duplicateOf,
}: {
  opened: boolean;
  onClose: () => void;
  typePath: string;
  existingKeys: ReadonlySet<string>;
  /** When set, the editor starts from this entity's data instead of the template. */
  duplicateOf?: string;
}): ReactNode {
  const info = contentTypeByPath(typePath);
  const navigate = useNavigate();
  const [key, setKey] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setKey(duplicateOf ? suggestCopyKey(duplicateOf, existingKeys) : '');
    setTouched(false);
  }, [opened, duplicateOf, existingKeys]);

  const trimmed = key.trim();
  const formatError = trimmed.length === 0 ? 'Enter a key.' : validateContentKey(trimmed);
  const takenError = existingKeys.has(trimmed) ? 'That key already exists.' : undefined;
  const error = formatError ?? takenError;

  const submit = (): void => {
    setTouched(true);
    if (error) return;
    void navigate({
      to: '/content/$typePath/$key',
      params: { typePath, key: trimmed },
      search: duplicateOf ? { create: true, from: duplicateOf } : { create: true },
    });
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={duplicateOf ? `Duplicate ${duplicateOf}` : `New ${singular(info?.label ?? 'entity')}`}
      size="md"
    >
      <Stack gap="md">
        <TextInput
          label="Key"
          description="Lowercase snake_case. Keys are permanent — seeds, assets and saved player data all reference them."
          placeholder="ember_warden"
          value={key}
          onChange={(event) => setKey(event.currentTarget.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
          error={touched ? error : undefined}
          data-autofocus
        />

        <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
          <Text size="xs">
            {duplicateOf
              ? `The editor opens pre-filled with ${duplicateOf}'s values. Nothing is saved until you save there.`
              : 'The editor opens with a valid starting template. Nothing is saved until you save there.'}
          </Text>
        </Alert>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="mist" onClick={submit} disabled={touched && Boolean(error)}>
            Open editor
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

/** `ember_warden` → `ember_warden_copy`, then `_copy_2`, … until one is free. */
function suggestCopyKey(source: string, taken: ReadonlySet<string>): string {
  const base = `${source}_copy`;
  if (!taken.has(base)) return base;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}_${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}

function singular(label: string): string {
  if (label.endsWith('ies')) return `${label.slice(0, -3)}y`;
  if (label.endsWith('es') && label.endsWith('ses')) return label.slice(0, -2);
  if (label.endsWith('s')) return label.slice(0, -1);
  return label;
}
