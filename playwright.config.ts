// Design Ref: MTU-E2E1 — Playwright E2E 설정
// Plan SC: FR-QA-1 — E2E 테스트 자동화 기반 구축

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'e2e-report' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:4000',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
