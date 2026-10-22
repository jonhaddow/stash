import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from './test-db.ts';
import type { DB } from './db/index.ts';
import { listPositions, setPosition } from './positions.ts';

let db: DB;
beforeEach(async () => {
	db = await testDb();
});

describe('positions', () => {
	it('saves, updates and forgets a video’s position', async () => {
		await setPosition(db, 'dQw4w9WgXcQ', 42.7);
		await setPosition(db, 'abcdefghijk', 10);
		expect(await listPositions(db)).toEqual({ dQw4w9WgXcQ: 42, abcdefghijk: 10 });
		await setPosition(db, 'dQw4w9WgXcQ', 90);
		await setPosition(db, 'abcdefghijk', null);
		expect(await listPositions(db)).toEqual({ dQw4w9WgXcQ: 90 });
	});
});
