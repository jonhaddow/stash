import { describe, expect, it } from 'vitest';
import { ago, formatDateTime } from './time.ts';

describe('ago', () => {
	const now = new Date('2026-10-20T12:00:00Z');
	it('counts minutes, hours and days', () => {
		expect(ago('2026-10-20T11:59:30Z', now)).toBe('now');
		expect(ago('2026-10-20T11:55:00Z', now)).toBe('5m');
		expect(ago('2026-10-20T09:00:00Z', now)).toBe('3h');
		expect(ago('2026-10-18T12:00:00Z', now)).toBe('2d');
	});
	it('shows a date for older things, with the year if not this one', () => {
		expect(ago('2026-09-01T12:00:00Z', now)).toBe('1 Sept');
		expect(ago('2025-09-01T12:00:00Z', now)).toBe('1 Sept 2025');
	});
});

describe('formatDateTime', () => {
	it('uses UK time', () => {
		expect(formatDateTime('2026-10-20T13:05:00Z')).toBe('20 Oct, 14:05');
	});
});
