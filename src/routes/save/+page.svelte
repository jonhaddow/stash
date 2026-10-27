<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Back to the article it came from, once there's been time to read this.
	$effect(() => {
		if (history.length < 2) return;
		const timer = setTimeout(() => history.back(), 1200);
		return () => clearTimeout(timer);
	});
</script>

<svelte:head>
	<title>Saved · Stash</title>
</svelte:head>

<main class="page">
	<h1>Saved</h1>
	<p role="status">{data.title}</p>
	<p><a href={data.url}>Back to the page</a> · <a href="/later">Later</a></p>
</main>
