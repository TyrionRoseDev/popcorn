CREATE TABLE "watch_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"media_type" text NOT NULL,
	"rating" integer,
	"note" text,
	"watched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_event_companion" (
	"id" text PRIMARY KEY NOT NULL,
	"watch_event_id" text NOT NULL,
	"friend_id" text,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watch_event" ADD CONSTRAINT "watch_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_event_companion" ADD CONSTRAINT "watch_event_companion_watch_event_id_watch_event_id_fk" FOREIGN KEY ("watch_event_id") REFERENCES "public"."watch_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_event_companion" ADD CONSTRAINT "watch_event_companion_friend_id_user_id_fk" FOREIGN KEY ("friend_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "watch_event_user_id_idx" ON "watch_event" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "watch_event_user_title_idx" ON "watch_event" USING btree ("user_id","tmdb_id","media_type");--> statement-breakpoint
CREATE INDEX "watch_event_watched_at_idx" ON "watch_event" USING btree ("watched_at");--> statement-breakpoint
CREATE INDEX "watch_event_companion_event_idx" ON "watch_event_companion" USING btree ("watch_event_id");