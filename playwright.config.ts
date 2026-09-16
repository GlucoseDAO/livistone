import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', fullyParallel: false, workers: 1, timeout: 120000,
  use: {
    baseURL: 'http://127.0.0.1:5173', viewport: { width: 1200, height: 800 }, headless: !process.env.PW_HEADED,
    channel: 'chrome',
    launchOptions: { args: ['--disable-dev-shm-usage', ...(process.env.PW_HEADED && process.platform === 'linux' ? ['--ozone-platform=x11'] : []), ...(process.env.LIVISTONE_SOFTWARE_GL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: { command: 'bun run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30000 },
});
