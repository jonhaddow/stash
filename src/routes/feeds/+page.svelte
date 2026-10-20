<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { SvelteSet } from 'svelte/reactivity';
	import IconButton from '#lib/components/IconButton.svelte';
	import KindFilter from '#lib/components/KindFilter.svelte';
	import LinkRow from '#lib/components/LinkRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Opened here: shown read straight away, before the next load says so.
	const opened = new SvelteSet<number>();

	function open(id: number) {
		opened.add(id);
		// keepalive: the request outlives the page if the link replaces it.
		void fetch(`/items/${id}/read`, { method: 'POST', keepalive: true });
	}

	/** This page's URL with one filter changed (and paging reset). */
	function withParam(name: string, value: string | null) {
		const url = new URL(page.url.href);
		url.searchParams.delete('before');
		if (value) url.searchParams.set(name, value);
		else url.searchParams.delete(name);
		return url.pathname + url.search;
	}

	const unreadHere = $derived(
		data.folderId
			? (data.folders.find((f) => f.id === data.folderId)?.unread ?? 0)
			: data.totalUnread
	);
</script>

<svelte:head>
	<title>Feeds · Stash</title>
</svelte:head>

<main class="page">
	<header>
		<h1>Feeds</h1>
		{#if unreadHere}
			<form method="POST" action="?/readAll" use:enhance>
				<input type="hidden" name="upTo" value={data.loadedAt} />
				<button class="btn quiet small">Mark all read</button>
			</form>
		{/if}
	</header>

	{#if data.folders.length}
		<nav class="chips" aria-label="Folders">
			<a
				class="chip"
				class:on={!data.folderId}
				href={withParam('folder', null)}
				data-sveltekit-replacestate>All</a
			>
			{#each data.folders as f (f.id)}
				<a
					class="chip"
					class:on={data.folderId === f.id}
					href={withParam('folder', String(f.id))}
					data-sveltekit-replacestate
					>{f.name}{#if f.unread}<span class="count">{f.unread}</span>{/if}</a
				>
			{/each}
		</nav>
	{/if}

	<div class="filters">
		<KindFilter kind={data.kind ?? null} />
		<a
			class="chip"
			class:on={data.unreadOnly}
			href={withParam('unread', data.unreadOnly ? null : '1')}
			aria-current={data.unreadOnly ? 'true' : undefined}
			data-sveltekit-replacestate>Unread</a
		>
	</div>

	{#if data.items.length}
		<ul class="list">
			{#each data.items as it (it.id)}
				<LinkRow
					url={it.url}
					title={it.title}
					source={it.feedTitle}
					at={it.publishedAt}
					unread={!it.readAt && !opened.has(it.id)}
					onopen={() => open(it.id)}
				>
					{#snippet actions()}
						<form method="POST" use:enhance>
							{#if it.savedId}
								<input type="hidden" name="savedId" value={it.savedId} />
								<IconButton
									icon="saved"
									on
									label="Remove from Later: {it.title}"
									formaction="?/unsave"
								/>
							{:else}
								<input type="hidden" name="url" value={it.url} />
								<input type="hidden" name="title" value={it.title} />
								<IconButton icon="save" label="Save for later: {it.title}" formaction="?/save" />
							{/if}
						</form>
					{/snippet}
				</LinkRow>
			{/each}
		</ul>
		{#if data.more}
			<a class="btn quiet more" href={withParam('before', data.more)}>Older</a>
		{/if}
	{:else if data.paged}
		<p class="empty muted">No older entries.</p>
	{:else if data.folders.length || data.totalUnread}
		<p class="empty muted">Nothing here{data.unreadOnly ? ' unread' : ''}.</p>
	{:else}
		<p class="empty muted">
			No feeds yet. <a href="/settings/feeds">Add one</a> from a site, YouTube channel or subreddit.
		</p>
	{/if}
</main>

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.small {
		min-height: 36px;
		font-size: 14px;
		padding: 0 14px;
	}
	/* Folders scroll sideways rather than wrapping onto lines. */
	nav.chips {
		flex-wrap: nowrap;
		overflow-x: auto;
		margin: 0 -16px;
		padding: 0 16px;
		scrollbar-width: none;
	}
	nav .chip {
		flex-shrink: 0;
		gap: 6px;
	}
	.count {
		font-size: 12px;
		font-weight: 800;
		opacity: 0.7;
	}
	.filters {
		display: flex;
		gap: 8px;
	}
	.filters :global(.segments) {
		flex: 1;
	}
	.filters .chip {
		min-height: 46px;
		border-radius: 16px;
	}
	.more {
		align-self: center;
	}
	.empty {
		text-align: center;
		padding: 32px 16px;
	}
</style>
