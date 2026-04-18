ALTER TABLE "user_title" ADD COLUMN "season_episode_counts" jsonb;--> statement-breakpoint
ALTER TABLE "watch_event" ADD COLUMN "origin_event_id" text;--> statement-breakpoint
ALTER TABLE "watch_event" ADD CONSTRAINT "watch_event_origin_event_id_watch_event_id_fk" FOREIGN KEY ("origin_event_id") REFERENCES "public"."watch_event"("id") ON DELETE set null ON UPDATE no action;