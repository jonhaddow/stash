import { defineConfig } from 'drizzle-kit';

// Only used to generate SQL migrations into ./drizzle; Wrangler applies them to D1
// (npm run db:migrate:local / db:migrate:remote).
export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'sqlite',
	verbose: true,
	strict: true
});
