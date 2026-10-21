<script lang="ts" module>
	/** What a swipe does: its label shows under the row; `away` slides the row off. */
	export type Swipe = { label: string; run: () => unknown; away?: boolean };
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { hackUrl, hostOf, youtubeId } from '#lib/kind.ts';
	import { ago } from '#lib/time.ts';
	import Player from './Player.svelte';

	// A link in a list: title, where it's from and when, and a thumbnail, opening the original
	// page (YouTube videos play in the app instead; Hacker News threads open in Hack on iOS).
	// Swiping it right or left past the threshold does that side's action. Buttons (the archive's) to its right.
	let {
		url,
		title,
		image,
		source,
		at,
		unread,
		saved,
		onopen,
		right,
		left,
		actions
	}: {
		url: string;
		title: string;
		/** A thumbnail; YouTube videos without one get the video's own. */
		image?: string | null;
		/** Where it's from; the link's site if not given. */
		source?: string;
		at: string;
		/** Feed entries only; saved links have no read state. */
		unread?: boolean;
		/** A feed entry that's in Later. */
		saved?: boolean;
		onopen?: () => void;
		right?: Swipe;
		left?: Swipe;
		actions?: Snippet;
	} = $props();

	const video = $derived(youtubeId(url));
	const hack = $derived(hackUrl(url));
	let playing = $state(false);
	const thumb = $derived(image || (video ? `https://i.ytimg.com/vi/${video}/mqdefault.jpg` : null));
	// Images that fail to load (gone, or hotlinking refused) leave just the title.
	let broken = $state(false);

	const THRESHOLD = 80;
	let li: HTMLLIElement;
	let dx = $state(0);
	let dragging = $state(false);
	let start: { x: number; y: number } | null = null;
	// A drag ends with a click on the link, which mustn't open it.
	let swiped = false;
	const swipe = $derived(dx > 0 ? right : dx < 0 ? left : undefined);

	function onpointerdown(e: PointerEvent) {
		swiped = false;
		if (e.button === 0 && (right || left)) start = { x: e.clientX, y: e.clientY };
	}

	function onpointermove(e: PointerEvent) {
		if (!start) return;
		const x = e.clientX - start.x;
		if (!dragging) {
			const y = e.clientY - start.y;
			if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) start = null; // scrolling
			if (!start || Math.abs(x) < 10) return;
			dragging = true;
			li.setPointerCapture(e.pointerId);
		}
		dx = (x > 0 && right) || (x < 0 && left) ? x : 0;
	}

	function onpointerup() {
		start = null;
		if (!dragging) return;
		dragging = false;
		swiped = true;
		if (swipe && Math.abs(dx) >= THRESHOLD) {
			// If it fails (offline, say), the row comes back.
			Promise.resolve(swipe.run()).catch(() => (dx = 0));
			if (swipe.away) {
				dx = Math.sign(dx) * li.offsetWidth;
				return;
			}
		}
		dx = 0;
	}

	function onpointercancel() {
		start = null;
		dragging = false;
		dx = 0;
	}

	// iPads say they're Macs, but Macs have no touch screen.
	const ios = () =>
		/iPhone|iPad/.test(navigator.userAgent) ||
		(/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

	function onclick(e: MouseEvent) {
		if (swiped) {
			e.preventDefault();
			return;
		}
		onopen?.();
		if (video) {
			e.preventDefault();
			playing = true;
		} else if (hack && ios()) {
			e.preventDefault();
			location.href = hack;
		}
	}
</script>

<li
	bind:this={li}
	class:unread
	class:read={unread === false}
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	{onpointercancel}
>
	{#if swipe}
		<div class="under" class:left={dx < 0} class:armed={Math.abs(dx) >= THRESHOLD}>
			{swipe.label}
		</div>
	{/if}
	<a
		href={url}
		target="_blank"
		rel="noopener noreferrer"
		draggable="false"
		class:dragging
		style:translate="{dx}px 0"
		{onclick}
	>
		<span class="text">
			<span class="title">{title}</span>
			<span class="meta">
				{#if unread}<span class="dot" aria-label="Unread"></span>{/if}
				<span class="source">{source ?? hostOf(url)}</span>
				<span>· {ago(at)}</span>
				{#if saved}<span class="saved">· In Later</span>{/if}
			</span>
		</span>
		{#if thumb && !broken}
			<img
				src={thumb}
				alt=""
				loading="lazy"
				referrerpolicy="no-referrer"
				draggable="false"
				onerror={() => (broken = true)}
			/>
		{/if}
	</a>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
	{#if playing && video}
		<Player id={video} {title} {url} onclose={() => (playing = false)} />
	{/if}
</li>

<style>
	li {
		position: relative;
		display: flex;
		align-items: center;
		/* Vertical drags scroll the page; sideways ones are swipes. */
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	a {
		position: relative;
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 16px 0;
		text-decoration: none;
		background: var(--card);
		transition: translate 0.2s ease-out;
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	img {
		flex-shrink: 0;
		width: 76px;
		aspect-ratio: 1;
		object-fit: cover;
		background: var(--line);
		filter: saturate(0.6);
	}
	li.read img {
		opacity: 0.6;
	}
	a.dragging {
		transition: none;
	}
	/* Behind the row as it slides: what letting go will do. */
	.under {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		padding: 0 20px;
		background: var(--line);
		color: var(--muted);
		font-weight: 800;
	}
	.under.left {
		justify-content: flex-end;
	}
	.under.armed {
		background: var(--accent);
		color: var(--on-accent);
	}
	.title {
		font-family: var(--serif);
		font-size: 20px;
		font-weight: 500;
		line-height: 1.25;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		overflow-wrap: anywhere;
	}
	/* Read entries step back; unread ones are bold with a dot. */
	li.read .title {
		color: var(--muted);
		font-weight: 500;
	}
	.unread .title {
		font-weight: 700;
	}
	/* Above the title, like a newspaper's kicker. */
	.meta {
		order: -1;
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--muted);
		min-width: 0;
	}
	.source {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta > span:not(.source) {
		flex-shrink: 0;
	}
	.dot {
		flex-shrink: 0;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
	}
	.actions {
		display: flex;
		gap: 2px;
		padding-right: 6px;
	}
	.saved {
		color: var(--accent);
		font-weight: 700;
	}
</style>
