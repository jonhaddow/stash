<script lang="ts">
	import { enhance } from '$app/forms';
	import FeedOptions from '#lib/components/FeedOptions.svelte';
	import FolderPicker from '#lib/components/FolderPicker.svelte';
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

	<form class="edit" method="POST" action="?/save" use:enhance>
		<label class="field">
			Name
			<input name="title" value={f.title} required maxlength="200" />
		</label>
		{#key f.url}<FeedOptions {reddit} {youtube} />{/key}
		{#key f.folderId}<FolderPicker folders={data.folders} selected={f.folderId} />{/key}
		{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
		<button class="btn primary">Save</button>
	</form>

	<section class="group">
		<header>
			<h2>Sync log</h2>
			<form method="POST" action="?/fetch" use:enhance>
				<button class="btn quiet small">Fetch now</button>
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
			<p class="muted">Not fetched in the last 30 days.</p>
		{/if}
	</section>

	<form
		method="POST"
		action="?/delete"
		use:enhance={({ cancel }) => {
			if (!confirm(`Remove ${f.title} and all its entries?`)) cancel();
		}}
	>
		<button class="btn danger">Remove this feed</button>
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
	.small {
		min-height: 36px;
		font-size: 14px;
		padding: 0 14px;
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
	form > .btn.danger {
		width: 100%;
	}
</style>
