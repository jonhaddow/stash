// Starts a Workers Build of a commit on main, unless Cloudflare already has one.
// Cloudflare sometimes misses or delays GitHub's push event after a merge, so
// scripts/wait-deploy.sh calls this when the commit isn't live after a minute.
// Usage: node scripts/start-build.ts <commit sha>, with CLOUDFLARE_API_TOKEN set.

const commit = process.argv[2];
const headers = {
	Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
	'Content-Type': 'application/json'
};

async function api(path: string, init: RequestInit = {}) {
	const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, { headers, ...init });
	const body = await res.json();
	if (!body.success) throw new Error(`${path}: ${JSON.stringify(body.errors)}`);
	return body.result;
}

const account = (await api('/accounts'))[0].id;
const script = (await api(`/accounts/${account}/workers/scripts`)).find(
	(s: { id: string }) => s.id === 'stash'
);
const builds = await api(`/accounts/${account}/builds/workers/${script.tag}/builds?per_page=10`);
if (
	builds.some(
		(b: { build_trigger_metadata?: { commit_hash?: string } }) =>
			b.build_trigger_metadata?.commit_hash === commit
	)
) {
	console.log(`build of ${commit.slice(0, 7)} already started`);
} else {
	const [trigger] = await api(`/accounts/${account}/builds/workers/${script.tag}/triggers`);
	// The commit hash, not just the branch: without it the build labels the version "main".
	await api(`/accounts/${account}/builds/triggers/${trigger.trigger_uuid}/builds`, {
		method: 'POST',
		body: JSON.stringify({ branch: 'main', commit_hash: commit })
	});
	console.log(`no build of ${commit.slice(0, 7)} from the merge, started one`);
}
