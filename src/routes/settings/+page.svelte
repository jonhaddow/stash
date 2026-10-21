<script lang="ts">
	import { enhance } from '$app/forms';
	import { looks } from '#lib/looks.ts';
	import { formatDateTime } from '#lib/time.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// iOS shows the unread count on the app icon only once notifications are
	// allowed. Unset until mounted: there's no Notification on the server.
	let permission = $state<NotificationPermission>();
	$effect(() => {
		if ('Notification' in window && 'setAppBadge' in navigator)
			permission = Notification.permission;
	});

	async function allow() {
		permission = await Notification.requestPermission();
		// The layout set the badge before it was allowed; set it again now.
		if (permission === 'granted' && data.unread) void navigator.setAppBadge(data.unread);
	}
</script>

<svelte:head>
	<title>Settings · Stash</title>
</svelte:head>

<main class="page">
	<h1>Settings</h1>

	<ul class="list">
		<li><a href="/settings/feeds">Feeds and sync log <span class="muted">›</span></a></li>
		<li><a href="/archive">Archive <span class="muted">›</span></a></li>
	</ul>

	<section class="group">
		<h2>Share sheet</h2>
		<p class="muted">
			An iOS Shortcut puts “Save to Stash” in the share sheet. It needs a key to save without
			signing in.
		</p>
		{#if form?.token}
			<div class="note">
				<p>Your key, shown only now:</p>
				<code>{form.token}</code>
			</div>
			<ol class="steps">
				<li>
					Shortcuts → <b>+</b>. In its settings (ⓘ), turn on <b>Show in Share Sheet</b> and pick URLs
					and Safari web pages.
				</li>
				<li>
					Add <b>Get Contents of URL</b>: <code>https://stash.app.haddow.me/api/save</code>, method
					POST, header <code>Authorization</code> = <code>Bearer</code> + your key, request body
					JSON with <code>url</code> = Shortcut Input.
				</li>
				<li>Add <b>Show Notification</b> with the Contents of URL, so you see what was saved.</li>
				<li>Name it “Save to Stash”.</li>
			</ol>
		{:else}
			{#if data.tokenCreatedAt}
				<p class="muted">You made a key on {formatDateTime(data.tokenCreatedAt)}.</p>
			{/if}
			<form method="POST" action="?/token" use:enhance>
				<button class="btn">{data.tokenCreatedAt ? 'Make a new key' : 'Make a key'}</button>
			</form>
		{/if}
	</section>

	{#if permission}
		<section class="group">
			<h2>Icon badge</h2>
			{#if permission === 'granted'}
				<p class="muted">The app icon shows how many feed entries are unread.</p>
			{:else if permission === 'denied'}
				<p class="muted">
					Notifications are off for Stash, so the app icon can't show the unread count. Turn them on
					in iOS Settings → Notifications → Stash.
				</p>
			{:else}
				<p class="muted">
					Show how many feed entries are unread on the app icon. iOS asks to allow notifications
					first; Stash doesn't send any.
				</p>
				<button class="btn" onclick={allow}>Show the unread count</button>
			{/if}
		</section>
	{/if}

	<section class="group">
		<h2>Experimental: look</h2>
		<p class="muted">Mock-ups of other designs, to try on this device. Classic is the real one.</p>
		<form method="POST" action="?/look">
			<fieldset class="segments">
				<legend class="sr">Look</legend>
				{#each looks as l (l.id)}
					<label>
						<input
							type="radio"
							name="look"
							value={l.id}
							checked={data.look === l.id}
							onchange={(e) => e.currentTarget.form?.requestSubmit()}
						/>
						{l.label}
					</label>
				{/each}
			</fieldset>
		</form>
		<p class="muted">{looks.find((l) => l.id === data.look)?.about}</p>
	</section>

	<form method="POST" action="/logout">
		<button class="btn danger">Sign out ({data.user?.name})</button>
	</form>
</main>

<style>
	.list a {
		display: flex;
		justify-content: space-between;
		padding: 14px 16px;
		text-decoration: none;
		font-weight: 700;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.note {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	code {
		font-size: 14px;
		overflow-wrap: anywhere;
	}
	.note code {
		user-select: all;
		font-weight: 700;
	}
	.steps {
		margin: 0;
		padding-left: 20px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 15px;
		line-height: 1.4;
	}
	.btn {
		width: 100%;
	}
	fieldset {
		margin: 0;
		border: 0;
		min-width: 0;
	}
</style>
