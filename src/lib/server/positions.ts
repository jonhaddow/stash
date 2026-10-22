import { eq } from 'drizzle-orm';
import type { DB } from './db/index.ts';
import { videoPosition } from './db/schema.ts';

/** Every saved position (a short list: finished videos are removed), by video ID. */
export async function listPositions(db: DB): Promise<Record<string, number>> {
	const rows = await db.select().from(videoPosition);
	return Object.fromEntries(rows.map((r) => [r.videoId, r.seconds]));
}

/** Saves where a video was left, or forgets it (`null`) once it's finished. */
export async function setPosition(db: DB, videoId: string, seconds: number | null) {
	if (seconds === null) {
		await db.delete(videoPosition).where(eq(videoPosition.videoId, videoId));
		return;
	}
	const row = { seconds: Math.floor(seconds), updatedAt: new Date().toISOString() };
	await db
		.insert(videoPosition)
		.values({ videoId, ...row })
		.onConflictDoUpdate({ target: videoPosition.videoId, set: row });
}
