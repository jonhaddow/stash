import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { KINDS } from '../../kind.ts';

// Times are ISO timestamps (UTC).

/** People who can sign in (Google accounts). */
export const user = sqliteTable('user', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	email: text('email').notNull().unique(),
	name: text('name').notNull()
});

export type User = typeof user.$inferSelect;

/** Signed-in sessions. The id is the SHA-256 of the cookie's token, never the token itself. */
export const session = sqliteTable(
	'session',
	{
		id: text('id').primaryKey(),
		userId: integer('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		expiresAt: text('expires_at').notNull()
	},
	(t) => [index('session_user_idx').on(t.userId)]
);

/**
 * Tokens for saving links without a session (the iOS Shortcut). The id is the
 * SHA-256 of the token, which is shown once.
 */
export const apiToken = sqliteTable('api_token', {
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	createdAt: text('created_at').notNull()
});

/** Links to read later. Done ones move to the archive (`archivedAt`). */
export const saved = sqliteTable(
	'saved',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		url: text('url').notNull().unique(),
		title: text('title').notNull(),
		kind: text('kind', { enum: KINDS }).notNull(),
		addedAt: text('added_at').notNull(),
		archivedAt: text('archived_at')
	},
	(t) => [index('saved_list_idx').on(t.archivedAt, t.addedAt)]
);

export type Saved = typeof saved.$inferSelect;

/** Feed folders, one level deep. */
export const folder = sqliteTable('folder', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	sortOrder: integer('sort_order').notNull().default(0)
});

export type Folder = typeof folder.$inferSelect;

/** An RSS or Atom feed, polled in turn by the cron (sync.ts). */
export const feed = sqliteTable(
	'feed',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		folderId: integer('folder_id').references(() => folder.id, { onDelete: 'set null' }),
		title: text('title').notNull(),
		url: text('url').notNull().unique(),
		/** The site's own page, from the feed. */
		siteUrl: text('site_url'),
		/** For conditional requests, so unchanged feeds cost almost nothing. */
		etag: text('etag'),
		lastModified: text('last_modified'),
		lastFetchedAt: text('last_fetched_at'),
		lastStatus: text('last_status', { enum: ['ok', 'not-modified', 'error'] }),
		lastError: text('last_error'),
		createdAt: text('created_at').notNull()
	},
	(t) => [index('feed_fetched_idx').on(t.lastFetchedAt)]
);

export type Feed = typeof feed.$inferSelect;

/** A feed's entries. Never removed; opened ones are read (`readAt`). */
export const item = sqliteTable(
	'item',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		feedId: integer('feed_id')
			.notNull()
			.references(() => feed.id, { onDelete: 'cascade' }),
		guid: text('guid').notNull(),
		url: text('url').notNull(),
		title: text('title').notNull(),
		kind: text('kind', { enum: KINDS }).notNull(),
		publishedAt: text('published_at').notNull(),
		readAt: text('read_at')
	},
	(t) => [
		uniqueIndex('item_guid_idx').on(t.feedId, t.guid),
		index('item_published_idx').on(t.publishedAt),
		index('item_unread_idx').on(t.readAt)
	]
);

export type Item = typeof item.$inferSelect;

/** Each time a feed was fetched, kept for 30 days. */
export const syncLog = sqliteTable(
	'sync_log',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		feedId: integer('feed_id')
			.notNull()
			.references(() => feed.id, { onDelete: 'cascade' }),
		at: text('at').notNull(),
		status: text('status', { enum: ['ok', 'not-modified', 'error'] }).notNull(),
		httpStatus: integer('http_status'),
		itemsAdded: integer('items_added').notNull().default(0),
		error: text('error'),
		/** Wall time of the fetch and parse, in ms. */
		ms: integer('ms').notNull()
	},
	(t) => [index('sync_log_feed_idx').on(t.feedId, t.at), index('sync_log_at_idx').on(t.at)]
);

export type SyncLog = typeof syncLog.$inferSelect;
