<script lang="ts">
	import type { LayoutProps } from './$types';
	import { beforeNavigate, invalidate } from '$app/navigation';
	import { page, updated } from '$app/state';
	// Served with the app (not Google Fonts): no extra connections before text shows.
	import '@fontsource-variable/manrope';
	import font from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url';
	import './app.css';
	import './looks.css';

	let { data, children }: LayoutProps = $props();

	const path = $derived(page.url.pathname);
	const tabs = $derived([
		{ href: '/', label: 'Later', icon: 'later', active: path === '/' },
		{ href: '/feeds', label: 'Feeds', icon: 'feeds', active: path === '/feeds' },
		{
			href: '/settings',
			label: 'Settings',
			icon: 'settings',
			active: path.startsWith('/settings') || path === '/archive'
		}
	]);

	// A new version was deployed: load it fully on the next tap.
	beforeNavigate(({ willUnload, to }) => {
		if (updated.current && !willUnload && to?.url) location.href = to.url.href;
	});

	// Coming back to the app from the background: if a new version was deployed
	// meanwhile, load it straight away; otherwise refresh the unread count.
	async function onVisible() {
		if (document.visibilityState !== 'visible') return;
		if (await updated.check()) location.reload();
		else if (data.user) void invalidate('app:unread');
	}

	// The unread count on the home-screen icon too. iOS shows it only once
	// notifications are allowed (Settings), and it changes only while the app is open.
	$effect(() => {
		if (!('setAppBadge' in navigator)) return;
		const set = data.unread ? navigator.setAppBadge(data.unread) : navigator.clearAppBadge();
		set.catch(() => {});
	});
</script>

<svelte:head>
	<link rel="preload" href={font} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<svelte:document onvisibilitychange={onVisible} />

<!-- An experimental look (Settings), if one's chosen: looks.css keys on this. -->
<div class="look" data-look={data.look === 'classic' ? undefined : data.look}>
	{@render children()}

	{#if data.user}
		<!-- Each tab's code loads straight away, so the first tap only waits for data. -->
		<nav class="tabs" aria-label="Main" data-sveltekit-preload-code="eager">
			{#each tabs as tab (tab.href)}
				<a href={tab.href} class:active={tab.active} aria-current={tab.active ? 'page' : undefined}>
					<span class="icon">
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							{#if tab.icon === 'later'}
								<!-- A bookmark. -->
								<path d="M7 3.5h10a1 1 0 0 1 1 1V21l-6-4-6 4V4.5a1 1 0 0 1 1-1Z" />
							{:else if tab.icon === 'feeds'}
								<!-- The RSS waves. -->
								<path d="M5 5a14 14 0 0 1 14 14M5 11a8 8 0 0 1 8 8" />
								<circle cx="6" cy="18" r="1.5" fill="currentColor" stroke="none" />
							{:else}
								<circle cx="12" cy="12" r="3" />
								<path
									d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"
								/>
							{/if}
						</svg>
						{#if tab.icon === 'feeds' && data.unread}
							<span class="badge">{data.unread > 99 ? '99+' : data.unread}</span>
						{/if}
					</span>
					<span class="label">{tab.label}</span>
					{#if tab.icon === 'feeds' && data.unread}
						<span class="sr">, {data.unread} unread</span>
					{/if}
				</a>
			{/each}
		</nav>
	{/if}
</div>

<style>
	/* A floating, frosted pill; the page scrolls under it. */
	nav {
		position: fixed;
		left: 50%;
		bottom: calc(12px + env(safe-area-inset-bottom));
		translate: -50% 0;
		width: min(calc(100% - 32px), 360px);
		height: var(--tabs);
		padding: 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--card) 78%, transparent);
		backdrop-filter: blur(20px) saturate(1.6);
		-webkit-backdrop-filter: blur(20px) saturate(1.6);
		border: 1px solid color-mix(in srgb, var(--ink) 8%, transparent);
		box-shadow: 0 8px 28px rgb(0 0 0 / 0.12);
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	nav a {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 2px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 700;
		color: var(--muted);
		text-decoration: none;
		transition:
			background-color 0.2s,
			color 0.2s;
	}
	.icon {
		position: relative;
		display: flex;
	}
	.icon svg {
		width: 24px;
		height: 24px;
	}
	nav a.active {
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 12%, transparent);
	}
	.badge {
		position: absolute;
		top: -5px;
		left: 14px;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		background: var(--accent);
		color: var(--on-accent);
		font-size: 11px;
		font-weight: 800;
		line-height: 18px;
		text-align: center;
	}
</style>
