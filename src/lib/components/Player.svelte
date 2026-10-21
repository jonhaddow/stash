<script lang="ts">
	// A YouTube video playing over the list; closing it stops the video.
	let { id, title, url, onclose }: { id: string; title: string; url: string; onclose: () => void } =
		$props();

	const open = (d: HTMLDialogElement) => d.showModal();
</script>

<!-- A tap on the backdrop (the dialog itself, not its contents) closes it. -->
<dialog
	{@attach open}
	aria-label={title}
	{onclose}
	onclick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
>
	<!-- YouTube refuses to play embeds sent without a referrer (the site's policy is same-origin). -->
	<iframe
		src="https://www.youtube-nocookie.com/embed/{id}?autoplay=1&playsinline=1&rel=0"
		{title}
		allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
		allowfullscreen
		referrerpolicy="strict-origin-when-cross-origin"
	></iframe>
	<div class="bar">
		<p>{title}</p>
		<a class="btn quiet" href={url} target="_blank" rel="noopener noreferrer">YouTube</a>
		<form method="dialog"><button class="btn primary">Close</button></form>
	</div>
</dialog>

<style>
	dialog {
		width: min(100%, 960px);
		max-width: none;
		margin: auto;
		padding: 0;
		border: 0;
		background: var(--card);
		color: var(--ink);
		overflow: hidden;
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.85);
	}
	iframe {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		border: 0;
		background: #000;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px;
	}
	p {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
