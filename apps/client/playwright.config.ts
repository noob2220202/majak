import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

/**
 * E2E 스모크 (PLAN.md §8.2). 서버가 빌드된 클라 정적 파일을 직접 서빙하므로
 * vite 프록시 없이 단일 오리진에서 테스트한다. `pnpm e2e`가 먼저 vite build를 돌린다.
 */
const PORT = 8899;
const staticDir = fileURLToPath(new URL('./dist', import.meta.url));
const serverEntry = fileURLToPath(new URL('../server/src/index.ts', import.meta.url));

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: { executablePath: '/opt/pw-browsers/chromium' },
    trace: 'off',
  },
  webServer: {
    command: `tsx ${serverEntry}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: String(PORT),
      STATIC_DIR: staticDir,
      DB_PATH: ':memory:',
      BOT_DELAY_MS: '15',
      RESULT_DELAY_MS: '120',
      TURN_BASE_MS: '3000',
      RESERVE_MS: '2000',
    },
  },
});
