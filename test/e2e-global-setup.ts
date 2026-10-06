// Prepares the dedicated e2e database once per `npm run test:e2e`: creates it if missing and
// applies the migrations, so e2e specs never touch the dev database.
import 'dotenv/config';

import { execSync } from 'node:child_process';

import pg from 'pg';

const DATABASE_NAME_PATTERN = /^[a-z0-9_]+$/;
const MAINTENANCE_DATABASE = 'postgres';

export function readE2eDatabaseUrl(): string {
  const e2eDatabaseUrl = process.env['E2E_DATABASE_URL'];
  if (!e2eDatabaseUrl) {
    throw new Error('E2E_DATABASE_URL must be set (see .env.example)');
  }
  if (e2eDatabaseUrl === process.env['DATABASE_URL']) {
    throw new Error('E2E_DATABASE_URL must not point to the dev database');
  }
  return e2eDatabaseUrl;
}

async function createDatabaseIfMissing(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const databaseName = url.pathname.slice(1);
  // CREATE DATABASE cannot take a bind parameter, so the name is whitelisted instead.
  if (!DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error(`Invalid e2e database name: ${databaseName}`);
  }

  url.pathname = `/${MAINTENANCE_DATABASE}`;
  url.search = '';
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName],
    );
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await client.end();
  }
}

export async function setup(): Promise<void> {
  const e2eDatabaseUrl = readE2eDatabaseUrl();
  await createDatabaseIfMissing(e2eDatabaseUrl);
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: e2eDatabaseUrl },
    stdio: 'pipe',
  });
}
