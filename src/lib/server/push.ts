// Web Push, to keep the app icon's unread count current while the app is closed.
// iOS allows no silent pushes, so the service worker shows a quiet notification
// with each one (Jon has banners and the lock screen off for Stash). VAPID
// signing and the payload's encryption (RFC 8291) are done with WebCrypto.
import { eq, sql } from 'drizzle-orm';
import { pushSubscription } from './db/schema.ts';
import type { DB } from './db/index.ts';
import { workersFetch, type Fetch } from './http.ts';
import { unreadCount } from './feeds.ts';
import { b64url, fromB64url } from '../base64url.ts';

/** The VAPID key pair: the public key (uncompressed point) and private scalar, base64url. */
export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

export type Subscription = { endpoint: string; p256dh: string; auth: string };

const enc = new TextEncoder();

type Bytes = Uint8Array<ArrayBuffer>;

function concat(...parts: Uint8Array[]): Bytes {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let i = 0;
	for (const p of parts) {
		out.set(p, i);
		i += p.length;
	}
	return out;
}

/** The VAPID signing key, from its public point and private scalar. */
function signingKey(publicKey: Uint8Array, d: string) {
	const jwk = {
		kty: 'EC',
		crv: 'P-256',
		x: b64url(publicKey.slice(1, 33)),
		y: b64url(publicKey.slice(33, 65)),
		d
	};
	return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
		'sign'
	]);
}

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, bytes: number) {
	const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'HKDF', hash: 'SHA-256', salt, info },
		key,
		bytes * 8
	);
	return new Uint8Array(bits);
}

/**
 * The message body, encrypted for one subscription (aes128gcm) with a one-off
 * key pair and salt (random in `send`; the tests use RFC 8291's example).
 */
export async function encrypt(
	sub: Subscription,
	plaintext: string,
	ephemeral: { publicKey: Uint8Array; privateKey: CryptoKey },
	salt: Bytes
) {
	const uaPublic = fromB64url(sub.p256dh);
	const peer = await crypto.subtle.importKey(
		'raw',
		uaPublic,
		{ name: 'ECDH', namedCurve: 'P-256' },
		false,
		[]
	);
	const shared = new Uint8Array(
		await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, ephemeral.privateKey, 256)
	);
	const ikm = await hkdf(
		fromB64url(sub.auth),
		shared,
		concat(enc.encode('WebPush: info\0'), uaPublic, ephemeral.publicKey),
		32
	);
	const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
	const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
	const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
	// One record: the text, then the final-record delimiter.
	const record = concat(enc.encode(plaintext), new Uint8Array([2]));
	const cipher = new Uint8Array(
		await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, record)
	);
	const header = new Uint8Array(21);
	header.set(salt);
	new DataView(header.buffer).setUint32(16, 4096);
	header[20] = ephemeral.publicKey.length;
	return concat(header, ephemeral.publicKey, cipher);
}

/** The VAPID Authorization header for a push service. */
async function vapid(endpoint: string, keys: VapidKeys, now: Date) {
	const b64json = (o: object) => b64url(enc.encode(JSON.stringify(o)));
	const claims = {
		aud: new URL(endpoint).origin,
		exp: Math.floor(now.getTime() / 1000) + 12 * 3600,
		sub: keys.subject
	};
	const unsigned = `${b64json({ typ: 'JWT', alg: 'ES256' })}.${b64json(claims)}`;
	const key = await signingKey(fromB64url(keys.publicKey), keys.privateKey);
	const signature = await crypto.subtle.sign(
		{ name: 'ECDSA', hash: 'SHA-256' },
		key,
		enc.encode(unsigned)
	);
	return `vapid t=${unsigned}.${b64url(new Uint8Array(signature))}, k=${keys.publicKey}`;
}

/** Sends one message. Returns the push service's status (404 or 410: the subscription is gone). */
export async function send(
	sub: Subscription,
	message: object,
	keys: VapidKeys,
	fetcher: Fetch = workersFetch,
	now = new Date()
) {
	const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
		'deriveBits'
	])) as CryptoKeyPair;
	const ephemeral = {
		publicKey: new Uint8Array(
			(await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer
		),
		privateKey: pair.privateKey
	};
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const res = await fetcher(sub.endpoint, {
		method: 'POST',
		headers: {
			authorization: await vapid(sub.endpoint, keys, now),
			'content-encoding': 'aes128gcm',
			'content-type': 'application/octet-stream',
			ttl: String(24 * 3600),
			// A newer count replaces one not yet delivered.
			topic: 'unread'
		},
		body: await encrypt(sub, JSON.stringify(message), ephemeral, salt)
	});
	return res.status;
}

/** Keeps a device's subscription (the Settings page, once notifications are allowed). */
export async function subscribe(db: DB, sub: Subscription) {
	await db.insert(pushSubscription).values(sub).onConflictDoNothing();
}

/**
 * The app has just set the badge itself (the layout's count, or one changed by a
 * read on the Feeds page), so the next push is only needed once the count changes.
 */
export async function badgeShown(db: DB, unread: number) {
	await db
		.update(pushSubscription)
		.set({ sentUnread: unread })
		.where(sql`${pushSubscription.sentUnread} is not ${unread}`);
}

/**
 * After each sync: sends the unread count to each device whose icon shows a
 * different one. A count of 0 isn't sent (that would be a notification for
 * nothing); opening the app clears the badge.
 */
export async function pushUnread(db: DB, keys: VapidKeys, fetcher: Fetch = workersFetch) {
	const subs = await db.select().from(pushSubscription);
	if (!subs.length) return [];
	const unread = await unreadCount(db);
	const results = [];
	for (const sub of subs) {
		if (!unread || unread === sub.sentUnread) continue;
		const status = await send(sub, { unread }, keys, fetcher);
		results.push(`push: ${status}`);
		const where = eq(pushSubscription.endpoint, sub.endpoint);
		if (status === 404 || status === 410) await db.delete(pushSubscription).where(where);
		else if (status < 300)
			await db.update(pushSubscription).set({ sentUnread: unread }).where(where);
	}
	return results;
}
