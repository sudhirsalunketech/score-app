import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const web = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
const api = process.env.E2E_API_URL ?? 'http://localhost:4000';
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const reuseExistingServer = !process.env.CI && process.env.E2E_REUSE !== '0';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: web,
    extraHTTPHeaders: { Origin: web, 'x-e2e': '1' },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'sh -c \'set -a; if [ -f .env ]; then . ./.env; fi; set +a; pnpm --filter @crickscore/api dev\'',
      url: `${api}/api/v1/health`,
      reuseExistingServer,
      cwd: rootDir,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'pnpm --filter @crickscore/web dev',
      url: web,
      reuseExistingServer,
      cwd: rootDir,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
  metadata: { api },
});
