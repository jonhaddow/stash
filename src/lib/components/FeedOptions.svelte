<script lang="ts">
	// A subreddit's sort, time window and limit, or a YouTube channel's Shorts,
	// on the add box and a feed's edit form. feed-url.ts turns them into the URL.
	import { Switch } from '#lib/components/ui/switch/index.ts';
	import { SORTS, WINDOWS, type Subreddit } from '#lib/feed-url.ts';

	let {
		reddit = null,
		youtube = null
	}: {
		reddit?: Subreddit | null;
		youtube?: { shorts: boolean } | null;
	} = $props();

	// svelte-ignore state_referenced_locally
	let sort = $state(reddit?.sort ?? 'hot');
</script>

{#if reddit}
	<fieldset>
		<legend>Posts from r/{reddit.sub}</legend>
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
						><input type="radio" name="t" value={w} checked={reddit.t === w} />{w === 'all'
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
				value={reddit.limit ?? ''}
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
