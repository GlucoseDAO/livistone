import { defineConfig } from '@playwright/test';
// LIVISTONE_BASE_URL points a worktree's run at its own dev server (parallel realism branches); no webServer is started then.
const baseURL = process.env.LIVISTONE_BASE_URL ?? 'http://127.0.0.1:5173';
// WebGPURenderer uses WebGPU wherever Chrome offers an adapter. Headless Chrome on Linux offers a hardware one only with these
// flags, and only the integrated GPU presents a canvas headless on the dev laptop (the NVIDIA one does not), so the low-power
// adapter is forced. LIVISTONE_BACKEND=webgl withholds WebGPU instead: the same specs then run on the automatic WebGL 2 fallback.
const webgpu = process.env.LIVISTONE_BACKEND === 'webgl' ? ['--disable-features=WebGPU'] : process.platform === 'linux' ? ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-webgpu-power-preference=force-low-power'] : [];
export default defineConfig({
  // Match Vite's WebGPU core at runtime, rather than tsc's declaration-file path; specs also import DOM-free world constants.
  tsconfig: './tsconfig.playwright.json',
  testDir: './tests', testMatch: '**/*.spec.ts', fullyParallel: false, workers: 1, timeout: 120000,
  use: {
    baseURL, viewport: { width: 1200, height: 800 }, headless: !process.env.PW_HEADED,
    channel: 'chrome',
    // Headless Chrome uses ANGLE; native GL on Linux, D3D11 on Windows. LIVISTONE_SOFTWARE_GL=1 forces SwiftShader.
    launchOptions: { args: ['--disable-dev-shm-usage', ...(process.env.PW_HEADED && process.platform === 'linux' ? ['--ozone-platform=x11'] : []), ...(process.env.LIVISTONE_SOFTWARE_GL ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : process.platform === 'win32' ? ['--use-angle=d3d11', '--ignore-gpu-blocklist'] : ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist']), ...webgpu] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: process.env.LIVISTONE_BASE_URL ? undefined : { command: 'bun run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30000 },
});
