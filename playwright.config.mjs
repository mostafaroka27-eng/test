import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';

const chromiumPath=process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: {width: 1440, height: 1000},
    launchOptions: {
      ...(chromiumPath ? {executablePath: chromiumPath} : {}),
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']
    }
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false
  }
});
