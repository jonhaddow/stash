<script lang="ts">
	import { enhance } from '$app/forms';

	// "Done: Some article. Undo", floating above the tabs after an action.
	let {
		message,
		action,
		fields
	}: { message: string; action: string; fields: Record<string, string | number> } = $props();
</script>

<form class="undo" method="POST" {action} use:enhance role="status">
	<span>{message}</span>
	{#each Object.entries(fields) as [name, value] (name)}
		<input type="hidden" {name} {value} />
	{/each}
	<button>Undo</button>
</form>

<style>
	.undo {
		position: fixed;
		left: 50%;
		bottom: calc(var(--tabs) + 24px + env(safe-area-inset-bottom));
		translate: -50% 0;
		width: min(calc(100% - 32px), 448px);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 6px 6px 6px 16px;
		border-radius: 24px;
		background: var(--ink);
		color: var(--bg);
		font-weight: 600;
		box-shadow: 0 8px 28px rgb(0 0 0 / 0.18);
		animation: rise 0.2s ease-out;
		z-index: 2;
	}
	span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	button {
		min-height: 40px;
		padding: 0 16px;
		border: 0;
		border-radius: 20px;
		background: color-mix(in srgb, var(--bg) 18%, transparent);
		color: inherit;
		font-weight: 800;
		cursor: pointer;
	}
	@keyframes rise {
		from {
			opacity: 0;
			translate: -50% 12px;
		}
	}
</style>
