<script lang="ts">
	import { enhance } from '$app/forms';
	import IconButton from '#lib/components/IconButton.svelte';
	import LinkRow from '#lib/components/LinkRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Archive · Stash</title>
</svelte:head>

<main class="page">
	<a class="back" href="/settings">‹ Settings</a>
	<h1>Archive</h1>
	<p class="muted">Links you’ve finished, latest first.</p>

	{#if data.links.length}
		<ul class="list">
			{#each data.links as link (link.id)}
				<LinkRow url={link.url} title={link.title} at={link.archivedAt!}>
					{#snippet actions()}
						<form method="POST" use:enhance>
							<input type="hidden" name="id" value={link.id} />
							<IconButton
								icon="restore"
								label="Back to Later: {link.title}"
								formaction="?/restore"
							/>
						</form>
					{/snippet}
				</LinkRow>
			{/each}
		</ul>
	{:else}
		<p class="muted">Nothing archived yet.</p>
	{/if}
</main>
