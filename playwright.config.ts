import { defineConfig, devices } from '@playwright/test';

/**
 * The Admin Suite's smoke run (ADMIN_SUITE_DESIGN §5, gap G8).
 *
 * Vitest covers what every editor *computes* — the odds, the curves, the shop bands, the
 * goal sentences — against stubbed responses. What none of it covers is the one path the
 * whole suite exists to serve: **sign in, change something, see it in the diff, publish it,
 * and watch the live game move.** That path crosses the SPA, the Admin API, the content
 * cache and the database, and it is exactly the chain a unit test cannot hold.
 *
 * It needs three things running and one thing handed to it:
 *
 * - the **game server** on `:3001` with content published (`pnpm db:migrate && pnpm seed`),
 * - the **Admin SPA** on `:5174` (`pnpm dev`, whose proxy makes both same-origin),
 * - an **admin account**, passed in as `E2E_ADMIN_ACCOUNT` / `E2E_ADMIN_PASSWORD`.
 *
 * That last one is the interesting constraint. The suite cannot mint its own admin: there
 * is no self-serve promotion and there must not be, so the first admin on any box is made
 * with the game repo's `SET_RANK.sh`. Passing the credentials in keeps this repo's hardest
 * rule intact — **no direct database access, ever** — and mirrors how a real deployment
 * gets its first operator.
 */
export default defineConfig({
  testDir: './e2e',
  // Every spec publishes content against one shared server; running them at once would
  // have two publishes racing for the same revision.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  // Sign-in runs an argon2id verification, which is deliberately slow.
  timeout: 90_000,

  use: {
    baseURL: process.env.E2E_ADMIN_URL ?? 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // The pre-installed browser; never download one at test time.
        launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? undefined },
        // The suite is a desktop tool and its tables assume the room.
        viewport: { width: 1600, height: 1000 },
      },
    },
  ],
});
