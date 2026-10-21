// Experimental looks (Settings → Experimental): each is a set of overrides in
// routes/looks.css, keyed on data-look. "classic" is the app as designed.
export const looks = [
	{ id: 'classic', label: 'Classic', about: 'The app as it is.' },
	{
		id: 'desk',
		label: 'Desk',
		about: 'Edge-to-edge rows and a docked tab bar; on a laptop, a sidebar and a wider list.'
	},
	{
		id: 'magazine',
		label: 'Magazine',
		about: 'Big pictures on cards; on a laptop, a grid of them.'
	},
	{
		id: 'paper',
		label: 'Paper',
		about: 'A newspaper: serif headlines, hairline rules, no cards; tabs along the top on a laptop.'
	}
] as const;

export type Look = (typeof looks)[number]['id'];

export const toLook = (value: unknown): Look => looks.find((l) => l.id === value)?.id ?? 'classic';
