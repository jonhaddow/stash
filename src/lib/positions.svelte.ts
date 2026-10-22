import { page } from '$app/state';

// From the root layout's load.
const loaded = () => page.data as { positions?: Record<string, number> };

// Positions saved since the page loaded, over the loaded ones (`null`: finished).
const saved = $state<Record<string, number | null>>({});

/** Where a YouTube video was left in the player, in seconds, if it was. */
export function positionOf(video: string): number | null {
	return video in saved ? saved[video] : (loaded().positions?.[video] ?? null);
}

/** Saves where a video's got to; `null` forgets it once it's finished. */
export function savePosition(video: string, seconds: number | null) {
	saved[video] = seconds;
	// keepalive: this also runs as the app goes to the background.
	fetch('/api/position', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ video, seconds }),
		keepalive: true
	}).catch(() => {});
}
