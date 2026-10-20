<script lang="ts">
	// A dot for how a feed's last fetch went: green fine, red failed, grey not yet.
	let { status }: { status: 'ok' | 'not-modified' | 'error' | null } = $props();
	const label = $derived(
		status === 'error' ? 'Last fetch failed' : status ? 'Last fetch worked' : 'Not fetched yet'
	);
</script>

<span
	class="dot"
	class:is-ok={status === 'ok' || status === 'not-modified'}
	class:is-error={status === 'error'}
	role="img"
	aria-label={label}
	title={label}
></span>

<style>
	.dot {
		flex-shrink: 0;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--field);
	}
	.is-ok {
		background: var(--good);
	}
	.is-error {
		background: var(--over);
	}
</style>
