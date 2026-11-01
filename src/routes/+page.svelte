<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import ItemList from '#lib/components/ItemList.svelte';
	import KindFilter from '#lib/components/KindFilter.svelte';
	import OrderPicker from '#lib/components/OrderPicker.svelte';
	import { withParam } from '#lib/with-param.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Feeds · Stash</title>
</svelte:head>

<main class="page">
	<header>
		<h1>Feeds</h1>
		<div class="end">
			<Button variant="secondary" size="sm" href="/settings/feeds">Manage</Button>
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

	<ItemList items={data.items} order={data.order} more={data.more}>
		{#snippet empty()}
			{#if data.paged}
				<p class="empty muted">No more entries.</p>
			{:else if data.hasFeeds}
				<p class="empty muted">{data.unreadOnly ? 'All caught up.' : 'Nothing here.'}</p>
			{:else}
				<p class="empty muted">
					No feeds yet. <a href="/settings/feeds">Add one</a> from a site, YouTube channel or subreddit.
				</p>
			{/if}
		{/snippet}
	</ItemList>
</main>

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
		gap: 8px;
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
	.empty {
		text-align: center;
		padding: 32px 16px;
	}
</style>
