<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { positionOf, savePosition } from '#lib/positions.svelte.ts';

	// A YouTube video playing over the list; closing it stops the video. It starts where it
	// was left, and saves where it's got to as it plays, on closing and when the app's hidden.
	let { id, title, url, onclose }: { id: string; title: string; url: string; onclose: () => void } =
		$props();

	const YOUTUBE = 'https://www.youtube-nocookie.com';
	// Read once (the row makes a new player for each play): saving the position as the video
	// plays mustn't reload it.
	const start = untrack(() => positionOf(id));
	let saved = start;
	let time = start ?? 0;
	let duration = 0;
	let ended = false;

	const open = (d: HTMLDialogElement) => d.showModal();

	// Near the end counts as finished (end screens, credits), which forgets the position.
	// The first few seconds aren't worth saving.
	function save() {
		const at = ended || (duration && time > duration - 20) ? null : Math.floor(time);
		if (at === saved || (at !== null && at < 10)) return;
		saved = at;
		savePosition(id, at);
	}

	// The embed's API without YouTube's script: once told we're listening, the player
	// posts its state (time, duration, playing or ended) several times a second.
	function listen(frame: HTMLIFrameElement) {
		const hello = () =>
			frame.contentWindow?.postMessage(
				JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
				YOUTUBE
			);
		const onmessage = (e: MessageEvent) => {
			if (e.source !== frame.contentWindow || typeof e.data !== 'string') return;
			let info: { duration?: unknown; currentTime?: unknown; playerState?: unknown } | undefined;
			try {
				info = (JSON.parse(e.data) as { info?: typeof info }).info;
			} catch {
				return;
			}
			if (!info) return;
			if (typeof info.duration === 'number') duration = info.duration;
			if (typeof info.currentTime === 'number') time = info.currentTime;
			if (typeof info.playerState === 'number') ended = info.playerState === 0;
			if (ended || Math.abs(time - (saved ?? 0)) >= 15) save();
		};
		const onvisibilitychange = () => document.hidden && save();
		frame.addEventListener('load', hello);
		addEventListener('message', onmessage);
		document.addEventListener('visibilitychange', onvisibilitychange);
		return () => {
			frame.removeEventListener('load', hello);
			removeEventListener('message', onmessage);
			document.removeEventListener('visibilitychange', onvisibilitychange);
		};
	}

	const src = untrack(
		() =>
			`${YOUTUBE}/embed/${id}?autoplay=1&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(page.url.origin)}${start ? `&start=${start}` : ''}`
	);
</script>

<!-- A tap on the backdrop (the dialog itself, not its contents) closes it. -->
<dialog
	{@attach open}
	aria-label={title}
	onclose={() => {
		save();
		onclose();
	}}
	onclick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
>
	<!-- YouTube refuses to play embeds sent without a referrer (the site's policy is same-origin). -->
	<iframe
		{@attach listen}
		{src}
		{title}
		allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
		allowfullscreen
		referrerpolicy="strict-origin-when-cross-origin"
	></iframe>
	<div class="bar">
		<p>{title}</p>
		<Button variant="secondary" href={url} target="_blank" rel="noopener noreferrer">YouTube</Button
		>
		<form method="dialog"><Button>Close</Button></form>
	</div>
</dialog>

<style>
	dialog {
		width: min(100%, 960px);
		max-width: none;
		margin: auto;
		padding: 0;
		border: 0;
		background: var(--bg);
		color: var(--ink);
		overflow: hidden;
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.85);
	}
	iframe {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		border: 0;
		background: #000;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px;
	}
	p {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
