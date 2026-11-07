<script lang="ts">
	// A round 44px button with an icon, for list rows.
	// In a form it submits; otherwise give it an onclick.
	let {
		label,
		icon,
		formaction,
		name,
		value,
		onclick
	}: {
		label: string;
		icon: 'restore' | 'delete' | 'read' | 'unread' | 'later' | 'unlater' | 'archive';
		formaction?: string;
		name?: string;
		value?: string | number;
		onclick?: () => void;
	} = $props();
</script>

<button
	type={onclick ? 'button' : undefined}
	aria-label={label}
	title={label}
	{formaction}
	{name}
	{value}
	{onclick}
>
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		{#if icon === 'restore'}
			<path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" />
		{:else if icon === 'delete'}
			<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />
		{:else if icon === 'read'}
			<path d="M5 12.5l4.5 4.5L19 7.5" />
		{:else if icon === 'unread'}
			<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
		{:else if icon === 'later' || icon === 'unlater'}
			<!-- A bookmark, filled when it's in Later. -->
			<path
				d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1Z"
				fill={icon === 'unlater' ? 'currentColor' : 'none'}
			/>
		{:else}
			<path d="M3.5 4.5h17v4h-17zM5 8.5V19.5h14V8.5M10 12.5h4" />
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
		background: none;
		color: var(--muted);
		cursor: pointer;
		transition:
			scale 0.1s ease-out,
			background-color 0.1s;
	}
	@media (hover: hover) {
		button:hover {
			background: var(--line);
			color: var(--ink);
		}
	}
	button:active {
		background: var(--line);
		scale: 0.9;
	}
	svg {
		width: 22px;
		height: 22px;
	}
</style>
