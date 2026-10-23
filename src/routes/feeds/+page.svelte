<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { SvelteMap } from 'svelte/reactivity';
	import { act } from '#lib/act.ts';
	import KindFilter from '#lib/components/KindFilter.svelte';
	import LinkRow from '#lib/components/LinkRow.svelte';
	import OrderPicker from '#lib/components/OrderPicker.svelte';
	import UndoBar from '#lib/components/UndoBar.svelte';
	import { getUnreadChange } from '#lib/unread.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Item = (typeof data.items)[number];

	// Read or unread here (opened or swiped): shown straight away, before the next load says so.
	const readNow = new SvelteMap<number, boolean>();
	const isUnread = (it: Item) => !(readNow.get(it.id) ?? !!it.readAt);

	// Entries read here stay in the list (the unread one reloads without them) until it's
	// refreshed or its filters change.
	const kept = new SvelteMap<number, Item>();
	afterNavigate(() => kept.clear());
	const items = $derived.by(() => {
		const ids = new Set(data.items.map((it) => it.id));
		const gone = [...kept.values()].filter((it) => !ids.has(it.id));
		if (!gone.length) return data.items;
		const sign = data.order === 'oldest' ? 1 : -1;
		return [...data.items, ...gone].sort(
			(a, b) => sign * (a.publishedAt.localeCompare(b.publishedAt) || a.id - b.id)
		);
	});
	const keep = (it: Item, changes: Partial<Item> = {}) =>
		kept.set(it.id, { ...it, readAt: it.readAt ?? new Date().toISOString(), ...changes });

	const changeUnread = getUnreadChange();

	function setRead(it: Item, read: boolean) {
		if (isUnread(it) === read) changeUnread(read ? -1 : 1);
		readNow.set(it.id, read);
		if (read) keep(it);
		// keepalive: the request outlives the page if the link replaces it.
		void fetch(`/items/${it.id}/read`, { method: read ? 'POST' : 'DELETE', keepalive: true });
	}

	/** Saved by a swipe: the server marks it read, so drop any override here (or Undo would bring it back looking read). */
	async function save(it: Item) {
		if (isUnread(it)) changeUnread(-1);
		readNow.delete(it.id);
		keep(it);
		const result = await act(actionHere('save'), { id: it.id });
		if (result.type === 'success')
			keep(it, { savedId: (result.data as { done: { savedId: number } }).done.savedId });
	}

	async function unsave(it: Item) {
		if (kept.has(it.id)) keep(it, { savedId: null });
		await act(actionHere('unsave'), { savedId: it.savedId! });
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
			<a class="btn quiet small" href="/settings/feeds">Manage</a>
			<OrderPicker list="feeds" order={data.order} />
			<a
				class="btn quiet small add"
				href="/settings/feeds#add"
				aria-label="Add a feed"
				title="Add a feed">+</a
			>
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

	{#if items.length}
		<ul class="list">
			{#each items as it (it.id)}
				{@const unread = isUnread(it)}
				<LinkRow
					url={it.url}
					title={it.title}
					image={it.imageUrl}
					source={it.feedTitle}
					at={it.publishedAt}
					{unread}
					saved={!!it.savedId}
					onopen={() => setRead(it, true)}
					right={{ label: unread ? 'Read' : 'Unread', run: () => setRead(it, unread) }}
					left={it.savedId
						? { label: 'Out of Later', run: () => unsave(it) }
						: { label: 'Later', run: () => save(it) }}
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
			message="In Later: {form.done.title}"
			action={actionHere('undo')}
			fields={{ id: form.done.id, savedId: form.done.savedId }}
		/>
	{/key}
{/if}

<style>
	/* Baseline, like Later's header, so the order picker sits at the same height on both tabs. */
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.end {
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.add {
		font-size: 20px;
		padding: 0;
		width: 36px;
	}
	.small {
		min-height: 36px;
		font-size: 14px;
		padding: 0 12px;
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
	}
	.more {
		align-self: center;
	}
	.empty {
		text-align: center;
		padding: 32px 16px;
	}
</style>
