-- Made-up data for the end-to-end tests. Times are relative to now.
INSERT INTO user (email, name) VALUES ('alex@example.com', 'Alex');
INSERT INTO saved (url, title, kind, added_at) VALUES
	('https://blog.example/long-read', 'A long read about tea', 'article', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 hours')),
	('https://www.youtube.com/watch?v=abc', 'How to make bread', 'video', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 days')),
	-- Archived and brought back by later.spec.ts.
	('https://news.example/story', 'A news story', 'article', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-3 days'));
INSERT INTO saved (url, title, kind, added_at, archived_at) VALUES
	('https://old.example/', 'Something finished', 'article', '2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z');
-- Feeds at made-up addresses: the cron isn't running, and "Fetch now" fails, as it should.
INSERT INTO feed (title, url, site_url, last_fetched_at, last_status, created_at) VALUES
	('Bread Channel', 'https://feeds.invalid/bread.xml', 'https://www.youtube.com/@bread', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-10 minutes'), 'ok', '2026-10-01T00:00:00.000Z'),
	('Tea Blog', 'https://feeds.invalid/tea.xml', 'https://tea.example', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hours'), 'error', '2026-10-01T00:00:00.000Z');
UPDATE feed SET last_error = 'HTTP 503' WHERE id = 2;
INSERT INTO item (feed_id, guid, url, title, kind, published_at, read_at) VALUES
	(1, 'v1', 'https://www.youtube.com/watch?v=v1', 'Sourdough in a day', 'video', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-3 hours'), NULL),
	(1, 'v2', 'https://www.youtube.com/watch?v=v2', 'Bagels', 'video', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	(2, 't1', 'https://tea.example/oolong', 'All about oolong', 'article', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-5 hours'), NULL),
	(2, 't2', 'https://tea.example/green', 'Green tea, cold', 'article', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 days'), NULL);
INSERT INTO sync_log (feed_id, at, status, http_status, items_added, error, ms) VALUES
	(2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hours'), 'error', 503, 0, 'HTTP 503', 820),
	(2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 hours'), 'ok', 200, 2, NULL, 410);
-- Thumbnails (rows without one show just the title).
UPDATE saved SET image_url = '/icon-192.png' WHERE url = 'https://blog.example/long-read';
UPDATE item SET image_url = '/icon-192.png' WHERE guid = 't1';
