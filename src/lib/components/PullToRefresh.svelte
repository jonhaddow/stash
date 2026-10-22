<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	// Pulling down from the top of the page reloads its data, as in Safari (home-screen
	// apps don't have it). A navigation to the same URL, so pages can reset what they hold.
	const PULL = 70;
	let start: { x: number; y: number } | null = null;
	let dy = $state(0);
	let refreshing = $state(false);

	function ontouchstart(e: TouchEvent) {
		if (refreshing || scrollY > 0 || e.touches.length > 1) return;
		start = { x: e.touches[0].clientX, y: e.touches[0].clientY };
	}

	function ontouchmove(e: TouchEvent) {
		if (!start) return;
		const x = e.touches[0].clientX - start.x;
		const y = e.touches[0].clientY - start.y;
		// Sideways is a swipe on a row; up is scrolling.
		if (Math.abs(x) > Math.abs(y) || y < 0) {
			start = null;
			dy = 0;
			return;
		}
		dy = y;
	}

	async function ontouchend() {
		if (!start) return;
		start = null;
		const pulled = dy >= PULL;
		dy = 0;
		if (!pulled) return;
		refreshing = true;
		try {
			await goto(page.url.href, { refreshAll: true, replace: true, reset: false });
		} finally {
			refreshing = false;
		}
	}
</script>

<svelte:window
	{ontouchstart}
	{ontouchmove}
	{ontouchend}
	ontouchcancel={() => ((start = null), (dy = 0))}
/>

{#if dy > 10 || refreshing}
	<div
		class="pull"
		class:armed={dy >= PULL}
		class:refreshing
		style:translate="-50% {refreshing ? 12 : Math.min(dy, PULL) * 0.6 - 30}px"
		role="status"
		aria-label={refreshing ? 'Refreshing' : 'Pull to refresh'}
	>
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.2"
			stroke-linecap="round"
			stroke-linejoin="round"
			style:rotate="{refreshing ? 0 : Math.min(dy / PULL, 1) * 270}deg"
			aria-hidden="true"
		>
			<path d="M20 12a8 8 0 1 1-2.3-5.7" />
			<path d="M20 4v4h-4" />
		</svg>
	</div>
{/if}

<style>
	.pull {
		position: fixed;
		top: env(safe-area-inset-top);
		left: 50%;
		z-index: 3;
		display: flex;
		width: 40px;
		height: 40px;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--bg);
		color: var(--muted);
		box-shadow: 0 2px 12px rgb(0 0 0 / 0.18);
	}
	.pull.armed,
	.pull.refreshing {
		color: var(--accent);
	}
	svg {
		width: 22px;
		height: 22px;
	}
	.refreshing svg {
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
