// Turns an OPML export (Inoreader's) into SQL that adds its folders and feeds.
// Feeds already here are skipped. The cron fetches the new ones in turn; on
// each one's first fetch, everything already in it starts out read.
//
//   node scripts/import-opml.ts feeds.opml > /tmp/import.sql
//   wrangler d1 execute stash --remote --file /tmp/import.sql
import { readFileSync } from 'node:fs';

const xml = readFileSync(process.argv[2], 'utf8');
const decode = (s: string) =>
	s.replace(
		/&(amp|lt|gt|quot|apos|#39);/g,
		(_, e: string) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" })[e]!
	);
const attr = (tag: string, name: string) => {
	const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
	return m ? decode(m[1]) : null;
};
const sql = (s: string | null) => (s === null ? 'NULL' : `'${s.replaceAll("'", "''")}'`);

const now = new Date().toISOString();
const out: string[] = [];
let folder: string | null = null;
let folders = 0;
let feeds = 0;
// Outlines without an xmlUrl are folders; feeds inside one belong to it.
for (const [tag] of xml.matchAll(/<outline\b[^>]*>|<\/outline>/g)) {
	if (tag === '</outline>') {
		folder = null;
		continue;
	}
	const url = attr(tag, 'xmlUrl');
	const title = attr(tag, 'title') ?? attr(tag, 'text') ?? url;
	if (!url) {
		if (tag.endsWith('/>')) continue;
		folder = title;
		out.push(
			`INSERT INTO folder (name, sort_order) VALUES (${sql(folder)}, ${folders++}) ON CONFLICT (name) DO NOTHING;`
		);
		continue;
	}
	// "top scoring links : movies" reads better as r/movies.
	const sub = /reddit\.com\/r\/([\w-]+)/.exec(url)?.[1];
	out.push(
		`INSERT INTO feed (folder_id, title, url, site_url, created_at) VALUES (` +
			`${folder ? `(SELECT id FROM folder WHERE name = ${sql(folder)})` : 'NULL'}, ` +
			`${sql(sub ? `r/${sub}` : title)}, ${sql(url)}, ${sql(attr(tag, 'htmlUrl'))}, ${sql(now)}` +
			`) ON CONFLICT (url) DO NOTHING;`
	);
	feeds++;
}
console.log(out.join('\n'));
console.error(`${folders} folders, ${feeds} feeds`);
