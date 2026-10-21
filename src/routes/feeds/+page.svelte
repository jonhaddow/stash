<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { SvelteMap } from 'svelte/reactivity';
	import { act } from '#lib/act.ts';
	import KindFilter from '#lib/components/KindFilter.svelte';
	import LinkRow from '#lib/components/LinkRow.svelte';
	import OrderPicker from '#lib/components/OrderPicker.svelte';
	import UndoBar from '#lib/components/UndoBar.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// Read or unread here (opened or swiped): shown straight away, before the next load says so.
	const readNow = new SvelteMap<number, boolean>();
	const isUnread = (it: (typeof data.items)[number]) => !(readNow.get(it.id) ?? !!it.readAt);

	function setRead(id: number, read: boolean) {
		readNow.set(id, read);
		// keepalive: the request outlives the page if the link replaces it.
		void fetch(`/items/${id}/read`, { method: read ? 'POST' : 'DELETE', keepalive: true });
	}

	/** Read or saved by a swipe: the server marks it read, so drop any override here (or Undo would bring it back looking read). */
	function dealWith(action: 'read' | 'save', id: number) {
		readNow.delete(id);
		return act(actionHere(action), { id });
	}

	/** This page's URL with one filter changed (and paging reset). */
	function withParam(name: string, value: string | null) {
		const url = new URL(page.url.href);
		url.searchParams.delete('from');
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
		<div class="end">
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
			<OrderPicker list="feeds" order={data.order} />
		</div>
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
					right={data.unreadOnly
						? { label: 'Read', away: true, run: () => dealWith('read', it.id) }
						: { label: unread ? 'Read' : 'Unread', run: () => setRead(it.id, unread) }}
					left={it.savedId
						? {
								label: 'Out of Later',
								run: () => act(actionHere('unsave'), { savedId: it.savedId! })
							}
						: {
								label: 'Later',
								away: data.unreadOnly,
								run: () => dealWith('save', it.id)
							}}
				/>
			{/each}
		</ul>
		{#if data.more}
			<a class="btn quiet more" href={withParam('from', data.more)}
				>{data.order === 'oldest' ? 'Newer' : 'Older'}</a
			>
		{/if}
	{:else if data.paged}
		<p class="empty muted">No more entries.</p>
	{:else if data.hasFeeds}
		<p class="empty muted">{data.unreadOnly ? 'All caught up.' : 'Nothing here.'}</p>
	{:else}
		<p class="empty muted">
			No feeds yet. <a href="/settings/feeds">Add one</a> from a site, YouTube channel or subreddit.
		</p>
	{/if}
</main>

{#if form?.done}
	{#key form.done}
		<UndoBar
			message="{form.done.savedId ? 'In Later' : 'Read'}: {form.done.title}"
			action={actionHere('undo')}
			fields={{ id: form.done.id, savedId: form.done.savedId ?? '' }}
		/>
	{/key}
{/if}

<style>
	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.end {
		display: flex;
		align-items: center;
		gap: 8px;
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
