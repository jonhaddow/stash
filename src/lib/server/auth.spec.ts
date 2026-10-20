import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from './test-db.ts';
import * as schema from './db/schema.ts';
import {
	createApiToken,
	createSession,
	deleteSession,
	findAllowedUser,
	userForApiToken,
	validateSession
} from './auth.ts';
import type { DB } from './db/index.ts';

let db: DB;
let alex: number;

beforeEach(async () => {
	db = await testDb();
	const [u] = await db
		.insert(schema.user)
		.values({ email: 'alex@example.com', name: 'Alex' })
		.returning();
	alex = u.id;
});

describe('allowlist', () => {
	it('finds allowed users regardless of case', async () => {
		expect((await findAllowedUser(db, 'Alex@Example.com'))?.id).toBe(alex);
	});
	it('rejects anyone else', async () => {
		expect(await findAllowedUser(db, 'someone@gmail.com')).toBeNull();
	});
});

describe('sessions', () => {
	const t0 = new Date('2026-10-03T12:00:00Z');
	const days = (n: number) => new Date(t0.getTime() + n * 86_400_000);

	it('creates and validates a session without storing the token', async () => {
		const { token } = await createSession(db, alex, t0);
		const [row] = await db.select().from(schema.session);
		expect(row.id).not.toBe(token);
		expect((await validateSession(db, token, days(1)))?.user).toMatchObject({
			email: 'alex@example.com'
		});
	});

	it('rejects unknown tokens and expired sessions', async () => {
		const { token } = await createSession(db, alex, t0);
		expect(await validateSession(db, 'nope', days(1))).toBeNull();
		expect(await validateSession(db, token, days(61))).toBeNull();
	});

	it('extends sessions that are still being used', async () => {
		const { token } = await createSession(db, alex, t0);
		expect((await validateSession(db, token, days(10)))?.renewed).toBe(false);
		const later = await validateSession(db, token, days(45));
		expect(later?.renewed).toBe(true);
		expect(await validateSession(db, token, days(100))).not.toBeNull();
	});

	it('signs out', async () => {
		const { token } = await createSession(db, alex, t0);
		await deleteSession(db, token);
		expect(await validateSession(db, token, days(1))).toBeNull();
	});

	it('ends sessions when the user is removed from the allowlist', async () => {
		const { token } = await createSession(db, alex, t0);
		await db.delete(schema.user);
		expect(await validateSession(db, token, days(1))).toBeNull();
	});
});

describe('Shortcut tokens', () => {
	it('finds the user for their latest token only', async () => {
		const old = await createApiToken(db, alex);
		const token = await createApiToken(db, alex);
		expect((await userForApiToken(db, token))?.id).toBe(alex);
		expect(await userForApiToken(db, old)).toBeNull();
		expect(await userForApiToken(db, 'made-up')).toBeNull();
	});
});
