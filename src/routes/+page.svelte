<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import { enhance } from '$app/forms';
	import { act } from '#lib/act.ts';
	import KindFilter from '#lib/components/KindFilter.svelte';
	import LinkRow from '#lib/components/LinkRow.svelte';
	import OrderPicker from '#lib/components/OrderPicker.svelte';
	import UndoBar from '#lib/components/UndoBar.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const what = $derived(
		data.kind === 'video' ? 'videos' : data.kind === 'article' ? 'articles' : 'links'
	);
</script>

<svelte:head>
	<title>Later · Stash</title>
</svelte:head>

<main class="page">
	<header>
		<h1>Later</h1>
		<div class="end">
			<p class="muted">{data.links.length} {data.links.length === 1 ? what.slice(0, -1) : what}</p>
			<OrderPicker list="later" order={data.order} />
		</div>
	</header>

	<form class="add" method="POST" action="?/add" use:enhance>
		<label class="sr" for="add-url">Link to save</label>
		<input
			id="add-url"
			name="url"
			type="url"
			inputmode="url"
			autocomplete="off"
			placeholder="Paste a link"
			value={form?.url ?? ''}
			required
		/>
		<Button>Save</Button>
	</form>
	{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

	<KindFilter kind={data.kind} />

	{#if data.links.length}
		<ul class="list">
			{#each data.links as link (link.id)}
				<LinkRow
					url={link.url}
					title={link.title}
					image={link.imageUrl}
					at={link.addedAt}
					right={{
						label: 'Archive',
						away: true,
						run: () => act('?/done', { id: link.id, title: link.title })
					}}
				/>
			{/each}
		</ul>
	{:else}
		<p class="empty muted">
			Nothing to read. Share a link to Stash from any app, or save one from Feeds.
		</p>
	{/if}
</main>

{#if form?.done}
	{#key form.done.id}
		<UndoBar message="Archived: {form.done.title}" action="?/undo" fields={{ id: form.done.id }} />
	{/key}
{/if}

<style>
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}
	.end {
		display: flex;
		align-items: baseline;
		gap: 12px;
	}
	.add {
		display: flex;
		gap: 8px;
	}
	.add input {
		flex: 1;
		min-width: 0;
		min-height: 48px;
		padding: 10px 14px;
		border: 1.5px solid var(--field);
		background: var(--bg);
		font-size: 16px;
	}
	.empty {
		text-align: center;
		padding: 32px 16px;
	}
</style>
