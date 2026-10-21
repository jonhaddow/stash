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
<select id="order-{list}" value={order} onchange={choose}>
	<option value="newest">Newest first</option>
	<option value="oldest">Oldest first</option>
</select>

<style>
	select {
		min-height: 36px;
		padding: 0 12px;
		border: 0;
		border-radius: 18px;
		background: var(--line);
		font-size: 14px;
		font-weight: 600;
	}
</style>
