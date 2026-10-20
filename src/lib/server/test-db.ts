import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from './db/schema.ts';
import type { DB } from './db/index.ts';

/**
 * A fresh, migrated database for a test. The app runs on Cloudflare D1; tests
 * use libSQL in memory, which runs the same SQLite and has the same Drizzle
 * API (including batch) for what we use.
 */
export async function testDb(): Promise<DB> {
	const local = drizzle(createClient({ url: ':memory:' }), { schema });
	await migrate(local, { migrationsFolder: 'drizzle' });
	return local as unknown as DB;
}
