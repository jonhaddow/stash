<script lang="ts">
	// Feed entries with their swipes (read, Later) and paging, on Feeds and a feed's own page.
	// The page's actions are `itemActions` (item-actions.ts).
	import { Button } from '#lib/components/ui/button/index.ts';
	import type { Snippet } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { withParam } from '#lib/with-param.ts';
	import { SvelteMap } from 'svelte/reactivity';
	import { act } from '#lib/act.ts';
	import type { Order } from '#lib/kind.ts';
	import LinkRow from './LinkRow.svelte';
	import UndoBar from './UndoBar.svelte';
	import { getUnreadChange } from '#lib/unread.ts';

	type Item = {
		id: number;
		url: string;
		title: string;
		imageUrl: string | null;
		publishedAt: string;
		readAt: string | null;
		feedTitle: string;
		savedId: number | null;
	};

	let {
		items: loaded,
		order,
		more,
		empty
	}: {
		items: Item[];
		order: Order;
		/** Where the next page starts, if there is one. */
		more: string | null;
		/** Shown when there are none. */
		empty: Snippet;
	} = $props();

	// Read or unread here (opened or swiped): shown straight away, before the next load says so.
	const readNow = new SvelteMap<number, boolean>();
	const isUnread = (it: Item) => !(readNow.get(it.id) ?? !!it.readAt);

	// Entries read here stay in the list (the unread one reloads without them) until it's
	// refreshed or its filters change.
	const kept = new SvelteMap<number, Item>();
	afterNavigate(() => kept.clear());
	const items = $derived.by(() => {
		const ids = new Set(loaded.map((it) => it.id));
		const gone = [...kept.values()].filter((it) => !ids.has(it.id));
		if (!gone.length) return loaded;
		const sign = order === 'oldest' ? 1 : -1;
		return [...loaded, ...gone].sort(
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
			keep(it, { savedId: (result.data as { saved: { savedId: number } }).saved.savedId });
	}

	async function unsave(it: Item) {
		if (kept.has(it.id)) keep(it, { savedId: null });
		await act(actionHere('unsave'), { savedId: it.savedId! });
	}

	/** A form action on this page's URL, keeping its filters ("?/name" alone would drop them). */
	const actionHere = (name: string) =>
		page.url.search ? `${page.url.search}&/${name}` : `?/${name}`;

	const saved = $derived(
		(page.form as { saved?: { id: number; title: string; savedId: number } } | null)?.saved
	);
</script>

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
	{#if more}
		<Button variant="secondary" class="self-center" href={withParam('from', more)}
			>{order === 'oldest' ? 'Newer' : 'Older'}</Button
		>
	{/if}
{:else}
	{@render empty()}
{/if}

{#if saved}
	{#key saved}
		<UndoBar
			message="In Later: {saved.title}"
			action={actionHere('undo')}
			fields={{ id: saved.id, savedId: saved.savedId }}
		/>
	{/key}
{/if}
