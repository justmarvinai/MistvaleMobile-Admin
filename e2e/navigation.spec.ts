import { expect, test } from '@playwright/test';
import { signIn } from './support';

/**
 * Every screen in the suite opens, against a live server.
 *
 * The cheapest bug this catches is the one Vitest structurally cannot: a screen that
 * renders perfectly against a stubbed response and throws against the real one. The game
 * repo learned it the hard way in C6 — a malformed roster took down the frame the error
 * boundary exists to keep standing — and its own C12c lesson is the other half: a browser
 * suite is the only thing that notices when navigation is rearranged, because `pnpm verify`
 * does not run one.
 *
 * Driven by **clicking the sidebar**, deliberately, where the rest of the harness navigates
 * by URL. A route that works when typed and a link that reaches it are different facts, and
 * this is the spec whose job is the second one.
 */

/** Every destination, by the exact link text and the heading it must land on. */
const DESTINATIONS: { link: string; heading: string | RegExp }[] = [
  { link: 'Dashboard', heading: 'Dashboard' },
  { link: 'Game config', heading: 'Game config' },
  { link: 'Tutorial script', heading: /tutorial script/i },
  { link: 'Players', heading: 'Players' },
  { link: 'Arena bots', heading: /arena/i },
  { link: 'Mail', heading: /mail/i },
  { link: 'Campaign', heading: 'Campaign' },
  { link: 'The Depths', heading: 'The Depths' },
  { link: 'Mastery board', heading: 'Mastery board' },
  { link: 'Errands', heading: 'Errands' },
  { link: 'Calendar & news', heading: /calendar/i },
  { link: 'Vale Pass', heading: /vale pass/i },
  { link: 'Balance sandbox', heading: /balance sandbox/i },
  { link: 'Jobs & health', heading: /jobs/i },
  { link: 'Audit log', heading: /audit log/i },
  { link: 'Battle inspector', heading: /battle inspector/i },
];

test('every screen in the sidebar opens', async ({ page }) => {
  await signIn(page);
  const nav = page.getByRole('navigation');

  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(String(error)));

  for (const stop of DESTINATIONS) {
    // Exact, and `.first()` for the two labels the sidebar carries twice — `Summon pools`
    // and `Shops` are each a content type *and* a purpose-built screen, which is why those
    // two are exercised by their own steps below rather than here.
    await nav.getByRole('link', { name: stop.link, exact: true }).first().click();
    await expect(page.getByRole('heading', { name: stop.heading }).first(), stop.link).toBeVisible({
      timeout: 30_000,
    });
  }

  // The two screens whose sidebar label is not unique.
  for (const path of ['/admin/summon-pools', '/admin/shops']) {
    await page.goto(path);
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
  }

  // A thrown render is not a failed assertion — the error boundary catches it and the page
  // still shows *something* — so it is collected separately and reported by name.
  expect(failures, failures.join('\n')).toEqual([]);
});

test('every content type in the browser lists without throwing', async ({ page }) => {
  await signIn(page);
  const nav = page.getByRole('navigation');

  const links = await nav.getByRole('link').allInnerTexts();
  // The content section is everything between Dashboard and the first Live-ops entry; the
  // list is read from the page rather than written out here, so a twenty-seventh content
  // type is covered the day it is added rather than the day somebody remembers this file.
  const start = links.findIndex((text) => text.startsWith('Dashboard')) + 1;
  const end = links.findIndex((text) => text.startsWith('Players'));
  const types = links.slice(start, end).filter((text) => text.trim().length > 0);
  expect(types.length).toBeGreaterThan(20);

  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(String(error)));

  for (const label of types) {
    const name = label.split('\n')[0]!.trim();
    await nav.getByRole('link', { name, exact: true }).first().click();
    await expect(page.getByRole('heading').first(), name).toBeVisible({ timeout: 30_000 });
  }

  expect(failures, failures.join('\n')).toEqual([]);
});
