import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

import { readE2eDatabaseUrl } from './test/e2e-global-setup.js';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/e2e-global-setup.ts'],
    // Runtime env wins over .env in ConfigModule, prisma.config.ts and the seed, so every e2e
    // spec (and any child process it spawns) uses the dedicated e2e database.
    env: { DATABASE_URL: readE2eDatabaseUrl() },
  },
});
