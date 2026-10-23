<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.ts';
	import { Button } from '#lib/components/ui/button/index.ts';
	import type { Order } from '#lib/kind.ts';

	// Newest or oldest first, remembered per list in a cookie the page's load reads.
	let { list, order }: { list: 'later' | 'feeds'; order: Order } = $props();

	const labels: Record<Order, string> = { newest: 'Newest first', oldest: 'Oldest first' };

	function choose(value: string) {
		// bits-ui reports the starting value too: only a change needs a reload.
		if (value === order) return;
		document.cookie = `order-${list}=${value}; path=/; max-age=31536000; samesite=lax`;
		// From the top again: a page of older entries means nothing in the other order.
		const url = new URL(page.url.href);
		url.searchParams.delete('from');
		void goto(url.pathname + url.search, { replace: true, refreshAll: true });
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="secondary" size="sm" aria-label="Order: {labels[order]}">
				{labels[order]}
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg
				>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-auto min-w-40">
		<DropdownMenu.RadioGroup value={order} onValueChange={choose}>
			{#each Object.entries(labels) as [value, label] (value)}
				<DropdownMenu.RadioItem {value} closeOnSelect class="min-h-11 text-[15px] font-semibold">
					{label}
				</DropdownMenu.RadioItem>
			{/each}
		</DropdownMenu.RadioGroup>
	</DropdownMenu.Content>
</DropdownMenu.Root>
