<script lang="ts">
	import { enhance } from '$app/forms';
	import { fromB64url } from '#lib/base64url.ts';
	import { formatDateTime } from '#lib/time.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// iOS shows the unread count on the app icon only once notifications are
	// allowed. Unset until mounted: there's no Notification on the server.
	let permission = $state<NotificationPermission>();
	$effect(() => {
		if ('Notification' in window && 'setAppBadge' in navigator) {
			permission = Notification.permission;
			if (permission === 'granted') void subscribe();
		}
	});

	async function allow() {
		permission = await Notification.requestPermission();
		if (permission !== 'granted') return;
		// The layout set the badge before it was allowed; set it again now.
		if (data.unread) void navigator.setAppBadge(data.unread);
		await subscribe();
	}

	// So the cron can update the count while the app is closed (Web Push). Sent
	// each time Settings opens, in case the server has dropped it.
	async function subscribe() {
		if (!data.vapidPublicKey || !('PushManager' in window)) return;
		const key = fromB64url(data.vapidPublicKey);
		const registration = await navigator.serviceWorker.ready;
		const sub =
			(await registration.pushManager.getSubscription()) ??
			(await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: key
			}));
		await fetch('/settings/push', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(sub)
		});
	}
</script>

<svelte:head>
	<title>Settings · Stash</title>
</svelte:head>

<main class="page">
	<h1>Settings</h1>

	<ul class="list">
		<li><a href="/settings/feeds">Feeds <span class="muted">›</span></a></li>
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
				<p class="muted">
					The app icon shows how many feed entries are unread, kept up to date by a quiet
					notification after each sync. Turn off its banners and lock screen in iOS Settings →
					Notifications → Stash.
				</p>
			{:else if permission === 'denied'}
				<p class="muted">
					Notifications are off for Stash, so the app icon can't show the unread count. Turn them on
					in iOS Settings → Notifications → Stash.
				</p>
			{:else}
				<p class="muted">
					Show how many feed entries are unread on the app icon. iOS asks to allow notifications
					first: each update comes as a notification, which you can keep quiet.
				</p>
				<button class="btn" onclick={allow}>Show the unread count</button>
			{/if}
		</section>
	{/if}

	<form method="POST" action="/logout">
		<button class="btn danger">Sign out ({data.user?.name})</button>
	</form>
</main>

<style>
	.list a {
		display: flex;
		justify-content: space-between;
		padding: 14px 0;
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
</style>
