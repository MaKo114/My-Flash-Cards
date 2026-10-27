import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@playwright/test'

const here = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', headless: true },
  webServer: [
    {
      command: `"${path.resolve(here, '../.cache', process.platform === 'win32' ? 'flashcards-e2e.exe' : 'flashcards-e2e')}"`,
      cwd: path.resolve(here, '../backend'),
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: 'postgres://flashcards:flashcards@127.0.0.1:5433/flashcards_test?sslmode=disable',
      },
    },
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173', cwd: here, url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 120_000 },
  ],
})
