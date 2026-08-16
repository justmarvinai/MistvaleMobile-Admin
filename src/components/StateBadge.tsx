import type { ReactNode } from 'react';
import { Badge, Tooltip } from '@mantine/core';
import type { ContentState, DiffRisk } from '@/api/types';

/**
 * The publish-state badge.
 *
 * An operator's first question on any list is "what of this is live and what is still
 * mine", so the three states get distinct colours and an explanation on hover.
 */

const STATE_META: Record<ContentState, { color: string; label: string; help: string }> = {
  live: { color: 'gray', label: 'live', help: 'Published — players see this now.' },
  draft: {
    color: 'yellow',
    label: 'draft',
    help: 'Edited but not published. Publish to make it live.',
  },
  deleting: {
    color: 'red',
    label: 'deleting',
    help: 'Marked for removal. It disappears from the game at the next publish.',
  },
};

export function StateBadge({ state }: { state: ContentState }): ReactNode {
  const meta = STATE_META[state];
  return (
    <Tooltip label={meta.help} withArrow position="right">
      <Badge size="sm" variant="light" color={meta.color}>
        {meta.label}
      </Badge>
    </Tooltip>
  );
}

const RISK_META: Record<DiffRisk, { color: string; label: string; help: string }> = {
  rates: {
    color: 'red',
    label: 'rates',
    help: 'Changes summon odds. Players notice, and trust is hard to win back.',
  },
  balance: {
    color: 'orange',
    label: 'balance',
    help: 'Changes power of something players already own.',
  },
  economy: {
    color: 'yellow',
    label: 'economy',
    help: 'Changes rewards, prices or a tuning constant.',
  },
};

export function RiskBadge({ risk }: { risk: DiffRisk }): ReactNode {
  const meta = RISK_META[risk];
  return (
    <Tooltip label={meta.help} withArrow>
      <Badge size="sm" variant="filled" color={meta.color}>
        {meta.label}
      </Badge>
    </Tooltip>
  );
}

const CHANGE_COLORS = { added: 'teal', modified: 'blue', removed: 'red' } as const;

export function ChangeBadge({ change }: { change: 'added' | 'modified' | 'removed' }): ReactNode {
  return (
    <Badge size="sm" variant="light" color={CHANGE_COLORS[change]}>
      {change}
    </Badge>
  );
}
