import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from './schema.ts';

export type DB = DrizzleD1Database<typeof schema>;
