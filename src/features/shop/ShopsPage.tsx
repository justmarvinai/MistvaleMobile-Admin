import { useMemo, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Alert,
  Badge,
  Card,
  Group,
  Paper,
  Progress,
  SegmentedControl,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconAlertTriangle, IconBuildingStore } from '@tabler/icons-react';
import { useContentList } from '@/api/hooks';
import { ErrorState, LoadingState } from '@/components/QueryState';
import { PageHeader } from '@/components/PageHeader';
import {
  levelBands,
  unreachableOffers,
  windowCost,
  windowsPerDay,
  type LevelBand,
  type ShopLike,
  type ShopOfferLike,
} from './shopModel';

/**
 * The shop editor (ADMIN_SUITE_DESIGN §2.9).
 *
 * The same argument as the summon pools next door: every field of the Bazaar is already
 * editable in the generic browser, and none of them says what it *does*. A weight is
 * relative to the other offers, and which offers those are depends on the player's level —
 * so the one thing an operator cannot see anywhere is that adding a level-30 offer changes
 * the odds a level-29 player gets on everything else in the shop.
 *
 * The arithmetic is exact and lives in `shopModel.ts`, including the two things it
 * deliberately refuses to guess: there is no "chance of appearing in this window", because
 * the server stocks a window without replacement and no closed form exists; and a weight
 * of zero is only called dead beside a positive one, because a wholly weightless pool is
 * picked from uniformly.
 */

function asShop(entry: { key: string; data?: unknown }): ShopLike | null {
  const data = entry.data;
  if (typeof data !== 'object' || data === null) return null;
  const shop = data as Partial<ShopLike>;
  if (typeof shop.name !== 'string' || !Array.isArray(shop.offers)) return null;
  return {
    key: entry.key,
    name: shop.name,
    description: shop.description ?? '',
    restockMinutes: shop.restockMinutes ?? 60,
    baseSlots: shop.baseSlots ?? 4,
    crystalSlots: shop.crystalSlots ?? 0,
    crystalSlotCost: shop.crystalSlotCost ?? 0,
    refreshCost: shop.refreshCost ?? 0,
    offers: shop.offers as ShopOfferLike[],
  };
}

export function ShopsPage(): ReactNode {
  const shops = useContentList('shops');
  const [selected, setSelected] = useState<string | null>(null);

  const list = useMemo(
    () => (shops.data?.items ?? []).map(asShop).filter((shop): shop is ShopLike => shop !== null),
    [shops.data],
  );
  const shop = list.find((entry) => entry.key === selected) ?? list[0] ?? null;

  if (shops.isPending) return <LoadingState label="Loading the shops" />;
  if (shops.error) return <ErrorState error={shops.error} onRetry={() => void shops.refetch()} />;

  return (
    <>
      <PageHeader
        title="Shops"
        description="What a shop's weights and level gates actually do, before a player finds out by shopping."
      />

      {list.length === 0 ? (
        <Paper withBorder p="xl">
          <Stack align="center" gap="xs">
            <IconBuildingStore size={32} opacity={0.4} />
            <Text c="dimmed" size="sm">
              No shops are published.
            </Text>
          </Stack>
        </Paper>
      ) : (
        <Stack gap="md">
          {list.length > 1 && (
            <Paper withBorder p="md">
              <SegmentedControl
                value={shop?.key ?? ''}
                onChange={setSelected}
                data={list.map((entry) => ({ value: entry.key, label: entry.name }))}
                fullWidth
              />
            </Paper>
          )}
          {shop && <ShopView shop={shop} />}
        </Stack>
      )}
    </>
  );
}

