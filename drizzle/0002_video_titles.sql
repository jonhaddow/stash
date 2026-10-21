-- Hacker News marks videos "[video]" in the title (kindOf). LIKE is case-insensitive for ASCII; [ ] aren't wildcards.
UPDATE `saved` SET `kind` = 'video' WHERE `title` LIKE '%[video]%';--> statement-breakpoint
UPDATE `item` SET `kind` = 'video' WHERE `title` LIKE '%[video]%';
