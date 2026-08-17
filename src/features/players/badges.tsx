import type { ReactNode } from 'react';
import { Badge } from '@mantine/core';
import type { AccountRank, AccountStatus } from '@/api/types';

/**
 * Rank and status, coloured consistently wherever they appear.
 *
 * Small enough to inline, shared because they appear in the search table, the account
 * header and the confirmation dialogs — and three copies would eventually disagree about
 * what colour "banned" is.
 */

const RANK_COLOR: Record<AccountRank, string> = {
  player: 'gray',
  gamemaster: 'blue',
  admin: 'mist',
};

export function RankBadge({ rank }: { rank: AccountRank }): ReactNode {
  return (
    <Badge size="sm" variant="light" color={RANK_COLOR[rank]}>
      {rank}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: AccountStatus }): ReactNode {
  return (
    <Badge
      size="sm"
      variant={status === 'banned' ? 'filled' : 'light'}
      color={status === 'banned' ? 'red' : 'green'}
    >
      {status}
    </Badge>
  );
}