function ShopView({ shop }: { shop: ShopLike }): ReactNode {
  const maxSlots = shop.baseSlots + shop.crystalSlots;
  const bands = levelBands(shop, shop.baseSlots);
  const dead = unreachableOffers(shop);
  const [band, setBand] = useState<number | null>(null);
  const shown = bands.find((entry) => entry.level === band) ?? bands[bands.length - 1] ?? null;

  return (
    <Stack gap="md">
      {dead.length > 0 && (
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="red"
          variant="light"
          title={`${dead.length} ${dead.length === 1 ? 'offer' : 'offers'} no player can be shown`}
        >
          <Stack gap={4}>
            {dead.map((entry) => (
              <Text key={entry.key} size="sm">
                <strong>{entry.name}</strong> ({entry.key}) — {entry.reason}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      <Card>
        <Group justify="space-between" mb="sm" align="flex-start">
          <div>
            <Text fw={600} size="sm">
              {shop.name}
            </Text>
            {shop.description && (
              <Text size="xs" c="dimmed" maw={560}>
                {shop.description}
              </Text>
            )}
          </div>
          <Group gap="xs">
            <Badge variant="light" size="sm">
              {shop.baseSlots}
              {shop.crystalSlots > 0 ? `–${maxSlots}` : ''} slots
            </Badge>
            <Badge variant="light" size="sm">
              restocks {windowsPerDay(shop.restockMinutes)}× a day
            </Badge>
            {shop.refreshCost > 0 && (
              <Badge variant="light" size="sm" color="grape">
                {shop.refreshCost} crystals to re-roll
              </Badge>
            )}
            {shop.crystalSlots > 0 && (
              <Badge variant="light" size="sm" color="grape">
                {shop.crystalSlotCost} crystals a slot
              </Badge>
            )}
          </Group>
        </Group>

        {bands.length > 1 && (
          <>
            <Text size="xs" c="dimmed" mb={6}>
              A level gate filters the pool <em>before</em> the weights apply, so every band below
              is a different set of odds for the same shop.
            </Text>
            <SegmentedControl
              size="xs"
              mb="sm"
              value={String(shown?.level ?? '')}
              onChange={(value) => setBand(Number(value))}
              data={bands.map((entry) => ({
                value: String(entry.level),
                label: `Level ${entry.level}+`,
              }))}
            />
          </>
        )}

        {shown && <BandTable band={shown} slots={shop.baseSlots} />}
      </Card>
    </Stack>
  );
}

function BandTable({ band, slots }: { band: LevelBand; slots: number }): ReactNode {
  const costs = windowCost(band);

  return (
    <Stack gap="sm">
      {band.repeats && (
        <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />}>
          At level {band.level} only {band.offers.length}{' '}
          {band.offers.length === 1 ? 'offer is' : 'offers are'} eligible for {slots} slots. The
          server draws without replacement and then lets the rest repeat, so a player at this level
          sees the same offer more than once in a window.
        </Alert>
      )}

      <Group gap="lg">
        <Text size="xs" c="dimmed">
          {band.offers.length} offers · total weight {band.totalWeight}
        </Text>
        {costs.map((cost) => (
          <Text key={cost.currency} size="xs" c="dimmed">
            {cost.currency}: {cost.min.toLocaleString()}–{cost.max.toLocaleString()}
          </Text>
        ))}
      </Group>

      <Table fz="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Offer</Table.Th>
            <Table.Th>Kind</Table.Th>
            <Table.Th ta="right">Weight</Table.Th>
            <Table.Th w={200}>Share of a slot</Table.Th>
            <Table.Th ta="right">Price</Table.Th>
            <Table.Th ta="right">Daily limit</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[...band.offers]
            .sort((a, b) => b.share - a.share)
            .map((offer) => (
              <Table.Tr key={offer.key}>
                <Table.Td>
                  <Group gap={6}>
                    <Text size="xs">{offer.name}</Text>
                    {offer.minAccountLevel > 1 && (
                      <Badge size="xs" variant="outline">
                        L{offer.minAccountLevel}
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
                <Table.Td>{offer.kind}</Table.Td>
                <Table.Td ta="right">{offer.weight}</Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap">
                    <Progress value={offer.share * 100} size="sm" w={110} />
                    <Text size="xs" c="dimmed">
                      {(offer.share * 100).toFixed(1)}%
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td ta="right">
                  {offer.price.toLocaleString()} {offer.currency}
                  {offer.pricePerRank ? ` +${offer.pricePerRank}/★` : ''}
                </Table.Td>
                <Table.Td ta="right">{offer.dailyLimit || '—'}</Table.Td>
              </Table.Tr>
            ))}
        </Table.Tbody>
      </Table>

      <Text size="xs" c="dimmed">
        A share is the chance of <strong>one</strong> slot, which is what a weight means. A window
        is drawn without replacement, so an offer appears at most once in it — there is no closed
        form for “somewhere in the window” and none is guessed here. Every field is edited in{' '}
        <Link to="/content/$typePath" params={{ typePath: 'shops' }}>
          the shop browser
        </Link>
        .
      </Text>
    </Stack>
  );
}
