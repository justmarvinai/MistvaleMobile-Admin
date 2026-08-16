import { useMemo, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Box, Center, Group, Table, Text, TextInput, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconSearch, IconSelector } from '@tabler/icons-react';
import { EmptyState } from './QueryState';

/**
 * The shared sortable, searchable, windowed table.
 *
 * Every content list in the suite is this component — that is what keeps twelve (soon
 * twenty) browsers consistent and cheap to add (ADMIN_ARCHITECTURE §4).
 *
 * Rows render through a fixed-height window rather than a virtualisation library: the
 * lists here top out in the low thousands, and a plain slice keeps the DOM small without
 * another dependency or the measurement bugs that come with one.
 */

const ROW_HEIGHT = 34;
const OVERSCAN = 8;

export interface EntityTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  /** Stable row identity — the entity key, in every current use. */
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  /** Text a row is matched against by the search box. */
  getSearchText?: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Height of the scrolling body in pixels. */
  height?: number;
  initialSorting?: SortingState;
}

export function EntityTable<T>({
  data,
  columns,
  getRowId,
  onRowClick,
  searchPlaceholder = 'Search…',
  getSearchText,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  height = 560,
  initialSorting = [],
}: EntityTableProps<T>): ReactNode {
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [scrollTop, setScrollTop] = useState(0);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle || !getSearchText) return data;
    return data.filter((row) => getSearchText(row).toLowerCase().includes(needle));
  }, [data, search, getSearchText]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(height / ROW_HEIGHT) + OVERSCAN * 2;
  const windowed = rows.slice(first, first + visibleCount);
  const padTop = first * ROW_HEIGHT;
  const padBottom = Math.max(0, (rows.length - first - windowed.length) * ROW_HEIGHT);

  return (
    <Box>
      {getSearchText && (
        <TextInput
          leftSection={<IconSearch size={16} />}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          mb="sm"
          maw={340}
        />
      )}

      {data.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No matches"
          description={`Nothing matches “${search}”. Try a shorter search.`}
        />
      ) : (
        <Box
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          style={{ height, overflowY: 'auto', overflowX: 'auto' }}
        >
          <Table
            highlightOnHover={Boolean(onRowClick)}
            stickyHeader
            className="mv-tabular"
            style={{ tableLayout: 'fixed', minWidth: 640 }}
          >
            <Table.Thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <Table.Tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <Table.Th
                        key={header.id}
                        style={{ width: header.getSize() ? header.getSize() : undefined }}
                      >
                        {canSort ? (
                          <UnstyledButton
                            onClick={header.column.getToggleSortingHandler()}
                            style={{ width: '100%' }}
                          >
                            <Group gap={4} wrap="nowrap">
                              <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                                {flexRender(header.column.columnDef.header, header.getContext())}
                              </Text>
                              <SortIcon direction={sorted === false ? undefined : sorted} />
                            </Group>
                          </UnstyledButton>
                        ) : (
                          <Text size="xs" fw={600} tt="uppercase" c="dimmed">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </Text>
                        )}
                      </Table.Th>
                    );
                  })}
                </Table.Tr>
              ))}
            </Table.Thead>
            <Table.Tbody>
              {padTop > 0 && (
                <Table.Tr style={{ height: padTop }}>
                  <Table.Td colSpan={columns.length} style={{ padding: 0, border: 'none' }} />
                </Table.Tr>
              )}
              {windowed.map((row) => (
                <Table.Tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  style={{ cursor: onRowClick ? 'pointer' : undefined, height: ROW_HEIGHT }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <Table.Td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
              {padBottom > 0 && (
                <Table.Tr style={{ height: padBottom }}>
                  <Table.Td colSpan={columns.length} style={{ padding: 0, border: 'none' }} />
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
      )}

      {rows.length > 0 && (
        <Center mt="xs">
          <Text size="xs" c="dimmed">
            {rows.length === data.length
              ? `${data.length} ${data.length === 1 ? 'entry' : 'entries'}`
              : `${rows.length} of ${data.length} entries`}
          </Text>
        </Center>
      )}
    </Box>
  );
}

function SortIcon({ direction }: { direction: 'asc' | 'desc' | undefined }): ReactNode {
  if (direction === 'asc') return <IconChevronUp size={12} />;
  if (direction === 'desc') return <IconChevronDown size={12} />;
  return (
    <Box c="dimmed" opacity={0.4}>
      <IconSelector size={12} />
    </Box>
  );
}
