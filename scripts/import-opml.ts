// Turns an OPML export (Inoreader's) into SQL that adds its feeds (its folders are left out).
// Feeds already here are skipped. The cron fetches the new ones in turn; on
// each one's first fetch, everything already in it starts out read.
//
//   node scripts/import-opml.ts feeds.opml > /tmp/import.sql
//   wrangler d1 execute stash --remote --file /tmp/import.sql
import { readFileSync } from 'node:fs';
import { attr } from '../src/lib/server/parse.ts';

const xml = readFileSync(process.argv[2], 'utf8');
const sql = (s: string | null) => (s === null ? 'NULL' : `'${s.replaceAll("'", "''")}'`);

const now = new Date().toISOString();
const out: string[] = [];
let feeds = 0;
for (const [tag] of xml.matchAll(/<outline\b[^>]*>/g)) {
	const url = attr(tag, 'xmlUrl');
	if (!url) continue;
	const title = attr(tag, 'title') ?? attr(tag, 'text') ?? url;
	// "top scoring links : movies" reads better as r/movies.
	const sub = /reddit\.com\/r\/([\w-]+)/.exec(url)?.[1];
	out.push(
		`INSERT INTO feed (title, url, site_url, created_at) VALUES (` +
			`${sql(sub ? `r/${sub}` : title)}, ${sql(url)}, ${sql(attr(tag, 'htmlUrl'))}, ${sql(now)}` +
			`) ON CONFLICT (url) DO NOTHING;`
	);
	feeds++;
}
console.log(out.join('\n'));
console.error(`${feeds} feeds`);
