import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from './test-db.ts';
import { feed, item, pushSubscription } from './db/schema.ts';
import type { DB } from './db/index.ts';
import type { Fetch } from './http.ts';
import { b64url, fromB64url } from '../base64url.ts';
import { badgeShown, encrypt, pushUnread, subscribe } from './push.ts';

// RFC 8291, appendix A.
const rfc = {
	plaintext: 'When I grow up, I want to be a watermelon',
	asPublic:
		'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
	asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
	uaPublic:
		'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
	auth: 'BTBZMqHH6r4Tts7J_aSIgg',
	salt: 'DGv6ra1nlYgDCS1FRnbzlw',
	body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
};

describe('encrypt', () => {
	it('matches RFC 8291’s example', async () => {
		const publicKey = fromB64url(rfc.asPublic);
		const jwk = {
			kty: 'EC',
			crv: 'P-256',
			x: b64url(publicKey.slice(1, 33)),
			y: b64url(publicKey.slice(33, 65)),
			d: rfc.asPrivate
		};
		const privateKey = await crypto.subtle.importKey(
			'jwk',
			jwk,
			{ name: 'ECDH', namedCurve: 'P-256' },
			false,
			['deriveBits']
		);
		const body = await encrypt(
			{ endpoint: 'https://push.example/x', p256dh: rfc.uaPublic, auth: rfc.auth },
			rfc.plaintext,
			{ publicKey, privateKey },
			fromB64url(rfc.salt)
		);
		expect(b64url(body)).toBe(rfc.body);
	});
});

describe('pushUnread', () => {
	let db: DB;
	let keys: { publicKey: string; privateKey: string; subject: string };
	let sent: { url: string; headers: Headers }[];
	let status: number;
	const fetcher: Fetch = (input, init) => {
		sent.push({ url: String(input), headers: new Headers(init?.headers) });
		return Promise.resolve(new Response(null, { status }));
	};

	beforeEach(async () => {
		db = await testDb();
		sent = [];
		status = 201;
		const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
			'sign'
		])) as CryptoKeyPair;
		const raw = new Uint8Array(
			(await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer
		);
		const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
		keys = { publicKey: b64url(raw), privateKey: jwk.d!, subject: 'https://stash.example' };
		await subscribe(db, {
			endpoint: 'https://push.example/a',
			p256dh: rfc.uaPublic,
			auth: rfc.auth
		});
		const [f] = await db
			.insert(feed)
			.values({
				title: 'Blog',
				url: 'https://blog.example/feed',
				createdAt: '2026-10-20T00:00:00Z'
			})
			.returning();
		await db.insert(item).values(
			['a', 'b'].map((guid) => ({
				feedId: f.id,
				guid,
				url: `https://blog.example/${guid}`,
				title: guid,
				kind: 'article' as const,
				publishedAt: '2026-10-20T00:00:00Z'
			}))
		);
	});

	it('sends a changed count once, signed', async () => {
		expect(await pushUnread(db, keys, fetcher)).toEqual(['push: 201']);
		expect(sent[0].url).toBe('https://push.example/a');
		expect(sent[0].headers.get('authorization')).toMatch(/^vapid t=.+\..+\..+, k=/);
		expect(await pushUnread(db, keys, fetcher)).toEqual([]);
		expect(sent).toHaveLength(1);
	});

	it('sends nothing when all is read', async () => {
		await db.update(item).set({ readAt: '2026-10-20T01:00:00Z' });
		expect(await pushUnread(db, keys, fetcher)).toEqual([]);
	});

	it('forgets a subscription that has gone', async () => {
		status = 410;
		await pushUnread(db, keys, fetcher);
		expect(await db.select().from(pushSubscription)).toEqual([]);
	});

	it('sends the count again once the app has shown another', async () => {
		await pushUnread(db, keys, fetcher);
		await badgeShown(db, 0);
		expect(await pushUnread(db, keys, fetcher)).toEqual(['push: 201']);
		await badgeShown(db, 2);
		expect(await pushUnread(db, keys, fetcher)).toEqual([]);
	});
});
