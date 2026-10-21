# Roadmap

- **Imports**: Instapaper's CSV (unread to Later, the rest to the archive), as a one-off script like `scripts/import-opml.ts`, when Jon sends the export.
- **Open Reddit and Hacker News links in their apps** rather than Safari.
- Renaming, reordering and deleting folders (for now: move the feeds out).
- An unread count per feed on the Feeds list.
- **Reddit's signed-in API**, if retrying 429s isn't enough: its own quota rather than one shared with other Workers. Needs a registered Reddit app (if Reddit still approves personal ones), credentials in 1Password, and the JSON API instead of `.rss`.
