import { defineConfig } from '@playwright/test';
// LIVISTONE_BASE_URL points a worktree's run at its own dev server (parallel realism branches); no webServer is started then.
const baseURL = process.env.LIVISTONE_BASE_URL ?? 'http://127.0.0.1:5173';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', fullyParallel: false, workers: 1, timeout: 120000,
  use: {
    baseURL, viewport: { width: 1200, height: 800 }, headless: !process.env.PW_HEADED,
    channel: 'chrome',
    // Headless Chrome uses ANGLE; native GL on Linux, D3D11 on Windows. LIVISTONE_SOFTWARE_GL=1 forces SwiftShader.
    launchOptions: { args: ['--disable-dev-shm-usage', ...(process.env.PW_HEADED && process.platform === 'linux' ? ['--ozone-platform=x11'] : []), ...(process.env.LIVISTONE_SOFTWARE_GL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : process.platform === 'win32' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist'])] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: process.env.LIVISTONE_BASE_URL ? undefined : { command: 'bun run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30000 },
});
