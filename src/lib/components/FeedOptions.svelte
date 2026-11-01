<script lang="ts">
	// A subreddit's sort, time window and limit, or a YouTube channel's Shorts,
	// on the add box and a feed's edit form. feed-url.ts turns them into the URL.
	import { Switch } from '#lib/components/ui/switch/index.ts';
	import { SORTS, WINDOWS, clampLimit, subredditFeed, type Subreddit } from '#lib/feed-url.ts';

	let {
		reddit = null,
		youtube = null
	}: {
		reddit?: Subreddit | null;
		youtube?: { shorts: boolean } | null;
	} = $props();

	// The options start as the URL has them; the subreddit's name can change as it's typed.
	// svelte-ignore state_referenced_locally
	let sort = $state(reddit?.sort ?? 'hot');
	// svelte-ignore state_referenced_locally
	let t = $state(reddit?.t ?? 'day');
	// svelte-ignore state_referenced_locally
	let limit = $state<number | null>(reddit?.limit ?? null);
	const url = $derived(
		reddit && subredditFeed({ sub: reddit.sub, sort, t, limit: clampLimit(limit) })
	);
</script>

{#if reddit}
	<fieldset>
		<legend>Posts from r/{reddit.sub}</legend>
		<p class="muted url">{url}</p>
		<div class="chips">
			{#each SORTS as s (s)}
				<label class="chip"><input type="radio" name="sort" value={s} bind:group={sort} />{s}</label
				>
			{/each}
		</div>
		{#if sort === 'top'}
			<div class="chips">
				{#each WINDOWS as w (w)}
					<label class="chip"
						><input type="radio" name="t" value={w} bind:group={t} />{w === 'all'
							? 'all time'
							: `this ${w}`}</label
					>
				{/each}
			</div>
		{/if}
		<label class="limit">
			At most
			<input
				name="limit"
				type="number"
				inputmode="numeric"
				min="1"
				max="100"
				placeholder="25"
				bind:value={limit}
			/>
			posts each time
		</label>
	</fieldset>
{:else if youtube}
	<label class="check">
		<Switch name="shorts" checked={youtube.shorts} />
		Include Shorts
	</label>
{/if}

<style>
	fieldset {
		border: 0;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	legend {
		font-size: 14px;
		font-weight: 600;
		margin-bottom: 6px;
		padding: 0;
	}
	.url {
		margin: 0;
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	.limit,
	.check {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 15px;
		min-height: 44px;
	}
	.limit input {
		width: 4.5em;
		min-height: 44px;
		padding: 8px 10px;
		border: 1.5px solid var(--field);
		background: var(--bg);
		font-size: 17px;
	}
</style>
