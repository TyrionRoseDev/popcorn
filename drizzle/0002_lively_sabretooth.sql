ALTER TABLE "watch_event" RENAME COLUMN "review_public" TO "visibility";--> statement-breakpoint
ALTER TABLE "watch_event" ALTER COLUMN "visibility" SET DATA TYPE text USING CASE WHEN "visibility"::text = 'true' THEN 'public' ELSE 'private' END;--> statement-breakpoint
ALTER TABLE "watch_event" ALTER COLUMN "visibility" SET DEFAULT 'public';--> statement-breakpoint
ALTER TABLE "watch_event" ALTER COLUMN "visibility" SET NOT NULL;