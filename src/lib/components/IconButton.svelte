<script lang="ts">
	// A round 44px button with an icon, for list rows.
	let {
		label,
		icon,
		on = false,
		formaction,
		name,
		value
	}: {
		label: string;
		icon: 'done' | 'save' | 'saved' | 'restore' | 'delete';
		on?: boolean;
		formaction?: string;
		name?: string;
		value?: string | number;
	} = $props();
</script>

<button class:on aria-label={label} title={label} {formaction} {name} {value}>
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if icon === 'done'}
			<path d="m5 12.5 4.5 4.5L19 7.5" />
		{:else if icon === 'save' || icon === 'saved'}
			<path
				d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1Z"
				fill={icon === 'saved' ? 'currentColor' : 'none'}
			/>
		{:else if icon === 'restore'}
			<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" />
		{:else}
			<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />
		{/if}
	</svg>
</button>

<style>
	button {
		flex-shrink: 0;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		border-radius: 50%;
		background: none;
		color: var(--muted);
		cursor: pointer;
	}
	button:active {
		background: var(--line);
	}
	.on {
		color: var(--accent);
	}
	svg {
		width: 22px;
		height: 22px;
	}
</style>
