<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { SvelteMap } from 'svelte/reactivity';
	import { act } from '#lib/act.ts';
	import KindFilter from '#lib/components/KindFilter.svelte';
	import LinkRow from '#lib/components/LinkRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Read or unread here (opened or swiped): shown straight away, before the next load says so.
	const readNow = new SvelteMap<number, boolean>();
	const isUnread = (it: (typeof data.items)[number]) => !(readNow.get(it.id) ?? !!it.readAt);

	function setRead(id: number, read: boolean) {
		readNow.set(id, read);
		// keepalive: the request outlives the page if the link replaces it.
		void fetch(`/items/${id}/read`, { method: read ? 'POST' : 'DELETE', keepalive: true });
	}

	/** This page's URL with one filter changed (and paging reset). */
	function withParam(name: string, value: string | null) {
		const url = new URL(page.url.href);
		url.searchParams.delete('before');
		if (value) url.searchParams.set(name, value);
		else url.searchParams.delete(name);
		return url.pathname + url.search;
	}

	/** A form action on this page's URL, keeping its filters ("?/name" alone would drop them). */
	const actionHere = (name: string) =>
		page.url.search ? `${page.url.search}&/${name}` : `?/${name}`;
</script>

<svelte:head>
	<title>Feeds · Stash</title>
</svelte:head>

<main class="page">
	<header>
		<h1>Feeds</h1>
		{#if data.unread}
			<form
				method="POST"
				action={actionHere('readAll')}
				use:enhance={() =>
					async ({ update }) => {
						// Swiped-unread ones are read now too.
						readNow.clear();
						await update();
					}}
			>
				<input type="hidden" name="upTo" value={data.loadedAt} />
				<button class="btn quiet small">Mark all read</button>
			</form>
		{/if}
	</header>

	<div class="filters">
		<KindFilter kind={data.kind ?? null} />
		<a
			class="chip"
			class:on={data.unreadOnly}
			href={withParam('all', data.unreadOnly ? '1' : null)}
			aria-current={data.unreadOnly ? 'true' : undefined}
			data-sveltekit-replacestate>Unread</a
		>
	</div>

	{#if data.items.length}
		<ul class="list">
			{#each data.items as it (it.id)}
				{@const unread = isUnread(it)}
				<LinkRow
					url={it.url}
					title={it.title}
					image={it.imageUrl}
					source={it.feedTitle}
					at={it.publishedAt}
					{unread}
					saved={!!it.savedId}
					onopen={() => setRead(it.id, true)}
					right={{
						label: unread ? 'Read' : 'Unread',
						run: () => setRead(it.id, unread)
					}}
					left={it.savedId
						? {
								label: 'Out of Later',
								run: () => act(actionHere('unsave'), { savedId: it.savedId! })
							}
						: {
								label: 'Later',
								run: () => act(actionHere('save'), { id: it.id })
							}}
				/>
			{/each}
		</ul>
		{#if data.more}
			<a class="btn quiet more" href={withParam('before', data.more)}>Older</a>
		{/if}
	{:else if data.paged}
		<p class="empty muted">No older entries.</p>
	{:else if data.hasFeeds}
		<p class="empty muted">{data.unreadOnly ? 'All caught up.' : 'Nothing here.'}</p>
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
