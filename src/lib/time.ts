// "5m", "3h", "2d", or a date for older things, as list rows show them.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Built once: making a formatter costs ~0.1 ms against Workers' ~10 ms of CPU.
const shortDate = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	timeZone: 'Europe/London'
});
const withYear = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	timeZone: 'Europe/London'
});
const dateTime = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'short',
	hour: '2-digit',
	minute: '2-digit',
	timeZone: 'Europe/London'
});

export function ago(iso: string, now = new Date()) {
	const then = new Date(iso);
	const ms = now.getTime() - then.getTime();
	if (ms < MIN) return 'now';
	if (ms < HOUR) return `${Math.floor(ms / MIN)}m`;
	if (ms < DAY) return `${Math.floor(ms / HOUR)}h`;
	if (ms < 7 * DAY) return `${Math.floor(ms / DAY)}d`;
	return (then.getFullYear() === now.getFullYear() ? shortDate : withYear).format(then);
}

/** "20 Oct, 14:05" (UK time), for sync logs. */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
