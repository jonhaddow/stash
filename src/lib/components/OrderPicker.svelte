<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Order } from '#lib/kind.ts';

	// Newest or oldest first, remembered per list in a cookie the page's load reads.
	let { list, order }: { list: 'later' | 'feeds'; order: Order } = $props();

	function choose(e: Event) {
		const value = (e.currentTarget as HTMLSelectElement).value;
		document.cookie = `order-${list}=${value}; path=/; max-age=31536000; samesite=lax`;
		// From the top again: a page of older entries means nothing in the other order.
		const url = new URL(page.url.href);
		url.searchParams.delete('from');
		void goto(url.pathname + url.search, { replace: true, refreshAll: true });
	}
</script>

<label class="sr" for="order-{list}">Order</label>
<span class="pick">
	<select id="order-{list}" value={order} onchange={choose}>
		<option value="newest">Newest first</option>
		<option value="oldest">Oldest first</option>
	</select>
</span>

<style>
	/* Like the quiet small buttons beside it, with its own chevron (the native one sits cramped against the edge). */
	.pick {
		position: relative;
		display: inline-flex;
	}
	.pick::after {
		content: '';
		position: absolute;
		right: 15px;
		top: 50%;
		width: 6px;
		height: 6px;
		border: solid currentColor;
		border-width: 0 2px 2px 0;
		transform: translateY(-70%) rotate(45deg);
		pointer-events: none;
	}
	select {
		appearance: none;
		min-height: 36px;
		padding: 0 34px 0 14px;
		border: 0;
		border-radius: 18px;
		background: var(--line);
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
	}
	select:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
</style>
