<script lang="ts">
	import type { Snippet } from 'svelte';
	import { hostOf, youtubeId } from '#lib/kind.ts';
	import { ago } from '#lib/time.ts';
	import Player from './Player.svelte';

	// A link in a list: title, where it's from and when, opening the original
	// page (YouTube videos play in the app instead); buttons to its right.
	let {
		url,
		title,
		source,
		at,
		unread,
		onopen,
		actions
	}: {
		url: string;
		title: string;
		/** Where it's from; the link's site if not given. */
		source?: string;
		at: string;
		/** Feed entries only; saved links have no read state. */
		unread?: boolean;
		onopen?: () => void;
		actions?: Snippet;
	} = $props();

	const video = $derived(youtubeId(url));
	let playing = $state(false);

	function onclick(e: MouseEvent) {
		onopen?.();
		if (video) {
			e.preventDefault();
			playing = true;
		}
	}
</script>

<li class:unread class:read={unread === false}>
	<a href={url} target="_blank" rel="noopener noreferrer" {onclick}>
		<span class="title">{title}</span>
		<span class="meta">
			{#if unread}<span class="dot" aria-label="Unread"></span>{/if}
			<span class="source">{source ?? hostOf(url)}</span>
			<span>· {ago(at)}</span>
		</span>
	</a>
	{#if actions}<div class="actions">{@render actions()}</div>{/if}
	{#if playing && video}
		<Player id={video} {title} {url} onclose={() => (playing = false)} />
	{/if}
</li>

<style>
	li {
		display: flex;
		align-items: center;
		gap: 4px;
		padding-right: 6px;
	}
	a {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 14px 10px 14px 16px;
		text-decoration: none;
	}
	.title {
		font-size: 16px;
		font-weight: 600;
		line-height: 1.3;
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
		font-weight: 750;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		color: var(--muted);
		min-width: 0;
	}
	.source {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta > span:last-child {
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
	}
</style>
