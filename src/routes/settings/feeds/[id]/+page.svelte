<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import { enhance } from '$app/forms';
	import ItemList from '#lib/components/ItemList.svelte';
	import FeedOptions from '#lib/components/FeedOptions.svelte';
	import { asChannelFeed, asSubreddit } from '#lib/feed-url.ts';
	import SyncStatus from '#lib/components/SyncStatus.svelte';
	import { formatDateTime } from '#lib/time.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const f = $derived(data.feed);
	const reddit = $derived(asSubreddit(f.url));
	const youtube = $derived(asChannelFeed(f.url));

	const STATUS = { ok: 'OK', 'not-modified': 'No change', error: 'Failed' } as const;
</script>

<svelte:head>
	<title>{f.title} · Feeds · Stash</title>
</svelte:head>

<main class="page">
	<a class="back" href="/settings/feeds">‹ Feeds</a>
	<h1>{f.title}</h1>
	<p class="muted links">
		<a href={f.url} target="_blank" rel="noopener noreferrer">{f.url}</a>
	</p>

	<form class="edit" method="POST" action="?/edit" use:enhance>
		<label class="field">
			Name
			<input name="title" value={f.title} required maxlength="200" />
		</label>
		{#key f.url}<FeedOptions {reddit} {youtube} />{/key}
		{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
		<Button>Save</Button>
	</form>

	<section class="group">
		<header>
			<h2>Sync log</h2>
			<form method="POST" action="?/fetch" use:enhance>
				<Button variant="secondary" size="sm">Fetch now</Button>
			</form>
		</header>
		{#if f.lastError}<p class="error">{f.lastError}</p>{/if}
		{#if data.log.length}
			<ul class="list log">
				{#each data.log as l (l.id)}
					<li>
						<SyncStatus status={l.status} />
						<span class="at">{formatDateTime(l.at)}</span>
						<span class="what">
							{STATUS[l.status]}{#if l.itemsAdded}, +{l.itemsAdded}{/if}{#if l.error}&nbsp;<span
									class="muted">· {l.error}</span
								>{/if}
						</span>
						<span class="muted ms">{(l.ms / 1000).toFixed(1)}s</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted">Not fetched in the last 7 days.</p>
		{/if}
	</section>

	<section class="group">
		<h2>Entries</h2>
		<ItemList items={data.items} order={data.order} more={data.more}>
			{#snippet empty()}<p class="muted">No entries.</p>{/snippet}
		</ItemList>
	</section>

	<form
		method="POST"
		action="?/delete"
		use:enhance={({ cancel }) => {
			if (!confirm(`Remove ${f.title} and all its entries?`)) cancel();
		}}
	>
		<Button variant="destructive" class="w-full">Remove this feed</Button>
	</form>
</main>

<style>
	.links a {
		overflow-wrap: anywhere;
		font-size: 14px;
	}
	.edit {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.log li {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 12px 0;
		font-size: 14px;
	}
	.log :global(.dot) {
		align-self: center;
	}
	.at {
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}
	.what {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.ms {
		flex-shrink: 0;
	}
</style>
