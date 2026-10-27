<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Back to the article it came from, once there's been time to read this. Not
	// after signing in on the way, when going back would land on Google.
	$effect(() => {
		const from = document.referrer && new URL(document.referrer).origin;
		if (from !== new URL(data.url).origin) return;
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
