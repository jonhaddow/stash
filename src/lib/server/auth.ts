import type { Cookies } from '@sveltejs/kit';
import { and, eq, gt, lt } from 'drizzle-orm';
import { apiToken, session, user, type User } from './db/schema.ts';
import type { DB } from './db/index.ts';

export const SESSION_COOKIE = 'session';
const DAY = 86_400_000;
const SESSION_DAYS = 60;
/** Sessions used within this many days of expiring are extended. */
const RENEW_WITHIN_DAYS = 30;

/**
 * Google returns every app's sign-in to this one address (~/code/auth), which
 * forwards it to /auth/callback on the subdomain that starts the state.
 */
export const GOOGLE_REDIRECT_URI = 'https://auth.app.haddow.me/callback';

export type SessionUser = Pick<User, 'id' | 'email' | 'name'>;

async function sha256(text: string) {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken() {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

/** The allowlisted user for a Google account, if any. Emails compare case-insensitively. */
export async function findAllowedUser(db: DB, email: string) {
	const [u] = await db.select().from(user).where(eq(user.email, email.trim().toLowerCase()));
	return u ?? null;
}

/** Everyone who can sign in, by name. */
export function allowedUsers(db: DB) {
	return db.select({ email: user.email, name: user.name }).from(user).orderBy(user.name);
}

/** Starts a session; returns the token for the cookie and when it expires. */
export async function createSession(db: DB, userId: number, now = new Date()) {
	const token = randomToken();
	const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY);
	await db.batch([
		// Tidy up anyone's expired sessions while we're here.
		db.delete(session).where(lt(session.expiresAt, now.toISOString())),
		db
			.insert(session)
			.values({ id: await sha256(token), userId, expiresAt: expiresAt.toISOString() })
	]);
	return { token, expiresAt };
}

/**
 * Looks up the user for a session cookie. Extends sessions that are in use, so
 * someone who opens the app regularly stays signed in.
 */
export async function validateSession(
	db: DB,
	token: string,
	now = new Date()
): Promise<{ user: SessionUser; expiresAt: Date; renewed: boolean } | null> {
	const id = await sha256(token);
	const [row] = await db
		.select({
			expiresAt: session.expiresAt,
			user: { id: user.id, email: user.email, name: user.name }
		})
		.from(session)
		.innerJoin(user, eq(session.userId, user.id))
		.where(and(eq(session.id, id), gt(session.expiresAt, now.toISOString())));
	if (!row) return null;

	let expiresAt = new Date(row.expiresAt);
	const renewed = expiresAt.getTime() - now.getTime() < RENEW_WITHIN_DAYS * DAY;
	if (renewed) {
		expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY);
		await db.update(session).set({ expiresAt: expiresAt.toISOString() }).where(eq(session.id, id));
	}
	return { user: row.user, expiresAt, renewed };
}

export async function deleteSession(db: DB, token: string) {
	await db.delete(session).where(eq(session.id, await sha256(token)));
}

export function setSessionCookie(cookies: Cookies, token: string, expiresAt: Date) {
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		expires: expiresAt
	});
}

/**
 * A new token for the iOS Shortcut, replacing any earlier one. Only its hash is
 * kept, so it's shown once.
 */
export async function createApiToken(db: DB, userId: number, now = new Date()) {
	const token = randomToken();
	await db.batch([
		db.delete(apiToken).where(eq(apiToken.userId, userId)),
		db.insert(apiToken).values({ id: await sha256(token), userId, createdAt: now.toISOString() })
	]);
	return token;
}

/** When the user's Shortcut token was made, if they have one. */
export async function apiTokenCreatedAt(db: DB, userId: number) {
	const [row] = await db
		.select({ createdAt: apiToken.createdAt })
		.from(apiToken)
		.where(eq(apiToken.userId, userId));
	return row?.createdAt ?? null;
}

/** The user an `Authorization: Bearer` token belongs to, if any. */
export async function userForApiToken(db: DB, token: string) {
	const [row] = await db
		.select({ id: user.id, email: user.email, name: user.name })
		.from(apiToken)
		.innerJoin(user, eq(apiToken.userId, user.id))
		.where(eq(apiToken.id, await sha256(token)));
	return row ?? null;
}
