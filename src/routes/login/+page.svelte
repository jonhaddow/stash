<script lang="ts">
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Sign in · Stash</title>
</svelte:head>

<main class="login">
	<h1>Stash</h1>
	<p class="muted">Read it later, and your feeds.</p>

	{#if data.error}<p class="error" role="alert">{data.error}</p>{/if}

	<a class="btn primary" href="/auth/google?next={encodeURIComponent(data.next)}">
		<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
			<path
				fill="currentColor"
				d="M21.35 11.1H12v2.98h5.35c-.23 1.45-1.66 4.25-5.35 4.25-3.22 0-5.85-2.67-5.85-5.96S8.78 6.41 12 6.41c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.69 3.85 14.55 2.9 12 2.9 6.98 2.9 2.9 6.98 2.9 12s4.08 9.1 9.1 9.1c5.25 0 8.73-3.69 8.73-8.89 0-.6-.07-1.06-.15-1.51z"
			/>
		</svg>
		Sign in with Google
	</a>

	{#if data.devUsers.length}
		<form method="POST" action="?/dev" class="dev">
			<input type="hidden" name="next" value={data.next} />
			<p class="muted">Development only</p>
			{#each data.devUsers as u (u.email)}
				<button class="btn" name="email" value={u.email}>Sign in as {u.name}</button>
			{/each}
		</form>
	{/if}
</main>

<style>
	.login {
		max-width: 360px;
		margin: 0 auto;
		min-height: 100vh;
		min-height: 100dvh;
		padding: 24px 16px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 16px;
		text-align: center;
	}
	.dev {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 24px;
	}
	.dev p {
		font-size: 13px;
	}
</style>
