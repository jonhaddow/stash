import { applyAction, deserialize } from '$app/forms';
import { invalidateAll } from '$app/navigation';

/** Runs a page's form action without a form, as `use:enhance` would (swipes have no button). */
export async function act(action: string, fields: Record<string, string | number>) {
	const body = new FormData();
	for (const [name, value] of Object.entries(fields)) body.set(name, String(value));
	const res = await fetch(action, {
		method: 'POST',
		body,
		headers: { 'x-sveltekit-action': 'true' }
	});
	const result = deserialize(await res.text());
	if (result.type === 'success') await invalidateAll();
	await applyAction(result);
}
