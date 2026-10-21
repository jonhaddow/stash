<script lang="ts">
	import { enhance } from '$app/forms';
	import FolderPicker from '#lib/components/FolderPicker.svelte';
	import SyncStatus from '#lib/components/SyncStatus.svelte';
	import { ago } from '#lib/time.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let adding = $state(false);
</script>

<svelte:head>
	<title>Feeds · Settings · Stash</title>
</svelte:head>

<main class="page">
	<a class="back" href="/settings">‹ Settings</a>
	<h1>Feeds</h1>

	<form
		class="add"
		method="POST"
		action="?/add"
		use:enhance={() => {
			adding = true;
			return async ({ update }) => {
				await update();
				adding = false;
			};
		}}
	>
		<h2>Add a feed</h2>
		<label class="field">
			Site, feed, YouTube channel or subreddit
			<input
				name="url"
				type="url"
				inputmode="url"
				autocomplete="off"
				placeholder="https://"
				value={form?.url ?? ''}
				required
			/>
		</label>
		<FolderPicker folders={data.folders} />
		{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
		{#if form?.added}<p class="note" role="status">Added {form.added}</p>{/if}
		<button class="btn primary" disabled={adding}>{adding ? 'Finding the feed…' : 'Add'}</button>
	</form>

	{#each data.groups as g (g.id)}
		<section class="group">
			<h2>{g.name}</h2>
			<ul class="list">
				{#each g.feeds as f (f.id)}
					<li>
						<a href="/settings/feeds/{f.id}">
							<SyncStatus status={f.lastStatus} />
							<span class="name">{f.title}</span>
							<span class="muted when">
								{#if f.lastStatus === 'error'}<span class="over">failed</span
									>{:else if f.lastFetchedAt}{ago(f.lastFetchedAt)}{/if}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</main>

<style>
	.add {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.list a {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 0;
		text-decoration: none;
	}
	.name {
		flex: 1;
		min-width: 0;
		font-weight: 650;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.when {
		font-size: 13px;
		flex-shrink: 0;
	}
</style>
