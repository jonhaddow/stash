<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.ts';
	import { enhance } from '$app/forms';
	import FeedOptions from '#lib/components/FeedOptions.svelte';
	import { asChannelFeed, asSubreddit, typedAs } from '#lib/feed-url.ts';
	import SyncStatus from '#lib/components/SyncStatus.svelte';
	import { ago } from '#lib/time.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state('');
	// svelte-ignore state_referenced_locally
	let text = $state(form?.url ?? '');
	const typed = $derived(typedAs(text));
	const reddit = $derived(asSubreddit(text));
	// Results for what's in the box now, not for something typed before.
	const found = $derived(form?.found && form.url === text.trim() ? form.found : null);
	const showShorts = $derived(typed === 'youtube' || !!found?.some((r) => asChannelFeed(r.url)));
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
		use:enhance={({ action }) => {
			busy = action.search.includes('search') ? 'Searching…' : 'Finding the feed…';
			return async ({ result, update }) => {
				await update({ reset: false });
				if (result.type === 'success' && result.data?.added) text = '';
				busy = '';
			};
		}}
	>
		<h2 id="add">Add a feed</h2>
		<label class="field">
			Name, link, r/subreddit or @channel
			<input
				name="url"
				autocomplete="off"
				autocapitalize="off"
				spellcheck="false"
				enterkeyhint={typed === 'search' ? 'search' : 'go'}
				placeholder="e.g. veritasium, r/rust"
				bind:value={text}
				required
			/>
		</label>
		{#key reddit?.sub}<FeedOptions {reddit} youtube={showShorts ? { shorts: false } : null} />{/key}
		{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}
		{#if form?.added}<p class="note" role="status">Added {form.added}</p>{/if}
		{#if typed === 'search'}
			<Button formaction="?/search" disabled={!!busy}>{busy || 'Search'}</Button>
		{:else}
			<Button disabled={!!busy}>{busy || 'Add'}</Button>
		{/if}
		{#if found}
			{#if found.length}
				<ul class="list found">
					{#each found as r (r.url)}
						<li>
							{#if r.icon}<img
									src={r.icon}
									alt=""
									width="40"
									height="40"
									loading="lazy"
								/>{:else}<span class="icon"></span>{/if}
							<span class="what">
								<span class="name">{r.title}</span>
								<span class="muted detail">{r.detail}</span>
							</span>
							<Button
								variant="secondary"
								size="sm"
								name="pick"
								value={r.url}
								disabled={!!busy}
								aria-label="Add {r.title}">Add</Button
							>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted">Nothing found. Try a link to the site instead.</p>
			{/if}
		{/if}
	</form>

	{#each data.groups as g (g.name)}
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
	.found li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 0;
	}
	.found img,
	.found .icon {
		width: 40px;
		height: 40px;
		flex-shrink: 0;
		object-fit: cover;
		background: var(--line);
	}
	.what {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.detail {
		font-size: 13px;
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
