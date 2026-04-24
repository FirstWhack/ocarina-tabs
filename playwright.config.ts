import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/visual',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:5174',
    colorScheme: 'light',
    viewport: {
      width: 900,
      height: 700,
    },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    reuseExistingServer: true,
    url: 'http://127.0.0.1:5174',
  },
})
