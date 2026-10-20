<script lang="ts">
	import { page } from '$app/state';
	import type { Kind } from '#lib/kind.ts';

	// All / Articles / Videos, as links that keep the page's other filters.
	let { kind }: { kind: Kind | null } = $props();

	const options = [
		{ value: null, label: 'All' },
		{ value: 'article', label: 'Articles' },
		{ value: 'video', label: 'Videos' }
	] as const;

	function href(value: Kind | null) {
		const url = new URL(page.url.href);
		url.searchParams.delete('before');
		if (value) url.searchParams.set('kind', value);
		else url.searchParams.delete('kind');
		return url.pathname + url.search;
	}
</script>

<nav class="segments" aria-label="Show">
	{#each options as o (o.label)}
		<a
			href={href(o.value)}
			aria-current={kind === o.value ? 'page' : undefined}
			data-sveltekit-replacestate>{o.label}</a
		>
	{/each}
</nav>
