import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client, type QueryResultRow } from 'pg';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const SEED_FILES = ['01_schema_and_seed.sql', '02_indexes.sql'];
const SEED_SQL = SEED_FILES.map((file) =>
  readFileSync(join(__dirname, '..', '..', 'db', 'init', file), 'utf8'),
).join('\n');

export function testDatabaseUrl(): URL {
  const raw = process.env.DATABASE_URL;
  if (raw === undefined || raw === '') throw new Error('DATABASE_URL is not set for tests');

  const url = new URL(raw);
  const database = url.pathname.slice(1);
  if (!database.endsWith('_test')) {
    throw new Error(`Refusing to reset "${database}": test databases must end with _test`);
  }
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing to reset a database on ${url.hostname}: tests only run locally`);
  }
  return url;
}

async function ensureDatabaseExists(url: URL): Promise<void> {
  const database = url.pathname.slice(1);
  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';

  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
    }
  } finally {
    await client.end();
  }
}

export async function resetDatabase(): Promise<void> {
  const url = testDatabaseUrl();
  await ensureDatabaseExists(url);

  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await client.query(SEED_SQL);
  } finally {
    await client.end();
  }
}

export async function queryTestDatabase<Row extends QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<Row[]> {
  const client = new Client({ connectionString: testDatabaseUrl().toString() });
  await client.connect();
  try {
    const result = await client.query<Row>(text, [...params]);
    return result.rows;
  } finally {
    await client.end();
  }
}
